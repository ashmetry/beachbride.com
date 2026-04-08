/**
 * Test section image generation on an already-published article.
 *
 * Generates section images based on the article's H2 headings and inserts
 * them into the article body in place — no re-running the full $3 pipeline.
 *
 * Usage:
 *   node scripts/content-engine/test-section-images.js [slug]
 *
 * Default slug: beach-wedding-colors
 *
 * Cost: ~$0.15–0.20 (3 Gemini images + 3 Haiku prompts)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ARTICLES_DIR, IMAGES_DIR, MODEL_BRIEF } from './lib/config.js';
import { generateSectionImages } from './lib/gemini-image.js';

const slug = process.argv[2] || 'beach-wedding-colors';

// Copy of the visual intent patterns from generate.js
const VISUAL_INTENT_PATTERNS = [
  /color[s]?|colour[s]?|palette[s]?/,
  /cake[s]?/,
  /bouquet[s]?|floral|flower[s]?/,
  /nail[s]?/,
  /decor|decoration[s]?|centerpiece[s]?/,
  /dress|gown|attire/,
  /shoe[s]?|sandal[s]?|heel[s]?/,
  /tablescape[s]?/,
  /invitation[s]?|stationery/,
  /favor[s]?/,
  /boutonniere[s]?/,
  /lighting|lantern[s]?/,
  /arch|arbor/,
  /hair|updo/,
];

function detectVisualIntent(keyword) {
  return VISUAL_INTENT_PATTERNS.some(p => p.test(keyword.toLowerCase()));
}

function getSectionImageCount(keyword) {
  if (/color[s]?|colour[s]?|palette[s]?/.test(keyword.toLowerCase())) return 3;
  return 2;
}

function insertSectionImagesIntoArticle(articlePath, sectionResults, slug) {
  if (!sectionResults.length) return 0;
  let content = readFileSync(articlePath, 'utf8');

  const reversed = [...sectionResults].reverse();
  let inserted = 0;

  for (const { h2, imageIndex, altText } of reversed) {
    const escaped = h2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const h2Regex = new RegExp(`(^## ${escaped}[^\n]*\n)`, 'm');
    const imgTag = `\n![${altText || h2}](/images/${slug}-${imageIndex}.jpg)\n`;
    if (h2Regex.test(content)) {
      content = content.replace(h2Regex, `$1${imgTag}`);
      inserted++;
    } else {
      console.log(`  Warning: could not find H2 matching "${h2}" — skipping`);
    }
  }

  writeFileSync(articlePath, content);
  return inserted;
}

async function main() {
  console.log(`\n=== Section Image Test: ${slug} ===\n`);

  const mdxPath = join(ARTICLES_DIR, `${slug}.mdx`);
  const mdPath  = join(ARTICLES_DIR, `${slug}.md`);
  const articlePath = existsSync(mdxPath) ? mdxPath : mdPath;

  if (!existsSync(articlePath)) {
    console.error(`Article not found: ${articlePath}`);
    process.exit(1);
  }

  // Parse title and H2 headings from article
  const raw = readFileSync(articlePath, 'utf8');
  const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch?.[1] || slug;
  const bodyMatch = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/);
  const body = bodyMatch?.[1] || '';
  const h2Outline = (body.match(/^## .+/gm) || []).map(h => h.replace(/^## /, '').trim());

  console.log(`  Title: ${title}`);
  console.log(`  H2s found: ${h2Outline.length}`);
  h2Outline.forEach((h, i) => console.log(`    ${i + 1}. ${h}`));

  if (!detectVisualIntent(slug.replace(/-/g, ' '))) {
    console.log(`\n  Note: "${slug}" is not flagged as visual-intent by pattern matching.`);
    console.log('  Proceeding anyway for test purposes.\n');
  }

  const imageCount = getSectionImageCount(slug.replace(/-/g, ' '));
  console.log(`\n  Generating ${imageCount} section images...\n`);

  const sectionResults = await generateSectionImages(
    slug,
    title,
    h2Outline,
    IMAGES_DIR, // Write directly to public/images/ (already published)
    imageCount,
  );

  if (sectionResults.length === 0) {
    console.log('\n  No section images generated. Check GEMINI_API_KEY.');
    process.exit(1);
  }

  console.log(`\n  Generated ${sectionResults.length} section image(s):`);
  sectionResults.forEach(r => console.log(`    ${slug}-${r.imageIndex}.jpg → after "${r.h2}"`));

  // Insert image tags into the published article
  const inserted = insertSectionImagesIntoArticle(articlePath, sectionResults, slug);
  console.log(`\n  Inserted ${inserted} image tag(s) into ${articlePath}`);

  console.log('\n  Done. Review the article and images, then commit if happy:');
  console.log(`    git add src/content/articles/${slug}.* public/images/${slug}-*.jpg`);
  console.log(`    git commit -m "Add section images to ${slug}"`);
  console.log('    git push origin main\n');
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
