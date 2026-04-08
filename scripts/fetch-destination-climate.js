/**
 * fetch-destination-climate.js
 *
 * Fetches real monthly climate data for every destination in destinations.json
 * using the Open-Meteo Historical Weather API (free, no auth required).
 *
 * For each destination, pulls 5 years of daily data (2019-2023) and computes
 * monthly averages for:
 *   - Temperature min/max (°F)
 *   - Rain days per month (configurable threshold, default 5mm)
 *   - Precipitation inches per month
 *
 * Raw daily data is cached so thresholds can be adjusted without re-fetching.
 *
 * Hurricane risk is NOT sourced from this API — it stays hand-curated
 * based on NOAA hurricane season data.
 *
 * Usage:
 *   node scripts/fetch-destination-climate.js              # fetch missing, apply to JSON
 *   node scripts/fetch-destination-climate.js --force       # re-fetch all from API
 *   node scripts/fetch-destination-climate.js --dry-run     # preview without writing
 *   node scripts/fetch-destination-climate.js --validate    # compare API vs existing
 *   node scripts/fetch-destination-climate.js --threshold 5 # set rain day threshold in mm
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DESTINATIONS_PATH = join(ROOT, 'src/data/destinations.json');
const CACHE_PATH = join(ROOT, 'src/data/climate-cache-destinations.json');

const OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive';

const START_YEAR = 2019;
const END_YEAR = 2023;
const YEARS = END_YEAR - START_YEAR + 1;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Rain day threshold in mm.
 *
 * Why 3mm (not 1mm): Open-Meteo uses ERA5 reanalysis data which reports
 * precipitation across ~25km grid cells. In tropical coastal areas, this
 * captures frequent brief showers (5-10 min) that don't affect outdoor events.
 * A 3mm threshold (~0.12 inches) filters trace precipitation while keeping
 * light tropical rain that brides should plan around, aligning well with
 * what major tourism climate sources (Weather Spark, weather-atlas.com)
 * report for rain days.
 *
 * Override with --threshold N (in mm).
 */
const DEFAULT_RAIN_THRESHOLD_MM = 3;

// Destination slug → { lat, lon }
// Coordinates target the primary wedding/resort area, not country centroid.
const DEST_COORDS = {
  'cancun':           { lat: 21.16, lon: -86.85 },
  'punta-cana':       { lat: 18.58, lon: -68.37 },
  'jamaica':          { lat: 18.49, lon: -77.92 },
  'hawaii':           { lat: 20.88, lon: -156.44 },
  'bali':             { lat: -8.81, lon: 115.17 },
  'santorini':        { lat: 36.39, lon: 25.46 },
  'tulum':            { lat: 20.21, lon: -87.43 },
  'key-west':         { lat: 24.56, lon: -81.78 },
  'costa-rica':       { lat: 10.63, lon: -85.44 },
  'los-cabos':        { lat: 22.89, lon: -109.92 },
  'st-lucia':         { lat: 13.90, lon: -60.98 },  // Central (Castries area, better rain capture than coast)
  'riviera-maya':     { lat: 20.63, lon: -87.08 },
  'turks-and-caicos': { lat: 21.77, lon: -72.17 },
  'aruba':            { lat: 12.51, lon: -69.97 },
  'amalfi-coast':     { lat: 40.63, lon: 14.60 },
  'tuscany':          { lat: 43.32, lon: 11.33 },
  'algarve':          { lat: 37.02, lon: -8.13 },
  'dubrovnik':        { lat: 42.65, lon: 18.09 },
  'maldives':         { lat: 4.17, lon: 73.51 },
  'fiji':             { lat: -17.78, lon: 177.44 },
  'holbox':           { lat: 21.52, lon: -87.38 },
  'roatan':           { lat: 16.32, lon: -86.53 },
  'kotor':            { lat: 42.42, lon: 18.77 },
  'azores':           { lat: 37.75, lon: -25.68 },
  'koh-lanta':        { lat: 7.57, lon: 99.04 },
};

// Parse CLI args
const forceRefetch = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
const validateOnly = process.argv.includes('--validate');
const thresholdIdx = process.argv.indexOf('--threshold');
const RAIN_THRESHOLD_MM = thresholdIdx !== -1
  ? parseFloat(process.argv[thresholdIdx + 1])
  : DEFAULT_RAIN_THRESHOLD_MM;

function cToF(c) {
  return Math.round((c * 9) / 5 + 32);
}

function mmToInches(mm) {
  return Math.round((mm / 25.4) * 10) / 10;
}

/**
 * Fetch with retry on 429 rate limits.
 */
