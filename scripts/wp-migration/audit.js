/**
 * WordPress Migration Audit
 *
 * Cross-references wp_posts.csv with GSC traffic data and DataForSEO rankings
 * to determine which posts are worth migrating, rewriting, or redirecting.
 *
 * Usage:
 *   node scripts/wp-migration/audit.js
 *   node scripts/wp-migration/audit.js --gsc-only     (skip DataForSEO)
 *   node scripts/wp-migration/audit.js --dfs-only     (skip GSC)
 *   node scripts/wp-migration/audit.js --dry-run      (parse CSV only, no API calls)
 *
 * Output:
 *   scripts/wp-migration/audit-results.json  — full data
 *   scripts/wp-migration/audit-report.md     — human-readable summary
 *   scripts/wp-migration/redirects.txt       — _redirects file entries (Cloudflare Pages format)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { google } from 'googleapis';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
loadDotenv({ path: join(ROOT, '.env') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const GSC_ONLY = args.includes('--gsc-only');
const DFS_ONLY = args.includes('--dfs-only');

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || 'hello@keywords.am';
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || '32793fa32df9e59c';
const GSC_KEY_PATH = process.env.GSC_KEY_PATH || 'C:/Users/ash/.claude/search-console-key.json';
const GSC_SERVICE_ACCOUNT_KEY = process.env.GSC_SERVICE_ACCOUNT_KEY || '';

// ── CSV Parser ─────────────────────────────────────────────────────────────────

function parseCSV(content) {
  const rows = [];
  let current = '';
  let inQuote = false;
  let fields = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuote && content[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current); current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      fields.push(current); current = '';
      rows.push(fields); fields = [];
    } else {
      current += ch;
    }
  }
  if (current || fields.length) { fields.push(current); rows.push(fields); }
  return rows;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Load WordPress Posts ───────────────────────────────────────────────────────

function loadWPPosts() {
  const csvPath = join(ROOT, 'src', 'data', 'wp_posts.csv');
  const content = readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  const headers = rows[0];
  const data = rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));

  // Filter to published posts and pages with real content
  return data
    .filter(r => r.post_status === 'publish' && (r.post_type === 'post' || r.post_type === 'page'))
    .map(r => {
      const plainText = stripHtml(r.post_content);
      const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
      return {
        id: r.ID,
        slug: r.post_name,
        title: r.post_title,
        date: r.post_date.slice(0, 10),
        type: r.post_type,
        wordCount,
        excerpt: plainText.slice(0, 300),
        // Potential URL formats the old site might have used
        possibleUrls: [
          `/${r.post_name}/`,
          `/${r.post_date.slice(0, 4)}/${r.post_date.slice(5, 7)}/${r.post_name}/`,
          `/?p=${r.ID}`,
        ],
      };
    });
}

// ── GSC Data ───────────────────────────────────────────────────────────────────

async function fetchGSCData() {
  let keyData;
  if (GSC_SERVICE_ACCOUNT_KEY) {
    keyData = JSON.parse(Buffer.from(GSC_SERVICE_ACCOUNT_KEY, 'base64').toString());
  } else if (existsSync(GSC_KEY_PATH)) {
    keyData = JSON.parse(readFileSync(GSC_KEY_PATH, 'utf8'));
  } else {
    throw new Error('No GSC key found');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 16 * 30 * 86400000).toISOString().slice(0, 10); // ~16 months

  console.log(`  GSC: querying ${startDate} → ${endDate}`);

  const res = await sc.searchanalytics.query({
    siteUrl: 'https://beachbride.com/',
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 5000,
    },
  });

  const rows = res.data?.rows || [];
  console.log(`  GSC: ${rows.length} URLs with impressions found`);

  // Build map: url → { clicks, impressions, position }
  const urlMap = {};
  for (const row of rows) {
    const url = row.keys[0];
    const path = url.replace(/^https?:\/\/(?:www\.)?beachbride\.com/, '');
    urlMap[path] = {
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    };
  }

  return urlMap;
}

// ── DataForSEO Ranked Keywords ─────────────────────────────────────────────────

async function fetchDataForSEORankedKeywords() {
  const authStr = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

  console.log('  DataForSEO: querying ranked keywords for beachbride.com...');

  const data = await new Promise((resolve, reject) => {
    const body = JSON.stringify([{
      target: 'beachbride.com',
      location_code: 2840, // US
      language_code: 'en',
      limit: 1000,
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
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const items = data.tasks?.[0]?.result?.[0]?.items || [];
  console.log(`  DataForSEO: ${items.length} ranked keywords found`);

  // Build map: url_path → [{ keyword, position, volume, cpc }]
  const urlMap = {};
  for (const item of items) {
    const relUrl = item.ranked_serp_element?.serp_item?.relative_url;
    if (!relUrl) continue;
    const path = relUrl.startsWith('/') ? relUrl : '/' + relUrl;

    if (!urlMap[path]) urlMap[path] = [];
    urlMap[path].push({
      keyword: item.keyword_data?.keyword,
      position: item.ranked_serp_element?.serp_item?.rank_absolute,
      volume: item.keyword_data?.keyword_info?.search_volume || 0,
      cpc: item.keyword_data?.keyword_info?.cpc || 0,
    });
  }

  return urlMap;
}

// ── DataForSEO Bulk URL Metrics ────────────────────────────────────────────────

async function fetchDataForSEOUrlMetrics(slugs) {
  // Use DataForSEO On-Page API to batch-check URL metrics (domain authority proxy)
  // Since we can't get individual page authority easily, we'll use the ranked keywords
  // approach and score based on traffic signals we already have.
  // This is a placeholder for future enhancement.
  return {};
}

// ── Scoring & Categorization ───────────────────────────────────────────────────

function scorePost(post, gscData, dfsData) {
  let score = 0;
  let signals = [];

  // Find this post in GSC/DFS data by trying all possible URL formats
  let gscMatch = null;
  let dfsMatch = null;

  for (const url of post.possibleUrls) {
    if (!gscMatch && gscData[url]) gscMatch = { url, ...gscData[url] };
    if (!dfsMatch && dfsData[url]) dfsMatch = { url, keywords: dfsData[url] };
  }

  // Also try without trailing slash
  for (const url of post.possibleUrls) {
    const noSlash = url.replace(/\/$/, '');
    if (!gscMatch && gscData[noSlash]) gscMatch = { url: noSlash, ...gscData[noSlash] };
    if (!dfsMatch && dfsData[noSlash]) dfsMatch = { url: noSlash, keywords: dfsData[noSlash] };
  }

  // GSC signals
  if (gscMatch) {
    if (gscMatch.clicks > 100) { score += 40; signals.push(`${gscMatch.clicks} clicks`); }
    else if (gscMatch.clicks > 20) { score += 25; signals.push(`${gscMatch.clicks} clicks`); }
    else if (gscMatch.clicks > 0) { score += 10; signals.push(`${gscMatch.clicks} clicks`); }
    if (gscMatch.impressions > 1000) { score += 20; signals.push(`${gscMatch.impressions} impressions`); }
    else if (gscMatch.impressions > 100) { score += 10; signals.push(`${gscMatch.impressions} impressions`); }
    if (gscMatch.position <= 10) { score += 20; signals.push(`pos ${gscMatch.position.toFixed(1)}`); }
    else if (gscMatch.position <= 30) { score += 10; signals.push(`pos ${gscMatch.position.toFixed(1)}`); }
  }

  // DataForSEO signals
  if (dfsMatch) {
    const keywords = dfsMatch.keywords;
    const topKeyword = keywords.sort((a, b) => b.volume - a.volume)[0];
    const totalVolume = keywords.reduce((s, k) => s + k.volume, 0);
    if (totalVolume > 5000) { score += 30; signals.push(`${totalVolume} monthly vol`); }
    else if (totalVolume > 1000) { score += 20; signals.push(`${totalVolume} monthly vol`); }
    else if (totalVolume > 100) { score += 10; signals.push(`${totalVolume} monthly vol`); }
    const avgPosition = keywords.reduce((s, k) => s + (k.position || 100), 0) / keywords.length;
    if (avgPosition <= 10) { score += 20; signals.push(`avg rank ${avgPosition.toFixed(0)}`); }
    else if (avgPosition <= 30) { score += 10; signals.push(`avg rank ${avgPosition.toFixed(0)}`); }
  }

  // Content quality signals
  if (post.wordCount >= 1200) { score += 15; signals.push(`${post.wordCount}w`); }
  else if (post.wordCount >= 600) { score += 8; signals.push(`${post.wordCount}w`); }
  else if (post.wordCount >= 300) { score += 3; signals.push(`${post.wordCount}w`); }

  // Recency (slightly favor newer content)
  const year = parseInt(post.date.slice(0, 4));
  if (year >= 2022) { score += 5; }
  else if (year >= 2019) { score += 2; }

  // Determine category
  let action, reason;
  if (score >= 60) {
    action = 'MIGRATE_REWRITE';
    reason = 'High traffic/rankings — must migrate with full rewrite';
  } else if (score >= 30) {
    action = 'EVALUATE';
    reason = 'Some signals — review manually, likely worth rewriting';
  } else if (score >= 15 && post.wordCount >= 600) {
    action = 'REDIRECT_ONLY';
    reason = 'Low traffic but decent content — redirect to closest new page';
  } else if (gscMatch || dfsMatch) {
    action = 'REDIRECT_ONLY';
    reason = 'Has some ranking presence — set redirect to prevent 404';
  } else {
    action = 'SKIP';
    reason = 'No traffic signals, thin content — skip';
  }

  // Override: always redirect pages with any GSC traffic to prevent 404 loss
  if (action === 'SKIP' && gscMatch && (gscMatch.clicks > 0 || gscMatch.impressions > 50)) {
    action = 'REDIRECT_ONLY';
    reason = 'Has GSC impressions — set redirect to prevent 404';
  }

  return {
    score,
    action,
    reason,
    signals,
    gsc: gscMatch,
    dfs: dfsMatch ? { url: dfsMatch.url, keywordCount: dfsMatch.keywords.length, topKeywords: dfsMatch.keywords.slice(0, 5) } : null,
  };
}

// ── Determine new URL for redirect ────────────────────────────────────────────

function determineNewUrl(post) {
  // The new Astro site uses /{slug}/ for articles
  // If the old WP slug maps cleanly to the new site's content, link there
  // Otherwise redirect to the most relevant destination hub or the homepage

  const slug = post.slug;

  // Check if slug matches any existing new articles
  const newArticles = ['destination-wedding-guide', 'destination-wedding-cost', 'beach-wedding-checklist'];
  if (newArticles.includes(slug)) return `/${slug}/`;

  // Destination-specific content → redirect to destination hub
  const destinationMatches = [
    { patterns: ['cancun', 'mexico'], dest: '/destinations/cancun/' },
    { patterns: ['bali', 'indonesi'], dest: '/destinations/bali/' },
    { patterns: ['santorini', 'greece', 'greek'], dest: '/destinations/santorini/' },
    { patterns: ['hawaii', 'maui', 'kauai', 'oahu', 'waikiki'], dest: '/destinations/hawaii/' },
    { patterns: ['jamaica', 'negril', 'montego'], dest: '/destinations/jamaica/' },
    { patterns: ['punta-cana', 'punta cana', 'dominican'], dest: '/destinations/punta-cana/' },
    { patterns: ['tulum'], dest: '/destinations/tulum/' },
    { patterns: ['costa-rica', 'costa rica'], dest: '/destinations/costa-rica/' },
    { patterns: ['key-west', 'key west', 'florida keys'], dest: '/destinations/key-west/' },
  ];

  const slugAndTitle = (slug + ' ' + post.title).toLowerCase();
  for (const { patterns, dest } of destinationMatches) {
    if (patterns.some(p => slugAndTitle.includes(p))) return dest;
  }

  // Topic-based redirects
  if (/budget|cost|price|afford|save money|saving/.test(slugAndTitle)) return '/destination-wedding-cost/';
  if (/checklist|timeline|planning|plan|step|how to|guide/.test(slugAndTitle)) return '/beach-wedding-checklist/';
  if (/photographer|photo/.test(slugAndTitle)) return '/vendors/';
  if (/planner|vendor|florist|catering|caterer|dj|officiant/.test(slugAndTitle)) return '/vendors/';
  if (/dress|gown|attire|veil|accessories|shoes|jewelry|ring|engagement/.test(slugAndTitle)) return '/destination-wedding-guide/';

  // Default: main guide
  return '/destination-wedding-guide/';
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== WordPress Migration Audit ===\n');

  // 1. Load WP posts
  console.log('Loading wp_posts.csv...');
  const wpPosts = loadWPPosts();
  console.log(`  ${wpPosts.length} published posts/pages loaded`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping API calls. Showing CSV summary only.\n');
    const wc = { thin: 0, short: 0, medium: 0, long: 0 };
    for (const p of wpPosts) {
      if (p.wordCount < 300) wc.thin++;
      else if (p.wordCount < 800) wc.short++;
      else if (p.wordCount < 1500) wc.medium++;
      else wc.long++;
    }
    console.log('Word count buckets:', wc);
    console.log('\nTop 20 by word count:');
    wpPosts.sort((a,b) => b.wordCount - a.wordCount).slice(0,20).forEach(p =>
      console.log(`  ${p.wordCount}w  ${p.slug}  |  ${p.title.slice(0,60)}`)
    );
    return;
  }

  // 2. GSC data
  let gscData = {};
  if (!DFS_ONLY) {
    try {
      gscData = await fetchGSCData();
      console.log(`  GSC: ${Object.keys(gscData).length} unique URLs with data`);
    } catch (err) {
      console.log(`  GSC error: ${err.message}`);
      console.log('  (Continuing without GSC data — may still be syncing)');
    }
  }

  // 3. DataForSEO ranked keywords
  let dfsData = {};
  if (!GSC_ONLY) {
    try {
      dfsData = await fetchDataForSEORankedKeywords();
      // Reveal actual URL structure from DFS results
      const sampleUrls = Object.keys(dfsData).slice(0, 10);
      console.log('  DataForSEO URL samples:', sampleUrls);
    } catch (err) {
      console.log(`  DataForSEO error: ${err.message}`);
    }
  }

  // 4. Score and categorize each post
  console.log('\nScoring posts...');
  const results = wpPosts.map(post => {
    const scoring = scorePost(post, gscData, dfsData);
    const newUrl = (scoring.action !== 'SKIP') ? determineNewUrl(post) : null;
    const oldUrl = scoring.gsc?.url || scoring.dfs?.url || `/${post.slug}/`;
    return { ...post, ...scoring, oldUrl, newUrl };
  });

  // 5. Sort and summarize
  results.sort((a, b) => b.score - a.score);

  const byAction = {
    MIGRATE_REWRITE: results.filter(r => r.action === 'MIGRATE_REWRITE'),
    EVALUATE: results.filter(r => r.action === 'EVALUATE'),
    REDIRECT_ONLY: results.filter(r => r.action === 'REDIRECT_ONLY'),
    SKIP: results.filter(r => r.action === 'SKIP'),
  };

  console.log('\n=== Results ===');
  console.log(`  MIGRATE_REWRITE: ${byAction.MIGRATE_REWRITE.length} posts`);
  console.log(`  EVALUATE:        ${byAction.EVALUATE.length} posts`);
  console.log(`  REDIRECT_ONLY:   ${byAction.REDIRECT_ONLY.length} posts`);
  console.log(`  SKIP:            ${byAction.SKIP.length} posts`);

  // 6. Build redirect file (Cloudflare Pages _redirects format)
  const redirectLines = [];
  const redirected = results.filter(r => r.action !== 'SKIP' && r.newUrl);

  // Deduplicate: one redirect per unique old URL
  const seen = new Set();
  for (const post of redirected) {
    for (const url of post.possibleUrls) {
      if (!seen.has(url) && url !== post.newUrl) {
        seen.add(url);
        redirectLines.push(`${url} ${post.newUrl} 301`);
      }
    }
    if (!seen.has(post.oldUrl) && post.oldUrl !== post.newUrl) {
      seen.add(post.oldUrl);
      redirectLines.push(`${post.oldUrl} ${post.newUrl} 301`);
    }
  }

  // 7. Write output files
  const outputDir = join(ROOT, 'scripts', 'wp-migration');

  writeFileSync(join(outputDir, 'audit-results.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      migrate: byAction.MIGRATE_REWRITE.length,
      evaluate: byAction.EVALUATE.length,
      redirect: byAction.REDIRECT_ONLY.length,
      skip: byAction.SKIP.length,
    },
    gscUrlCount: Object.keys(gscData).length,
    dfsUrlCount: Object.keys(dfsData).length,
    posts: results
  }, null, 2));

  writeFileSync(join(outputDir, 'redirects.txt'), redirectLines.join('\n') + '\n');

  // 8. Human-readable markdown report
  const report = buildMarkdownReport(byAction, gscData, dfsData, redirectLines.length);
  writeFileSync(join(outputDir, 'audit-report.md'), report);

  console.log(`\nOutput files:`);
  console.log(`  scripts/wp-migration/audit-results.json`);
  console.log(`  scripts/wp-migration/audit-report.md`);
  console.log(`  scripts/wp-migration/redirects.txt  (${redirectLines.length} redirects)`);
}

// ── Markdown Report Builder ────────────────────────────────────────────────────

function buildMarkdownReport(byAction, gscData, dfsData, redirectCount) {
  const lines = [
    `# WordPress Migration Audit Report`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `## Summary`,
    ``,
    `| Action | Count | Description |`,
    `|--------|-------|-------------|`,
    `| MIGRATE_REWRITE | ${byAction.MIGRATE_REWRITE.length} | Has traffic/rankings — rewrite and migrate to new site |`,
    `| EVALUATE | ${byAction.EVALUATE.length} | Some signals — review manually and decide |`,
    `| REDIRECT_ONLY | ${byAction.REDIRECT_ONLY.length} | Limited content but has ranking presence — just redirect |`,
    `| SKIP | ${byAction.SKIP.length} | No traffic, thin content — safe to drop |`,
    `| **Total** | **${Object.values(byAction).reduce((s,a) => s+a.length, 0)}** | |`,
    ``,
    `GSC data: ${Object.keys(gscData).length} URLs with impression data`,
    `DataForSEO: ${Object.keys(dfsData).length} URLs with ranking data`,
    `Redirects generated: ${redirectCount}`,
    ``,
    `## Posts to MIGRATE & REWRITE (priority order)`,
    ``,
    `These have real traffic or keyword volume. Full rewrite required — do not copy-paste.`,
    ``,
  ];

  for (const post of byAction.MIGRATE_REWRITE) {
    lines.push(`### [${post.title}](/${post.slug}/)`);
    lines.push(`- **Score:** ${post.score} | **Words:** ${post.wordCount} | **Date:** ${post.date}`);
    lines.push(`- **Signals:** ${post.signals.join(', ')}`);
    if (post.gsc) lines.push(`- **GSC:** ${post.gsc.clicks} clicks, ${post.gsc.impressions} impressions, pos ${post.gsc.position?.toFixed(1)}`);
    if (post.dfs) {
      const kws = post.dfs.topKeywords.map(k => `${k.keyword} (${k.position}, ${k.volume}/mo)`).join('; ');
      lines.push(`- **Keywords:** ${kws}`);
    }
    lines.push(`- **Old URL:** \`${post.oldUrl}\``);
    lines.push(`- **New URL:** \`${post.newUrl || 'TBD — needs new article'}\``);
    lines.push(`- **Excerpt:** ${post.excerpt.slice(0, 200)}...`);
    lines.push('');
  }

  lines.push(`## Posts to EVALUATE`);
  lines.push('');
  lines.push('| Title | Score | Words | Signals | Old URL |');
  lines.push('|-------|-------|-------|---------|---------|');
  for (const post of byAction.EVALUATE) {
    lines.push(`| ${post.title.slice(0, 50)} | ${post.score} | ${post.wordCount} | ${post.signals.slice(0,3).join(', ')} | \`${post.oldUrl}\` |`);
  }

  lines.push('');
  lines.push(`## REDIRECT_ONLY (no rewrite needed)`);
  lines.push('');
  lines.push('| Old URL | New URL | Reason |');
  lines.push('|---------|---------|--------|');
  for (const post of byAction.REDIRECT_ONLY.slice(0, 50)) {
    lines.push(`| \`${post.oldUrl}\` | \`${post.newUrl}\` | ${post.reason} |`);
  }
  if (byAction.REDIRECT_ONLY.length > 50) {
    lines.push(`| ... | ... | ${byAction.REDIRECT_ONLY.length - 50} more in audit-results.json |`);
  }

  lines.push('');
  lines.push(`## Next Steps`);
  lines.push('');
  lines.push('1. Copy `scripts/wp-migration/redirects.txt` content into `public/_redirects`');
  lines.push('2. For each MIGRATE_REWRITE post: create a new article in `src/content/articles/` with full rewrite');
  lines.push('3. Update redirects for migrated articles to point to their new slugs (not the catch-all destination page)');
  lines.push('4. For EVALUATE posts: review each manually and decide migrate vs redirect');
  lines.push('5. Run `npm run build` to verify all redirects and new articles build cleanly');

  return lines.join('\n');
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
