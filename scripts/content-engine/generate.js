/**
 * Content Engine — Article Generator
 * Full pipeline: brief → research → write → quality gate → images.
 * Resume-safe: checks topic status before each sub-step.
 *
 * Usage:
 *   node scripts/content-engine/generate.js [--dry-run] [--limit N] [--topic "id"]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  loadPipeline, savePipeline, getExistingArticles, ensureDirs, cliFlags,
  QUEUE_DIR, QUEUE_IMAGES_DIR, ARTICLES_DIR, LINK_TARGETS, AFFILIATE_TARGETS,
  resolveDeepLink,
  MODEL_BRIEF, MODEL_WRITE, MODEL_GATE, MODEL_RESEARCH, MODEL_ALT,
  SEO_THRESHOLD, AI_DETECTION_THRESHOLD, MAX_REWRITES,
  MIN_WORD_COUNT, MAX_WORD_COUNT,
} from './lib/config.js';
import { callModel, callModelJSON } from './lib/openrouter.js';
import { generateHeroImage, generateSectionImages } from './lib/gemini-image.js';
import { notifyFailed } from './lib/email.js';

const { dryRun, limit, topicId } = cliFlags();

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Content Engine: Generate Articles ===`);
  console.log(`  dry-run: ${dryRun}  limit: ${limit === Infinity ? 'none' : limit}\n`);

  ensureDirs();
  const pipeline = loadPipeline();
  const existingArticles = getExistingArticles();

  // Select topics to process
  let topics = pipeline.topics.filter(t =>
    ['discovered', 'briefed', 'researched', 'written', 'passed'].includes(t.status)
  );

  if (topicId) {
    topics = topics.filter(t => t.id === topicId);
    if (topics.length === 0) {
      console.log(`  Topic "${topicId}" not found or not in processable state`);
      return;
    }
  }

  // Sort by score descending, take limit
  topics.sort((a, b) => b.score - a.score);
  topics = topics.slice(0, limit);

  console.log(`  Processing ${topics.length} topics\n`);

  const stats = { generated: 0, passed: 0, failed: 0, failures: [] };

  for (const topic of topics) {
    console.log(`\n── ${topic.keyword} (${topic.id}) ──`);
    console.log(`  Status: ${topic.status}  Score: ${topic.score.toFixed(0)}  Type: ${topic.contentType}`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would process through full pipeline`);
      continue;
    }

    try {
      // A. Brief
      if (topic.status === 'discovered') {
        console.log('\n  Step 1: Generating brief...');
        topic.brief = await generateBrief(topic, existingArticles);
        // Normalize schemaType to lowercase to match Zod enum
        if (topic.brief.schemaType) topic.brief.schemaType = topic.brief.schemaType.toLowerCase();
        // Respect pre-seeded slug (e.g. WP migration) over brief's generated slug
        topic.articleSlug = topic._forcedSlug || topic.brief.slug;
        topic.status = 'briefed';
        savePipeline(pipeline);
        console.log(`  Brief complete: "${topic.brief.title}"`);
      }

      // A2. Intent gate — runs after brief, before expensive research/writing.
      // Compares the brief's H2 outline + FAQs against every existing article's
      // actual sections and FAQ questions. Catches intent overlap that discovery
      // missed because we now have much richer signal (full outline vs. just keyword).
      if (topic.status === 'briefed' && !topic.isRefresh) {
        console.log('\n  Step 1b: Intent overlap check...');
        const overlap = await checkIntentOverlap(topic, existingArticles, pipeline);
        if (overlap) {
          console.log(`  BLOCKED: intent overlaps with /${overlap.slug}/ — "${overlap.reason}"`);
          topic.status = 'skipped-intent-overlap';
          topic.failReason = `Intent overlap with /${overlap.slug}/: ${overlap.reason}`;
          savePipeline(pipeline);
          stats.failed++;
          stats.failures.push({ id: topic.id, reason: topic.failReason });
          continue;
        }
        console.log('  Intent check: PASSED (unique angle confirmed)');
      }

      // B. Research
      if (topic.status === 'briefed') {
        console.log('\n  Step 2: Researching...');
        const research = await conductResearch(topic);
        if (!research) {
          console.log('  BLOCKED: Research returned no citations. Keeping status "briefed".');
          continue;
        }
        topic.researchData = research;
        topic.status = 'researched';
        savePipeline(pipeline);
        console.log(`  Research complete: ${research.allCitations.length} citations found`);
      }

      // C. Write
      if (topic.status === 'researched') {
        console.log('\n  Step 3: Writing article...');
        const articleContent = (await writeArticle(topic, existingArticles)).trimStart();
        const articlePath = join(QUEUE_DIR, `${topic.articleSlug}.md`);
        writeFileSync(articlePath, articleContent);
        topic.status = 'written';
        savePipeline(pipeline);
        stats.generated++;
        console.log(`  Article written: ${articlePath}`);
      }

      // D. Quality Gate (with rewrite loop)
      if (topic.status === 'written') {
        console.log('\n  Step 4: Quality gate...');
        const passed = await runQualityGate(topic, pipeline);
        if (!passed) {
          stats.failed++;
          stats.failures.push({ id: topic.id, reason: topic.failReason });
          continue;
        }
      }

      // E. Images
      if (topic.status === 'passed') {
        console.log('\n  Step 5: Generating images...');
        await generateImages(topic);
        topic.status = 'staged';
        savePipeline(pipeline);
        stats.passed++;
        console.log(`  Staged: content-queue/${topic.articleSlug}.md`);
      }

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      topic.failReason = err.message;
      topic.status = 'failed';
      savePipeline(pipeline);
      stats.failed++;
      stats.failures.push({ id: topic.id, reason: err.message });
      await notifyFailed(topic.id, err.message);
    }
  }

  // Update timestamp
  pipeline.lastGenerationRun = new Date().toISOString();
  savePipeline(pipeline);

  // Summary
  const queueDepth = pipeline.topics.filter(t => t.status === 'staged').length;
  console.log(`\n=== Generation Summary ===`);
  console.log(`  Generated: ${stats.generated}  Passed: ${stats.passed}  Failed: ${stats.failed}`);
  console.log(`  Queue depth: ${queueDepth}`);
}

// ── A. Brief Generation ────────────────────────────────────────────────────────

async function generateBrief(topic, existingArticles) {
  const outlineGuide = getOutlineGuide(topic.contentType);
  const articleList = existingArticles.map(a => `- /${a.slug}/ (${a.title})`).join('\n');
  const linkTargets = LINK_TARGETS.map(t => `- /${t.slug}/ — ${t.patterns.join(', ')}`).join('\n');

  const systemPrompt = `You are an expert SEO content strategist for beachbride.com, a destination wedding planning website. Generate a structured content brief as JSON.

The site helps couples plan destination weddings in Cancun, Bali, Santorini, Hawaii, Jamaica, Punta Cana, Tulum, and Costa Rica. Revenue comes from: vendor lead generation (planners/photographers/florists/caterers/DJs), affiliate commissions (luxury resorts, engagement rings), and premium vendor directory listings.

Writing voice: warm, aspirational, and expert. Like a trusted friend who has planned hundreds of destination weddings. Never dry or clinical.`;

  const userPrompt = `Create a content brief for an article targeting: "${topic.keyword}"

Content type: ${topic.contentType}
Schema type: ${topic.schemaType}
${topic.isRefresh ? `This is a REFRESH of existing article: /${topic.existingSlug}/` : 'This is a NEW article.'}
${topic._wpContext ? `\nOriginal article context (improve and expand on this):\n${topic._wpContext}\n` : ''}${topic._editorialNotes ? `\nEDITORIAL NOTES — Pre-verified facts that MUST be incorporated accurately. Do not contradict these:\n${topic._editorialNotes}\n` : ''}

Outline structure for this content type:
${outlineGuide}

Existing articles on the site (for internal linking):
${articleList}

Link targets (link to these where relevant):
${linkTargets}

Return a JSON object with these fields:
{
  "slug": "kebab-case-url-slug",
  "title": "SEO-optimized title with keyword",
  "metaDescription": "140-165 char meta description",
  "targetWordCount": 1500-2500,
  "schemaType": "${topic.schemaType}",
  "h2Outline": ["H2 heading 1", "H2 heading 2", ...],
  "faqTopics": ["question 1?", "question 2?", ...],
  "internalLinkTargets": ["slug1", "slug2", ...],
  "externalSourceTypes": ["travel industry data", "wedding industry surveys", ...],
  "disclaimers": ["financial"],
  "relatedSlugs": ["existing-slug-1", "existing-slug-2", ...],
  "affiliateOpportunity": "Any relevant affiliate angle: hotels/resorts, jewelry/rings, travel insurance, wedding insurance, destination photography, guest activities, villas, car rental, honeymoon cruises, bridal gifts — or null if none fit naturally",
  "uniqueAngle": "What makes this article different from competitors",
  "sectionImageCount": 0
}

Rules:
- At least 50% of H2s should be phrased as questions
- Include 5-8 FAQ topics
- relatedSlugs must be real slugs from the existing articles list (3-5)
- disclaimers: always include "financial" for any cost/budget content; add "professional" for legal requirement content; add "referral" if recommending specific vendors or resorts
- slug should be concise and keyword-rich
- sectionImageCount: number of ADDITIONAL images beyond the hero. Use 0 for text-heavy articles (guides, checklists, how-tos, cost breakdowns, legal info, scripture). Use 2 for articles where readers expect to see visual examples (venue roundups, real wedding features, destination overviews, honeymoon destinations). Use 3 only for pure inspiration articles where every section benefits from a distinct visual (color palettes, cake designs, bouquet styles, nail looks, decor themes). Maximum is 3.`;

  return await callModelJSON(MODEL_BRIEF, systemPrompt, userPrompt, { temperature: 0.3, max_tokens: 2000 });
}

function getOutlineGuide(contentType) {
  const guides = {
    how_to: `1. Brief intro (why this destination wedding task matters and when to do it)
2. What you'll need / prerequisites
3. Step-by-step H2s (each step as a question where possible)
4. Common mistakes couples make
5. When to delegate to your local planner instead
6. FAQ section`,
    informational: `1. What is [topic]? (definition + why it matters for destination weddings)
2. What factors affect [topic]?
3. Destination-by-destination comparison where relevant
4. Practical guidance and real numbers
5. How BeachBride can help (quiz CTA)
6. FAQ section`,
    comparison: `1. What to look for when choosing
2. One H2 per option with honest assessment
3. Comparison table (data-driven with real numbers)
4. Our recommendation (with caveats and context)
5. FAQ section`,
    destination_vendor_guide: `1. Why hiring a local [vendor type] in [destination] matters (what goes wrong without one)
2. What to look for when vetting [vendor type]s in [destination] specifically (local expertise, legal knowledge, resort relationships)
3. Questions to ask before hiring — as a comparison table (question + why it matters + red flags)
4. How much does a [vendor type] cost in [destination]? (real price ranges by tier/service level, data table)
5. How to find vetted [vendor type]s in [destination] — link prominently to /vendors/[type]/[destination]/ directory page
6. Red flags: how to spot inexperienced or unreliable [vendor type]s
7. FAQ section`,
  };
  return guides[contentType] || guides.informational;
}

// ── A2. Intent Overlap Gate ───────────────────────────────────────────────
// Runs after brief generation (cheap — one Sonnet call) but before research
// (expensive — 10+ Perplexity calls) and writing (expensive — one Opus call).
// The brief gives us the full H2 outline, FAQ topics, and unique angle,
// which is 10x more signal than the keyword alone had at discovery time.

async function checkIntentOverlap(topic, existingArticles, pipeline) {
  const brief = topic.brief;
  if (!brief) return null;

  // Build rich inventory of what already exists
  const existingContent = existingArticles
    .map(a => {
      let entry = `/${a.slug}/ — "${a.title}"`;
      if (a.description) entry += `\n  Description: ${a.description}`;
      if (a.h2s?.length) entry += `\n  H2 sections: ${a.h2s.join(' | ')}`;
      if (a.faqQuestions?.length) entry += `\n  FAQs: ${a.faqQuestions.join(' | ')}`;
      return entry;
    })
    .join('\n\n');

  // Also check articles already in the queue (staged/passed) that haven't published yet
  const queuedContent = pipeline.topics
    .filter(t => ['briefed', 'researched', 'written', 'passed', 'staged'].includes(t.status) && t.id !== topic.id)
    .map(t => {
      let entry = `"${t.keyword}" (${t.status})`;
      if (t.brief?.title) entry += ` — "${t.brief.title}"`;
      if (t.brief?.h2Outline?.length) entry += `\n  H2 sections: ${t.brief.h2Outline.join(' | ')}`;
      if (t.brief?.faqTopics?.length) entry += `\n  FAQs: ${t.brief.faqTopics.join(' | ')}`;
      return entry;
    })
    .join('\n\n');

  // The candidate brief
  const candidateBrief = `Keyword: "${topic.keyword}"
Title: "${brief.title}"
Unique angle: ${brief.uniqueAngle || 'none specified'}
H2 outline: ${(brief.h2Outline || []).join(' | ')}
FAQ topics: ${(brief.faqTopics || []).join(' | ')}`;

  const result = await callModelJSON(MODEL_BRIEF,
    `You are an SEO cannibalization detector for beachbride.com, a destination wedding site. You prevent wasted content creation by catching intent overlap BEFORE expensive research and writing steps.

Your test: "If a searcher googled this candidate's keyword and landed on any existing article, would that article fully satisfy their query?" If yes, the candidate is redundant — the existing article already serves that intent, even if the keyword is worded differently.

Be strict. The cost of a false negative (wasted $5-$10 in API calls for a redundant article) is much higher than a false positive (skipping a marginally unique topic that can be re-evaluated later).`,
    `Does this candidate article overlap in search intent with any existing content?

CANDIDATE BRIEF:
${candidateBrief}

EXISTING PUBLISHED ARTICLES:
${existingContent}

${queuedContent ? `ARTICLES IN QUEUE (not yet published):
${queuedContent}` : ''}

Rules:
- If the candidate's H2 outline covers substantially the same ground as an existing article's H2 sections (>60% topical overlap), it's a duplicate intent.
- If the candidate's FAQs are already answered in an existing article's FAQs or body sections, it's a duplicate intent.
- A candidate with a genuinely distinct angle (different destination, different vendor type, different audience segment) is NOT overlap even if the broad topic is similar.

Return JSON:
- If NO overlap: { "overlaps": false }
- If overlap found: { "overlaps": true, "slug": "existing-article-slug", "reason": "specific explanation of the overlap" }`,
    { temperature: 0 }
  );

  if (result.overlaps) {
    // Strip any leading/trailing slashes the LLM may include in the slug
    const slug = (result.slug || '').replace(/^\/+|\/+$/g, '');
    return { slug, reason: result.reason };
  }
  return null;
}

// ── B. Research ────────────────────────────────────────────────────────────────

async function conductResearch(topic) {
  const brief = topic.brief;
  if (!brief?.h2Outline?.length) return null;

  const sections = [];
  let allCitations = [];

  for (const h2 of brief.h2Outline) {
    console.log(`    Researching: ${h2}`);

    const { text, citations } = await callModel(
      MODEL_RESEARCH,
      'You are a research assistant specializing in destination weddings, travel, and the wedding industry. Provide factual, well-sourced information with specific statistics and data points. Focus on authoritative sources (The Knot, WeddingWire, tourism boards, government travel advisories, travel industry reports).',
      `For an article about "${topic.keyword}" on a destination wedding website, research this section: "${h2}"

Provide:
- 3-5 key facts with specific numbers/statistics
- Source names and URLs for each fact
- Any relevant tourism board guidelines, legal requirements, or industry data
- Common misconceptions about this topic that couples have

Be specific. Use real data. Cite every claim.`,
      { temperature: 0.2, max_tokens: 2000 },
    );

    const sectionCitations = citations || [];
    allCitations.push(...sectionCitations);

    sections.push({
      h2,
      content: text,
      citations: sectionCitations,
    });

    // Rate limit between research calls
    await new Promise(r => setTimeout(r, 300));
  }

  // BLOCKING: require at least some citations
  if (allCitations.length === 0) {
    console.log('    No citations returned from any research query');
    return null;
  }

  return {
    sections,
    allCitations: [...new Set(allCitations)],
    conductedAt: new Date().toISOString(),
  };
}

// ── C. Article Writing ─────────────────────────────────────────────────────────

const DESTINATION_KEYWORDS = {
  'cancun': 'cancun', 'cancún': 'cancun', 'punta cana': 'punta-cana',
  'jamaica': 'jamaica', 'hawaii': 'hawaii', 'maui': 'hawaii', 'oahu': 'hawaii',
  'bali': 'bali', 'santorini': 'santorini', 'tulum': 'tulum',
  'costa rica': 'costa-rica', 'key west': 'key-west', 'los cabos': 'los-cabos',
  'cabo': 'los-cabos', 'st lucia': 'st-lucia', 'saint lucia': 'st-lucia',
  'riviera maya': 'riviera-maya', 'turks': 'turks-and-caicos', 'aruba': 'aruba',
  'amalfi': 'amalfi-coast', 'tuscany': 'tuscany', 'maldives': 'maldives',
  'fiji': 'fiji', 'dubrovnik': 'dubrovnik', 'algarve': 'algarve',
};

function detectTopicDestination(text) {
  for (const [keyword, slug] of Object.entries(DESTINATION_KEYWORDS)) {
    if (text.includes(keyword)) return slug;
  }
  return null;
}

async function writeArticle(topic, existingArticles) {
  const brief = topic.brief;
  const research = topic.researchData;

  const articleList = existingArticles.map(a => `- /${a.slug}/ — ${a.title}`).join('\n');
  const linkTargets = LINK_TARGETS.map(t => `- /${t.slug}/ — matches: ${t.patterns.join(', ')}`).join('\n');
  // Detect destination from topic keyword/title for deep link resolution
  const topicText = `${topic.keyword || ''} ${brief.title || ''}`.toLowerCase();
  const destinationSlug = detectTopicDestination(topicText);

  const affiliateTargets = brief.affiliateOpportunity
    ? AFFILIATE_TARGETS.map(t => {
        const resolved = resolveDeepLink(t, destinationSlug);
        return `- ${resolved.label}: key="${resolved.key}" | cta="${resolved.cardCta}" | title="${resolved.cardTitle}" | desc="${resolved.cardDesc}" | proof="${resolved.cardProof || ''}" | matches: ${t.patterns.join(', ')}`;
      }).join('\n')
    : '';

  const researchContext = research.sections.map(s =>
    `### ${s.h2}\n${s.content}\nSources: ${s.citations.join(', ')}`
  ).join('\n\n');

  // For refresh articles, load existing content
  let existingContent = '';
  if (topic.isRefresh && topic.existingSlug) {
    const existingPath = join(ARTICLES_DIR, `${topic.existingSlug}.md`);
    if (existsSync(existingPath)) {
      existingContent = readFileSync(existingPath, 'utf8');
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are an expert content writer for beachbride.com, a destination wedding planning website. Write warm, aspirational articles that help couples plan their dream destination wedding with confidence.

BRAND VOICE: Like a trusted friend who has planned hundreds of destination weddings. Expert but never intimidating. Warm and encouraging. Specific and actionable. Never vague or generic. Use second-person ("you", "your") to speak directly to couples. Occasionally "we" for BeachBride brand voice.

CRITICAL RULES:
- Every factual claim MUST cite a source from the research provided. Format: "According to [Source Name](URL), ..."
- Every number/statistic needs attribution
- Legal requirements must note that they change — "consult your local planner or the [country] embassy to confirm current requirements"
- Cost figures must include a disclaimer: "costs vary significantly based on season, guest count, and specific vendors"
- Affiliate promotions: Use styled affiliate cards (not inline links). Place 2-3 cards after relevant paragraphs using this exact HTML format:

<div class="affiliate-card not-prose">
<div class="affiliate-card-inner">
<span class="affiliate-card-label">We Recommend</span>
<p class="affiliate-card-title">TITLE</p>
<p class="affiliate-card-desc">DESCRIPTION</p>
<p class="affiliate-card-proof">PROOF</p>
<a class="affiliate-card-cta" href="/go/KEY" target="_blank" rel="sponsored nofollow noopener">CTA TEXT <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd"/></svg></a>
</div>
</div>

Replace TITLE, DESCRIPTION, PROOF, CTA TEXT, and KEY with values from the AFFILIATE TARGETS list below. The href is always "/go/KEY" where KEY is the affiliate key. The label is always "We Recommend". Only place cards where the product is genuinely relevant to the reader's need. Never place a card inside or immediately after an H2 heading. Never place a card in the first two sections of the article — let the reader get invested before showing recommendations.
- NEVER use: em-dashes (—), "game-changer", "seamlessly", "cutting-edge", "robust", "comprehensive", "In conclusion", "not just X but also Y", "It's worth noting", "In today's world", "dream wedding" (overused — use "your wedding" or "the wedding you've imagined")

STRUCTURE RULES:
- At least 50% of H2 headings must be questions
- Every question H2: first sentence is a 15-30 word direct answer (answer capsule), no links
- No links in the first paragraph after any H2
- Include at least 1 data/comparison table
- Include at least 3 statistics with cited sources
- ${MIN_WORD_COUNT}-${MAX_WORD_COUNT} words total
- End with a CTA to take the BeachBride quiz at /quiz/?stage=2 or /quiz/`;

  const userPrompt = `Write an article based on this brief and research.

BRIEF:
${JSON.stringify(brief, null, 2)}

RESEARCH (cite these sources):
${researchContext}

INTERNAL LINK TARGETS (link naturally on first mention):
${linkTargets}

${affiliateTargets ? `AFFILIATE TARGETS — place 2-3 affiliate cards using the HTML template from the rules above. Use the values below:
${affiliateTargets}

` : ''}EXISTING ARTICLES (for \`related\` frontmatter and context):
${articleList}

${existingContent ? `EXISTING ARTICLE TO REFRESH (improve, don't just rewrite):\n${existingContent}\n` : ''}${topic._editorialNotes ? `\nEDITORIAL NOTES — Pre-verified facts that MUST be incorporated accurately. Do not contradict these:\n${topic._editorialNotes}\n` : ''}
OUTPUT FORMAT: A complete markdown file starting with YAML frontmatter between --- delimiters.

Required frontmatter fields:
---
title: "${brief.title}"
description: "${brief.metaDescription}"
publishDate: ${today}
author: "BeachBride Editorial Team"
tags: [relevant, keyword, tags]
schemaType: "${brief.schemaType}"
${brief.schemaType === 'howto' ? 'howToSteps:\n  - name: "Step name"\n    text: "Step description"' : ''}
${brief.affiliateOpportunity ? 'affiliateDisclosure: true' : ''}
faqs:
  - question: "FAQ question?"
    answer: "Complete answer in 2-4 sentences."
related:
${(brief.relatedSlugs || []).map(s => `  - "${s}"`).join('\n')}
disclaimers:
${(brief.disclaimers || ['financial']).map(d => `  - "${d}"`).join('\n')}
---

After frontmatter, write the full article body in markdown. IMPORTANT rules:
- Do NOT include an H1 heading (# Title). The layout renders the title automatically from frontmatter.
- Start the body directly with the opening paragraph, then use H2 (##) headings for sections.
- Inline internal links: [descriptive text](/slug/) on first mention
- External source links from research
- At least one data table
- FAQ section is ONLY in frontmatter (don't repeat as H2 in body)
- End with a warm call-to-action linking to /quiz/ or /quiz/?stage=2

QUALITY CHECKLIST — your article will be scored on all 10 of these before publishing. Verify each before outputting:
[ ] 1. meta description is 140-165 characters (count carefully)
[ ] 2. target keyword "${topic.keyword}" appears in the title
[ ] 3. target keyword appears in the first paragraph
[ ] 4. target keyword (or a key word from it) appears in at least one H2 heading
[ ] 5. body contains >= 2 internal links using format [text](/slug/)
[ ] 6. body contains >= 1 external link to a source URL
[ ] 7. word count is between ${MIN_WORD_COUNT} and ${MAX_WORD_COUNT} words
[ ] 8. frontmatter faqs array has >= 3 entries
[ ] 9. body contains >= 3 cited sources (inline links to source URLs or "According to [Source](URL)" format)
[ ] 10. frontmatter related array has 3-5 slugs

AI DETECTION — your article will also be checked for these. Avoid them:
- Uniform sentence length (vary short/medium/long sentences deliberately)
- Em-dashes (—), "game-changer", "seamlessly", "cutting-edge", "robust", "comprehensive", "In conclusion", "delve", "leverage", "fostering", "empower", "navigate", "dream wedding"
- Throat-clearing openers: "It's worth noting", "In today's world", "not just X but also Y"

Do a final self-check against this list before outputting.`;

  const { text } = await callModel(MODEL_WRITE, systemPrompt, userPrompt, {
    temperature: 0.4,
    max_tokens: 8000,
  });

  return text;
}

// ── D. Quality Gate ────────────────────────────────────────────────────────────

async function runQualityGate(topic, pipeline) {
  const articlePath = join(QUEUE_DIR, `${topic.articleSlug}.md`);
  if (!existsSync(articlePath)) {
    topic.status = 'failed';
    topic.failReason = 'Article file not found in queue';
    return false;
  }

  const content = readFileSync(articlePath, 'utf8');
  const report = analyzeQuality(content, topic);

  topic.qualityReport = report;
  console.log(`    SEO: ${report.seoScore}%  AI Detection: ${report.aiScore}%  Factual: ${report.factualPass ? 'PASS' : 'FAIL'}`);

  const passes = report.seoScore >= SEO_THRESHOLD
    && report.aiScore <= AI_DETECTION_THRESHOLD
    && report.factualPass;

  if (passes) {
    topic.status = 'passed';
    savePipeline(pipeline);
    console.log('    Quality gate: PASSED');
    return true;
  }

  // Failed — try rewrite?
  if (topic.rewriteAttempts < MAX_REWRITES) {
    topic.rewriteAttempts++;
    console.log(`    Quality gate: FAILED. Rewrite attempt ${topic.rewriteAttempts}/${MAX_REWRITES}...`);

    const rewritten = (await rewriteArticle(content, report, topic)).trimStart();
    writeFileSync(articlePath, rewritten);
    savePipeline(pipeline);

    // Re-run gate
    return runQualityGate(topic, pipeline);
  }

  // Max rewrites exhausted
  topic.status = 'failed';
  topic.failReason = formatFailReason(report);
  savePipeline(pipeline);
  console.log(`    Quality gate: FAILED after ${MAX_REWRITES} rewrites. ${topic.failReason}`);
  await notifyFailed(topic.id, topic.failReason, report);
  return false;
}

function analyzeQuality(content, topic) {
  const fmMatch = content.trimStart().match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  const keyword = topic.keyword.toLowerCase();

  // ── SEO Checks (10 × 10 = 100) ──
  let seoPoints = 0;
  const seoDetails = [];

  // 1. Description length
  const descMatch = frontmatter.match(/description:\s*["']?(.+?)["']?\s*$/m);
  const desc = descMatch ? descMatch[1] : '';
  if (desc.length >= 140 && desc.length <= 165) { seoPoints += 10; }
  else { seoDetails.push(`description length: ${desc.length} (need 140-165)`); }

  // 2. Keyword in title
  const titleMatch = frontmatter.match(/title:\s*["']?(.+?)["']?\s*$/m);
  const title = (titleMatch ? titleMatch[1] : '').toLowerCase();
  if (title.includes(keyword) || keyword.split(' ').every(w => title.includes(w))) { seoPoints += 10; }
  else { seoDetails.push('keyword not in title'); }

  // 3. Keyword in first paragraph
  const firstPara = body.split('\n\n').find(p => p.trim() && !p.startsWith('#'))?.toLowerCase() || '';
  if (firstPara.includes(keyword) || keyword.split(' ').filter(w => w.length > 3).every(w => firstPara.includes(w))) { seoPoints += 10; }
  else { seoDetails.push('keyword not in first paragraph'); }

  // 4. Keyword in at least one H2
  const h2s = body.match(/^## .+/gm) || [];
  const h2Text = h2s.join(' ').toLowerCase();
  if (h2Text.includes(keyword) || keyword.split(' ').filter(w => w.length > 3).some(w => h2Text.includes(w))) { seoPoints += 10; }
  else { seoDetails.push('keyword not in any H2'); }

  // 5. >= 2 internal links
  const internalLinks = (body.match(/\]\(\//g) || []).length;
  if (internalLinks >= 2) { seoPoints += 10; }
  else { seoDetails.push(`only ${internalLinks} internal links (need 2+)`); }

  // 6. >= 1 external link
  const externalLinks = (body.match(/\]\(https?:\/\//g) || []).length;
  if (externalLinks >= 1) { seoPoints += 10; }
  else { seoDetails.push('no external links'); }

  // 7. Word count
  const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount >= MIN_WORD_COUNT && wordCount <= MAX_WORD_COUNT) { seoPoints += 10; }
  else { seoDetails.push(`word count: ${wordCount} (need ${MIN_WORD_COUNT}-${MAX_WORD_COUNT})`); }

  // 8. FAQs >= 3
  const faqCount = (frontmatter.match(/- question:/g) || []).length;
  if (faqCount >= 3) { seoPoints += 10; }
  else { seoDetails.push(`only ${faqCount} FAQs (need 3+)`); }

  // 9. >= 3 cited sources
  const citations = (body.match(/\[Source:|According to |according to /gi) || []).length;
  const sourceLinkCount = (body.match(/\[.+?\]\(https?:\/\/.+?\)/g) || []).length;
  const totalCites = Math.max(citations, sourceLinkCount);
  if (totalCites >= 3) { seoPoints += 10; }
  else { seoDetails.push(`only ${totalCites} citations (need 3+)`); }

  // 10. Related array 3-5
  const relatedCount = (frontmatter.match(/^\s+-\s+["'].+["']/gm) || []).length;
  const hasRelated = frontmatter.includes('related:');
  if (hasRelated && relatedCount >= 3) { seoPoints += 10; }
  else { seoDetails.push(`related array: ${relatedCount} entries (need 3-5)`); }

  // ── Factual Accuracy ──
  let factualPass = true;
  const factualDetails = [];

  // Check disclaimers present
  const hasDisclaimers = frontmatter.includes('disclaimers:');
  if (!hasDisclaimers) {
    factualPass = false;
    factualDetails.push('no disclaimers in frontmatter');
  }

  // Check for unverified superlatives
  const superlatives = body.match(/\b(most affordable|most popular destination|best resort|only option|cheapest way|most romantic|guaranteed)\b/gi) || [];
  if (superlatives.length > 3) {
    factualDetails.push(`unverified superlatives: ${superlatives.join(', ')}`);
    factualPass = false;
  }

  // ── AI Detection Heuristic ──
  const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 10);
  let patternCount = 0;

  const bannedPatterns = [
    /\u2014/g,                              // em-dash
    /game.changer/gi,
    /seamless(ly)?/gi,
    /cutting.edge/gi,
    /\brobust\b/gi,
    /\bcomprehensive\b/gi,
    /In conclusion/gi,
    /not just .+ but also/gi,
    /It'?s worth noting/gi,
    /In today'?s (world|age|landscape)/gi,
    /\bdelve\b/gi,
    /\bleverage\b/gi,
    /\bfostering?\b/gi,
    /\bnavigat(e|ing)\b/gi,
    /\bempowering?\b/gi,
    /dream wedding/gi,
  ];

  for (const pattern of bannedPatterns) {
    const matches = body.match(pattern);
    if (matches) patternCount += matches.length;
  }

  // Sentence length uniformity check
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((a, b) => a + (b - mean) ** 2, 0) / sentenceLengths.length;
  const cv = Math.sqrt(variance) / mean;
  const uniformityPenalty = cv < 0.15 ? 10 : 0;

  const aiScore = sentences.length > 0
    ? Math.round((patternCount * 3 + uniformityPenalty) / sentences.length * 100)
    : 0;

  return {
    seoScore: seoPoints,
    seoDetails,
    factualPass,
    factualDetails,
    aiScore,
    aiDetails: { patternCount, uniformityPenalty, cv: cv.toFixed(2), sentenceCount: sentences.length },
    wordCount,
    internalLinks,
    externalLinks,
    citations: totalCites,
  };
}

async function rewriteArticle(content, report, topic) {
  const issues = [];
  if (report.seoScore < SEO_THRESHOLD) {
    issues.push(`SEO score is ${report.seoScore}% (need ${SEO_THRESHOLD}%). Issues: ${report.seoDetails.join('; ')}`);
  }
  if (!report.factualPass) {
    issues.push(`Factual accuracy issues: ${report.factualDetails.join('; ')}`);
  }
  if (report.aiScore > AI_DETECTION_THRESHOLD) {
    issues.push(`AI detection score is ${report.aiScore}% (need <=${AI_DETECTION_THRESHOLD}%). Found ${report.aiDetails.patternCount} banned patterns. Make sentences more varied in length.`);
  }

  const systemPrompt = `You are rewriting a destination wedding article to fix specific quality issues. Preserve the good parts. Fix ONLY the identified problems. Output the complete corrected markdown file with frontmatter. Do NOT include an H1 (# Title) in the body — the title comes from frontmatter and is rendered by the layout.`;

  const userPrompt = `Fix these issues in the article below:

ISSUES TO FIX:
${issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')}

RESEARCH DATA (for adding missing citations):
${topic.researchData?.allCitations?.join('\n') || 'No additional citations available'}

ARTICLE:
${content}

Return the COMPLETE corrected markdown file starting with --- frontmatter.`;

  const { text } = await callModel(MODEL_WRITE, systemPrompt, userPrompt, {
    temperature: 0.3,
    max_tokens: 8000,
  });

  return text;
}

function formatFailReason(report) {
  const reasons = [];
  if (report.seoScore < SEO_THRESHOLD) reasons.push(`SEO ${report.seoScore}%`);
  if (!report.factualPass) reasons.push(`Factual: ${report.factualDetails.join(', ')}`);
  if (report.aiScore > AI_DETECTION_THRESHOLD) reasons.push(`AI detection ${report.aiScore}%`);
  return reasons.join('; ');
}

// ── E. Image Generation ────────────────────────────────────────────────────────

async function generateImages(topic) {
  const articlePath = join(QUEUE_DIR, `${topic.articleSlug}.md`);

  // Hero image (always)
  const heroResult = await generateHeroImage(
    topic.articleSlug,
    topic.brief.title,
    topic.keyword,
    QUEUE_IMAGES_DIR,
    topic.brief?.h2Outline || [],
  );

  if (heroResult) {
    if (existsSync(articlePath)) {
      let content = readFileSync(articlePath, 'utf8');
      if (!content.includes('heroImage:')) {
        const insertPoint = content.indexOf('\n---', 3);
        if (insertPoint > 0) {
          content = content.slice(0, insertPoint) + `\nheroImage: "/images/${topic.articleSlug}.jpg"` + content.slice(insertPoint);
          writeFileSync(articlePath, content);
        }
      }
    }
    console.log(`    Hero image ready. Alt: ${heroResult.altText}`);
  } else {
    console.log('    Hero image failed — article will publish without hero image');
  }

  // Section images: use LLM's brief judgement if available, fall back to keyword regex
  const briefCount = typeof topic.brief?.sectionImageCount === 'number' ? topic.brief.sectionImageCount : -1;
  const imageCount = briefCount >= 0
    ? Math.min(briefCount, 3)  // cap at 3 regardless of what LLM returns
    : (detectVisualIntent(topic.keyword) ? getSectionImageCount(topic.keyword) : 0);
  if (imageCount > 0) {
    console.log(`    ${briefCount >= 0 ? 'Brief' : 'Regex'}-detected visual intent — generating ${imageCount} section image(s)...`);
    const sectionResults = await generateSectionImages(
      topic.articleSlug,
      topic.brief.title,
      topic.brief?.h2Outline || [],
      QUEUE_IMAGES_DIR,
      imageCount,
    );
    if (sectionResults.length > 0 && existsSync(articlePath)) {
      insertSectionImagesIntoArticle(articlePath, sectionResults, topic.articleSlug);
      console.log(`    Inserted ${sectionResults.length} section image(s) into article body`);
    }
  }
}

// ── Visual Intent Detection ────────────────────────────────────────────────────
// Topics where users expect to see multiple images, not just one hero shot.
// Color palettes, cakes, florals, decor, nails, attire — all inspiration-driven.

const VISUAL_INTENT_PATTERNS = [
  /color[s]?|colour[s]?|palette[s]?/,
  /cake[s]?/,
  /bouquet[s]?|floral|flower[s]?/,
  /nail[s]?/,
  /decor|decoration[s]?|centerpiece[s]?/,
  /dress|gown|attire/,
  /shoe[s]?|sandal[s]?|heel[s]?/,
  /table[s]?cape|tablescape[s]?/,
  /invitation[s]?|stationery/,
  /favor[s]?/,
  /boutonniere[s]?/,
  /lighting|lantern[s]?/,
  /arch|arbor/,
  /hair|updo/,
];

function detectVisualIntent(keyword) {
  const kw = keyword.toLowerCase();
  return VISUAL_INTENT_PATTERNS.some(p => p.test(kw));
}

function getSectionImageCount(keyword) {
  const kw = keyword.toLowerCase();
  // Color palette articles warrant more — each palette deserves a visual
  if (/color[s]?|colour[s]?|palette[s]?/.test(kw)) return 3;
  return 2;
}

/**
 * Insert section image tags into article body at appropriate H2 positions.
 * Finds the matching H2 in the article and inserts the image immediately after it,
 * before the first line of body content for that section.
 */
function insertSectionImagesIntoArticle(articlePath, sectionResults, slug) {
  if (!sectionResults.length) return;
  let content = readFileSync(articlePath, 'utf8');

  // Work bottom-to-top so earlier insertions don't shift positions of later ones
  const reversed = [...sectionResults].reverse();

  for (const { h2, imageIndex, altText } of reversed) {
    // Escape special regex chars in the H2 heading text
    const escaped = h2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const h2Regex = new RegExp(`(^## ${escaped}[^\n]*\n)`, 'm');
    const imgTag = `\n![${altText || h2}](/images/${slug}-${imageIndex}.jpg)\n`;
    if (h2Regex.test(content)) {
      content = content.replace(h2Regex, `$1${imgTag}`);
    }
  }

  writeFileSync(articlePath, content);
}

// ── Run ────────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
