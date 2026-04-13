/**
 * One-time script: backfill affiliate links into existing articles.
 *
 * Scans all articles in src/content/articles/ for keyword matches
 * from AFFILIATE_TARGETS and injects tracked links (max 3 per article).
 * Sets affiliateDisclosure: true in frontmatter when links are added.
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

function processArticle(filepath) {
  const raw = readFileSync(filepath, 'utf8');
  const parsed = splitFrontmatter(raw);
  if (!parsed) return null;

  const { fm, body } = parsed;
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
      const before = updated.slice(Math.max(0, idx - 10), idx);
      if (before.includes('[') || before.includes('(') || before.includes('#') || before.includes('!')) continue;

      // Don't link in first paragraph after H2
      const linesBefore = updated.slice(0, idx).split('\n');
      const lastH2Idx = linesBefore.findLastIndex(l => l.startsWith('## '));
      if (lastH2Idx >= 0) {
        const linesBetween = linesBefore.slice(lastH2Idx + 1).filter(l => l.trim()).length;
        if (linesBetween < 1) continue;
      }

      updated = updated.slice(0, idx) +
        `<a href="${target.url}" target="_blank" rel="${target.rel} noopener">${match[1]}</a>` +
        updated.slice(idx + match[1].length);
      linked.add(target.url);
      added++;
      break;
    }
  }

  if (added === 0) return null;

  fm.affiliateDisclosure = true;
  return { content: assembleFrontmatter(fm, updated), added };
}

// Main
const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
let totalModified = 0;
let totalLinks = 0;

console.log(`${dryRun ? '[DRY RUN] ' : ''}Scanning ${files.length} articles for affiliate link opportunities...\n`);

for (const file of files) {
  const filepath = join(ARTICLES_DIR, file);
  const result = processArticle(filepath);
  if (!result) continue;

  totalModified++;
  totalLinks += result.added;
  console.log(`  ${file}: +${result.added} affiliate link(s)`);

  if (!dryRun) {
    writeFileSync(filepath, result.content, 'utf8');
  }
}

console.log(`\n${dryRun ? '[DRY RUN] Would modify' : 'Modified'}: ${totalModified} articles, ${totalLinks} total affiliate links added.`);
