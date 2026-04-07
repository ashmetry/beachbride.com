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

async function main() {
  console.log(`\n=== Content Engine: Discover Topics ===`);
  console.log(`  dry-run: ${dryRun}  limit: ${limit === Infinity ? 'none' : limit}\n`);

  const pipeline = loadPipeline();
  const existingArticles = getExistingArticles();
  const existingSlugs = new Set(existingArticles.map(a => a.slug));
  const pipelineKeywords = new Set(pipeline.topics.map(t => normalizeKeyword(t.keyword)));

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

  let candidates = [];

  // 1. GSC strike zone
  try {
    const gscTopics = await fetchGSCStrikeZone();
    console.log(`  GSC: ${gscTopics.length} strike zone keywords found`);
    candidates.push(...gscTopics);
  } catch (err) {
    console.log(`  GSC error: ${err.message}`);
  }

  // 2. DataForSEO ranked keywords
  try {
    const dfsTopics = await fetchDataForSEOKeywords();
    console.log(`  DataForSEO: ${dfsTopics.length} ranked keywords found`);
    candidates.push(...dfsTopics);
  } catch (err) {
    console.log(`  DataForSEO error: ${err.message}`);
  }

  // 3. Deduplicate + score + classify
  const newTopics = [];
  const seen = new Set();
  let skipped = 0;
  let refreshes = 0;

  for (const c of candidates) {
    if (newTopics.length >= limit) break;

    const normalized = normalizeKeyword(c.keyword);
    if (seen.has(normalized) || pipelineKeywords.has(normalized)) {
      skipped++;
      continue;
    }
    seen.add(normalized);

    // Check cannibalization against existing articles
    const isRefresh = checkCannibalization(c, existingSlugs);

    const topic = {
      id: slugify(c.keyword),
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

  // 4. Semantic overlap check — catch topics that are different keywords but same intent
  let filtered = newTopics;
  if (newTopics.length > 0) {
    console.log(`\n  Checking semantic overlap...`);
    filtered = await filterSemanticOverlap(newTopics, existingArticles, pipeline.topics);
    const removed = newTopics.length - filtered.length;
    if (removed > 0) {
      console.log(`    Removed ${removed} topics that overlap with existing content`);
    }
  }

  console.log(`\n  Results:`);
  console.log(`    New topics: ${filtered.length}`);
  console.log(`    Skipped (keyword duplicates): ${skipped}`);
  console.log(`    Skipped (semantic overlap): ${newTopics.length - filtered.length}`);
  console.log(`    Refresh candidates: ${refreshes}`);

  if (filtered.length > 0) {
    console.log(`\n  Top topics:`);
    for (const t of filtered.slice(0, 10)) {
      console.log(`    [${t.score.toFixed(0)}] ${t.keyword} (${t.contentType}${t.isRefresh ? ', REFRESH' : ''})`);
    }
  }

  if (!dryRun && filtered.length > 0) {
    pipeline.topics.push(...filtered);
    pipeline.lastDiscoveryRun = new Date().toISOString();
    savePipeline(pipeline);
    console.log(`\n  Saved ${filtered.length} topics to pipeline.json`);
  } else if (dryRun) {
    console.log(`\n  [DRY RUN] Would save ${filtered.length} topics`);
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

  // Build context: existing articles + already-queued pipeline topics
  const existingContent = existingArticles
    .map(a => `- /${a.slug}/ — "${a.title}" [tags: ${a.tags.join(', ')}]`)
    .join('\n');

  const pipelineContent = pipelineTopics
    .filter(t => ['briefed', 'researched', 'written', 'passed', 'staged', 'published'].includes(t.status))
    .map(t => `- ${t.keyword} (${t.status})`)
    .join('\n');

  const candidateList = candidates
    .map((c, i) => `${i}: "${c.keyword}" (${c.contentType}${c.isRefresh ? ', refresh of /' + c.existingSlug + '/' : ''})`)
    .join('\n');

  const result = await callModelJSON(MODEL_BRIEF,
    `You are an SEO content strategist. Your job is to prevent topic cannibalization on a destination wedding planning website (beachbride.com).`,
    `Review these candidate topics against existing content. Remove any candidate that would substantially overlap with an existing article or pipeline topic — i.e., a searcher looking for one would be equally satisfied by the other.

KEEP refresh candidates (they improve existing articles, not create new ones).
KEEP topics that are related but target genuinely different search intent.
REMOVE topics that would compete with existing content for the same queries.

EXISTING ARTICLES:
${existingContent}

ALREADY IN PIPELINE:
${pipelineContent || '(none)'}

CANDIDATE TOPICS:
${candidateList}

Return JSON: { "keep": [0, 2, 5, ...], "removed": [{"index": 1, "reason": "overlaps with /existing-slug/"}] }
Only include index numbers. The "removed" array is for logging.`,
    { temperature: 0 }
  );

  if (result.removed?.length) {
    for (const r of result.removed) {
      console.log(`    Removed "${candidates[r.index]?.keyword}": ${r.reason}`);
    }
  }

  const kept = (result.keep || []).map(i => candidates[i]).filter(Boolean);
  return kept;
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
