/**
 * Seed Editorial Topics
 * Injects 9 proven-traffic editorial topics (from old WP site) directly into
 * pipeline.json as 'discovered', bypassing GSC/DataForSEO discovery.
 *
 * Usage:
 *   node scripts/seed-editorial-topics.js [--dry-run]
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadPipeline, savePipeline, getExistingArticles, MODEL_ALT } from './content-engine/lib/config.js';
import { callModelJSON } from './content-engine/lib/openrouter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

// Parse WP CSV
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
        row.push(field); field = '';
        if (row.length > 1) rows.push(row);
        row = [];
        if (c === '\r') i++;
      } else { field += c; }
    }
  }
  if (row.length > 1) rows.push(row);
  return rows;
}

// Map WP slugs → target keyword + content type + schema
const EDITORIAL_TOPICS = [
  // ── Tier 1: GSC-indexed pages with strong position signals ──────────────────
  {
    wpSlug: 'find-the-perfect-transportation-for-your-beach-wedding',
    keyword: 'beach wedding transportation ideas',
    secondaryKeywords: ['wedding transportation for beach wedding', 'how to arrive at beach wedding', 'beach wedding getaway car ideas'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 88,
  },
  {
    wpSlug: 'diy-beach-wedding-shoe-valet',
    keyword: 'beach wedding shoe valet',
    secondaryKeywords: ['diy shoe valet beach wedding', 'beach wedding shoes station', 'barefoot wedding shoe basket'],
    contentType: 'listicle',
    schemaType: 'HowTo',
    score: 82,
  },
  {
    wpSlug: 'seafood-menu',
    keyword: 'seafood menu ideas for beach wedding',
    secondaryKeywords: ['beach wedding seafood reception menu', 'coastal seafood wedding catering', 'seafood dishes beach wedding'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 87,
  },
  {
    wpSlug: 'edible-wedding-favors-beach-wedding',
    keyword: 'edible beach wedding favors',
    secondaryKeywords: ['food wedding favors beach theme', 'beach wedding edible gifts', 'unique edible wedding favors'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 83,
  },
  {
    wpSlug: 'celebrity-beach-weddings',
    keyword: 'celebrity beach weddings',
    secondaryKeywords: ['famous beach weddings celebrities', 'celebrity destination weddings beach', 'stars who got married on beach'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 79,
  },
  {
    wpSlug: 'beach-wedding-tabletop-decor-ideas',
    keyword: 'beach wedding table decor ideas',
    secondaryKeywords: ['beach wedding tablescape ideas', 'coastal wedding table decorations', 'beach reception table decor'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 84,
  },
  {
    wpSlug: 'dessert-bar-menu-ideas-for-a-beach-wedding',
    keyword: 'beach wedding dessert bar ideas',
    secondaryKeywords: ['candy bar beach wedding', 'dessert table ideas beach wedding', 'beach wedding sweet table'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 80,
  },
  {
    wpSlug: '5-great-beach-wedding-bridesmaids-gifts',
    keyword: 'beach wedding bridesmaid gifts',
    secondaryKeywords: ['gifts for bridesmaids beach wedding', 'beach themed bridesmaid thank you gifts', 'coastal bridesmaid gifts'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 77,
  },
  {
    wpSlug: 'beach-wedding-in-the-evening-lighting-decor-ideas',
    keyword: 'evening beach wedding lighting ideas',
    secondaryKeywords: ['beach wedding at night lighting', 'sunset beach wedding lights', 'beach wedding lighting decor'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 86,
  },
  {
    wpSlug: 'beach-wedding-menu-ideas',
    keyword: 'beach wedding menu ideas',
    secondaryKeywords: ['beach wedding reception food ideas', 'coastal wedding catering menu', 'tropical wedding food ideas'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 85,
  },
  {
    wpSlug: 'message-bottle-beach-proposal',
    keyword: 'message in a bottle beach proposal',
    secondaryKeywords: ['beach proposal ideas romantic', 'message bottle engagement idea', 'unique beach proposal'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 76,
  },
  // ── Tier 2: Good keyword targets with affiliate potential ───────────────────
  {
    wpSlug: 'sea-glass-vases',
    keyword: 'diy sea glass vase wedding',
    secondaryKeywords: ['how to make sea glass vase', 'sea glass wedding centerpiece diy', 'beach wedding diy decor'],
    contentType: 'listicle',
    schemaType: 'HowTo',
    score: 73,
  },
  {
    wpSlug: '5-breathtaking-beach-wedding-looks',
    keyword: 'beach wedding dress styles',
    secondaryKeywords: ['beach wedding gown ideas', 'what to wear beach wedding bride', 'best dresses for beach wedding'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 75,
  },
  {
    wpSlug: '7-elevated-trip-ideas-for-your-beach-bride',
    keyword: 'bachelorette trip ideas beach bride',
    secondaryKeywords: ['beach bachelorette party destinations', 'bachelorette weekend ideas beach', 'beach bride trip ideas'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 72,
  },
  {
    wpSlug: 'considering-having-a-beach-wedding-think-about-these-pros-and-cons-first',
    keyword: 'pros and cons of a beach wedding',
    secondaryKeywords: ['beach wedding advantages disadvantages', 'is a beach wedding right for me', 'beach wedding considerations'],
    contentType: 'editorial',
    schemaType: 'Article',
    score: 78,
  },
  {
    wpSlug: '4-awesome-beach-destinations-honeymoon',
    keyword: 'best beach destinations for honeymoon',
    secondaryKeywords: ['top honeymoon beach destinations', 'beach honeymoon destination ideas', 'romantic beach honeymoon spots'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 82,
  },
  {
    wpSlug: 'destination-wedding-tips',
    keyword: 'destination wedding tips',
    secondaryKeywords: ['destination wedding planning tips', 'things to buy for destination wedding', 'destination wedding checklist items'],
    contentType: 'listicle',
    schemaType: 'HowTo',
    score: 92,
  },
  {
    wpSlug: 'a-delicious-tropical-menu-for-a-beach-themed-bridal-shower',
    keyword: 'beach themed bridal shower menu',
    secondaryKeywords: ['tropical bridal shower food ideas', 'beach bridal shower menu', 'tropical menu ideas bridal shower'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 74,
  },
  {
    wpSlug: 'beach-wedding-beautiful-and-easy-centerpiece-ideas',
    keyword: 'beach wedding centerpiece ideas',
    secondaryKeywords: ['beach wedding table centerpieces', 'diy beach wedding centerpieces', 'easy beach wedding centerpieces'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 78,
  },
  {
    wpSlug: '7-ways-to-bring-the-beach-to-a-wedding-reception-indoors',
    keyword: 'beach themed wedding reception indoors',
    secondaryKeywords: ['indoor beach wedding ideas', 'bring beach to indoor wedding', 'beach themed indoor reception ideas'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 72,
  },
  {
    wpSlug: 'unique-beach-wedding-ideas',
    keyword: 'unique beach wedding ideas',
    secondaryKeywords: ['creative beach wedding ideas', 'beach wedding inspiration', 'unusual beach wedding ideas'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 81,
  },
  {
    wpSlug: 'gorgeous-beach-themed-wedding-cakes',
    keyword: 'beach themed wedding cakes',
    secondaryKeywords: ['beach wedding cake ideas', 'ocean themed wedding cake', 'tropical wedding cake designs'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 76,
  },
  {
    wpSlug: 'is-it-really-possible-to-save-money-with-a-beach-destination-wedding',
    keyword: 'save money with a destination wedding',
    secondaryKeywords: ['is a destination wedding cheaper', 'destination wedding cost savings', 'affordable destination wedding'],
    contentType: 'editorial',
    schemaType: 'Article',
    score: 85,
  },
  {
    wpSlug: 'beautiful-light-accessories-for-a-beach-bride',
    keyword: 'beach bride accessories',
    secondaryKeywords: ['beach wedding accessories for bride', 'light jewelry for beach wedding', 'beach bridal accessories'],
    contentType: 'listicle',
    schemaType: 'Article',
    score: 70,
  },
  {
    wpSlug: 'tips-for-planning-your-palm-beaches-destination-beach-wedding',
    keyword: 'Palm Beaches destination wedding',
    secondaryKeywords: ['Palm Beach wedding planning', 'West Palm Beach destination wedding', 'Palm Beach Florida wedding tips'],
    contentType: 'destination-guide',
    schemaType: 'Article',
    score: 68,
  },
];

async function main() {
  console.log('\n=== Seed Editorial Topics ===');
  console.log(`  dry-run: ${dryRun}\n`);

  // Load WP content for context
  const csvPath = join(ROOT, 'src', 'data', 'wp_posts.csv');
  const csvData = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvData);
  const headers = rows[0];
  const hi = {};
  headers.forEach((h, i) => { hi[h] = i; });

  const wpPosts = {};
  rows.slice(1).forEach(r => {
    wpPosts[r[hi['post_name']]] = {
      title: r[hi['post_title']],
      content: r[hi['post_content']],
    };
  });

  const pipeline = loadPipeline();
  const existingArticles = getExistingArticles();
  const existingSlugs = new Set(existingArticles.map(a => a.slug));
  const existingKeywords = new Set(pipeline.topics.map(t => t.keyword.toLowerCase()));

  const toAdd = [];

  for (const t of EDITORIAL_TOPICS) {
    if (existingKeywords.has(t.keyword.toLowerCase())) {
      console.log(`  SKIP (already in pipeline): ${t.keyword}`);
      continue;
    }

    const wpPost = wpPosts[t.wpSlug];
    if (!wpPost) {
      console.warn(`  WARN: WP post not found for slug: ${t.wpSlug}`);
    }

    // Strip HTML from WP content for research context (first 1500 chars)
    const wpText = wpPost
      ? wpPost.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)
      : '';

    const isRefresh = existingSlugs.has(t.wpSlug);

    const topic = {
      id: t.wpSlug,
      keyword: t.keyword,
      secondaryKeywords: t.secondaryKeywords,
      status: 'discovered',
      score: t.score,
      contentType: t.contentType,
      schemaType: t.schemaType,
      isRefresh,
      existingSlug: isRefresh ? t.wpSlug : null,
      brief: null,
      researchData: null,
      qualityReport: null,
      rewriteAttempts: 0,
      failReason: null,
      discoveredAt: new Date().toISOString().slice(0, 10),
      publishedAt: null,
      articleSlug: t.wpSlug,   // preserve the proven slug
      _forcedSlug: t.wpSlug,  // prevents generate.js brief step from overwriting
      _wpContext: wpText,      // seed the original content as research context
      _source: {
        impressions: 0,
        clicks: 0,
        position: 0,
        volume: 0,
        cpc: 0,
        difficulty: 0,
        currentPageUrl: `https://www.beachbride.com/${t.wpSlug}/`,
        source: 'wp-migration',
      },
    };

    toAdd.push(topic);
    console.log(`  + [${t.score}] ${t.keyword} (${t.contentType}) → slug: ${t.wpSlug}`);
  }

  console.log(`\n  Topics to add: ${toAdd.length}`);

  // Intent overlap check — catch duplicates before they enter the pipeline
  let approved = toAdd;
  if (toAdd.length > 0) {
    approved = await filterIntentOverlap(toAdd, existingArticles, pipeline);
  }

  if (!dryRun && approved.length > 0) {
    pipeline.topics.push(...approved);
    savePipeline(pipeline);
    console.log(`  Saved ${approved.length} topics to pipeline.json`);
    console.log(`\n  Next step: npm run content:generate -- --limit ${approved.length}`);
  } else if (dryRun) {
    console.log('  [DRY RUN] No changes written');
  }
}

// ── Intent Overlap Filter ──────────────────────────────────────────────────────

async function filterIntentOverlap(candidates, existingArticles, pipeline) {
  const existingContent = existingArticles
    .map(a => `- /${a.slug}/ — "${a.title}"`)
    .join('\n');

  const pipelineContent = pipeline.topics
    .filter(t => ['discovered', 'briefed', 'researched', 'written', 'passed', 'staged', 'published'].includes(t.status))
    .map(t => `- "${t.keyword}" → /${t.articleSlug || t.id}/`)
    .join('\n');

  const candidateList = candidates
    .map((t, i) => `${i}: "${t.keyword}" (${t.contentType}${t.isRefresh ? `, refresh of /${t.existingSlug}/` : ''})`)
    .join('\n');

  console.log(`\n  Checking intent overlap for ${candidates.length} topics...`);

  const result = await callModelJSON(
    MODEL_ALT,
    `You are an SEO content strategist for beachbride.com, a destination wedding planning website. Prevent duplicate content by catching topics that target the same search intent as existing articles, even with different phrasing.`,
    `Review these candidate topics. Remove any whose intent is already covered by an existing article or pipeline topic — meaning a bride searching for it would be equally satisfied by the existing content.

KEEP topics with genuinely different intent: different destination, planning stage, question, or audience segment.
KEEP refresh candidates (marked as refresh) — they improve existing articles, not create new ones.
REMOVE topics where existing content already satisfies the same searcher need.

EXISTING PUBLISHED ARTICLES:
${existingContent}

ALREADY IN PIPELINE:
${pipelineContent || '(none)'}

CANDIDATE TOPICS:
${candidateList}

Return JSON: { "keep": [0, 2, ...], "remove": [{ "index": 1, "conflicts_with": "/slug/", "reason": "..." }] }`,
    { temperature: 0 }
  );

  if (result.remove?.length) {
    for (const r of result.remove) {
      const t = candidates[r.index];
      if (t) console.log(`    Skipping "${t.keyword}": conflicts with ${r.conflicts_with} — ${r.reason}`);
    }
  }

  const kept = (result.keep || []).map(i => candidates[i]).filter(Boolean);
  console.log(`    Kept ${kept.length} / ${candidates.length} (removed ${candidates.length - kept.length})`);
  return kept;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
