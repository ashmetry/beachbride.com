/**
 * Content Engine — pSEO Page Enricher
 * Generates destination-specific editorial copy for vendor type+destination pages.
 * Writes to src/data/pseo-editorial.json, keyed by "type-destination".
 *
 * The Astro template reads this JSON and falls back to hardcoded templates when
 * a key is absent. Run this to add richer, differentiated copy for high-traffic
 * type+destination combos — prevents thin-content risk on low-vendor pages.
 *
 * Usage:
 *   node scripts/content-engine/enrich-pseo-pages.js [--dry-run] [--type planner] [--destination hawaii]
 *   node scripts/content-engine/enrich-pseo-pages.js --all         # regenerate all priority combos
 *   node scripts/content-engine/enrich-pseo-pages.js --skip-existing  # only add missing entries
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { callModelJSON } from './lib/openrouter.js';
import { MODEL_BRIEF } from './lib/config.js';
import destinations from '../../src/data/destinations.json' assert { type: 'json' };
import vendors from '../../src/data/vendors.json' assert { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUTPUT_PATH = join(ROOT, 'src', 'data', 'pseo-editorial.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipExisting = args.includes('--skip-existing');
const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const destFilter = args.includes('--destination') ? args[args.indexOf('--destination') + 1] : null;

// Priority combos: highest-volume type+destination pairs
// Sorted by estimated traffic opportunity (DataForSEO volume × intent)
const PRIORITY_COMBOS = [
  // Hawaii — highest volume destination, all types
  { type: 'planner',      destination: 'hawaii',      volume: 1300 },
  { type: 'photographer', destination: 'hawaii',      volume: 720 },
  { type: 'officiant',    destination: 'hawaii',      volume: 880 },
  { type: 'florist',      destination: 'hawaii',      volume: 480 },
  { type: 'venue',        destination: 'hawaii',      volume: 590 },
  // Cancun — highest aggregate search volume destination
  { type: 'planner',      destination: 'cancun',      volume: 1100 },
  { type: 'photographer', destination: 'cancun',      volume: 590 },
  { type: 'venue',        destination: 'cancun',      volume: 480 },
  { type: 'resort',       destination: 'cancun',      volume: 620 },
  // Jamaica
  { type: 'planner',      destination: 'jamaica',     volume: 320 },
  { type: 'photographer', destination: 'jamaica',     volume: 210 },
  // Bali — high CPC, international luxury market
  { type: 'planner',      destination: 'bali',        volume: 320 },
  { type: 'photographer', destination: 'bali',        volume: 260 },
  { type: 'florist',      destination: 'bali',        volume: 180 },
  // Santorini — very high CPC, premium segment
  { type: 'planner',      destination: 'santorini',   volume: 280 },
  { type: 'photographer', destination: 'santorini',   volume: 310 },
  // Punta Cana
  { type: 'planner',      destination: 'punta-cana',  volume: 290 },
  { type: 'resort',       destination: 'punta-cana',  volume: 380 },
  // Tulum
  { type: 'planner',      destination: 'tulum',       volume: 190 },
  // Costa Rica
  { type: 'planner',      destination: 'costa-rica',  volume: 210 },
];

// Vendor type context for prompts
const TYPE_CONTEXT = {
  planner: 'wedding planner or wedding coordinator',
  photographer: 'wedding photographer',
  florist: 'wedding florist',
  caterer: 'wedding caterer',
  dj: 'wedding DJ or entertainment',
  officiant: 'wedding officiant',
  resort: 'wedding resort or all-inclusive hotel',
  venue: 'wedding venue',
};

async function generateEditorialCopy(type, destSlug, dest, vendorCount) {
  const typeLabel = TYPE_CONTEXT[type] || type;

  const prompt = `Write editorial copy for a destination wedding directory page listing ${vendorCount} ${typeLabel}s in ${dest.name}, ${dest.country}.

Context about ${dest.name}:
- Average wedding cost: $${(dest.avgCostUSD.min/1000).toFixed(0)}k–$${(dest.avgCostUSD.max/1000).toFixed(0)}k
- Best season: ${dest.bestMonths.slice(0,3).join(', ')}
- Legal ceremony: ${dest.legalCeremonyType}
- Region: ${dest.region}
${dest.microDestinations?.length ? `- Popular areas: ${dest.microDestinations.slice(0,3).map(m => m.name).join(', ')}` : ''}

Write two things:

1. "heading": A concise H2 heading (max 12 words) that answers the implied question "why should I hire a ${typeLabel} in ${dest.name} specifically?" — not generic, specific to ${dest.name}.

2. "body": 2–3 paragraphs (150–220 words total) of editorial copy that:
   - Opens with what makes hiring a LOCAL ${typeLabel} in ${dest.name} specifically valuable (not generic advice)
   - References real ${dest.name} characteristics: climate, local customs, venue types, legal environment, or cultural context
   - Mentions a specific challenge or opportunity unique to ${dest.name} weddings for this vendor type
   - Ends with a practical action the reader can take (search/compare vendors on the page)
   - Tone: warm and expert, like advice from a friend who planned a ${dest.name} wedding
   - NO marketing fluff, NO em-dashes, NO "seamless", NO "comprehensive", NO "game-changer"
   - Write in second person ("you", "your wedding")

Return JSON: { "heading": "...", "body": "..." }`;

  return await callModelJSON(
    MODEL_BRIEF,
    `You are an expert destination wedding content writer for beachbride.com. Write specific, useful editorial copy that helps couples understand why a local vendor matters in a specific destination.`,
    prompt,
    { temperature: 0.5, max_tokens: 800 }
  );
}

async function main() {
  console.log('\n=== pSEO Page Enricher ===');
  console.log(`  dry-run: ${dryRun}  skip-existing: ${skipExisting}`);
  if (typeFilter) console.log(`  type filter: ${typeFilter}`);
  if (destFilter) console.log(`  destination filter: ${destFilter}`);
  console.log();

  // Load existing data
  let existing = {};
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
    console.log(`  Loaded ${Object.keys(existing).length} existing entries from pseo-editorial.json\n`);
  }

  // Apply filters
  let combos = PRIORITY_COMBOS;
  if (typeFilter) combos = combos.filter(c => c.type === typeFilter);
  if (destFilter) combos = combos.filter(c => c.destination === destFilter);
  if (skipExisting) combos = combos.filter(c => !existing[`${c.type}-${c.destination}`]);

  console.log(`  Processing ${combos.length} combos...\n`);

  const result = { ...existing };
  let generated = 0;
  let skipped = 0;

  for (const combo of combos) {
    const key = `${combo.type}-${combo.destination}`;
    const dest = destinations.find(d => d.slug === combo.destination);

    if (!dest) {
      console.log(`  SKIP ${key}: destination not found`);
      skipped++;
      continue;
    }

    const vendorCount = vendors.filter(v => v.type === combo.type && v.destinations.includes(combo.destination)).length;
    if (vendorCount === 0) {
      console.log(`  SKIP ${key}: no vendors`);
      skipped++;
      continue;
    }

    console.log(`  Generating: ${key} (${vendorCount} vendors, ~${combo.volume}/mo searches)`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate editorial for ${key}`);
      continue;
    }

    try {
      const copy = await generateEditorialCopy(combo.type, combo.destination, dest, vendorCount);

      if (!copy?.heading || !copy?.body) {
        console.log(`  ERROR ${key}: model returned invalid response`);
        continue;
      }

      result[key] = {
        heading: copy.heading,
        body: copy.body,
        generatedAt: new Date().toISOString().slice(0, 10),
        vendorCount,
        volume: combo.volume,
      };

      generated++;
      console.log(`  OK ${key}: "${copy.heading.slice(0, 60)}..."`);

      // Rate limit
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`  ERROR ${key}: ${err.message}`);
    }
  }

  if (!dryRun && generated > 0) {
    writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    console.log(`\n  Wrote ${Object.keys(result).length} total entries to src/data/pseo-editorial.json`);
    console.log(`  (${generated} generated this run, ${skipped} skipped)`);
  }

  console.log(`\n=== Done ===`);
  console.log(`  Generated: ${generated}  Skipped: ${skipped}`);
  if (!dryRun && generated > 0) {
    console.log(`\n  Next: run 'npm run build' to verify pages render correctly`);
  }
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
