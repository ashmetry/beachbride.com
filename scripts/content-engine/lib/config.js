/**
 * Content Engine — Shared Configuration
 * Paths, env vars, model names, quality thresholds, pipeline helpers.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..', '..', '..');

// Load .env from project root (local dev only — CI uses process.env)
loadDotenv({ path: join(ROOT, '.env') });

// ── Paths ──────────────────────────────────────────────────────────────────────
export const ARTICLES_DIR = join(ROOT, 'src', 'content', 'articles');
export const IMAGES_DIR = join(ROOT, 'public', 'images');
export const QUEUE_DIR = join(ROOT, 'content-queue');
export const QUEUE_IMAGES_DIR = join(ROOT, 'content-queue', 'images');
export const PIPELINE_PATH = join(ROOT, 'scripts', 'content-engine', 'pipeline.json');

// ── OpenRouter Models ──────────────────────────────────────────────────────────
export const MODEL_BRIEF = 'anthropic/claude-sonnet-4-6';
export const MODEL_WRITE = 'anthropic/claude-opus-4-6';
export const MODEL_GATE = 'anthropic/claude-sonnet-4-6';
export const MODEL_RESEARCH = 'perplexity/sonar-pro';
export const MODEL_ALT = 'anthropic/claude-haiku-4-5';

// ── Gemini (image generation) ──────────────────────────────────────────────────
export const GEMINI_MODEL = 'gemini-3-pro-image-preview';

// ── Quality Thresholds ─────────────────────────────────────────────────────────
export const SEO_THRESHOLD = 80;
export const AI_DETECTION_THRESHOLD = 25;
export const MAX_REWRITES = 2;
export const MIN_WORD_COUNT = 1500;
export const MAX_WORD_COUNT = 2500;

// ── Environment Variables ──────────────────────────────────────────────────────
export const env = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'beachbride.com',
  NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || '',
  GSC_KEY_PATH: process.env.GSC_KEY_PATH || '',
  GSC_SERVICE_ACCOUNT_KEY: process.env.GSC_SERVICE_ACCOUNT_KEY || '', // base64 JSON (CI)
  DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN || '',
  DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD || '',
};

// ── Internal Link Targets ──────────────────────────────────────────────────────
// keyword patterns → slug (used by generate + publish for internal linking)
export const LINK_TARGETS = [
  { patterns: ['destination wedding guide', 'plan a destination wedding', 'destination wedding planning'], slug: 'destination-wedding-guide' },
  { patterns: ['destination wedding cost', 'how much does a destination wedding cost', 'destination wedding budget'], slug: 'destination-wedding-cost' },
  { patterns: ['beach wedding checklist', 'beach wedding planning', 'beach wedding timeline'], slug: 'beach-wedding-checklist' },
  { patterns: ['cancun wedding', 'wedding in cancun', 'cancun destination wedding'], slug: 'destinations/cancun' },
  { patterns: ['bali wedding', 'wedding in bali', 'bali destination wedding'], slug: 'destinations/bali' },
  { patterns: ['santorini wedding', 'wedding in santorini', 'santorini destination wedding'], slug: 'destinations/santorini' },
  { patterns: ['hawaii wedding', 'wedding in hawaii', 'hawaii destination wedding'], slug: 'destinations/hawaii' },
  { patterns: ['jamaica wedding', 'wedding in jamaica', 'jamaica destination wedding'], slug: 'destinations/jamaica' },
  { patterns: ['punta cana wedding', 'wedding in punta cana'], slug: 'destinations/punta-cana' },
  { patterns: ['tulum wedding', 'wedding in tulum'], slug: 'destinations/tulum' },
  { patterns: ['costa rica wedding', 'wedding in costa rica'], slug: 'destinations/costa-rica' },
  { patterns: ['key west wedding', 'wedding in key west', 'florida keys wedding'], slug: 'destinations/key-west' },
  // Vendor type + destination (high-intent, link to pSEO pages)
  { patterns: ['wedding planner in hawaii', 'hawaii wedding planner', 'find a planner in hawaii', 'local planner hawaii'], slug: 'vendors/planner/hawaii' },
  { patterns: ['wedding planner in cancun', 'cancun wedding planner', 'find a planner in cancun', 'local planner cancun'], slug: 'vendors/planner/cancun' },
  { patterns: ['wedding planner in jamaica', 'jamaica wedding planner', 'find a planner in jamaica', 'local planner jamaica'], slug: 'vendors/planner/jamaica' },
  { patterns: ['wedding planner in bali', 'bali wedding planner', 'find a planner in bali', 'local planner bali'], slug: 'vendors/planner/bali' },
  { patterns: ['wedding planner in santorini', 'santorini wedding planner', 'find a planner in santorini'], slug: 'vendors/planner/santorini' },
  { patterns: ['wedding planner in tulum', 'tulum wedding planner', 'local planner tulum'], slug: 'vendors/planner/tulum' },
  { patterns: ['wedding planner in costa rica', 'costa rica wedding planner', 'local planner costa rica'], slug: 'vendors/planner/costa-rica' },
  { patterns: ['wedding planner in punta cana', 'punta cana wedding planner', 'local planner punta cana'], slug: 'vendors/planner/punta-cana' },
  { patterns: ['wedding photographer in hawaii', 'hawaii wedding photographer', 'destination photographer hawaii'], slug: 'vendors/photographer/hawaii' },
  { patterns: ['wedding photographer in cancun', 'cancun wedding photographer', 'destination photographer cancun'], slug: 'vendors/photographer/cancun' },
  { patterns: ['wedding photographer in bali', 'bali wedding photographer', 'destination photographer bali'], slug: 'vendors/photographer/bali' },
  { patterns: ['wedding photographer in santorini', 'santorini wedding photographer', 'destination photographer santorini'], slug: 'vendors/photographer/santorini' },
  { patterns: ['wedding photographer in jamaica', 'jamaica wedding photographer', 'destination photographer jamaica'], slug: 'vendors/photographer/jamaica' },
  { patterns: ['wedding officiant in hawaii', 'hawaii wedding officiant', 'officiant in hawaii'], slug: 'vendors/officiant/hawaii' },
  { patterns: ['wedding florist in hawaii', 'hawaii wedding florist', 'tropical florist hawaii'], slug: 'vendors/florist/hawaii' },
  { patterns: ['wedding florist in bali', 'bali wedding florist', 'tropical florist bali'], slug: 'vendors/florist/bali' },
  { patterns: ['wedding venues in cancun', 'cancun wedding venues', 'venue in cancun'], slug: 'vendors/venue/cancun' },
  { patterns: ['wedding venues in hawaii', 'hawaii wedding venues', 'venue in hawaii'], slug: 'vendors/venue/hawaii' },
  { patterns: ['wedding venues in jamaica', 'jamaica wedding venues', 'venue in jamaica'], slug: 'vendors/venue/jamaica' },
  { patterns: ['resorts in cancun wedding', 'cancun all inclusive wedding', 'cancun wedding resort'], slug: 'vendors/resort/cancun' },
  { patterns: ['resorts in hawaii wedding', 'hawaii wedding resort', 'maui wedding resort'], slug: 'vendors/resort/hawaii' },
  // Generic vendor type hubs (fallback when no specific destination)
  { patterns: ['wedding planner', 'local wedding planner', 'destination wedding planner', 'find a planner'], slug: 'vendors/planner' },
  { patterns: ['wedding photographer', 'destination wedding photographer', 'find a photographer'], slug: 'vendors/photographer' },
  { patterns: ['los cabos wedding', 'cabo san lucas wedding', 'cabo wedding', 'cabo destination wedding'], slug: 'destinations/los-cabos' },
  { patterns: ['st lucia wedding', 'saint lucia wedding', 'st lucia destination wedding'], slug: 'destinations/st-lucia' },
  { patterns: ['riviera maya wedding', 'playa del carmen wedding', 'riviera maya destination wedding'], slug: 'destinations/riviera-maya' },
  { patterns: ['turks and caicos wedding', 'turks caicos wedding', 'grace bay wedding'], slug: 'destinations/turks-and-caicos' },
  { patterns: ['aruba wedding', 'aruba destination wedding'], slug: 'destinations/aruba' },
  { patterns: ['amalfi coast wedding', 'positano wedding', 'ravello wedding', 'amalfi wedding'], slug: 'destinations/amalfi-coast' },
  { patterns: ['tuscany wedding', 'tuscan wedding', 'tuscany vineyard wedding', 'italian vineyard wedding'], slug: 'destinations/tuscany' },
  { patterns: ['portugal wedding', 'algarve wedding', 'algarve destination wedding'], slug: 'destinations/algarve' },
  { patterns: ['dubrovnik wedding', 'croatia wedding', 'adriatic wedding', 'dubrovnik destination wedding'], slug: 'destinations/dubrovnik' },
  { patterns: ['maldives wedding', 'maldives destination wedding', 'overwater bungalow wedding'], slug: 'destinations/maldives' },
  { patterns: ['fiji wedding', 'fiji destination wedding', 'south pacific wedding'], slug: 'destinations/fiji' },
  { patterns: ['holbox wedding', 'isla holbox wedding', 'holbox island wedding'], slug: 'destinations/holbox' },
  { patterns: ['roatan wedding', 'roatan destination wedding', 'honduras wedding'], slug: 'destinations/roatan' },
  { patterns: ['kotor wedding', 'montenegro wedding', 'bay of kotor wedding'], slug: 'destinations/kotor' },
  { patterns: ['azores wedding', 'sao miguel wedding', 'azores destination wedding'], slug: 'destinations/azores' },
  { patterns: ['koh lanta wedding', 'thailand beach wedding', 'koh lanta destination wedding'], slug: 'destinations/koh-lanta' },
  { patterns: ['symbolic ceremony', 'symbolic wedding', 'legal vs symbolic'], slug: 'guides/symbolic-ceremony' },
  { patterns: ['hidden gem destination', 'undiscovered wedding destination', 'hidden gem wedding'], slug: 'destinations/hidden-gems' },
  { patterns: ['personalized match', 'vendor match', 'matched with vendors', 'take the quiz'], slug: 'quiz' },
  // Room block + guest accommodations
  { patterns: ['room block', 'hotel block', 'group rooms', 'room block calculator', 'how many hotel rooms', 'guest accommodations', 'hotel block for wedding'], slug: 'tools/room-block-calculator' },
];

// ── Affiliate Link Targets ─────────────────────────────────────────────────────
// keyword patterns → Awin tracked affiliate URL (inserted by generate script)
// Canonical registry: src/data/affiliate-links.ts (front-end)
// These are the same Awin tracking links, used at content-generation time.
// rel="sponsored nofollow noopener" is enforced in the write prompt.
export const AFFILIATE_TARGETS = [
  // Wedding insurance
  { patterns: ['wedding insurance', 'wedding cancellation insurance', 'wedding liability insurance', 'protect your wedding'],
    url: 'https://tidd.ly/4mspchp', label: 'eWed Insurance', rel: 'sponsored nofollow',
    cardTitle: 'Protect Your Wedding Day', cardDesc: 'Destination wedding insurance covers cancellation, vendor no-shows, extreme weather, and more. Policies start under $200 for up to $35,000 in coverage.', cardCta: 'Get a Free Quote' },
  // Travel insurance
  { patterns: ['travel insurance', 'trip protection', 'trip cancellation', 'travel protection plan'],
    url: 'https://tidd.ly/4dD5Vrk', label: 'Generali Travel Insurance', rel: 'sponsored nofollow',
    cardTitle: 'Trip Protection for Your Wedding Party', cardDesc: 'Cover flights, hotels, and medical emergencies for your entire guest list. Generali plans include cancel-for-any-reason options ideal for destination weddings.', cardCta: 'Compare Plans' },
  // Fine jewelry — bridal
  { patterns: ['luxury wedding jewelry', 'bridal jewelry', '18k gold', 'platinum ring', 'diamond necklace', 'fine jewelry'],
    url: 'https://tidd.ly/4t9ttch', label: 'Jade Trau Bridal', rel: 'sponsored nofollow',
    cardTitle: 'Bridal Jewelry That Travels Beautifully', cardDesc: 'Handcrafted fine jewelry designed for the modern bride. Pieces that look stunning in natural light and ocean backdrops.', cardCta: 'Browse the Collection' },
  // Engagement rings
  { patterns: ['engagement ring', 'diamond ring', 'solitaire ring', 'halo ring', 'compare diamonds'],
    url: 'https://tidd.ly/3Q7Po4S', label: 'Rare Carat', rel: 'sponsored nofollow',
    cardTitle: 'Compare Diamond Prices Instantly', cardDesc: 'Rare Carat searches across all major jewelers to find the best diamond for your budget. Save up to 40% vs. retail with AI-powered price comparison.', cardCta: 'Compare Diamonds' },
  { patterns: ['custom engagement ring', 'design your ring', 'bespoke ring'],
    url: 'https://tidd.ly/4c5uGez', label: 'AnjaysDesigns', rel: 'sponsored nofollow',
    cardTitle: 'Design a One-of-a-Kind Ring', cardDesc: 'Custom engagement rings handcrafted to your exact vision. Work directly with a designer to create something as unique as your love story.', cardCta: 'Start Your Custom Design' },
  // Men's wedding bands
  { patterns: ['wedding band', "groom's ring", 'tungsten ring', 'titanium ring', 'silicone ring', "men's wedding ring"],
    url: 'https://tidd.ly/47SJc6X', label: 'Larson Jewelers', rel: 'sponsored nofollow',
    cardTitle: "Wedding Bands Built for Adventure", cardDesc: "Tungsten, titanium, and alternative metal bands that handle sand, salt water, and everything else your destination wedding throws at them.", cardCta: 'Shop Wedding Bands' },
  // Hotels — destination-specific (generic fallback)
  { patterns: ['book a hotel', 'find accommodation', 'resort booking', 'hotel deals', 'where to stay'],
    url: 'https://tidd.ly/4ssglOg', label: 'Booking.com', rel: 'sponsored nofollow',
    cardTitle: 'Find Your Wedding Venue & Guest Hotels', cardDesc: 'Compare resort rates, read verified guest reviews, and book with free cancellation. Filter by wedding-friendly properties at your destination.', cardCta: 'Search Hotels' },
  // Destination photographers
  { patterns: ['destination photographer', 'local photographer', 'vacation photographer', 'book a photographer abroad', 'destination wedding photographer'],
    url: 'https://tidd.ly/4vkss2p', label: 'Flytographer', rel: 'sponsored nofollow',
    cardTitle: 'Book a Local Wedding Photographer', cardDesc: 'Professional photographers in 400+ cities worldwide who know the best light, angles, and hidden spots at your destination. Browse portfolios and book online.', cardCta: 'Find a Photographer' },
  // Villas
  { patterns: ['private villa', 'villa wedding', 'luxury villa', 'rent a villa'],
    url: 'https://tidd.ly/4syBRRf', label: 'Top Villas', rel: 'sponsored nofollow',
    cardTitle: 'Private Villa Weddings', cardDesc: 'Luxury villas with pools, ocean views, and space for your entire wedding party. From Caribbean beachfront estates to Tuscan hilltop retreats.', cardCta: 'Browse Villas' },
  // Video guest book
  { patterns: ['video guest book', 'guest video messages', 'virtual guest book', 'guests who can\'t attend'],
    url: 'https://tidd.ly/4dD5NrQ', label: 'Voast', rel: 'sponsored nofollow',
    cardTitle: 'Video Guest Book for Your Wedding', cardDesc: 'Let guests who can\'t make the trip send heartfelt video messages. Collect, organize, and rewatch forever.', cardCta: 'Create Your Guest Book' },
  // Activities / tours
  { patterns: ['guest activities', 'things to do', 'excursions for guests', 'tours and activities', 'local tours'],
    url: 'https://tidd.ly/3NWpGQk', label: 'GetYourGuide', rel: 'sponsored nofollow',
    cardTitle: 'Plan Activities for Your Wedding Guests', cardDesc: 'Snorkeling, sunset cruises, food tours, and more at every major destination. Book activities your guests will actually remember.', cardCta: 'Browse Activities' },
  // Cruises
  { patterns: ['honeymoon cruise', 'cruise wedding', 'caribbean cruise', 'wedding cruise'],
    url: 'https://tidd.ly/47VOU8b', label: 'GoToSea', rel: 'sponsored nofollow',
    cardTitle: 'Wedding Cruises & Honeymoon Sailings', cardDesc: 'Compare cruise lines, itineraries, and onboard wedding packages. Caribbean, Mediterranean, and beyond.', cardCta: 'Explore Cruises' },
  // Car rental
  { patterns: ['car rental', 'rent a car', 'airport transfer', 'transportation at destination'],
    url: 'https://tidd.ly/47R2REo', label: 'Discover Cars', rel: 'sponsored nofollow',
    cardTitle: 'Destination Car Rentals', cardDesc: 'Compare rates from all major rental companies at your destination. Free cancellation and no hidden fees.', cardCta: 'Compare Car Rentals' },
  // Bridal box
  { patterns: ['bridal subscription box', 'bride-to-be gift', 'bridal box', 'engagement gift box'],
    url: 'https://tidd.ly/4dEvEj6', label: 'Miss To Mrs', rel: 'sponsored nofollow',
    cardTitle: 'The Ultimate Bridal Subscription Box', cardDesc: 'Curated bride-to-be gifts delivered monthly from engagement to wedding day. The perfect gift for a bride planning a destination wedding.', cardCta: 'See What\'s Inside' },
  // Xcaret (Cancun-specific activities)
  { patterns: ['xcaret', 'cancun eco park', 'riviera maya activities', 'cancun attractions'],
    url: 'https://tidd.ly/47ZjZrr', label: 'Xcaret', rel: 'sponsored nofollow',
    cardTitle: 'Xcaret Parks — Cancun\'s Best Group Activity', cardDesc: 'Underground rivers, snorkeling, cultural shows, and more. Perfect for a wedding-week outing your guests will never forget.', cardCta: 'Get Tickets' },
];

// ── Existing Articles Inventory ────────────────────────────────────────────────

/**
 * Read all articles from src/content/articles/, parse frontmatter + body signals.
 * Returns [{ slug, title, tags, schemaType, related, disclaimers, description, h2s, faqQuestions }]
 *
 * The h2s and faqQuestions fields give dedup checks real signal about what
 * search intent each article serves — not just its title and slug.
 */
