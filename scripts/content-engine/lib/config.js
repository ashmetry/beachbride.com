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
  { key: 'ewed', patterns: ['wedding insurance', 'wedding cancellation insurance', 'wedding liability insurance', 'protect your wedding'],
    label: 'eWed Insurance', rel: 'sponsored nofollow',
    cardTitle: 'Protect Your Wedding Day', cardDesc: 'Destination wedding insurance covers cancellation, vendor no-shows, extreme weather, and more. Policies start under $200 for up to $35,000 in coverage.', cardCta: 'Get a Free Quote', cardProof: 'Rated A+ by the BBB. Policies issued within minutes.' },
  // Travel insurance
  { key: 'generali', patterns: ['travel insurance', 'trip protection', 'trip cancellation', 'travel protection plan'],
    label: 'Generali Travel Insurance', rel: 'sponsored nofollow',
    cardTitle: 'Trip Protection for Your Wedding Party', cardDesc: 'Cover flights, hotels, and medical emergencies for your entire guest list. Cancel-for-any-reason options ideal for destination weddings.', cardCta: 'Compare Plans', cardProof: 'A+ rated insurer. Group plans available for wedding parties.' },
  // Fine jewelry — bridal
  { key: 'jade-trau-bridal', patterns: ['luxury wedding jewelry', 'bridal jewelry', '18k gold', 'platinum ring', 'diamond necklace', 'fine jewelry'],
    label: 'Jade Trau', rel: 'sponsored nofollow',
    cardTitle: 'Bridal Jewelry That Travels Beautifully', cardDesc: 'Handcrafted fine jewelry designed for the modern bride. Pieces that look stunning in natural light and ocean backdrops.', cardCta: 'Browse the Collection', cardProof: 'Worn by celebrities. Handcrafted in NYC with ethically sourced stones.' },
  // Engagement rings
  { key: 'rare-carat', patterns: ['engagement ring', 'diamond ring', 'solitaire ring', 'halo ring', 'compare diamonds'],
    label: 'Rare Carat', rel: 'sponsored nofollow',
    cardTitle: 'Compare Diamond Prices Instantly', cardDesc: 'Search across all major jewelers to find the best diamond for your budget. Save up to 40% vs. retail with AI-powered price comparison.', cardCta: 'Compare Diamonds', cardProof: 'Featured in the NY Times. Over 1 million diamonds compared.' },
  { key: 'anjays-engagement', patterns: ['custom engagement ring', 'design your ring', 'bespoke ring'],
    label: 'AnjaysDesigns', rel: 'sponsored nofollow',
    cardTitle: 'Design a One-of-a-Kind Ring', cardDesc: 'Custom engagement rings handcrafted to your exact vision. Work directly with a designer to create something as unique as your love story.', cardCta: 'Start Your Custom Design', cardProof: '4.9 stars from 2,000+ reviews. Free resizing included.' },
  // Men's wedding bands
  { key: 'larson-wedding-bands', patterns: ['wedding band', "groom's ring", 'tungsten ring', 'titanium ring', 'silicone ring', "men's wedding ring"],
    label: 'Larson Jewelers', rel: 'sponsored nofollow',
    cardTitle: "Wedding Bands Built for Adventure", cardDesc: "Tungsten, titanium, and alternative metal bands that handle sand, salt water, and everything your destination wedding throws at them.", cardCta: 'Shop Wedding Bands', cardProof: 'Lifetime warranty. Free engraving on all bands.' },
  // Hotels — destination-aware (resolves to deep link at injection time)
  { key: 'booking', patterns: ['book a hotel', 'find accommodation', 'resort booking', 'hotel deals', 'where to stay', 'all-inclusive', 'resort'],
    label: 'Booking.com', rel: 'sponsored nofollow',
    cardTitle: 'Find Your Wedding Venue & Guest Hotels', cardDesc: 'Compare resort rates, read verified guest reviews, and book with free cancellation. Filter by wedding-friendly properties at your destination.', cardCta: 'Search Hotels', cardProof: 'Free cancellation on most properties. No booking fees.',
    deepLinkPrefix: 'booking' },
  // Destination photographers
  { key: 'flytographer-wedding', patterns: ['destination photographer', 'local photographer', 'vacation photographer', 'book a photographer abroad', 'destination wedding photographer'],
    label: 'Flytographer', rel: 'sponsored nofollow',
    cardTitle: 'Book a Local Wedding Photographer', cardDesc: 'Professional photographers in 400+ cities worldwide who know the best light, angles, and hidden spots at your destination.', cardCta: 'Find a Photographer', cardProof: '3 million+ photos taken. 100% happiness guarantee.' },
  // Villas — region-aware
  { key: 'top-villas', patterns: ['private villa', 'villa wedding', 'luxury villa', 'rent a villa'],
    label: 'Top Villas', rel: 'sponsored nofollow',
    cardTitle: 'Private Villa Weddings', cardDesc: 'Luxury villas with pools, ocean views, and space for your entire wedding party. Caribbean beachfront estates to Tuscan hilltop retreats.', cardCta: 'Browse Villas', cardProof: 'Concierge service included. Villas sleep 10-30+ guests.',
    deepLinkPrefix: 'top-villas' },
  // Video guest book
  { key: 'voast', patterns: ['video guest book', 'guest video messages', 'virtual guest book', 'guests who can\'t attend'],
    label: 'Voast', rel: 'sponsored nofollow',
    cardTitle: 'Video Guest Book for Your Wedding', cardDesc: 'Let guests who can\'t make the trip send heartfelt video messages. Collect, organize, and rewatch forever.', cardCta: 'Create Your Guest Book', cardProof: 'Loved by 50,000+ couples. Takes 30 seconds to set up.' },
  // Activities / tours — destination-aware
  { key: 'getyourguide', patterns: ['guest activities', 'things to do', 'excursions for guests', 'tours and activities', 'local tours'],
    label: 'GetYourGuide', rel: 'sponsored nofollow',
    cardTitle: 'Plan Activities for Your Wedding Guests', cardDesc: 'Snorkeling, sunset cruises, food tours, and more at every major destination. Book activities your guests will actually remember.', cardCta: 'Browse Activities', cardProof: 'Free cancellation up to 24 hours before. Mobile tickets.',
    deepLinkPrefix: 'getyourguide' },
  // Cruises
  { key: 'gotosea', patterns: ['honeymoon cruise', 'cruise wedding', 'caribbean cruise', 'wedding cruise'],
    label: 'GoToSea', rel: 'sponsored nofollow',
    cardTitle: 'Wedding Cruises & Honeymoon Sailings', cardDesc: 'Compare cruise lines, itineraries, and onboard wedding packages. Caribbean, Mediterranean, and beyond.', cardCta: 'Explore Cruises', cardProof: 'Price match guarantee. All major cruise lines compared.' },
  // Car rental
  { key: 'discover-cars', patterns: ['car rental', 'rent a car', 'airport transfer', 'transportation at destination'],
    label: 'Discover Cars', rel: 'sponsored nofollow',
    cardTitle: 'Destination Car Rentals', cardDesc: 'Compare rates from all major rental companies at your destination. Free cancellation and no hidden fees.', cardCta: 'Compare Car Rentals', cardProof: '500+ trusted suppliers. Best price guaranteed.' },
  // Bridal box
  { key: 'miss-to-mrs', patterns: ['bridal subscription box', 'bride-to-be gift', 'bridal box', 'engagement gift box'],
    label: 'Miss To Mrs', rel: 'sponsored nofollow',
    cardTitle: 'The Ultimate Bridal Subscription Box', cardDesc: 'Curated bride-to-be gifts delivered monthly from engagement to wedding day. The perfect gift for a bride planning a destination wedding.', cardCta: 'See What\'s Inside', cardProof: '4.8 stars on Trustpilot. Ships to 50+ countries.' },
  // Xcaret (Cancun-specific activities)
  { key: 'xcaret', patterns: ['xcaret', 'cancun eco park', 'riviera maya activities', 'cancun attractions'],
    label: 'Xcaret', rel: 'sponsored nofollow',
    cardTitle: 'Xcaret Parks — Cancun\'s Best Group Activity', cardDesc: 'Underground rivers, snorkeling, cultural shows, and more. Perfect for a wedding-week outing your guests will never forget.', cardCta: 'Get Tickets', cardProof: '#1 attraction in Riviera Maya. Group discounts available.' },
];

