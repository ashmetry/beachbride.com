/**
 * Content Engine — Topic Discovery
 * Queries GSC strike zone + DataForSEO ranked keywords, scores and deduplicates.
 *
 * Usage:
 *   node scripts/content-engine/discover.js [--dry-run] [--limit N]
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { google } from 'googleapis';
import https from 'https';
import {
  env, ARTICLES_DIR, loadPipeline, savePipeline,
  getExistingArticles, cliFlags, MODEL_BRIEF,
} from './lib/config.js';
import { callModelJSON } from './lib/openrouter.js';

// ── Article word count cache ───────────────────────────────────────────────────
// Used to boost refresh scoring for thin articles
function buildWordCountMap(existingArticles) {
  const map = {};
  for (const a of existingArticles) {
    try {
      const mdxPath = join(ARTICLES_DIR, `${a.slug}.mdx`);
      const mdPath = join(ARTICLES_DIR, `${a.slug}.md`);
      const filePath = existsSync(mdxPath) ? mdxPath : mdPath;
      if (!existsSync(filePath)) continue;
      const raw = readFileSync(filePath, 'utf8');
      const body = raw.replace(/^---[\s\S]*?---\n/, '');
      map[a.slug] = body.trim().split(/\s+/).length;
    } catch {
      // skip
    }
  }
  return map;
}

const { dryRun, limit } = cliFlags();

// ── Main ───────────────────────────────────────────────────────────────────────

// How many undiscovered topics to keep in reserve before skipping fetch.
// At 3 articles/week generated, 20 = ~7 weeks runway.
const DISCOVERY_QUEUE_THRESHOLD = 20;

async function main() {
  console.log(`\n=== Content Engine: Discover Topics ===`);
  console.log(`  dry-run: ${dryRun}  limit: ${limit === Infinity ? 'none' : limit}\n`);

  const pipeline = loadPipeline();
  const existingArticles = getExistingArticles();
  const existingSlugs = new Set(existingArticles.map(a => a.slug));
  const pipelineKeywords = new Set(pipeline.topics.filter(t => t.keyword).map(t => normalizeKeyword(t.keyword)));
  // Build a set of pipeline IDs so slug-based dedup catches what keyword-normalization misses
  const pipelineIds = new Set(pipeline.topics.map(t => t.id));
  // Persistent blacklist: keywords previously rejected by the semantic overlap LLM.
  // Checked before any LLM call so we never re-evaluate the same keyword twice.
  if (!pipeline.rejectedKeywords) pipeline.rejectedKeywords = [];
  const rejectedKeywords = new Set(pipeline.rejectedKeywords);

  // Build word count map for thin-content refresh boosting
  const wordCountMap = buildWordCountMap(existingArticles);
  const thinSlugs = new Set(
    Object.entries(wordCountMap)
      .filter(([, wc]) => wc < 1500)
      .map(([slug]) => slug)
  );
  if (thinSlugs.size > 0) {
    console.log(`  Thin articles detected (< 1500w): ${[...thinSlugs].join(', ')}`);
  }

  // Skip expensive fetches if we already have enough topics queued.
  // The LLM semantic filter still runs to classify any candidates that made it
  // through previous dedup checks but haven't been evaluated yet.
  const discoveredCount = pipeline.topics.filter(t => t.status === 'discovered').length;
  if (discoveredCount >= DISCOVERY_QUEUE_THRESHOLD && !dryRun) {
    console.log(`  Queue has ${discoveredCount} discovered topics (threshold: ${DISCOVERY_QUEUE_THRESHOLD}) — skipping fetch.\n`);
    console.log('  Nothing to do.');
    return;
  }
  console.log(`  Queue depth: ${discoveredCount} discovered topics — fetching new candidates.\n`);

  let candidates = [];

  // 1. GSC strike zone
  try {
    const gscTopics = await fetchGSCStrikeZone();
    console.log(`  GSC: ${gscTopics.length} strike zone keywords found`);
    candidates.push(...gscTopics);
  } catch (err) {
    console.log(`  GSC error: ${err.message}`);
  }

  // 2. DataForSEO ranked keywords (our own site)
  try {
    const dfsTopics = await fetchDataForSEOKeywords();
    console.log(`  DataForSEO: ${dfsTopics.length} ranked keywords found`);
    candidates.push(...dfsTopics);
  } catch (err) {
    console.log(`  DataForSEO error: ${err.message}`);
  }

  // 3. Competitor keyword gap — keywords top competitors rank for that we don't
  try {
    const gapTopics = await fetchCompetitorKeywordGap();
    console.log(`  Competitor gap: ${gapTopics.length} new keyword opportunities found`);
    candidates.push(...gapTopics);
  } catch (err) {
    console.log(`  Competitor gap error: ${err.message}`);
  }

  // 3. Deduplicate + score + classify
  const newTopics = [];
  const seen = new Set();
  let skipped = 0;
  let refreshes = 0;

  for (const c of candidates) {
    if (newTopics.length >= limit) break;

    const normalized = normalizeKeyword(c.keyword);
    if (seen.has(normalized) || pipelineKeywords.has(normalized) || rejectedKeywords.has(normalized)) {
      skipped++;
      continue;
    }
    seen.add(normalized);

    // Guard: skip if the slug generated from this keyword already exists as a published
    // article on disk OR as any pipeline topic. This catches articles that were created
    // outside the pipeline (manual imports, WP migrations) which have no pipeline entry
    // and therefore no keyword to match against.
    const topicId = slugify(c.keyword);
    if (existingSlugs.has(topicId) || pipelineIds.has(topicId)) {
      skipped++;
      continue;
    }

    // Check cannibalization against existing articles
    const isRefresh = checkCannibalization(c, existingSlugs);

    const topic = {
      id: topicId,
      keyword: c.keyword,
      secondaryKeywords: [],
      status: 'discovered',
      score: scoreTopic(c, isRefresh, wordCountMap),
      contentType: detectContentType(c.keyword),
      schemaType: detectSchemaType(c.keyword),
      isRefresh: isRefresh.refresh,
      existingSlug: isRefresh.slug || null,
      brief: null,
      researchData: null,
      qualityReport: null,
      rewriteAttempts: 0,
      failReason: null,
      discoveredAt: new Date().toISOString().slice(0, 10),
      publishedAt: null,
      articleSlug: null,
      // Raw data from source
      _source: {
        impressions: c.impressions || 0,
        clicks: c.clicks || 0,
        position: c.position || 0,
        volume: c.volume || 0,
        cpc: c.cpc || 0,
        difficulty: c.difficulty || 0,
        currentPageUrl: c.currentPageUrl || null,
        source: c.source,
      },
    };

    if (isRefresh.refresh) refreshes++;
    newTopics.push(topic);
  }

  // Sort by score descending
  newTopics.sort((a, b) => b.score - a.score);

  // 4a. Semantic overlap check — filter candidates against existing published articles.
  // Returns both the kept topics and the normalized keywords of rejected ones.
  // Rejected keywords are persisted to pipeline.rejectedKeywords so future runs skip
  // them deterministically without re-calling the LLM.
  let filtered = newTopics;
  let newlyRejectedKeywords = [];
  if (newTopics.length > 0) {
    console.log(`\n  Checking semantic overlap vs. existing articles...`);
    ({ filtered, rejectedNormalized: newlyRejectedKeywords } = await filterSemanticOverlap(newTopics, existingArticles, pipeline.topics));
    const removed = newTopics.length - filtered.length;
    if (removed > 0) {
      console.log(`    Removed ${removed} topics that overlap with existing content`);
    }
  }

  // 4b. Intra-batch dedup — remove candidates that serve the same search intent as
  // OTHER candidates in this same batch. This prevents intent clusters from polluting
  // the pipeline queue (e.g. 5 "beach wedding songs" variants all passing step 4a
  // because none overlap with published articles, only to waste generate runs later).
  // Keeps the highest-scored representative from each intent cluster.
  if (filtered.length > 1) {
    console.log(`\n  Deduplicating within batch (${filtered.length} candidates)...`);
    const { deduped, intraBatchRejected } = await filterIntraBatchDuplicates(filtered);
    const intraBatchRemoved = filtered.length - deduped.length;
    if (intraBatchRemoved > 0) {
      console.log(`    Removed ${intraBatchRemoved} intra-batch duplicates`);
      // Add intra-batch rejected keywords to blacklist so future discovery skips them
      for (const kw of intraBatchRejected) {
        if (!newlyRejectedKeywords.includes(kw)) newlyRejectedKeywords.push(kw);
      }
    }
    filtered = deduped;
  }

  console.log(`\n  Results:`);
  console.log(`    New topics: ${filtered.length}`);
  console.log(`    Skipped (keyword duplicates or blacklist): ${skipped}`);
  console.log(`    Skipped (semantic overlap): ${newTopics.length - filtered.length}`);
  console.log(`    Blacklist size: ${rejectedKeywords.size + newlyRejectedKeywords.length} keywords`);
  console.log(`    Refresh candidates: ${refreshes}`);

  if (filtered.length > 0) {
    console.log(`\n  Top topics:`);
    for (const t of filtered.slice(0, 10)) {
      const src = t._source?.source || '';
      const srcLabel = src.startsWith('gap:') ? ` via ${src.replace('gap:', '')}` : src === 'gsc' ? ' [GSC]' : '';
      console.log(`    [${t.score.toFixed(0)}] ${t.keyword} (${t.contentType}${t.isRefresh ? ', REFRESH' : ''}${srcLabel})`);
    }
  }

  if (!dryRun) {
    if (filtered.length > 0) pipeline.topics.push(...filtered);
    // Persist newly rejected keywords to blacklist — dedupe against existing entries
    if (newlyRejectedKeywords.length > 0) {
      const existing = new Set(pipeline.rejectedKeywords);
      for (const kw of newlyRejectedKeywords) {
        if (!existing.has(kw)) pipeline.rejectedKeywords.push(kw);
      }
    }
    if (filtered.length > 0 || newlyRejectedKeywords.length > 0) {
      pipeline.lastDiscoveryRun = new Date().toISOString();
      savePipeline(pipeline);
      console.log(`\n  Saved ${filtered.length} topics, ${newlyRejectedKeywords.length} new blacklist entries`);
    }
  } else {
    console.log(`\n  [DRY RUN] Would save ${filtered.length} topics, ${newlyRejectedKeywords.length} blacklist entries`);
  }
}

// ── GSC Strike Zone ────────────────────────────────────────────────────────────

async function fetchGSCStrikeZone() {
  let keyData;

  // CI: base64-encoded key in env
  if (env.GSC_SERVICE_ACCOUNT_KEY) {
    keyData = JSON.parse(Buffer.from(env.GSC_SERVICE_ACCOUNT_KEY, 'base64').toString());
  }
  // Local: key file path
  else if (env.GSC_KEY_PATH && existsSync(env.GSC_KEY_PATH)) {
    keyData = JSON.parse(readFileSync(env.GSC_KEY_PATH, 'utf8'));
  }
  // Fallback: default local path
  else {
    const defaultPath = 'C:/Users/ash/.claude/search-console-key.json';
    if (!existsSync(defaultPath)) {
      throw new Error('No GSC service account key found');
    }
    keyData = JSON.parse(readFileSync(defaultPath, 'utf8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const res = await sc.searchanalytics.query({
    siteUrl: 'sc-domain:beachbride.com',
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit: 500,
    },
  });

  const rows = res.data?.rows || [];

  // Filter: strike zone (position 8-50, impressions >= 10)
  return rows
    .filter(r => r.position >= 8 && r.position <= 50 && r.impressions >= 10)
    .map(r => ({
      keyword: r.keys[0],
      currentPageUrl: r.keys[1],
      impressions: r.impressions,
      clicks: r.clicks,
      position: r.position,
      volume: r.impressions * 4, // Rough estimate: impressions over 90 days → monthly
      cpc: 0,
      difficulty: Math.min(r.position * 1.2, 100),
      source: 'gsc',
    }));
}

// ── DataForSEO Ranked Keywords ─────────────────────────────────────────────────

async function fetchDataForSEOKeywords() {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    throw new Error('DataForSEO credentials not set');
  }

  const authStr = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString('base64');

  // DataForSEO supports up to 100 tasks per request
  const data = await new Promise((resolve, reject) => {
    const body = JSON.stringify([{
      target: 'beachbride.com',
      location_code: 2840, // US
      language_code: 'en',
      limit: 100,
    }]);

    const req = https.request({
      hostname: 'api.dataforseo.com',
      path: '/v3/dataforseo_labs/google/ranked_keywords/live',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authStr}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const items = data.tasks?.[0]?.result?.[0]?.items || [];

  return items
    .filter(item => item.keyword_data?.keyword)
    .map(item => ({
      keyword: item.keyword_data.keyword,
      currentPageUrl: item.ranked_serp_element?.serp_item?.relative_url
        ? `https://beachbride.com${item.ranked_serp_element.serp_item.relative_url}`
        : null,
      impressions: 0,
      clicks: 0,
      position: item.ranked_serp_element?.serp_item?.rank_absolute || 100,
      volume: item.keyword_data.keyword_info?.search_volume || 0,
      cpc: item.keyword_data.keyword_info?.cpc || 0,
      difficulty: item.keyword_data.keyword_info?.competition_level === 'HIGH' ? 70
        : item.keyword_data.keyword_info?.competition_level === 'MEDIUM' ? 50 : 30,
      source: 'dataforseo',
    }));
}

// ── Competitor Keyword Gap ─────────────────────────────────────────────────────
// Finds keywords that top destination wedding competitors rank for but
// beachbride.com does not — the core of proactive topic discovery.
//
// Competitors chosen for maximum signal/noise ratio:
//   - destinationweddingdetails.com — #1 destination wedding content site, pure niche
//   - destify.com — exact same model (lead gen + content), high-intent keywords
//   - junebugweddings.com — large library, strong destination wedding section
//   - destinationido.com — similar audience + vendor directory model
//   - destinationweddings.com — commercial-intent destination wedding planning
//
// We use DataForSEO's keyword_intersection endpoint: for each competitor, fetch
// keywords they rank for in positions 1-30 that beachbride.com does NOT rank
// for at all. Filter to destination/beach wedding relevance before returning.

const COMPETITORS = [
  'destinationweddingdetails.com',
  'destify.com',
  'junebugweddings.com',
  'destinationido.com',
  'destinationweddings.com',
];

// Keywords containing these terms are almost certainly irrelevant to beachbride.com
// (vendor-side content, local wedding content, fashion, registry, etc.)
const GAP_EXCLUDE_PATTERNS = [
  /\bphotographer\b.*\b(tips|business|clients|portfolio|pricing|career|marketing)\b/i,
  /\bvendor\b.*\b(business|marketing|tips|get clients)\b/i,
  /\bwedding dress\b|\bbridal gown\b|\bbridesmaids dress\b/i,
  /\bwedding cake\b.*\b(recipe|bake|make)\b/i,
  /\bwedding registry\b/i,
  /\bengagement party\b|\bbridal shower\b(?!.*beach)/i,
  /\bwedding invitation\b.*\b(design|template|wording)\b/i,
  /\blocal wedding\b|\bhometown wedding\b/i,
];

// Must contain at least one of these to be considered destination/beach relevant
const GAP_REQUIRE_PATTERNS = [
  /destination wedding/i,
  /beach wedding/i,
  /\b(cancun|bali|santorini|hawaii|jamaica|punta cana|tulum|costa rica|los cabos|cabo|maldives|fiji|amalfi|tuscany|mexico|caribbean|bahamas|barbados|aruba|st lucia|turks|riviera maya)\b/i,
  /\b(elope|elopement)\b/i,
  /wedding abroad|marry abroad|married abroad|getting married in/i,
  /all.inclusive wedding|resort wedding|villa wedding/i,
  /outdoor wedding|tropical wedding|intimate wedding/i,
];

async function fetchCompetitorKeywordGap() {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    throw new Error('DataForSEO credentials not set');
  }

  const authStr = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString('base64');

  // Batch all competitors in a single request — DataForSEO supports up to 100 tasks
  // Each task: get ranked keywords for one competitor (positions 1-30, limit 200)
  const tasks = COMPETITORS.map(competitor => ({
    target: competitor,
    location_code: 2840, // US
    language_code: 'en',
    limit: 200,
    filters: [
      ['ranked_serp_element.serp_item.rank_absolute', '<=', 30],
    ],
  }));

  const data = await new Promise((resolve, reject) => {
    const body = JSON.stringify(tasks);
    const req = https.request({
      hostname: 'api.dataforseo.com',
      path: '/v3/dataforseo_labs/google/ranked_keywords/live',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authStr}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  // Collect all keywords across competitors, dedupe by keyword text
  const keywordMap = new Map();

  for (let i = 0; i < COMPETITORS.length; i++) {
    const items = data.tasks?.[i]?.result?.[0]?.items || [];
    const competitor = COMPETITORS[i];

    for (const item of items) {
      const kw = item.keyword_data?.keyword;
      if (!kw) continue;

      // Relevance filter — must match at least one require pattern, none of the exclude patterns
      const relevant = GAP_REQUIRE_PATTERNS.some(p => p.test(kw));
      const excluded = GAP_EXCLUDE_PATTERNS.some(p => p.test(kw));
      if (!relevant || excluded) continue;

      // Keep the entry with the highest search volume if seen from multiple competitors
      const volume = item.keyword_data.keyword_info?.search_volume || 0;
      const existing = keywordMap.get(kw);
      if (!existing || volume > existing.volume) {
        keywordMap.set(kw, {
          keyword: kw,
          volume,
          position: item.ranked_serp_element?.serp_item?.rank_absolute || 30,
          cpc: item.keyword_data.keyword_info?.cpc || 0,
          difficulty: item.keyword_data.keyword_info?.competition_level === 'HIGH' ? 70
            : item.keyword_data.keyword_info?.competition_level === 'MEDIUM' ? 50 : 30,
          competitor,
        });
      }
    }
  }

  // Convert to candidate format — no currentPageUrl since beachbride doesn't rank for these
  return [...keywordMap.values()].map(k => ({
    keyword: k.keyword,
    currentPageUrl: null, // we don't rank for these — that's the point
    impressions: 0,
    clicks: 0,
    position: 999, // signals "not ranking" for scoring purposes
    volume: k.volume,
    cpc: k.cpc,
    difficulty: k.difficulty,
    source: `gap:${k.competitor}`,
  }));
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreTopic(candidate, isRefresh = { refresh: false, slug: null }, wordCountMap = {}) {
  const volume = candidate.volume || 1;
  const difficulty = candidate.difficulty || 50;
  const intentMultiplier = getIntentMultiplier(candidate.keyword);
  const winProbability = (100 - difficulty) / 100;

  let score = volume * intentMultiplier * winProbability;

  // Normalize to roughly 0-100 range
  score = Math.min(Math.log10(Math.max(score, 1)) * 20, 100);

  // Bonus: already ranking (strike zone) — easier to push up
  if (candidate.position > 0 && candidate.position <= 50) {
    score += 15;
  }

  // Bonus: competitor gap keyword — validated demand (competitor ranks for it),
  // no existing competition from our own pages, pure net-new opportunity
  if (candidate.source?.startsWith('gap:')) {
    score += 10;
  }

  // Bonus: high CPC = commercial intent
  if (candidate.cpc > 5) score += 10;
  else if (candidate.cpc > 2) score += 5;

  // Bonus: refresh of a thin article — higher ROI than publishing something new
  // because the existing page already has some authority, internal links, and indexing
  if (isRefresh.refresh && isRefresh.slug) {
    const wc = wordCountMap[isRefresh.slug] || 9999;
    if (wc < 1000) score += 25;       // severely thin — top priority
    else if (wc < 1500) score += 15;  // below minimum threshold
    else if (wc < 2000) score += 8;   // could be improved
  }

  return Math.min(score, 100);
}

function getIntentMultiplier(keyword) {
  const kw = keyword.toLowerCase();
  // High commercial intent — couples actively planning or ready to book
  const commercial = ['cost', 'price', 'package', 'all-inclusive', 'resort', 'book', 'hire', 'best', 'top', 'cheap', 'affordable', 'luxury', 'budget'];
  // Transactional — looking to take action
  const transactional = ['plan', 'planning', 'planner', 'checklist', 'guide', 'tips', 'how to', 'photographer', 'florist', 'venue'];

  if (commercial.some(w => kw.includes(w))) return 1.5;
  if (transactional.some(w => kw.includes(w))) return 1.3;
  return 1.0;
}

// ── Content Type Detection ─────────────────────────────────────────────────────

function detectContentType(keyword) {
  const kw = keyword.toLowerCase();
  if (/\bhow to\b|step.by.step|\bways to\b|\btutorial\b|\bchecklist\b|\bplanning\b|\btimeline\b/.test(kw)) return 'how_to';
  if (/\bbest\b|\btop \d|\breview|\bvs\b|\bversus\b|\bcompare\b/.test(kw)) return 'comparison';
  if (/\bwhat is\b|\bwhat are\b|\bdefin|\bmean\b/.test(kw)) return 'informational';
  if (/\bcost\b|\bprice\b|\bhow much\b|\bbudget\b|\bpackage\b/.test(kw)) return 'informational';
  return 'informational';
}

function detectSchemaType(keyword) {
  const ct = detectContentType(keyword);
  if (ct === 'how_to') return 'howto';
  if (ct === 'comparison') return 'review';
  return 'article';
}

// ── Cannibalization Check ──────────────────────────────────────────────────────

function checkCannibalization(candidate, existingSlugs) {
  if (!candidate.currentPageUrl) return { refresh: false, slug: null };

  // Extract slug from URL
  const match = candidate.currentPageUrl.match(/beachbride\.com\/([^/]+)\/?$/);
  if (!match) return { refresh: false, slug: null };

  const slug = match[1];
  // Refresh if ranking in strike zone OR if the article exists but is thin
  // (thin articles get a score boost via scoreTopic regardless of current rank)
  if (existingSlugs.has(slug)) {
    return { refresh: true, slug };
  }
  return { refresh: false, slug: null };
}

// ── Semantic Overlap Filter ────────────────────────────────────────────────────

async function filterSemanticOverlap(candidates, existingArticles, pipelineTopics) {
  if (candidates.length === 0) return candidates;

  // Build rich context: existing articles with H2s and FAQs so the LLM can
  // judge search intent, not just titles. A searcher who wants "how much does
  // a beach wedding cost in Cancun" might be fully served by an article titled
  // "Destination Wedding Cost Breakdown" if its H2s cover per-destination pricing.
  const existingContent = existingArticles
    .map(a => {
      let entry = `- /${a.slug}/ — "${a.title}"`;
      if (a.description) entry += `\n    Description: ${a.description}`;
      if (a.h2s?.length) entry += `\n    Sections: ${a.h2s.join(' | ')}`;
      if (a.faqQuestions?.length) entry += `\n    FAQs: ${a.faqQuestions.join(' | ')}`;
      return entry;
    })
    .join('\n');

  const pipelineContent = pipelineTopics
    .filter(t => t.keyword && ['discovered', 'briefed', 'researched', 'written', 'passed', 'staged', 'published', 'skipped-intent-overlap'].includes(t.status))
    .map(t => {
      let entry = `- "${t.keyword}" (${t.status})`;
      if (t.brief?.title) entry += ` — "${t.brief.title}"`;
      if (t.brief?.h2Outline?.length) entry += `\n    Sections: ${t.brief.h2Outline.join(' | ')}`;
      return entry;
    })
    .join('\n');

  const candidateList = candidates
    .map((c, i) => `${i}: "${c.keyword}" (${c.contentType}${c.isRefresh ? ', refresh of /' + c.existingSlug + '/' : ''})`)
    .join('\n');

  const result = await callModelJSON(MODEL_BRIEF,
    `You are an SEO content strategist. Your job is to prevent search intent cannibalization on beachbride.com, a destination wedding planning website.

Two articles cannibalize each other when a searcher would be equally satisfied by either one. The test is: "If someone googled this keyword and landed on the existing article, would they bounce back to Google unsatisfied?" If the existing article already answers the query — even if the keyword is worded differently — it's a duplicate intent.

Examples of SAME intent (should be removed):
- "how much does a destination wedding cost" vs existing article covering destination wedding costs by location
- "beach wedding planning tips" vs existing comprehensive beach wedding checklist
- "best beach wedding photographer" vs existing article on finding destination wedding vendors

Examples of DIFFERENT intent (should be kept):
- "destination wedding cost in Cancun specifically" vs a general cost overview (location-specific angle)
- "beach wedding checklist" vs "beach wedding decoration ideas" (planning vs. inspiration)
- "how to find a wedding planner in Bali" vs "destination wedding planning guide" (vendor hiring vs. general planning)`,
    `Review these candidate topics against existing content. The existing article data includes their H2 section headings and FAQ questions — use these to judge whether the candidate's search intent is already served.

REMOVE if: a searcher looking for the candidate keyword would be fully satisfied by an existing article's content (based on its sections and FAQs).
KEEP if: the candidate targets a genuinely distinct angle, destination-specific detail, or user need not covered by existing content.
KEEP refresh candidates (they improve existing articles, not create new ones).

EXISTING ARTICLES (with section outlines):
${existingContent}

ALREADY IN PIPELINE (with briefs where available):
${pipelineContent || '(none)'}

CANDIDATE TOPICS:
${candidateList}

Return JSON: { "keep": [0, 2, 5, ...], "removed": [{"index": 1, "reason": "same intent as /existing-slug/ which covers [specific overlap]"}] }
Only include index numbers. The "removed" array is for logging.`,
    { temperature: 0 }
  );

  // Collect normalized keywords of removed candidates to persist in blacklist
  const rejectedNormalized = [];
  if (result.removed?.length) {
    for (const r of result.removed) {
      const candidate = candidates[r.index];
      if (candidate) {
        console.log(`    Removed "${candidate.keyword}": ${r.reason}`);
        rejectedNormalized.push(normalizeKeyword(candidate.keyword));
      }
    }
  }

  const kept = (result.keep || []).map(i => candidates[i]).filter(Boolean);
  return { filtered: kept, rejectedNormalized };
}

// ── Intra-Batch Duplicate Filter ───────────────────────────────────────────────
// After filtering against existing articles, check the surviving candidates
// against EACH OTHER. Catches intent clusters within a single discovery batch
// (e.g. DataForSEO returning 5 "beach wedding songs" variants at once).
//
// Keeps the highest-scored representative from each cluster. Rejected candidates
// are added to pipeline.rejectedKeywords so they're never re-evaluated.

async function filterIntraBatchDuplicates(candidates) {
  if (candidates.length <= 1) return { deduped: candidates, intraBatchRejected: [] };

  const candidateList = candidates
    .map((c, i) => `${i} [score:${c.score.toFixed(0)}]: "${c.keyword}"`)
    .join('\n');

  const result = await callModelJSON(MODEL_BRIEF,
    `You are an SEO content strategist for beachbride.com, a destination wedding website. Your job is to prevent wasted content by catching keywords that serve identical search intent — even when worded differently.

Two keywords are the SAME intent if a reader searching for one would be equally satisfied by an article written for the other.

Same intent examples:
- "beach wedding songs" / "music for beach wedding" / "beach wedding song" → all want a song list
- "destination wedding invitation wording" / "destination wedding invitation text" / "destination wedding invite wording" → all want sample wording text
- "beach wedding nail ideas" / "beach wedding nails" → both want nail inspiration

Different intent examples:
- "destination wedding invitation etiquette" vs "destination wedding invitation wording" → rules vs. text samples (distinct needs)
- "save the date wording" vs "invitation wording" → different documents
- "destination wedding welcome bags" vs "destination wedding party favors" → arrival gifts vs. ceremony takeaways`,

    `These candidates have already passed overlap checks against published articles. Now identify any that serve the same search intent as each other.

For each group of near-duplicate intents, keep ONE — the highest-scored candidate (shown as [score:N]). If scores are equal, keep the most broadly useful keyword.

CANDIDATES:
${candidateList}

Return JSON:
{
  "keep": [list of indices to keep],
  "clusters": [
    { "keep": 5, "skip": [0, 3], "reason": "all serve the same 'beach wedding music/songs' intent" }
  ]
}
Return ALL indices that have no duplicates in the "keep" array. Only omit indices that are duplicated by a kept index.`,
    { temperature: 0 }
  );

  const keepIndices = new Set(result.keep || []);

  // Log clusters for visibility
  if (result.clusters?.length) {
    for (const cluster of result.clusters) {
      const keepKw = candidates[cluster.keep]?.keyword;
      const skipKws = (cluster.skip || []).map(i => `"${candidates[i]?.keyword}"`).join(', ');
      console.log(`    Cluster: keeping "${keepKw}", dropping ${skipKws} — ${cluster.reason}`);
    }
  }

  // Collect rejected normalized keywords for blacklist
  const intraBatchRejected = [];
  for (let i = 0; i < candidates.length; i++) {
    if (!keepIndices.has(i)) {
      intraBatchRejected.push(normalizeKeyword(candidates[i].keyword));
    }
  }

  const deduped = candidates.filter((_, i) => keepIndices.has(i));
  return { deduped, intraBatchRejected };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeKeyword(kw) {
  return kw.toLowerCase().replace(/\b(a|an|the|in|on|of|for|to|and|is|are|how|do|does|can|my|your)\b/g, '').replace(/\s+/g, ' ').trim();
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// ── Run ────────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
