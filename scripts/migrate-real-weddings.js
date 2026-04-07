/**
 * Migrate Real Wedding Galleries from WP
 *
 * Reads wp_posts.csv, finds the 63 traffic-matched gallery posts, copies their
 * images from the local archive into public/images/real-weddings/[slug]/,
 * and writes MDX files to src/content/realWeddings/[slug].mdx.
 *
 * Usage:
 *   node scripts/migrate-real-weddings.js [--dry-run] [--limit N]
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

const ARCHIVE_DIR = 'C:\\Users\\ash\\Documents\\Projects\\beachbride_uploads_archive';
const OUTPUT_CONTENT_DIR = join(ROOT, 'src', 'content', 'realWeddings');
const OUTPUT_IMAGES_DIR = join(ROOT, 'public', 'images', 'real-weddings');
const CSV_PATH = join(ROOT, 'src', 'data', 'wp_posts.csv');

// The 63 traffic-matched gallery post slugs
const GALLERY_SLUGS = new Set([
  'modern-mexican-destination-wedding',
  'orange-turquoise',
  'chic-nautical-splashes',
  'gilded-seashell-decorations',
  'lovely-cause-beautiful-beginning',
  'colors-sunset-colors-love',
  'seas-the-day',
  'barefoot-and-married',
  'courtney-tim-tiffany-blue-new-white',
  'simple-floral-wedding',
  'even-rain-cant-stop-us',
  'polaroid-memoirs',
  'beach-balls-sea-shells',
  'you-are-the-one',
  'bora-bora-elopement',
  'leap-day-beach-wedding',
  'spring-vibes-at-the-marina',
  'chic-bohemian-dreams',
  'diy-candy-buffet-jars-on-pedestals',
  'el-matador-beach-placerita-canyon-engagement-shoot',
  'teresa-tom-beach-blue-beautiful',
  'love-shined-so-bright',
  'pulling-heart-strings',
  'beach-and-barn-engagement',
  'beach-front-chic-and-romance',
  'bohemian-feels-at-the-beach',
  'traditions-elegance',
  'all-white-glamour',
  'christina-chris-flight-to-forever',
  'miami-skyline-wedding',
  'ocean-blue',
  'our-love-and-the-tropics',
  'romance-overcast-engagement-shoot',
  'surfing-sun-and-sand',
  'vintage-rustic-destination-wedding',
  'laura-ramin',
  'love-and-happiness',
  'neutral-and-non-traditional',
  'sarah-eric',
  'bayside-charm',
  'elegant-settings-engagement-session',
  'jillian-arthur-beautiful-beginning',
  'land-of-leis-and-alohas',
  'pink-navy-nautical-beach-wedding',
  'rustic-bombastic',
  'rustic-chic-and-a-tad-bit-romantic',
  'season-of-love-and-sunflowers',
  'sugar-coated-sea-sand',
  'love-culture-traditions',
  'nicole-daniel',
  'palm-trees-and-sunset',
  'the-sunrise-and-the-beach',
  'amanda-mikey-romantically-rustic',
  'beach-getaway-wedding',
  'come-and-fly-for-love',
  'delight-and-love',
  'jennifer-jason',
  'labyrinthine-patterns',
  'mayra-rodrigo-happily-forever-after',
  'nautical-day',
  'south-padre-island-bayside-wedding',
  'beach-soulmates',
  // extra ones that appear in traffic
  '7-ways-to-bring-the-beach-to-a-wedding-reception-indoors', // already editorial — skip handled below
]);

// Destination slug mapping — best-effort based on known content
const DESTINATION_MAP = {
  'modern-mexican-destination-wedding': 'riviera-maya',
  'bora-bora-elopement': null,
  'laura-ramin': 'riviera-maya',
  'mayra-rodrigo-happily-forever-after': 'cancun',
  'south-padre-island-bayside-wedding': null,
  'leap-day-beach-wedding': null,
  'miami-skyline-wedding': null,
  'pink-navy-nautical-beach-wedding': null,
  'land-of-leis-and-alohas': 'hawaii',
  'nautical-day': null,
};

// CSV parser
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

// Extract image URLs from HTML content
function extractImageUrls(html) {
  const urls = [];
  const re = /(?:src|href)=["']([^"']*?\.(?:jpg|jpeg|png|gif|webp)[^"']*)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let url = m[1];
    // Exclude thumbnail/resized variants — prefer _low or original
    if (url.includes('-150x') || url.includes('-300x') || url.includes('-100x')) continue;
    urls.push(url);
  }
  // Deduplicate
  return [...new Set(urls)];
}

// Convert WP image URL to local archive path
function urlToArchivePath(url) {
  // Remove domain and normalize
  // Handles: https://www.beachbride.com/wp-content/uploads/2021/08/file.jpg
  //          http://www.beachbride.com/blog/wp-content/uploads/2016/05/file.jpg
  const match = url.match(/wp-content\/uploads\/(\d{4}\/\d{2}\/.+)$/);
  if (!match) return null;
  const relPath = match[1].split('/').join('\\');
  return join(ARCHIVE_DIR, relPath);
}

// Strip HTML to plain text
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[caption[^\]]*\].*?\[\/caption\]/gs, '')
    .replace(/\[.*?\]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Infer tags from title + content
function inferTags(title, text) {
  const tags = [];
  const haystack = (title + ' ' + text).toLowerCase();
  if (/bohemian|boho/.test(haystack)) tags.push('boho');
  if (/nautical/.test(haystack)) tags.push('nautical');
  if (/rustic/.test(haystack)) tags.push('rustic');
  if (/tropical/.test(haystack)) tags.push('tropical');
  if (/elopement/.test(haystack)) tags.push('elopement');
  if (/engagement/.test(haystack)) tags.push('engagement');
  if (/chic/.test(haystack)) tags.push('chic');
  if (/vintage/.test(haystack)) tags.push('vintage');
  if (/diy/.test(haystack)) tags.push('diy');
  if (/hawaii|maui|aloha/.test(haystack)) tags.push('hawaii');
  if (/mexico|cancun|cabo|tulum|riviera|playa/.test(haystack)) tags.push('mexico');
  if (/bali/.test(haystack)) tags.push('bali');
  if (/santorini|greece/.test(haystack)) tags.push('santorini');
  if (/caribbean|jamaica|punta cana|bahamas/.test(haystack)) tags.push('caribbean');
  if (/costa rica/.test(haystack)) tags.push('costa-rica');
  if (/bora bora|tahiti|french polynesia/.test(haystack)) tags.push('south-pacific');
  return [...new Set(tags)];
}

// Infer location from content
function inferLocation(title, text) {
  const haystack = (title + ' ' + text).toLowerCase();
  const matches = [
    [/cancun/i, 'Cancun, Mexico'],
    [/punta cana/i, 'Punta Cana, Dominican Republic'],
    [/jamaica/i, 'Jamaica'],
    [/hawaii|maui|oahu|kauai/i, 'Hawaii'],
    [/bali/i, 'Bali, Indonesia'],
    [/santorini/i, 'Santorini, Greece'],
    [/tulum/i, 'Tulum, Mexico'],
    [/costa rica/i, 'Costa Rica'],
    [/bora bora/i, 'Bora Bora, French Polynesia'],
    [/cabo|los cabos/i, 'Los Cabos, Mexico'],
    [/riviera maya|playa del carmen/i, 'Riviera Maya, Mexico'],
    [/south padre/i, 'South Padre Island, TX'],
    [/miami/i, 'Miami, FL'],
    [/fort lauderdale/i, 'Fort Lauderdale, FL'],
    [/palm beach/i, 'Palm Beach, FL'],
    [/key west/i, 'Key West, FL'],
    [/bahamas/i, 'Bahamas'],
    [/st\. pete|clearwater/i, 'St. Pete Beach, FL'],
  ];
  for (const [re, name] of matches) {
    if (re.test(haystack)) return name;
  }
  return null;
}

// Infer photographer credit from content
function inferPhotographer(html) {
  const m = html.match(/[Pp]hoto(?:graphy|grapher)?(?:\s+by)?[:\s]+([A-Z][^<\n,]{3,40})/);
  return m ? m[1].trim() : null;
}

// Escape YAML string
function yamlStr(s) {
  if (!s) return '""';
  return '"' + s.replace(/"/g, '\\"') + '"';
}

async function main() {
  console.log('\n=== Migrate Real Wedding Galleries ===');
  console.log(`  dry-run: ${dryRun}  limit: ${limit === Infinity ? 'none' : limit}\n`);

  if (!dryRun) {
    mkdirSync(OUTPUT_CONTENT_DIR, { recursive: true });
    mkdirSync(OUTPUT_IMAGES_DIR, { recursive: true });
  }

  const csvData = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvData);
  const headers = rows[0];
  const hi = {};
  headers.forEach((h, i) => { hi[h] = i; });

  // Get all published posts matching our gallery slugs (exclude editorial ones already done)
  const EDITORIAL_SLUGS = new Set([
    'destination-wedding-tips',
    'a-delicious-tropical-menu-for-a-beach-themed-bridal-shower',
    'beach-wedding-beautiful-and-easy-centerpiece-ideas',
    '7-ways-to-bring-the-beach-to-a-wedding-reception-indoors',
    'unique-beach-wedding-ideas',
    'gorgeous-beach-themed-wedding-cakes',
    'is-it-really-possible-to-save-money-with-a-beach-destination-wedding',
    'beautiful-light-accessories-for-a-beach-bride',
    'tips-for-planning-your-palm-beaches-destination-beach-wedding',
    'beautiful-beach-wedding-color-schemes',
  ]);

  const posts = rows.slice(1).filter(r =>
    r[hi['post_status']] === 'publish' &&
    r[hi['post_type']] === 'post' &&
    GALLERY_SLUGS.has(r[hi['post_name']]) &&
    !EDITORIAL_SLUGS.has(r[hi['post_name']])
  );

  console.log(`  Found ${posts.length} gallery posts to migrate\n`);

  const stats = { migrated: 0, skipped: 0, imagesCopied: 0, imagesMissing: 0 };

  for (const post of posts.slice(0, limit)) {
    const slug = post[hi['post_name']];
    const title = post[hi['post_title']];
    const rawContent = post[hi['post_content']];
    const postDate = post[hi['post_date']].slice(0, 10);

    const mdxPath = join(OUTPUT_CONTENT_DIR, `${slug}.mdx`);
    if (existsSync(mdxPath)) {
      console.log(`  SKIP (exists): ${slug}`);
      stats.skipped++;
      continue;
    }

    console.log(`\n  ${slug}`);
    console.log(`    Title: ${title}`);

    // Extract and copy images
    const imageUrls = extractImageUrls(rawContent);
    const localImagePaths = [];
    const slugImageDir = join(OUTPUT_IMAGES_DIR, slug);

    if (!dryRun) mkdirSync(slugImageDir, { recursive: true });

    for (const url of imageUrls) {
      const archivePath = urlToArchivePath(url);
      if (!archivePath) continue;

      // Use original filename, sanitized
      const ext = extname(archivePath) || '.jpg';
      const name = basename(archivePath, ext).replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const destName = `${name}${ext}`;
      const destPath = join(slugImageDir, destName);
      const publicPath = `/images/real-weddings/${slug}/${destName}`;

      if (existsSync(archivePath)) {
        if (!dryRun) copyFileSync(archivePath, destPath);
        localImagePaths.push(publicPath);
        stats.imagesCopied++;
      } else {
        console.log(`    MISSING: ${archivePath}`);
        stats.imagesMissing++;
      }
    }

    const heroImage = localImagePaths[0] || null;
    const galleryImages = localImagePaths.slice(1);

    // Build MDX content
    const plainText = stripHtml(rawContent);
    const location = inferLocation(title, plainText);
    const photographer = inferPhotographer(rawContent);
    const tags = inferTags(title, plainText);
    const destination = DESTINATION_MAP[slug] ?? null;

    // Description: first ~160 chars of plain text
    const description = plainText.slice(0, 160).replace(/\s\S+$/, '…');

    const frontmatter = [
      '---',
      `title: ${yamlStr(title)}`,
      `description: ${yamlStr(description)}`,
      `publishDate: ${postDate}`,
      location ? `location: ${yamlStr(location)}` : null,
      photographer ? `photographer: ${yamlStr(photographer)}` : null,
      heroImage ? `heroImage: ${yamlStr(heroImage)}` : null,
      galleryImages.length > 0 ? `images:` : `images: []`,
      ...galleryImages.map(p => `  - ${yamlStr(p)}`),
      tags.length > 0 ? `tags:` : `tags: []`,
      ...tags.map(t => `  - ${t}`),
      destination ? `destination: ${destination}` : null,
      '---',
    ].filter(Boolean).join('\n');

    // Body: clean plain text paragraphs (skip if too short)
    const bodyParagraphs = plainText
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 40)
      .slice(0, 8)
      .join('\n\n');

    const mdxContent = frontmatter + '\n\n' + (bodyParagraphs || plainText.slice(0, 500));

    console.log(`    Images: ${localImagePaths.length} (${imageUrls.length} found in HTML)`);
    console.log(`    Tags: ${tags.join(', ') || 'none'}`);
    console.log(`    Location: ${location || 'unknown'}`);

    if (!dryRun) {
      writeFileSync(mdxPath, mdxContent, 'utf-8');
    }

    stats.migrated++;
  }

  console.log('\n=== Migration Summary ===');
  console.log(`  Migrated:      ${stats.migrated}`);
  console.log(`  Skipped:       ${stats.skipped}`);
  console.log(`  Images copied: ${stats.imagesCopied}`);
  console.log(`  Images missing: ${stats.imagesMissing}`);
  if (!dryRun) {
    console.log(`\n  Content: src/content/realWeddings/`);
    console.log(`  Images:  public/images/real-weddings/`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