export function getExistingArticles() {
  if (!existsSync(ARTICLES_DIR)) return [];
  const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
  return files.map(f => {
    const slug = f.replace(/\.(mdx|md)$/, '');
    const raw = readFileSync(join(ARTICLES_DIR, f), 'utf8');
    const fm = parseFrontmatter(raw);

    // Extract H2 headings from body (intent signal)
    const bodyMatch = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1] : '';
    const h2s = (body.match(/^## .+/gm) || []).map(h => h.replace(/^## /, ''));

    // Extract FAQ questions from frontmatter (intent signal)
    const faqQuestions = [];
    const faqMatches = raw.matchAll(/- question:\s*["']?(.+?)["']?\s*$/gm);
    for (const m of faqMatches) faqQuestions.push(m[1]);

    return {
      slug,
      title: fm.title || slug,
      description: fm.description || '',
      tags: fm.tags || [],
      schemaType: fm.schemaType || 'article',
      related: fm.related || [],
      disclaimers: fm.disclaimers || [],
      destination: fm.destination || null,
      h2s,
      faqQuestions,
    };
  });
}

/**
 * Minimal frontmatter parser — extracts YAML between --- delimiters.
 * Returns a plain object. Uses simple regex for speed; publish.js uses
 * the `yaml` package for robust read/write.
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  // Parse simple key: value pairs and arrays
  let currentKey = null;
  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
    if (kvMatch) {
      const [, key, val] = kvMatch;
      if (val.startsWith('[') || val.startsWith('"[')) {
        // Inline array: ["a", "b"]
        try { result[key] = JSON.parse(val.replace(/'/g, '"')); } catch { result[key] = val; }
      } else {
        result[key] = val.replace(/^["']|["']$/g, '');
      }
      currentKey = key;
    } else if (line.match(/^  - /)) {
      // YAML array item
      if (currentKey) {
        if (!Array.isArray(result[currentKey])) result[currentKey] = [];
        const itemMatch = line.match(/^  - ["']?(.+?)["']?\s*$/);
        if (itemMatch) result[currentKey].push(itemMatch[1]);
      }
    } else if (line.match(/^\w[\w-]*\s*:$/)) {
      // Key with no value (start of block)
      currentKey = line.match(/^(\w[\w-]*)/)[1];
      result[currentKey] = [];
    }
  }
  return result;
}

// ── Pipeline State ─────────────────────────────────────────────────────────────

const EMPTY_PIPELINE = { topics: [], rejectedKeywords: [], lastDiscoveryRun: null, lastGenerationRun: null };

export function loadPipeline() {
  if (!existsSync(PIPELINE_PATH)) return structuredClone(EMPTY_PIPELINE);
  try {
    return JSON.parse(readFileSync(PIPELINE_PATH, 'utf8'));
  } catch {
    return structuredClone(EMPTY_PIPELINE);
  }
}

export function savePipeline(data) {
  const tmp = PIPELINE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, PIPELINE_PATH);
}

// ── Directory Helpers ──────────────────────────────────────────────────────────

export function ensureDirs() {
  for (const dir of [QUEUE_DIR, QUEUE_IMAGES_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ── CLI Helpers ────────────────────────────────────────────────────────────────

export function cliFlags() {
  const args = process.argv;
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const topicIdx = args.indexOf('--topic');
  const topicId = topicIdx !== -1 ? args[topicIdx + 1] : null;
  const force = args.includes('--force');
  return { dryRun, limit, topicId, force };
}
