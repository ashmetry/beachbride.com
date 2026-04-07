/**
 * Regenerate hero image(s) for existing articles.
 *
 * Usage:
 *   node scripts/content-engine/regen-image.js peacock-wedding-cake-ideas beach-wedding-nails-for-bride
 *   node scripts/content-engine/regen-image.js --all   (regenerates every article)
 *
 * Reads article frontmatter + H2 headings, generates a new image via the
 * same Haiku → Gemini pipeline used during content generation, overwrites
 * public/images/{slug}.jpg.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ARTICLES_DIR, IMAGES_DIR, parseFrontmatter } from './lib/config.js';
import { generateHeroImage } from './lib/gemini-image.js';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node regen-image.js <slug> [slug2 ...] | --all');
  process.exit(1);
}

// Resolve target slugs
let slugs;
if (args[0] === '--all') {
  const { readdirSync } = await import('fs');
  slugs = readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
    .map(f => f.replace(/\.(mdx|md)$/, ''));
} else {
  slugs = args;
}

console.log(`Regenerating images for ${slugs.length} article(s)...\n`);

for (const slug of slugs) {
  const mdxPath = join(ARTICLES_DIR, `${slug}.mdx`);
  const mdPath  = join(ARTICLES_DIR, `${slug}.md`);
  const articlePath = existsSync(mdxPath) ? mdxPath : existsSync(mdPath) ? mdPath : null;

  if (!articlePath) {
    console.log(`[${slug}] NOT FOUND — skipping`);
    continue;
  }

  const raw = readFileSync(articlePath, 'utf8');
  const fm = parseFrontmatter(raw);
  const title = fm.title || slug;

  // Extract H2 headings from article body (after the closing ---)
  const bodyStart = raw.indexOf('---', 3) + 3;
  const body = raw.slice(bodyStart);
  const h2Outline = [...body.matchAll(/^##\s+(.+)$/gm)].map(m => m[1].trim()).slice(0, 6);

  const topic = fm.tags?.[0] || slug.replace(/-/g, ' ');

  console.log(`[${slug}]`);
  console.log(`  Title: ${title}`);
  console.log(`  H2s: ${h2Outline.slice(0, 3).join(' | ') || '(none found)'}`);

  const result = await generateHeroImage(slug, title, topic, IMAGES_DIR, h2Outline);

  if (result) {
    console.log(`  Done → ${result.path}\n`);
  } else {
    console.log(`  FAILED (check GEMINI_API_KEY and logs above)\n`);
  }
}

console.log('Complete.');