// ── Deep Link Resolution ──────────────────────────────────────────────────────

/**
 * Valid deep link keys — must match keys in src/data/affiliate-links.ts.
 * Used by resolveDeepLink() to verify a destination-specific key exists
 * before generating a /go/{key} URL.
 */
const DEEP_LINK_KEYS = new Set([
  // Booking.com destinations
  'booking-cancun', 'booking-punta-cana', 'booking-jamaica', 'booking-hawaii',
  'booking-bali', 'booking-santorini', 'booking-tulum', 'booking-costa-rica',
  'booking-key-west', 'booking-los-cabos', 'booking-st-lucia', 'booking-riviera-maya',
  'booking-turks-and-caicos', 'booking-aruba', 'booking-amalfi-coast', 'booking-tuscany',
  'booking-maldives', 'booking-fiji',
  // GetYourGuide destinations
  'getyourguide-cancun', 'getyourguide-punta-cana', 'getyourguide-jamaica',
  'getyourguide-hawaii', 'getyourguide-bali', 'getyourguide-santorini',
  'getyourguide-los-cabos', 'getyourguide-st-lucia', 'getyourguide-riviera-maya',
  'getyourguide-turks-and-caicos', 'getyourguide-aruba', 'getyourguide-amalfi-coast',
  'getyourguide-tuscany', 'getyourguide-maldives', 'getyourguide-fiji',
  // Top Villas regions
  'top-villas-caribbean', 'top-villas-mexico',
]);