async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status === 429 && attempt < retries) {
      const wait = (attempt + 1) * 60000; // 1min, 2min, 3min
      console.log(`  Rate limited, waiting ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    throw new Error(`Open-Meteo ${res.status}: ${text}`);
  }
}

/**
 * Fetch daily weather data from Open-Meteo for one year.
 */
async function fetchYearData(lat, lon, year) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
  });

  const res = await fetchWithRetry(`${OPEN_METEO_BASE}?${params}`);
  return res.json();
}

/**
 * Fetch 5 years of daily data. Returns raw monthly arrays for flexible
 * post-processing (different thresholds without re-fetching).
 */
async function fetchRawMonthlyData(slug, lat, lon) {
  // Per-month accumulators
  const monthData = Array.from({ length: 12 }, () => ({
    tempMins: [],
    tempMaxs: [],
    dailyPrecipValues: [],   // every daily precip value, for threshold filtering
    monthlyPrecipTotals: [], // one total per year, for avg monthly precip
  }));

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const data = await fetchYearData(lat, lon, year);
    const { temperature_2m_max, temperature_2m_min, precipitation_sum, time } = data.daily;

    const yearMonthPrecip = new Array(12).fill(0);

    for (let i = 0; i < time.length; i++) {
      const month = new Date(time[i]).getMonth();
      if (temperature_2m_min[i] != null) monthData[month].tempMins.push(temperature_2m_min[i]);
      if (temperature_2m_max[i] != null) monthData[month].tempMaxs.push(temperature_2m_max[i]);
      if (precipitation_sum[i] != null) {
        monthData[month].dailyPrecipValues.push(precipitation_sum[i]);
        yearMonthPrecip[month] += precipitation_sum[i];
      }
    }

    for (let m = 0; m < 12; m++) {
      monthData[m].monthlyPrecipTotals.push(yearMonthPrecip[m]);
    }

    // Pause between years
    await new Promise(r => setTimeout(r, 500));
  }

  // Compute temperature averages (threshold-independent)
  return monthData.map((m, i) => ({
    month: MONTH_NAMES[i],
    avgTempMinC: m.tempMins.length ? m.tempMins.reduce((a, b) => a + b, 0) / m.tempMins.length : null,
    avgTempMaxC: m.tempMaxs.length ? m.tempMaxs.reduce((a, b) => a + b, 0) / m.tempMaxs.length : null,
    dailyPrecipValues: m.dailyPrecipValues,
    monthlyPrecipTotals: m.monthlyPrecipTotals,
  }));
}

/**
 * From cached raw data, compute final monthly values at given threshold.
 */
function computeMonthly(rawMonths, thresholdMm) {
  return rawMonths.map(m => {
    const rainDays = Math.round(
      m.dailyPrecipValues.filter(p => p >= thresholdMm).length / YEARS
    );
    const avgPrecipMm = m.monthlyPrecipTotals.length
      ? m.monthlyPrecipTotals.reduce((a, b) => a + b, 0) / m.monthlyPrecipTotals.length
      : 0;

    return {
      month: m.month,
      avgTempF: {
        min: m.avgTempMinC != null ? cToF(m.avgTempMinC) : null,
        max: m.avgTempMaxC != null ? cToF(m.avgTempMaxC) : null,
      },
      rainDays,
      precipitationInches: mmToInches(avgPrecipMm),
    };
  });
}

/**
 * Compare API data vs existing and report significant differences.
 */
function validateAgainstExisting(slug, apiMonths, existingMonths) {
  const diffs = [];
  for (let i = 0; i < 12; i++) {
    const api = apiMonths[i];
    const existing = existingMonths[i];
    if (!existing) continue;

    const tempMinDiff = Math.abs(api.avgTempF.min - existing.avgTempF.min);
    const tempMaxDiff = Math.abs(api.avgTempF.max - existing.avgTempF.max);
    const rainDaysDiff = Math.abs(api.rainDays - existing.rainDays);

    if (tempMinDiff > 5) {
      diffs.push(`  ${api.month}: temp min ${existing.avgTempF.min}°F → ${api.avgTempF.min}°F (Δ${tempMinDiff}°F)`);
    }
    if (tempMaxDiff > 5) {
      diffs.push(`  ${api.month}: temp max ${existing.avgTempF.max}°F → ${api.avgTempF.max}°F (Δ${tempMaxDiff}°F)`);
    }
    if (rainDaysDiff > 3) {
      diffs.push(`  ${api.month}: rain days ${existing.rainDays} → ${api.rainDays} (Δ${rainDaysDiff})`);
    }
  }
  return diffs;
}

async function main() {
  console.log(`Rain day threshold: ${RAIN_THRESHOLD_MM}mm`);
  console.log(`Data range: ${START_YEAR}-${END_YEAR} (${YEARS}-year average)\n`);

  const destinations = JSON.parse(readFileSync(DESTINATIONS_PATH, 'utf8'));
  const cache = existsSync(CACHE_PATH)
    ? JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
    : {};

  const unmapped = destinations.filter(d => !DEST_COORDS[d.slug]);
  if (unmapped.length) {
    console.warn('⚠️  No coordinates for:', unmapped.map(d => d.slug).join(', '));
  }

  let fetched = 0, skipped = 0, failed = 0;
  const allDiffs = [];

  for (const dest of destinations) {
    const coords = DEST_COORDS[dest.slug];
    if (!coords) continue;

    // Skip if cached and not forcing refetch (validate can use cached data)
    const hasCachedRaw = cache[dest.slug]?.rawMonthly;
    if (!forceRefetch && hasCachedRaw) {
      // Still compute and validate using cached raw data
      const months = computeMonthly(cache[dest.slug].rawMonthly, RAIN_THRESHOLD_MM);
      if (dest.monthlyWeather) {
        const diffs = validateAgainstExisting(dest.slug, months, dest.monthlyWeather);
        if (diffs.length) {
          allDiffs.push(`\n${dest.name} — ${diffs.length} difference(s):`);
          allDiffs.push(...diffs);
        }
      }
      skipped++;
      continue;
    }

    process.stdout.write(`Fetching ${dest.name} (${coords.lat}, ${coords.lon})... `);

    try {
      const rawMonths = await fetchRawMonthlyData(dest.slug, coords.lat, coords.lon);

      cache[dest.slug] = {
        lat: coords.lat,
        lon: coords.lon,
        fetchedAt: new Date().toISOString(),
        source: `Open-Meteo Historical Weather API (${START_YEAR}-${END_YEAR})`,
        rawMonthly: rawMonths,
      };

      // Compute at current threshold for display
      const months = computeMonthly(rawMonths, RAIN_THRESHOLD_MM);
      const janMin = months[0].avgTempF.min;
      const julMax = months[6].avgTempF.max;
      const maxRain = Math.max(...months.map(m => m.rainDays));
      console.log(`Jan min=${janMin}°F  Jul max=${julMax}°F  peak rain=${maxRain}d`);

      if (dest.monthlyWeather) {
        const diffs = validateAgainstExisting(dest.slug, months, dest.monthlyWeather);
        if (diffs.length) {
          allDiffs.push(`\n${dest.name} — ${diffs.length} difference(s):`);
          allDiffs.push(...diffs);
        }
      }

      fetched++;

      // Longer pause between destinations to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
      // Wait extra on failure (likely rate limit)
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Save cache (always, even in validate mode — raw data is valuable)
  if (!dryRun) {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`\nCache saved → src/data/climate-cache-destinations.json`);
  }

  console.log(`\nFetched: ${fetched}  Skipped (cached): ${skipped}  Failed: ${failed}`);

  if (allDiffs.length) {
    console.log('\n═══ VALIDATION: Differences from hand-entered data (threshold >3 rain days or >5°F) ═══');
    allDiffs.forEach(d => console.log(d));
  } else {
    console.log('\n✓ All API data is within tolerance of existing hand-entered data.');
  }

  if (validateOnly || dryRun) {
    console.log('\n(Dry run / validate only — destinations.json not modified)');
    return;
  }

  // Merge into destinations.json
  let updated = 0;
  for (const dest of destinations) {
    const entry = cache[dest.slug];
    if (!entry?.rawMonthly) continue;

    const months = computeMonthly(entry.rawMonthly, RAIN_THRESHOLD_MM);

    // Preserve hand-curated hurricaneRisk
    const existingRisk = {};
    if (dest.monthlyWeather) {
      for (const mw of dest.monthlyWeather) {
        existingRisk[mw.month] = mw.hurricaneRisk || 'none';
      }
    }

    dest.monthlyWeather = months.map(m => ({
      month: m.month,
      avgTempF: m.avgTempF,
      rainDays: m.rainDays,
      precipitationInches: m.precipitationInches,
      hurricaneRisk: existingRisk[m.month] || 'none',
    }));

    dest.climateDataSource = `Open-Meteo Historical Weather API (${START_YEAR}-${END_YEAR} averages)`;
    dest.climateDataUpdated = new Date().toISOString().split('T')[0];

    updated++;
  }

  writeFileSync(DESTINATIONS_PATH, JSON.stringify(destinations, null, 2));
  console.log(`\nUpdated ${updated} destinations in src/data/destinations.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
