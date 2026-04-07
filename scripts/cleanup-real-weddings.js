/**
 * Clean up real wedding MDX files:
 * - Split body text into paragraphs at section headings
 * - Separate VENDORS section into frontmatter field
 * - Remove money matters section (not on-brand)
 *
 * Usage: node scripts/cleanup-real-weddings.js [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'src', 'content', 'realWeddings');
const dryRun = process.argv.includes('--dry-run');

// Section headings that appear in WP gallery posts
const SECTION_HEADINGS = [
  'Our Story', 'The Theme', 'Wedding Outfit Inspiration', 'The Dress',
  'Our Do-It-Yourself', 'DIY Projects', 'Favorite Part of the Day',
  'Highlights from the Ceremony', 'A Memorable Moment', 'What Made The Day',
  'Extra Special Details', 'The Photographer', 'Heed This Advice',
  'Money Matters', 'VENDORS', 'Vendors', 'The Details',
  'Words of Advice', 'About the Couple', 'The Proposal',
];

// Parse vendor string "Key: Value" lines after VENDORS heading
function parseVendors(text) {
  const vendors = [];
  const lines = text.split(/\n|(?=[A-Z][^:]+:)/);
  for (const line of lines) {
    const m = line.trim().match(/^([A-Z][^:]{2,40}):\s*(.+)/);
    if (m) vendors.push({ role: m[1].trim(), name: m[2].trim() });
  }
  return vendors;
}

// Split wall-of-text into paragraphs using section headings as natural breaks
function formatBody(raw) {
  let text = raw.trim();

  // Split off VENDORS section
  const vendorMatch = text.match(/\n?VENDORS\b([\s\S]*)$/i) ||
                      text.match(/\n?Vendors\b([\s\S]*)$/);
  let vendorText = '';
  if (vendorMatch) {
    vendorText = vendorMatch[1];
    text = text.slice(0, vendorMatch.index).trim();
  }

  // Remove Money Matters section
  text = text.replace(/Money Matters[\s\S]{0,200}?\$[\d,\-\s]+/i, '').trim();

  // Insert paragraph breaks before known section headings
  for (const h of SECTION_HEADINGS) {
    if (h === 'VENDORS' || h === 'Vendors' || h === 'Money Matters') continue;
    const re = new RegExp(`(\\s)(${h.replace(/[()]/g, '\\$&')}\\b)`, 'g');
    text = text.replace(re, '\n\n**$2**\n\n');
  }

  // Break remaining long runs at sentence boundaries (every ~3 sentences)
  const parts = text.split('\n\n');
  const formatted = parts.map(part => {
    if (part.startsWith('**')) return part; // already a heading
    // Split into sentences
    const sentences = part.match(/[^.!?]+[.!?]+["']?/g) || [part];
    if (sentences.length <= 3) return part;
    // Group into paragraphs of ~3 sentences
    const paras = [];
    for (let i = 0; i < sentences.length; i += 3) {
      paras.push(sentences.slice(i, i + 3).join(' ').trim());
    }
    return paras.join('\n\n');
  });

  return { body: formatted.join('\n\n').trim(), vendorText };
}

const files = readdirSync(DIR).filter(f => f.endsWith('.mdx'));
let updated = 0;

for (const f of files) {
  const path = join(DIR, f);
  const content = readFileSync(path, 'utf-8');

  // Split frontmatter from body
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) continue;

  const fm = fmMatch[1];
  const rawBody = fmMatch[2].trim();

  // Skip if already cleaned (has markdown paragraphs/headings)
  if (rawBody.includes('\n\n') && rawBody.split('\n\n').length > 3) continue;

  const { body, vendorText } = formatBody(rawBody);
  const vendors = vendorText ? parseVendors(vendorText) : [];

  // Build vendors YAML block
  let newFm = fm;
  if (vendors.length > 0 && !fm.includes('vendors:')) {
    const vendorYaml = 'vendors:\n' + vendors
      .map(v => `  - role: "${v.role.replace(/"/g, '\\"')}"\n    name: "${v.name.replace(/"/g, '\\"')}"`)
      .join('\n');
    newFm = fm.trimEnd() + '\n' + vendorYaml;
  }

  const newContent = `---\n${newFm}\n---\n\n${body}\n`;

  if (!dryRun) {
    writeFileSync(path, newContent, 'utf-8');
  } else {
    console.log(`\n=== ${f} ===`);
    console.log('BODY PREVIEW:');
    console.log(body.slice(0, 300));
    if (vendors.length) console.log('\nVENDORS:', vendors.slice(0, 3));
  }
  updated++;
}

console.log(`\n${dryRun ? '[DRY RUN] Would update' : 'Updated'} ${updated} files`);
