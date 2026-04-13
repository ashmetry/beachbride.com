/**
 * Affiliate link registry — single source of truth for all tracking URLs.
 *
 * Architecture:
 *   /go/[key]  →  this file  →  Awin cread.php  →  advertiser destination
 *
 * Every key here generates a /go/{key} redirect page (src/pages/go/[key].astro).
 * The content pipeline (publish.js, generate.js, backfill.js) injects cards using
 * /go/{key} hrefs — card copy and keyword patterns live in config.js AFFILIATE_TARGETS,
 * which references keys defined here. No raw tracking URLs appear anywhere else.
 *
 * To add a new affiliate link:
 *   1. Generate the Awin tracking URL via the Awin Link Builder API
 *   2. Add an entry below with a unique key
 *   3. If the pipeline should auto-inject it into articles, also add to
 *      AFFILIATE_TARGETS in scripts/content-engine/lib/config.js
 *   4. If it's a destination deep link, also add the key to DEEP_LINK_KEYS in config.js
 *
 * Verification rule: always test the full chain — /go/ page → Awin 302 → destination live.
 * Never declare a link verified without confirming the final landing page is correct.
 */

export interface AffiliateLink {
  /** Human-readable label for the link */
  label: string;
  /** Awin tracking URL (full cread.php URL — the canonical tracked link) */
  url: string;
  /** Awin short URL (tidd.ly redirect) */
  short: string;
  /** Awin advertiser ID */
  awinId: number;
  /** Advertiser name for grouping/display */
  advertiser: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const affiliateLinks: Record<string, AffiliateLink> = {
  // ── Wedding Insurance ──────────────────────────────────────────────────
  'ewed': {
    label: 'eWed Insurance',
    url: 'https://www.awin1.com/cread.php?awinmid=86129&awinaffid=2852109&ued=https%3A%2F%2Fwww.ewedinsurance.com&platform=pl',
    short: 'https://tidd.ly/4mspchp',
    awinId: 86129,
    advertiser: 'eWed Insurance',
  },

  // ── Travel Insurance ───────────────────────────────────────────────────
  'generali': {
    label: 'Generali Travel Insurance',
    url: 'https://www.awin1.com/cread.php?awinmid=49127&awinaffid=2852109&ued=https%3A%2F%2Fwww.generalitravelinsurance.com&platform=pl',
    short: 'https://tidd.ly/4dD5Vrk',
    awinId: 49127,
    advertiser: 'Generali Travel Insurance',
  },

  // ── Fine Jewelry ───────────────────────────────────────────────────────
  'jade-trau-bridal': {
    label: 'Jade Trau Bridal Collection',
    url: 'https://www.awin1.com/cread.php?awinmid=44255&awinaffid=2852109&ued=https%3A%2F%2Fjadetrau.com%2Fcollections%2Fbridal&platform=pl',
    short: 'https://tidd.ly/4t9ttch',
    awinId: 44255,
    advertiser: 'Jade Trau',
  },
  'rare-carat': {
    label: 'Rare Carat',
    url: 'https://www.awin1.com/cread.php?awinmid=44489&awinaffid=2852109&ued=https%3A%2F%2Fwww.rarecarat.com&platform=pl',
    short: 'https://tidd.ly/3Q7Po4S',
    awinId: 44489,
    advertiser: 'Rare Carat',
  },
  'larson-wedding-bands': {
    label: 'Larson Jewelers Wedding Bands',
    url: 'https://www.awin1.com/cread.php?awinmid=117539&awinaffid=2852109&ued=https%3A%2F%2Fwww.larsonjewelers.com%2Fcollections%2Fwedding-bands&platform=pl',
    short: 'https://tidd.ly/47SJc6X',
    awinId: 117539,
    advertiser: 'Larson Jewelers',
  },
  'anjays-engagement': {
    label: 'AnjaysDesigns Engagement Rings',
    url: 'https://www.awin1.com/cread.php?awinmid=88939&awinaffid=2852109&ued=https%3A%2F%2Fanjaysdesigns.com%2Fcategories%2Fengagement-rings.html&platform=pl',
    short: '',
    awinId: 88939,
    advertiser: 'AnjaysDesigns',
  },

  // ── Hotels & Accommodation ─────────────────────────────────────────────
  'booking': {
    label: 'Booking.com',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com&platform=pl',
    short: 'https://tidd.ly/4ssglOg',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  // Destination deep links: 4-5 star resorts, rated 8.0+
  // Filters: ht_id=204 (resorts), class=4, class=5, review_score=80
  'booking-cancun': {
    label: 'Luxury Resorts in Cancun',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DCancun%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-punta-cana': {
    label: 'Luxury Resorts in Punta Cana',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DPunta%2BCana%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-jamaica': {
    label: 'Luxury Resorts in Jamaica',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DJamaica%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-hawaii': {
    label: 'Luxury Resorts in Hawaii',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DHawaii%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-bali': {
    label: 'Luxury Resorts in Bali',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DBali%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-santorini': {
    label: 'Luxury Resorts in Santorini',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DSantorini%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-tulum': {
    label: 'Luxury Resorts in Tulum',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DTulum%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-costa-rica': {
    label: 'Luxury Resorts in Costa Rica',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DCosta%2BRica%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-key-west': {
    label: 'Luxury Resorts in Key West',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DKey%2BWest%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-los-cabos': {
    label: 'Luxury Resorts in Los Cabos',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DLos%2BCabos%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-st-lucia': {
    label: 'Luxury Resorts in St. Lucia',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DSt%2BLucia%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-riviera-maya': {
    label: 'Luxury Resorts in Riviera Maya',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DRiviera%2BMaya%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-turks-and-caicos': {
    label: 'Luxury Resorts in Turks & Caicos',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DTurks%2Band%2BCaicos%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-aruba': {
    label: 'Luxury Resorts in Aruba',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DAruba%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-amalfi-coast': {
    label: 'Luxury Resorts on the Amalfi Coast',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DAmalfi%2BCoast%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-tuscany': {
    label: 'Luxury Resorts in Tuscany',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DTuscany%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-maldives': {
    label: 'Luxury Resorts in the Maldives',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DMaldives%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-fiji': {
    label: 'Luxury Resorts in Fiji',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DFiji%26nflt%3Dht_id%253D204%253Bclass%253D4%253Bclass%253D5%253Breview_score%253D80&platform=pl',
    short: '',
    awinId: 6776,
    advertiser: 'Booking.com',
  },

  // ── Villas ─────────────────────────────────────────────────────────────
  'top-villas': {
    label: 'Top Villas',
    url: 'https://www.awin1.com/cread.php?awinmid=12048&awinaffid=2852109&ued=https%3A%2F%2Fwww.thetopvillas.com%2Fen_us&platform=pl',
    short: 'https://tidd.ly/4syBRRf',
    awinId: 12048,
    advertiser: 'Top Villas',
  },
  'top-villas-caribbean': {
    label: 'Caribbean Villas',
    url: 'https://www.awin1.com/cread.php?awinmid=12048&awinaffid=2852109&ued=https%3A%2F%2Fwww.thetopvillas.com%2Fdestination%2Fcaribbean&platform=pl',
    short: '',
    awinId: 12048,
    advertiser: 'Top Villas',
  },
  'top-villas-mexico': {
    label: 'Mexico Villas',
    url: 'https://www.awin1.com/cread.php?awinmid=12048&awinaffid=2852109&ued=https%3A%2F%2Fwww.thetopvillas.com%2Fdestination%2Fmexico&platform=pl',
    short: '',
    awinId: 12048,
    advertiser: 'Top Villas',
  },

  // ── Photography ────────────────────────────────────────────────────────
  'flytographer-wedding': {
    label: 'Flytographer Destination Photography',
    url: 'https://www.awin1.com/cread.php?awinmid=112308&awinaffid=2852109&ued=https%3A%2F%2Fwww.flytographer.com&platform=pl',
    short: '',
    awinId: 112308,
    advertiser: 'Flytographer',
  },

  // ── Wedding Products ───────────────────────────────────────────────────
  'voast': {
    label: 'Voast Video Guest Book',
    url: 'https://www.awin1.com/cread.php?awinmid=64346&awinaffid=2852109&ued=https%3A%2F%2Fwww.raiseavoast.com&platform=pl',
    short: 'https://tidd.ly/4dD5NrQ',
    awinId: 64346,
    advertiser: 'Voast',
  },
  'miss-to-mrs': {
    label: 'Miss To Mrs Bridal Box',
    url: 'https://www.awin1.com/cread.php?awinmid=56925&awinaffid=2852109&ued=https%3A%2F%2Fmisstomrsbox.com&platform=pl',
    short: 'https://tidd.ly/4dEvEj6',
    awinId: 56925,
    advertiser: 'Miss To Mrs',
  },

  // ── Activities & Tours ─────────────────────────────────────────────────
  'getyourguide': {
    label: 'GetYourGuide',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com&platform=pl',
    short: 'https://tidd.ly/3NWpGQk',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-cancun': {
    label: 'Things to Do in Cancun',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fcancun-l150%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-punta-cana': {
    label: 'Things to Do in Punta Cana',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fpunta-cana-l411%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-jamaica': {
    label: 'Things to Do in Jamaica',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fjamaica-l169118%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-hawaii': {
    label: 'Things to Do in Hawaii',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fhawaii-l85%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-bali': {
    label: 'Things to Do in Bali',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fbali-l347%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-santorini': {
    label: 'Things to Do in Santorini',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fsantorini-l753%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-los-cabos': {
    label: 'Things to Do in Los Cabos',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Flos-cabos-l264%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-st-lucia': {
    label: 'Things to Do in St. Lucia',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fsaint-lucia-l169165%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-riviera-maya': {
    label: 'Things to Do in Riviera Maya',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Friviera-maya-l1099%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-turks-and-caicos': {
    label: 'Things to Do in Turks & Caicos',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fturks-and-caicos-islands-l169188%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-aruba': {
    label: 'Things to Do in Aruba',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Faruba-l169061%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-amalfi-coast': {
    label: 'Things to Do on the Amalfi Coast',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Famalfi-coast-l32579%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-tuscany': {
    label: 'Things to Do in Tuscany',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Ftuscany-l558%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-maldives': {
    label: 'Things to Do in the Maldives',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fmaldives-l169135%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-fiji': {
    label: 'Things to Do in Fiji',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Ffiji-l169098%2F&platform=pl',
    short: '',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'xcaret': {
    label: 'Xcaret Parks (Cancun)',
    url: 'https://www.awin1.com/cread.php?awinmid=34947&awinaffid=2852109&ued=https%3A%2F%2Fwww.xcaret.com%2Fen%2F&platform=pl',
    short: 'https://tidd.ly/47ZjZrr',
    awinId: 34947,
    advertiser: 'Xcaret',
  },

  // ── Cruises ────────────────────────────────────────────────────────────
  'gotosea': {
    label: 'GoToSea Cruises',
    url: 'https://www.awin1.com/cread.php?awinmid=57795&awinaffid=2852109&ued=https%3A%2F%2Fwww.gotosea.com&platform=pl',
    short: 'https://tidd.ly/47VOU8b',
    awinId: 57795,
    advertiser: 'GoToSea',
  },

  // ── Car Rental ─────────────────────────────────────────────────────────
  'discover-cars': {
    label: 'Discover Cars',
    url: 'https://www.awin1.com/cread.php?awinmid=90743&awinaffid=2852109&ued=https%3A%2F%2Fdiscovercars.com&platform=pl',
    short: 'https://tidd.ly/47R2REo',
    awinId: 90743,
    advertiser: 'Discover Cars',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard rel attribute for all affiliate links */
const AFFILIATE_REL = 'sponsored nofollow noopener';

/**
 * Get the tracked URL for an affiliate link by key.
 * Returns the short (tidd.ly) URL for cleaner markup.
 * Falls back to full tracking URL if short is missing.
 */
export function getAffiliateUrl(key: string): string {
  const link = affiliateLinks[key];
  if (!link) {
    console.warn(`[affiliate] Unknown link key: "${key}"`);
    return '#';
  }
  return link.short || link.url;
}

/**
 * Get the full set of HTML attributes for an affiliate <a> tag.
 * Use with Astro's spread syntax: <a {...affiliateAttrs('booking-cancun')}>
 */
export function affiliateAttrs(key: string): Record<string, string> {
  const link = affiliateLinks[key];
  if (!link) {
    console.warn(`[affiliate] Unknown link key: "${key}"`);
    return { href: '#', rel: AFFILIATE_REL, target: '_blank' };
  }
  return {
    href: link.short || link.url,
    rel: AFFILIATE_REL,
    target: '_blank',
  };
}

/**
 * Get a destination-specific Booking.com link key.
 * Maps destination slugs (from destinations.json) to booking link keys.
 */
export function getBookingKey(destinationSlug: string): string | null {
  const key = `booking-${destinationSlug}`;
  return affiliateLinks[key] ? key : null;
}

/**
 * Get a destination-specific GetYourGuide link key.
 */
export function getActivityKey(destinationSlug: string): string | null {
  const key = `getyourguide-${destinationSlug}`;
  return affiliateLinks[key] ? key : null;
}
