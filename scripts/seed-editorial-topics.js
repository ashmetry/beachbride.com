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
import { loadPipeline, savePipeline, getExistingArticles } from './content-engine/lib/config.js';

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

  if (!dryRun && toAdd.length > 0) {
    pipeline.topics.push(...toAdd);
    savePipeline(pipeline);
    console.log(`  Saved to pipeline.json`);
    console.log(`\n  Next step: npm run content:generate -- --limit ${toAdd.length}`);
  } else if (dryRun) {
    console.log('  [DRY RUN] No changes written');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
