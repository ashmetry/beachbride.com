/**
 * Content Engine — Rankings Audit & Rewrite Recommender
 *
 * Queries GSC for the last 28 days, stores a weekly snapshot in
 * rankings-history.json, and analyses trends across snapshots to
 * recommend the right action for each ranking page:
 *
 *   CLIMBING    — position improving; leave it alone
 *   PLATEAUED   — position stagnant 2+ weeks; candidate for rewrite
 *   STALLED     — position worsening; investigate
 *   META_ONLY   — ranking well (pos < 10) but CTR ≈ 0; fix title/description only
 *   NEW         — first snapshot; no trend yet
 *
 * Only flags REWRITE when: PLATEAUED + position > 15 + impressions >= 3.
 * Never recommends rewriting a CLIMBING article regardless of CTR.
 *
 * Usage:
 *   node scripts/content-engine/audit-rankings.js            # snapshot + report
 *   node scripts/content-engine/audit-rankings.js --dry-run  # report only, don't save snapshot
 *   node scripts/content-engine/audit-rankings.js --report   # report from existing history only
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { google } from 'googleapis';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
loadDotenv({ path: join(ROOT, '.env') });

const HISTORY_PATH = join(__dirname, 'rankings-history.json');
const REDIRECTS_PATH = join(ROOT, 'public', '_redirects');
const ARTICLES_DIR = join(ROOT, 'src', 'content', 'articles');
const GSC_SITE = 'sc-domain:beachbride.com';

// ── Thresholds ────────────────────────────────────────────────────────────────
const MIN_IMPRESSIONS_FOR_SIGNAL = 3;   // below this, too noisy to act on
const REWRITE_MIN_POSITION = 15;        // don't rewrite articles already on page 1-2
const PLATEAU_THRESHOLD = 2;            // position must change < this to count as plateaued
const CLIMBING_THRESHOLD = 2;           // position must improve > this to count as climbing
const STALL_THRESHOLD = 2;              // position must worsen > this to count as stalled
const META_ONLY_MAX_POSITION = 10;      // pos < this with zero CTR → meta fix, not rewrite
const SNAPSHOT_INTERVAL_DAYS = 6;       // min days between snapshots (avoid daily noise)
const WEEKS_FOR_PLATEAU = 2;            // consecutive snapshots needed to call a plateau

// ── GSC Auth ──────────────────────────────────────────────────────────────────
function getGSCAuth() {
  const env = process.env;
  let keyData;
  if (env.GSC_SERVICE_ACCOUNT_KEY) {
    keyData = JSON.parse(Buffer.from(env.GSC_SERVICE_ACCOUNT_KEY, 'base64').toString());
  } else if (env.GSC_KEY_PATH && existsSync(env.GSC_KEY_PATH)) {
    keyData = JSON.parse(readFileSync(env.GSC_KEY_PATH, 'utf8'));
  } else {
    const defaultPath = 'C:/Users/ash/.claude/search-console-key.json';
    if (!existsSync(defaultPath)) throw new Error('No GSC service account key found');
    keyData = JSON.parse(readFileSync(defaultPath, 'utf8'));
  }
  return new google.auth.GoogleAuth({ credentials: keyData, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
}

// ── Fetch GSC data ────────────────────────────────────────────────────────────
async function fetchGSCData() {
  const auth = getGSCAuth();
  const sc = google.searchconsole({ version: 'v1', auth });

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

  console.log(`  Querying GSC: ${startDate} → ${endDate}`);

  const res = await sc.searchanalytics.query({
    siteUrl: GSC_SITE,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit: 1000,
      orderBy: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
    },
  });

  return res.data?.rows || [];
}

// ── Build page-level summary from GSC rows ────────────────────────────────────
function buildPageSummary(rows) {
  // Only new-site URLs (apex domain, not www)
  const newSiteRows = rows.filter(r => !r.keys[1].includes('www.beachbride.com'));

  const pages = {};
  for (const r of newSiteRows) {
    const page = r.keys[1].replace('https://beachbride.com', '') || '/';
    if (!pages[page]) {
      pages[page] = { impressions: 0, clicks: 0, posSum: 0, posCount: 0, topQueries: [] };
    }
    pages[page].impressions += r.impressions;
    pages[page].clicks += r.clicks;
    pages[page].posSum += r.position * r.impressions; // weighted by impressions
    pages[page].posCount += r.impressions;
    pages[page].topQueries.push({ q: r.keys[0], impressions: r.impressions, position: +r.position.toFixed(1) });
  }

  // Normalise
  const result = {};
  for (const [page, d] of Object.entries(pages)) {
    const avgPos = d.posCount > 0 ? +(d.posSum / d.posCount).toFixed(1) : null;
    const ctr = d.impressions > 0 ? +(d.clicks / d.impressions * 100).toFixed(2) : 0;
    result[page] = {
      impressions: d.impressions,
      clicks: d.clicks,
      ctr,
      avgPosition: avgPos,
      topQueries: d.topQueries.sort((a, b) => b.impressions - a.impressions).slice(0, 5),
    };
  }
  return result;
}

// ── History helpers ───────────────────────────────────────────────────────────
function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return { snapshots: [] };
  return JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
}

function saveHistory(history) {
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function shouldTakeSnapshot(history) {
  if (history.snapshots.length === 0) return true;
  const latest = history.snapshots[history.snapshots.length - 1].date;
  const daysSince = (Date.now() - new Date(latest).getTime()) / 86400000;
  return daysSince >= SNAPSHOT_INTERVAL_DAYS;
}

// ── Trend analysis ────────────────────────────────────────────────────────────
function analyseTrend(page, history) {
  // Gather all snapshots that have data for this page, chronological
  const dataPoints = history.snapshots
    .map(s => ({ date: s.date, data: s.pages[page] }))
    .filter(x => x.data && x.data.avgPosition !== null && x.data.impressions >= MIN_IMPRESSIONS_FOR_SIGNAL);

  if (dataPoints.length < 2) {
    return { trend: 'NEW', dataPoints };
  }

  // Compare the last N positions (lower = better rank)
  const positions = dataPoints.map(p => p.data.avgPosition);
  const latest = positions[positions.length - 1];
  const prev = positions[positions.length - 2];
  const delta = latest - prev; // positive = worsened, negative = improved

  // Check if plateaued across last WEEKS_FOR_PLATEAU+1 snapshots
  const recentPositions = positions.slice(-(WEEKS_FOR_PLATEAU + 1));
  const maxVariance = Math.max(...recentPositions) - Math.min(...recentPositions);
  const isPlateau = recentPositions.length >= WEEKS_FOR_PLATEAU + 1 && maxVariance < PLATEAU_THRESHOLD;

  let trend;
  if (isPlateau) {
    trend = 'PLATEAUED';
  } else if (delta < -CLIMBING_THRESHOLD) {
    trend = 'CLIMBING';
  } else if (delta > STALL_THRESHOLD) {
    trend = 'STALLED';
  } else {
    // Small movement — check direction across all points
    const overallDelta = latest - positions[0];
    trend = overallDelta < -CLIMBING_THRESHOLD ? 'CLIMBING' : 'PLATEAUED';
  }

  return { trend, dataPoints, delta, latest, prev };
}

// ── Action recommendation ─────────────────────────────────────────────────────
function recommendAction(page, currentData, trendInfo) {
  const { impressions, clicks, avgPosition, ctr } = currentData;

  if (impressions < MIN_IMPRESSIONS_FOR_SIGNAL) {
    return { action: 'WATCH', reason: 'Too few impressions for a signal yet' };
  }

  // Good rank, zero CTR → title/meta problem, not content
  if (avgPosition <= META_ONLY_MAX_POSITION && ctr === 0 && impressions >= MIN_IMPRESSIONS_FOR_SIGNAL) {
    return {
      action: 'META_ONLY',
      reason: `Ranking pos ${avgPosition} but 0% CTR — title or meta description needs work, not the article`,
    };
  }

  const { trend } = trendInfo;

  if (trend === 'CLIMBING') {
    return { action: 'LEAVE', reason: `Climbing (${trendInfo.prev} → ${trendInfo.latest}) — do not touch` };
  }

  if (trend === 'NEW') {
    return { action: 'WATCH', reason: 'First snapshot — need 2+ weeks of data before acting' };
  }

  if (trend === 'STALLED' && avgPosition > REWRITE_MIN_POSITION) {
    return {
      action: 'INVESTIGATE',
      reason: `Position worsening (${trendInfo.prev} → ${trendInfo.latest}) — check for competing pages or content gaps`,
    };
  }

  if (trend === 'PLATEAUED' && avgPosition > REWRITE_MIN_POSITION && impressions >= MIN_IMPRESSIONS_FOR_SIGNAL) {
    return {
      action: 'REWRITE',
      reason: `Plateaued at pos ${avgPosition} with ${impressions} impressions and 0 clicks — content improvement likely to move needle`,
    };
  }

  return { action: 'MONITOR', reason: `${trend} at pos ${avgPosition}` };
}

// ── Redirect analysis ─────────────────────────────────────────────────────────
// Topic keywords that signal the URL has indexable SEO value
const SEO_TOPIC_WORDS = [
  'wedding', 'bride', 'bridal', 'beach', 'destination', 'planner', 'photographer',
  'florist', 'cake', 'bouquet', 'venue', 'ceremony', 'honeymoon', 'proposal',
  'tattoo', 'dress', 'shoes', 'color', 'decor', 'centerpiece', 'menu', 'food',
  'checklist', 'budget', 'cost', 'bible', 'verses', 'vows', 'rings', 'jewelry',
];

// Patterns that indicate a redirect is intentionally "lose-the-old-slug" (not a bad redirect)
const CATCH_ALL_PATTERNS = [
  /^\/20\d{2}\//, // dated WP archive paths /2014/08/...
  /^\/(author|category|page|blog|tag)\//,
  /^\/(vendor|photographer)s\/listings\//,
  /^\/checkout/,
  /^\/social-media/,
  /\*$/, // wildcard redirects
  /^\/(kontakt|contacte|contact\.html|advertising|write-for-us|guest-post|collab|wedding-dress-?\d*)$/,
];

function hasTopicValue(slug) {
  const lower = slug.toLowerCase();
  return SEO_TOPIC_WORDS.some(w => lower.includes(w));
}

function findBadRedirects() {
  if (!existsSync(REDIRECTS_PATH)) return [];
  const lines = readFileSync(REDIRECTS_PATH, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const bad = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const [from, to, code] = parts;
    if (code !== '301') continue;

    // Skip catch-all / intentional "lose the old slug" redirects
    if (CATCH_ALL_PATTERNS.some(p => p.test(from))) continue;

    // Only flag URLs that have real SEO topic value
    if (!hasTopicValue(from)) continue;

    // Check if destination is clearly off-topic relative to source
    const fromWords = new Set(from.replace(/\//g, '-').split('-').filter(w => w.length > 4));
    const toWords = new Set(to.replace(/\//g, '-').split('-').filter(w => w.length > 4));
    const overlap = [...fromWords].filter(w => toWords.has(w));

    // Flag if: source has topic keywords, destination has none of the same words,
    // and destination is not /real-weddings/ (which is intentional for gallery posts)
    if (overlap.length === 0 && !to.includes('/real-weddings/') && !to.includes('/destinations/')) {
      const sourceTopics = SEO_TOPIC_WORDS.filter(w => from.toLowerCase().includes(w));
      bad.push({ from, to, sourceTopics, note: `"${sourceTopics.join(', ')}" content routing to unrelated destination` });
    }
  }
  return bad;
}

// ── Articles on disk ──────────────────────────────────────────────────────────
function getPublishedSlugs() {
  try {
    return readdirSync(ARTICLES_DIR)
      .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
      .map(f => '/' + f.replace(/\.(md|mdx)$/, '') + '/');
  } catch { return []; }
}

// ── Report printer ────────────────────────────────────────────────────────────
function printReport(history, currentSnapshot) {
  const today = currentSnapshot?.date || new Date().toISOString().slice(0, 10);
  const pages = currentSnapshot?.pages || {};

  console.log('\n' + '═'.repeat(60));
  console.log(`  BeachBride Rankings Audit — ${today}`);
  console.log(`  Snapshots on record: ${history.snapshots.length}`);
  console.log('═'.repeat(60));

  const ranked = Object.entries(pages)
    .filter(([, d]) => d.avgPosition !== null)
    .sort((a, b) => a[1].avgPosition - b[1].avgPosition);

  if (ranked.length === 0) {
    console.log('\n  No ranking pages found in current snapshot.\n');
    return;
  }

  // Group by action
  const byAction = {};
  const allRecommendations = [];

  for (const [page, data] of ranked) {
    const trendInfo = analyseTrend(page, history);
    const rec = recommendAction(page, data, trendInfo);
    allRecommendations.push({ page, data, trendInfo, rec });
    if (!byAction[rec.action]) byAction[rec.action] = [];
    byAction[rec.action].push({ page, data, trendInfo, rec });
  }

  // Priority order
  const actionOrder = ['META_ONLY', 'REWRITE', 'INVESTIGATE', 'CLIMBING', 'LEAVE', 'MONITOR', 'WATCH'];
  const actionLabel = {
    META_ONLY:   '[ FIX META ]',
    REWRITE:     '[  REWRITE ]',
    INVESTIGATE: '[INVESTIGATE]',
    CLIMBING:    '[ CLIMBING ]',
    LEAVE:       '[  LEAVE   ]',
    MONITOR:     '[ MONITOR  ]',
    WATCH:       '[  WATCH   ]',
  };

  for (const action of actionOrder) {
    const group = byAction[action];
    if (!group || group.length === 0) continue;

    console.log(`\n── ${action} (${group.length}) ${'─'.repeat(40 - action.length)}`);
    for (const { page, data, trendInfo, rec } of group) {
      const pos = data.avgPosition ? `pos ${data.avgPosition}` : 'pos ?';
      const imp = `${data.impressions}i`;
      const clk = `${data.clicks}c`;
      const hist = trendInfo.dataPoints.length > 1
        ? trendInfo.dataPoints.map(p => p.data.avgPosition).join(' → ')
        : '(1st snapshot)';
      console.log(`\n  ${actionLabel[action]} ${page}`);
      console.log(`             ${pos} | ${imp} | ${clk} | history: ${hist}`);
      console.log(`             ${rec.reason}`);
      if (data.topQueries?.length > 0) {
        const top = data.topQueries.slice(0, 2).map(q => `"${q.q}" (pos ${q.position})`).join(', ');
        console.log(`             Top queries: ${top}`);
      }
    }
  }

  // Bad redirects
  const badRedirects = findBadRedirects();
  if (badRedirects.length > 0) {
    console.log(`\n── BAD REDIRECTS (${badRedirects.length}) ${'─'.repeat(40)}`);
    for (const r of badRedirects) {
      console.log(`\n  ${r.from}`);
      console.log(`    → ${r.to}`);
      console.log(`    ${r.note}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  Summary:');
  for (const action of actionOrder) {
    const n = (byAction[action] || []).length;
    if (n > 0) console.log(`    ${actionLabel[action]}  ${n} page${n > 1 ? 's' : ''}`);
  }
  if (badRedirects.length > 0) {
    console.log(`    [ BAD REDIR ]  ${badRedirects.length} redirect${badRedirects.length > 1 ? 's' : ''} to fix`);
  }
  console.log('═'.repeat(60) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const reportOnly = args.includes('--report');

  console.log('\nBeachBride Rankings Audit');
  console.log(dryRun ? '(dry run — snapshot will not be saved)' : '');

  const history = loadHistory();

  let currentSnapshot;

  if (reportOnly) {
    // Use the most recent snapshot already in history
    if (history.snapshots.length === 0) {
      console.error('No snapshots in history yet. Run without --report to take the first one.');
      process.exit(1);
    }
    currentSnapshot = history.snapshots[history.snapshots.length - 1];
    console.log(`Reporting on existing snapshot: ${currentSnapshot.date}`);
  } else {
    if (!shouldTakeSnapshot(history)) {
      const latest = history.snapshots[history.snapshots.length - 1].date;
      console.log(`Last snapshot was ${latest} — less than ${SNAPSHOT_INTERVAL_DAYS} days ago.`);
      console.log('Use --report to see analysis of existing data, or wait for next interval.');
      // Still run report from existing data
      currentSnapshot = history.snapshots[history.snapshots.length - 1];
    } else {
      console.log('Fetching GSC data...');
      const rows = await fetchGSCData();
      console.log(`  ${rows.length} rows returned`);

      const pages = buildPageSummary(rows);
      const date = new Date().toISOString().slice(0, 10);
      currentSnapshot = { date, pages };

      if (!dryRun) {
        history.snapshots.push(currentSnapshot);
        // Keep last 26 snapshots (~6 months of weekly data)
        if (history.snapshots.length > 26) {
          history.snapshots = history.snapshots.slice(-26);
        }
        saveHistory(history);
        console.log(`  Snapshot saved (${history.snapshots.length} total on record)`);
      } else {
        console.log('  (dry run: snapshot not saved)');
      }
    }
  }

  printReport(history, currentSnapshot);
}

main().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
