/**
 * Seed Vendor Guide Topics
 * Seeds 10 high-intent "how to find a [vendor type] in [destination]" articles
 * into pipeline.json at 'discovered' status. These articles link back to the
 * pSEO type+destination directory pages and target high commercial-intent queries.
 *
 * Usage:
 *   node scripts/seed-vendor-guide-topics.js [--dry-run]
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadPipeline, savePipeline, getExistingArticles, MODEL_ALT } from './content-engine/lib/config.js';
import { callModelJSON } from './content-engine/lib/openrouter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

/**
 * High-volume type+destination vendor guide topics.
 * Scores based on DataForSEO keyword volume × intent × win probability.
 * These link to /vendors/[type]/[destination]/ pSEO pages for conversion.
 */
const VENDOR_GUIDE_TOPICS = [
  // ── Tier 1: Hawaii (highest volume, lowest competition) ─────────────────────
  {
    id: 'how-to-find-wedding-planner-hawaii',
    keyword: 'how to find a wedding planner in hawaii',
    secondaryKeywords: [
      'hawaii wedding planner tips',
      'hiring destination wedding planner hawaii',
      'best wedding planner hawaii',
      'questions to ask hawaii wedding planner',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 95,
    destination: 'hawaii',
    vendorType: 'planner',
    directorySlug: 'vendors/planner/hawaii',
  },
  {
    id: 'how-to-find-wedding-photographer-hawaii',
    keyword: 'how to find a wedding photographer in hawaii',
    secondaryKeywords: [
      'hawaii wedding photographer tips',
      'best wedding photographer hawaii',
      'hiring photographer destination wedding hawaii',
      'hawaii elopement photographer',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 91,
    destination: 'hawaii',
    vendorType: 'photographer',
    directorySlug: 'vendors/photographer/hawaii',
  },
  // ── Tier 1: Jamaica (high volume, strong planner demand) ────────────────────
  {
    id: 'how-to-find-wedding-planner-jamaica',
    keyword: 'how to find a wedding planner in jamaica',
    secondaryKeywords: [
      'jamaica wedding planner tips',
      'all inclusive wedding planner jamaica',
      'hiring wedding planner jamaica',
      'sandals wedding planner jamaica',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 90,
    destination: 'jamaica',
    vendorType: 'planner',
    directorySlug: 'vendors/planner/jamaica',
  },
  // ── Tier 1: Cancun (highest search volume destination) ──────────────────────
  {
    id: 'how-to-find-wedding-planner-cancun',
    keyword: 'how to find a wedding planner in cancun',
    secondaryKeywords: [
      'cancun wedding planner tips',
      'all inclusive wedding planner cancun',
      'hiring local wedding planner cancun mexico',
      'cancun resort wedding coordinator vs independent planner',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 93,
    destination: 'cancun',
    vendorType: 'planner',
    directorySlug: 'vendors/planner/cancun',
  },
  {
    id: 'how-to-find-wedding-photographer-cancun',
    keyword: 'how to find a wedding photographer in cancun',
    secondaryKeywords: [
      'cancun wedding photographer tips',
      'best photographer cancun wedding',
      'resort vs independent photographer cancun',
      'cancun destination wedding photos',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 87,
    destination: 'cancun',
    vendorType: 'photographer',
    directorySlug: 'vendors/photographer/cancun',
  },
  // ── Tier 2: Bali (high CPC, international demand) ───────────────────────────
  {
    id: 'how-to-find-wedding-planner-bali',
    keyword: 'how to find a wedding planner in bali',
    secondaryKeywords: [
      'bali wedding planner tips',
      'hiring wedding coordinator bali indonesia',
      'bali villa wedding planner',
      'symbolic vs legal wedding planner bali',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 89,
    destination: 'bali',
    vendorType: 'planner',
    directorySlug: 'vendors/planner/bali',
  },
  {
    id: 'how-to-find-wedding-photographer-bali',
    keyword: 'how to find a wedding photographer in bali',
    secondaryKeywords: [
      'bali wedding photographer tips',
      'best photographer for bali wedding',
      'bali destination photographer',
      'rice terrace wedding photography bali',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 84,
    destination: 'bali',
    vendorType: 'photographer',
    directorySlug: 'vendors/photographer/bali',
  },
  // ── Tier 2: Santorini (very high CPC, luxury segment) ───────────────────────
  {
    id: 'how-to-find-wedding-planner-santorini',
    keyword: 'how to find a wedding planner in santorini',
    secondaryKeywords: [
      'santorini wedding planner tips',
      'hiring wedding coordinator santorini greece',
      'oia caldera wedding planner',
      'santorini destination wedding coordinator',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 86,
    destination: 'santorini',
    vendorType: 'planner',
    directorySlug: 'vendors/planner/santorini',
  },
  {
    id: 'how-to-find-wedding-photographer-santorini',
    keyword: 'how to find a wedding photographer in santorini',
    secondaryKeywords: [
      'santorini wedding photographer tips',
      'best photographer santorini oia sunset',
      'destination photographer santorini greece',
      'caldera wedding photography santorini',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 83,
    destination: 'santorini',
    vendorType: 'photographer',
    directorySlug: 'vendors/photographer/santorini',
  },
  // ── Tier 2: Punta Cana (resort-heavy market) ────────────────────────────────
  {
    id: 'how-to-find-wedding-planner-punta-cana',
    keyword: 'how to find a wedding planner in punta cana',
    secondaryKeywords: [
      'punta cana wedding planner tips',
      'all inclusive resort planner vs independent punta cana',
      'hiring coordinator punta cana',
      'punta cana destination wedding coordinator',
    ],
    contentType: 'destination_vendor_guide',
    schemaType: 'howto',
    score: 82,
    destination: 'punta-cana',
    vendorType: 'planner',
    directorySlug: 'vendors/planner/punta-cana',
  },
];

async function main() {
  console.log('\n=== Seed Vendor Guide Topics ===');
  console.log(`  dry-run: ${dryRun}\n`);

  const pipeline = loadPipeline();
  const existingArticles = getExistingArticles();
  const existingIds = new Set(pipeline.topics.map(t => t.id));
  const existingKeywords = new Set(pipeline.topics.map(t => t.keyword.toLowerCase()));

  const toAdd = [];

  for (const t of VENDOR_GUIDE_TOPICS) {
    if (existingIds.has(t.id)) {
      console.log(`  SKIP (already in pipeline): ${t.id}`);
      continue;
    }
    if (existingKeywords.has(t.keyword.toLowerCase())) {
      console.log(`  SKIP (keyword already in pipeline): ${t.keyword}`);
      continue;
    }

    const topic = {
      id: t.id,
      keyword: t.keyword,
      secondaryKeywords: t.secondaryKeywords,
      status: 'discovered',
      score: t.score,
      contentType: t.contentType,
      schemaType: t.schemaType,
      isRefresh: false,
      existingSlug: null,
      brief: null,
      researchData: null,
      qualityReport: null,
      rewriteAttempts: 0,
      failReason: null,
      discoveredAt: new Date().toISOString().slice(0, 10),
      publishedAt: null,
      articleSlug: t.id,
      _forcedSlug: t.id,
      destination: t.destination,
      vendorType: t.vendorType,
      directorySlug: t.directorySlug,
      _source: {
        impressions: 0,
        clicks: 0,
        position: 0,
        volume: 0,
        cpc: 0,
        difficulty: 0,
        source: 'vendor-guide-seed',
      },
    };

    toAdd.push(topic);
    console.log(`  + [${t.score}] ${t.keyword} → /vendors/${t.vendorType}/${t.destination}/`);
  }

  console.log(`\n  Topics to add: ${toAdd.length}`);

  if (toAdd.length === 0) {
    console.log('  Nothing to add.');
    return;
  }

  // Intent overlap check
  let approved = toAdd;
  if (toAdd.length > 0) {
    approved = await filterIntentOverlap(toAdd, existingArticles, pipeline);
  }

  if (!dryRun && approved.length > 0) {
    pipeline.topics.push(...approved);
    savePipeline(pipeline);
    console.log(`\n  Saved ${approved.length} topics to pipeline.json`);
    console.log(`\n  Next step: npm run content:generate -- --limit ${approved.length}`);
  } else if (dryRun) {
    console.log('  [DRY RUN] No changes written');
  }
}

async function filterIntentOverlap(candidates, existingArticles, pipeline) {
  const existingContent = existingArticles
    .map(a => `- /${a.slug}/ — "${a.title}"`)
    .join('\n');

  const pipelineContent = pipeline.topics
    .filter(t => ['discovered', 'briefed', 'researched', 'written', 'passed', 'staged', 'published'].includes(t.status))
    .map(t => `- "${t.keyword}" → /${t.articleSlug || t.id}/`)
    .join('\n');

  const candidateList = candidates
    .map((t, i) => `${i}: "${t.keyword}" (${t.contentType}, destination: ${t.destination}, vendor: ${t.vendorType})`)
    .join('\n');

  console.log(`\n  Checking intent overlap for ${candidates.length} topics...`);

  const result = await callModelJSON(
    MODEL_ALT,
    `You are an SEO content strategist for beachbride.com. Prevent duplicate content by catching topics that target the same search intent as existing articles.`,
    `Review these candidate topics. Remove any whose intent is already fully covered by existing content.

KEEP: Topics for different destinations, vendor types, or questions not yet covered.
REMOVE: Topics where existing content already satisfies the same searcher need.

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
