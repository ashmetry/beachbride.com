/**
 * Centralized affiliate link registry.
 *
 * Every affiliate URL on the site resolves through this file.
 * Content files reference links by key (e.g. "booking-cancun"),
 * never by raw URL. This keeps tracking IDs in one place and
 * ensures every link gets rel="sponsored nofollow noopener".
 *
 * To add a new link:
 *   1. Generate it via Awin Link Builder API (see memory/reference_awin_tracking_links.md)
 *   2. Add an entry below with a descriptive key
 *   3. Use `getAffiliateLink(key)` or `affiliateAttrs(key)` in templates
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
  'ewed-quote': {
    label: 'Get a Wedding Insurance Quote',
    url: 'https://www.awin1.com/cread.php?awinmid=86129&awinaffid=2852109&ued=https%3A%2F%2Fwww.ewedinsurance.com%2Fget-a-quote&platform=pl',
    short: 'https://tidd.ly/4mljaPy',
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
  'generali-quote': {
    label: 'Get a Trip Protection Quote',
    url: 'https://www.awin1.com/cread.php?awinmid=49127&awinaffid=2852109&ued=https%3A%2F%2Fwww.generalitravelinsurance.com%2Fbuy%2Ftrip-protection.html&platform=pl',
    short: 'https://tidd.ly/47R2XMg',
    awinId: 49127,
    advertiser: 'Generali Travel Insurance',
  },

  // ── Fine Jewelry ───────────────────────────────────────────────────────
  'jade-trau': {
    label: 'Jade Trau',
    url: 'https://www.awin1.com/cread.php?awinmid=44255&awinaffid=2852109&ued=https%3A%2F%2Fjadetrau.com&platform=pl',
    short: 'https://tidd.ly/4sszq2A',
    awinId: 44255,
    advertiser: 'Jade Trau',
  },
  'jade-trau-bridal': {
    label: 'Jade Trau Bridal Collection',
    url: 'https://www.awin1.com/cread.php?awinmid=44255&awinaffid=2852109&ued=https%3A%2F%2Fjadetrau.com%2Fcollections%2Fbridal&platform=pl',
    short: 'https://tidd.ly/4t9ttch',
    awinId: 44255,
    advertiser: 'Jade Trau',
  },
  'jade-trau-rings': {
    label: 'Jade Trau Rings',
    url: 'https://www.awin1.com/cread.php?awinmid=44255&awinaffid=2852109&ued=https%3A%2F%2Fjadetrau.com%2Fcollections%2Frings&platform=pl',
    short: 'https://tidd.ly/47Vixq2',
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
  'rare-carat-engagement': {
    label: 'Rare Carat Engagement Rings',
    url: 'https://www.awin1.com/cread.php?awinmid=44489&awinaffid=2852109&ued=https%3A%2F%2Fwww.rarecarat.com%2Fengagement-rings&platform=pl',
    short: 'https://tidd.ly/423SHg6',
    awinId: 44489,
    advertiser: 'Rare Carat',
  },
  'larson': {
    label: 'Larson Jewelers',
    url: 'https://www.awin1.com/cread.php?awinmid=117539&awinaffid=2852109&ued=https%3A%2F%2Fwww.larsonjewelers.com&platform=pl',
    short: 'https://tidd.ly/4cqaHGr',
    awinId: 117539,
    advertiser: 'Larson Jewelers',
  },
  'larson-wedding-bands': {
    label: 'Larson Jewelers Wedding Bands',
    url: 'https://www.awin1.com/cread.php?awinmid=117539&awinaffid=2852109&ued=https%3A%2F%2Fwww.larsonjewelers.com%2Fcollections%2Fwedding-bands&platform=pl',
    short: 'https://tidd.ly/47SJc6X',
    awinId: 117539,
    advertiser: 'Larson Jewelers',
  },
  'anjays': {
    label: 'AnjaysDesigns',
    url: 'https://www.awin1.com/cread.php?awinmid=88939&awinaffid=2852109&ued=https%3A%2F%2Fanjaysdesigns.com&platform=pl',
    short: 'https://tidd.ly/3OehE5q',
    awinId: 88939,
    advertiser: 'AnjaysDesigns',
  },
  'anjays-engagement': {
    label: 'AnjaysDesigns Engagement Rings',
    url: 'https://www.awin1.com/cread.php?awinmid=88939&awinaffid=2852109&ued=https%3A%2F%2Fanjaysdesigns.com%2Fcollections%2Fengagement-rings&platform=pl',
    short: 'https://tidd.ly/4c5uGez',
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
  'booking-cancun': {
    label: 'Hotels in Cancun',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DCancun%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/3QiKa6m',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-punta-cana': {
    label: 'Hotels in Punta Cana',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DPunta%2BCana%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/47Zk3HH',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-jamaica': {
    label: 'Hotels in Jamaica',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DJamaica%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/480mCtc',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-hawaii': {
    label: 'Hotels in Hawaii',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DHawaii%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/4tK8Z9T',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-bali': {
    label: 'Hotels in Bali',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DBali%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/3Olk427',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-santorini': {
    label: 'Hotels in Santorini',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DSantorini%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/4suHbFs',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-tulum': {
    label: 'Hotels in Tulum',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DTulum%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/3Q6G80X',
    awinId: 6776,
    advertiser: 'Booking.com',
  },
  'booking-costa-rica': {
    label: 'Hotels in Costa Rica',
    url: 'https://www.awin1.com/cread.php?awinmid=6776&awinaffid=2852109&ued=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3Fss%3DCosta%2BRica%26nflt%3Dht_id%253D204&platform=pl',
    short: 'https://tidd.ly/4tOc7Sh',
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
    url: 'https://www.awin1.com/cread.php?awinmid=12048&awinaffid=2852109&ued=https%3A%2F%2Fwww.thetopvillas.com%2Fen_us%2Fcaribbean%2F&platform=pl',
    short: 'https://tidd.ly/4tIj1bl',
    awinId: 12048,
    advertiser: 'Top Villas',
  },
  'top-villas-mexico': {
    label: 'Mexico Villas',
    url: 'https://www.awin1.com/cread.php?awinmid=12048&awinaffid=2852109&ued=https%3A%2F%2Fwww.thetopvillas.com%2Fen_us%2Fmexico%2F&platform=pl',
    short: 'https://tidd.ly/41YtsvI',
    awinId: 12048,
    advertiser: 'Top Villas',
  },

  // ── Photography ────────────────────────────────────────────────────────
  'flytographer': {
    label: 'Flytographer',
    url: 'https://www.awin1.com/cread.php?awinmid=112308&awinaffid=2852109&ued=https%3A%2F%2Fwww.flytographer.com&platform=pl',
    short: 'https://tidd.ly/4c8DxfG',
    awinId: 112308,
    advertiser: 'Flytographer',
  },
  'flytographer-wedding': {
    label: 'Flytographer Wedding Photography',
    url: 'https://www.awin1.com/cread.php?awinmid=112308&awinaffid=2852109&ued=https%3A%2F%2Fwww.flytographer.com%2Fwedding-photography&platform=pl',
    short: 'https://tidd.ly/4vkss2p',
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
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fcancun-l181%2F&platform=pl',
    short: 'https://tidd.ly/4vIp167',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-punta-cana': {
    label: 'Things to Do in Punta Cana',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fpunta-cana-l847%2F&platform=pl',
    short: 'https://tidd.ly/4tdOUsO',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-jamaica': {
    label: 'Things to Do in Jamaica',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fjamaica-l324%2F&platform=pl',
    short: 'https://tidd.ly/47YA5Sh',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-hawaii': {
    label: 'Things to Do in Hawaii',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fhawaii-l296%2F&platform=pl',
    short: 'https://tidd.ly/4c7wjZk',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-bali': {
    label: 'Things to Do in Bali',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fbali-l347%2F&platform=pl',
    short: 'https://tidd.ly/47VP8w3',
    awinId: 18925,
    advertiser: 'GetYourGuide',
  },
  'getyourguide-santorini': {
    label: 'Things to Do in Santorini',
    url: 'https://www.awin1.com/cread.php?awinmid=18925&awinaffid=2852109&ued=https%3A%2F%2Fwww.getyourguide.com%2Fsantorini-l546%2F&platform=pl',
    short: 'https://tidd.ly/4taU48O',
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
  'gotosea-caribbean': {
    label: 'Caribbean Cruises',
    url: 'https://www.awin1.com/cread.php?awinmid=57795&awinaffid=2852109&ued=https%3A%2F%2Fwww.gotosea.com%2Fcruises-to-caribbean&platform=pl',
    short: 'https://tidd.ly/4tINmH4',
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
  const map: Record<string, string> = {
    'cancun': 'booking-cancun',
    'punta-cana': 'booking-punta-cana',
    'jamaica': 'booking-jamaica',
    'hawaii': 'booking-hawaii',
    'bali': 'booking-bali',
    'santorini': 'booking-santorini',
    'tulum': 'booking-tulum',
    'costa-rica': 'booking-costa-rica',
  };
  return map[destinationSlug] || null;
}

/**
 * Get a destination-specific GetYourGuide link key.
 */
export function getActivityKey(destinationSlug: string): string | null {
  const map: Record<string, string> = {
    'cancun': 'getyourguide-cancun',
    'punta-cana': 'getyourguide-punta-cana',
    'jamaica': 'getyourguide-jamaica',
    'hawaii': 'getyourguide-hawaii',
    'bali': 'getyourguide-bali',
    'santorini': 'getyourguide-santorini',
  };
  return map[destinationSlug] || null;
}