/** Maps destination slug → region for Top Villas deep links */
const DESTINATION_TO_VILLA_REGION = {
  'cancun': 'mexico', 'tulum': 'mexico', 'riviera-maya': 'mexico', 'los-cabos': 'mexico',
  'jamaica': 'caribbean', 'punta-cana': 'caribbean', 'st-lucia': 'caribbean',
  'turks-and-caicos': 'caribbean', 'aruba': 'caribbean',
};

/** Destination slug → display name for card copy customization */
const DESTINATION_NAMES = {
  'cancun': 'Cancún', 'punta-cana': 'Punta Cana', 'jamaica': 'Jamaica',
  'hawaii': 'Hawaii', 'bali': 'Bali', 'santorini': 'Santorini', 'tulum': 'Tulum',
  'costa-rica': 'Costa Rica', 'key-west': 'Key West', 'los-cabos': 'Los Cabos',
  'st-lucia': 'St. Lucia', 'riviera-maya': 'Riviera Maya',
  'turks-and-caicos': 'Turks & Caicos', 'aruba': 'Aruba',
  'amalfi-coast': 'the Amalfi Coast', 'tuscany': 'Tuscany',
  'maldives': 'the Maldives', 'fiji': 'Fiji',
  'holbox': 'Holbox', 'roatan': 'Roatán', 'kotor': 'Kotor',
  'azores': 'the Azores', 'koh-lanta': 'Koh Lanta', 'dubrovnik': 'Dubrovnik',
  'algarve': 'the Algarve',
};

/**
 * Detect which destination an article is about from frontmatter + slug + body.
 * Returns the destination slug or null.
 */
export function detectDestination(frontmatter, slug, body) {
  // 1. Explicit frontmatter destination
  if (frontmatter.destination) return frontmatter.destination;

  // 2. Check slug for destination names
  for (const dest of Object.keys(DESTINATION_NAMES)) {
    if (slug.includes(dest)) return dest;
  }

  // 3. Check article body for dominant destination mentions (must appear 3+ times)
  const counts = {};
  for (const dest of Object.keys(DESTINATION_NAMES)) {
    const name = DESTINATION_NAMES[dest].replace(/^the /, '');
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = body.match(regex);
    if (matches && matches.length >= 3) counts[dest] = matches.length;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] >= 5) return sorted[0][0];

  return null;
}

/**
 * Resolve a deep link for a target + destination.
 * Returns { key, cardTitle, cardDesc, cardCta } with destination-specific values,
 * or the original target values if no deep link exists.
 * The `key` field maps to affiliate-links.ts registry and /go/{key} redirect.
 */
export function resolveDeepLink(target, destinationSlug) {
  if (!target.deepLinkPrefix || !destinationSlug) return target;

  const destName = DESTINATION_NAMES[destinationSlug];
  if (!destName) return target;

  // Resolve key (must exist in affiliate-links.ts / DEEP_LINK_KEYS)
  let deepKey;
  if (target.deepLinkPrefix === 'top-villas') {
    const region = DESTINATION_TO_VILLA_REGION[destinationSlug];
    deepKey = region ? `top-villas-${region}` : null;
  } else {
    deepKey = `${target.deepLinkPrefix}-${destinationSlug}`;
  }

  if (!deepKey || !DEEP_LINK_KEYS.has(deepKey)) return target;

  // Customize card copy for the destination
  const overrides = { key: deepKey };
  if (target.deepLinkPrefix === 'booking') {
    overrides.cardTitle = `Wedding Hotels in ${destName}`;
    overrides.cardDesc = `Compare all-inclusive resorts and boutique hotels in ${destName}. Read verified reviews, check wedding-friendly amenities, and book with free cancellation.`;
    overrides.cardCta = `Search ${destName} Hotels`;
  } else if (target.deepLinkPrefix === 'getyourguide') {
    overrides.cardTitle = `Things to Do in ${destName}`;
    overrides.cardDesc = `Snorkeling, sunset cruises, food tours, and more in ${destName}. Book wedding-week activities your guests will actually remember.`;
    overrides.cardCta = `Browse ${destName} Activities`;
  } else if (target.deepLinkPrefix === 'top-villas') {
    const regionName = DESTINATION_TO_VILLA_REGION[destinationSlug] === 'mexico' ? 'Mexico' : 'Caribbean';
    overrides.cardTitle = `${regionName} Villa Weddings`;
    overrides.cardDesc = `Luxury ${regionName.toLowerCase()} villas with pools, ocean views, and space for your entire wedding party near ${destName}.`;
    overrides.cardCta = `Browse ${regionName} Villas`;
  }

  return { ...target, ...overrides };
}

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
