#!/usr/bin/env node
/**
 * seed-vendors-places.js
 *
 * Uses Google Places API (Text Search + Place Details) to discover real
 * destination wedding vendors and seed them into src/data/vendors.json
 * as unclaimed listings.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/seed-vendors-places.js
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/seed-vendors-places.js --destination cancun
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/seed-vendors-places.js --dry-run
 *
 * What it does:
 *   1. For each destination (or the one specified), searches Google Places for
 *      each vendor type (planner, photographer, florist, caterer, dj, officiant)
 *   2. Fetches Place Details for the top results
 *   3. Writes your own description (NOT Google's) for each vendor
 *   4. Adds them to vendors.json with claimed: false
 *   5. Skips vendors already in the file (by name match)
 *
 * Google Places ToS compliance:
 *   - We use the API only to DISCOVER vendor names, types, and locations
 *   - We do NOT store Google's review text, photos, or rating data
 *   - We write our own descriptions based on vendor type + destination
 *   - We do NOT display Google's data — vendors.json is our own content
 *
 * Requirements:
 *   - Google Places API key with Places API (New) enabled
 *   - npm install (no extra deps — uses Node fetch, available in Node 18+)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VENDORS_PATH = join(__dirname, '../src/data/vendors.json');
const DESTINATIONS_PATH = join(__dirname, '../src/data/destinations.json');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const isDryRun = process.argv.includes('--dry-run');
const destFilter = (() => {
  const idx = process.argv.indexOf('--destination');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();
const typesFilter = (() => {
  const idx = process.argv.indexOf('--types');
  return idx !== -1 ? process.argv[idx + 1].split(',') : null;
})();

// Vendor types to search per destination
const VENDOR_TYPES = [
  { type: 'planner',      queries: ['destination wedding planner', 'wedding coordinator'] },
  { type: 'photographer', queries: ['destination wedding photographer'] },
  { type: 'florist',      queries: ['wedding florist', 'wedding flowers'] },
  { type: 'caterer',      queries: ['wedding caterer', 'wedding catering'] },
  { type: 'dj',           queries: ['wedding DJ', 'wedding entertainment'] },
  { type: 'officiant',    queries: ['wedding officiant', 'wedding celebrant'] },
  { type: 'resort',       queries: ['destination wedding resort', 'beach wedding resort', 'all-inclusive wedding resort'] },
  { type: 'venue',        queries: ['beach wedding venue', 'outdoor wedding venue'] },
];

// How many Place results to fetch per query (max 20 per Places API page)
const RESULTS_PER_QUERY = 5;

// Generic description templates — written by us, NOT from Google
function buildDescription(vendorType, destinationName) {
  const templates = {
    planner: [
      `Full-service destination wedding planning in ${destinationName}. Coordinating ceremonies, vendors, and logistics so couples can enjoy every moment.`,
      `${destinationName}-based wedding coordinator specializing in destination celebrations. Local expertise, international couples welcome.`,
    ],
    photographer: [
      `Destination wedding photographer based in ${destinationName}. Natural light, candid moments, and the beauty of the location woven into every image.`,
      `Wedding photography in ${destinationName} and surrounding areas. Available for elopements, intimate ceremonies, and large celebrations.`,
    ],
    florist: [
      `Floral design studio in ${destinationName} specializing in wedding arrangements. Sourcing local and tropical blooms for ceremonies and receptions.`,
      `Wedding florist serving ${destinationName}. Custom arrangements from intimate bouquets to full venue installations.`,
    ],
    caterer: [
      `Wedding catering in ${destinationName}. Custom menus featuring local cuisine and international options for destination celebrations.`,
      `${destinationName} catering team specializing in beach and resort wedding receptions. From cocktail hour to late-night bites.`,
    ],
    dj: [
      `Wedding DJ and entertainment in ${destinationName}. Keeping the dance floor alive from ceremony through last dance.`,
      `Live music and DJ services for destination weddings in ${destinationName}. Bilingual MCs available.`,
    ],
    officiant: [
      `Licensed wedding officiant in ${destinationName}. Symbolic and legal ceremonies performed in English and Spanish.`,
      `Destination wedding officiant serving ${destinationName}. Personalised vows, cultural traditions, and interfaith ceremonies.`,
    ],
    resort: [
      `All-inclusive resort in ${destinationName} with dedicated wedding packages. On-site coordinators, ceremony spaces, and group room blocks available.`,
      `${destinationName} resort offering beach and garden wedding ceremonies. Wedding packages include catering, décor, and accommodation for guests.`,
    ],
    venue: [
      `Dedicated wedding venue in ${destinationName}. Ceremony and reception spaces for intimate elopements through large celebrations.`,
      `${destinationName} wedding venue with ocean or garden settings. Available for full buyouts and partial bookings.`,
    ],
  };
  const options = templates[vendorType] ?? [`Wedding ${vendorType} serving ${destinationName}.`];
  return options[Math.floor(Math.random() * options.length)];
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function searchPlaces(query, locationBias) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: locationBias,
        radius: 50000, // 50km radius
      },
    },
    maxResultCount: RESULTS_PER_QUERY,
    languageCode: 'en',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.businessStatus',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.places ?? [];
}

// Approximate lat/lng centers for each destination slug
const DESTINATION_CENTERS = {
  cancun:        { latitude: 21.1619,  longitude: -86.8515 },
  'punta-cana':  { latitude: 18.5601,  longitude: -68.3725 },
  jamaica:       { latitude: 18.1096,  longitude: -77.2975 },
  hawaii:        { latitude: 20.7984,  longitude: -156.3319 },
  bali:          { latitude: -8.4095,  longitude: 115.1889 },
  santorini:     { latitude: 36.3932,  longitude: 25.4615 },
  tulum:         { latitude: 20.2114,  longitude: -87.4654 },
  'costa-rica':  { latitude: 10.2735,  longitude: -85.8270 },
  'key-west':    { latitude: 24.5551,  longitude: -81.7800 },
  'los-cabos':   { latitude: 22.8905,  longitude: -109.9167 },
  'st-lucia':    { latitude: 13.9094,  longitude: -60.9789 },
  'riviera-maya':{ latitude: 20.6296,  longitude: -87.0739 },
  'turks-caicos':{ latitude: 21.6940,  longitude: -71.7979 },
  aruba:         { latitude: 12.5211,  longitude: -69.9683 },
  maldives:        { latitude: 3.2028,   longitude: 73.2207 },
  fiji:            { latitude: -17.7134, longitude: 178.0650 },
  'turks-and-caicos': { latitude: 21.6940,  longitude: -71.7979 },
  'amalfi-coast':  { latitude: 40.6340,  longitude: 14.6027 },
  tuscany:         { latitude: 43.7711,  longitude: 11.2486 },
  algarve:         { latitude: 37.0179,  longitude: -7.9307 },
  dubrovnik:       { latitude: 42.6507,  longitude: 18.0944 },
  holbox:          { latitude: 21.5255,  longitude: -87.3768 },
  roatan:          { latitude: 16.3200,  longitude: -86.5350 },
  kotor:           { latitude: 42.4247,  longitude: 18.7712 },
  azores:          { latitude: 37.7412,  longitude: -25.6756 },
  'koh-lanta':     { latitude: 7.5367,   longitude: 99.0474 },
};

async function main() {
  if (!API_KEY) {
    console.error('Error: GOOGLE_PLACES_API_KEY environment variable is required.');
    console.error('Usage: GOOGLE_PLACES_API_KEY=your_key node scripts/seed-vendors-places.js');
    process.exit(1);
  }

  const destinations = JSON.parse(readFileSync(DESTINATIONS_PATH, 'utf8'));
  const vendors = JSON.parse(readFileSync(VENDORS_PATH, 'utf8'));

  const existingNames = new Set(vendors.map(v => v.name.toLowerCase()));
  const existingSlugs = new Set(vendors.map(v => v.slug));

  const targetDests = destFilter
    ? destinations.filter(d => d.slug === destFilter)
    : destinations;

  if (destFilter && targetDests.length === 0) {
    console.error(`Destination "${destFilter}" not found in destinations.json`);
    process.exit(1);
  }

  const newVendors = [];

  for (const dest of targetDests) {
    const center = DESTINATION_CENTERS[dest.slug];
    if (!center) {
      console.warn(`No coordinates for "${dest.slug}" — skipping. Add to DESTINATION_CENTERS.`);
      continue;
    }

    console.log(`\n=== ${dest.name} ===`);

    const activeTypes = typesFilter
      ? VENDOR_TYPES.filter(vt => typesFilter.includes(vt.type))
      : VENDOR_TYPES;

    for (const { type, queries } of activeTypes) {
      for (const queryTerm of queries) {
        const fullQuery = `${queryTerm} ${dest.name}`;
        console.log(`  Searching: "${fullQuery}"`);

        let places;
        try {
          places = await searchPlaces(fullQuery, center);
        } catch (err) {
          console.error(`  Error: ${err.message}`);
          continue;
        }

        for (const place of places) {
          const name = place.displayName?.text;
          if (!name) continue;
          if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') continue;

          // Skip if already in our vendors list
          if (existingNames.has(name.toLowerCase())) {
            console.log(`  Skipping (already exists): ${name}`);
            continue;
          }

          // Generate a unique slug
          let baseSlug = slugify(`${name} ${dest.slug}`);
          let slug = baseSlug;
          let counter = 2;
          while (existingSlugs.has(slug)) {
            slug = `${baseSlug}-${counter++}`;
          }

          const vendor = {
            slug,
            name,
            type,
            tier: 'free',
            claimed: false,
            destinations: [dest.slug],
            description: buildDescription(type, dest.name),
            website: place.websiteUri ?? '',
            contact: {
              email: '',
              phone: place.nationalPhoneNumber ?? '',
            },
            rating: null,
            reviewCount: null,
            featured: false,
            image: '',
          };

          existingNames.add(name.toLowerCase());
          existingSlugs.add(slug);
          newVendors.push(vendor);
          console.log(`  + Added: ${name} (${type})`);
        }

        // Respect Places API rate limits
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Found ${newVendors.length} new vendors to add.`);

  if (newVendors.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  if (isDryRun) {
    console.log('\n-- DRY RUN: not writing. New vendors would be:');
    newVendors.forEach(v => console.log(`  ${v.name} (${v.type}, ${v.destinations[0]})`));
    return;
  }

  const updated = [...vendors, ...newVendors];
  writeFileSync(VENDORS_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`\nWrote ${updated.length} total vendors to src/data/vendors.json`);
  console.log('Run `npm run build` to verify, then commit.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
