/**
 * Backfill affiliate cards into existing articles.
 *
 * Scans all articles in src/content/articles/ for keyword matches
 * from AFFILIATE_TARGETS and injects styled affiliate cards (max 3 per article).
 * Sets affiliateDisclosure: true in frontmatter when cards are added.
 *
 * Also strips old-style inline affiliate links (<a href="tidd.ly/...">)
 * that were injected by the previous version of this script.
 *
 * Usage:
 *   node scripts/backfill-affiliate-links.js --dry-run   # Preview changes
 *   node scripts/backfill-affiliate-links.js              # Apply changes
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ARTICLES_DIR, AFFILIATE_TARGETS } from './content-engine/lib/config.js';

const dryRun = process.argv.includes('--dry-run');
const MAX_PER_ARTICLE = 3;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  return { fm: parseYaml(match[1]), body: match[2], rawFm: match[1] };
}

function assembleFrontmatter(fm, body) {
  return `---\n${stringifyYaml(fm).trim()}\n---\n${body}`;
}

/**
 * Strip old inline affiliate links injected by the previous backfill.
 * Converts <a href="https://tidd.ly/..." ...>text</a> back to just "text".
 * Also fixes nested link bugs (e.g. <a href="...">text <a href="tidd.ly/...">inner</a></a>).
 */
function stripOldInlineAffiliateLinks(body) {
  let cleaned = body;
  let count = 0;

  // Fix nested link bugs first: <a href="...">text <a href="tidd.ly/...">inner</a></a>
  // Replace the outer broken structure
  const nestedPattern = /<a\s+href="[^"]*"[^>]*>([^<]*)<a\s+href="https:\/\/tidd\.ly\/[^"]*"[^>]*>([^<]*)<\/a><\/a>/g;
  cleaned = cleaned.replace(nestedPattern, (_, outerText, innerText) => {
    count++;
    return outerText + innerText;
  });

  // Strip standalone inline affiliate links: <a href="https://tidd.ly/...">text</a>
  const inlinePattern = /<a\s+href="https:\/\/tidd\.ly\/[^"]*"\s+target="_blank"\s+rel="sponsored nofollow noopener">([^<]*)<\/a>/g;
  cleaned = cleaned.replace(inlinePattern, (_, text) => {
    count++;
    return text;
  });

  // Also strip any existing affiliate cards from previous runs
  const cardPattern = /\n?<div class="affiliate-card not-prose">[\s\S]*?<\/div>\n?/g;
  cleaned = cleaned.replace(cardPattern, (match) => {
    count++;
    return '\n';
  });

  // Clean up any double blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return { body: cleaned, stripped: count };
}

function buildAffiliateCardHtml(target) {
  const arrow = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd"/></svg>';
  return `\n<div class="affiliate-card not-prose">\n<span class="affiliate-card-label">${target.label}</span>\n<p class="affiliate-card-title">${target.cardTitle}</p>\n<p class="affiliate-card-desc">${target.cardDesc}</p>\n<a class="affiliate-card-cta" href="${target.url}" target="_blank" rel="${target.rel} noopener">${target.cardCta} ${arrow}</a>\n</div>\n`;
}

function processArticle(filepath) {
  const raw = readFileSync(filepath, 'utf8');
  const parsed = splitFrontmatter(raw);
  if (!parsed) return null;

  let { fm, body } = parsed;

  // Step 1: Strip old inline affiliate links and existing cards
  const { body: cleanedBody, stripped } = stripOldInlineAffiliateLinks(body);
  body = cleanedBody;

  // Step 2: Inject affiliate cards
  let updated = body;
  let added = 0;
  const linked = new Set();

  for (const target of AFFILIATE_TARGETS) {
    if (added >= MAX_PER_ARTICLE) break;
    if (linked.has(target.url)) continue;

    // Skip if this affiliate URL is already in the article
    if (updated.includes(target.url)) {
      linked.add(target.url);
      continue;
    }

    for (const pattern of target.patterns) {
      if (added >= MAX_PER_ARTICLE) break;

      const regex = new RegExp(`\\b(${escapeRegex(pattern)})\\b`, 'i');
      const match = updated.match(regex);
      if (!match) continue;

      const idx = match.index;
      // Don't match inside existing links, headings, image alts, or HTML tags
      const before = updated.slice(Math.max(0, idx - 10), idx);
      if (before.includes('[') || before.includes('(') || before.includes('#') || before.includes('!') || before.includes('<')) continue;

      // Don't place card after first paragraph under H2 (answer capsule)
      const linesBefore = updated.slice(0, idx).split('\n');
      const lastH2Idx = linesBefore.findLastIndex(l => l.startsWith('## '));
      if (lastH2Idx >= 0) {
        const linesBetween = linesBefore.slice(lastH2Idx + 1).filter(l => l.trim()).length;
        if (linesBetween < 1) continue;
      }

      // Find end of the paragraph containing this keyword
      const afterMatch = updated.slice(idx);
      const nextBlankLine = afterMatch.indexOf('\n\n');
      const insertPos = nextBlankLine === -1
        ? updated.length
        : idx + nextBlankLine;

      const card = buildAffiliateCardHtml(target);
      updated = updated.slice(0, insertPos) + '\n' + card + updated.slice(insertPos);
      linked.add(target.url);
      added++;
      break;
    }
  }

  if (added === 0 && stripped === 0) return null;

  if (added > 0) {
    fm.affiliateDisclosure = true;
  }
  return { content: assembleFrontmatter(fm, updated), added, stripped };
}

// Main
const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
let totalModified = 0;
let totalCards = 0;
let totalStripped = 0;

console.log(`${dryRun ? '[DRY RUN] ' : ''}Scanning ${files.length} articles...\n`);

for (const file of files) {
  const filepath = join(ARTICLES_DIR, file);
  const result = processArticle(filepath);
  if (!result) continue;

  totalModified++;
  totalCards += result.added;
  totalStripped += result.stripped;

  const parts = [];
  if (result.stripped > 0) parts.push(`stripped ${result.stripped} old link(s)`);
  if (result.added > 0) parts.push(`+${result.added} card(s)`);
  console.log(`  ${file}: ${parts.join(', ')}`);

  if (!dryRun) {
    writeFileSync(filepath, result.content, 'utf8');
  }
}

console.log(`\n${dryRun ? '[DRY RUN] Would modify' : 'Modified'}: ${totalModified} articles`);
console.log(`  Old inline links stripped: ${totalStripped}`);
console.log(`  New affiliate cards added: ${totalCards}`);
