export const SITE_CONFIG = {
  email: 'hello@beachbride.com',
  emailHref: 'mailto:hello@beachbride.com',
  name: 'BeachBride',
  url: 'https://beachbride.com',
  tagline: 'Your dream wedding, on the beach. Anywhere in the world.',
  description:
    'BeachBride helps couples plan unforgettable destination weddings. Find vetted planners, photographers, and venues — plus expert guides for every beach destination.',
  social: {
    instagram: 'https://instagram.com/beachbride',
    pinterest: 'https://pinterest.com/beachbride',
  },
  // Affiliate links live in src/data/affiliate-links.ts (centralized registry).
  // Use getAffiliateUrl(key) or affiliateAttrs(key) from that file.
  // Do NOT put raw affiliate URLs in templates or content — always go through the registry.
  // Room block consultation — booking/scheduling link for intake calls.
  // Falls back to email when empty. Linked from destination hub pages + calculator CTA.
  roomBlockCalendlyUrl: '/book/',
  // Lead-eligible vendor types (NOT resorts or jewelers)
  leadVendorTypes: ['planner', 'photographer', 'florist', 'caterer', 'dj', 'officiant'],
  // Vendor directory tiers exist in the data model but are not actively monetized.
  // The directory is an SEO and trust asset — all vendors remain on free tier.
  vendorTiers: {
    free: { name: 'Free', price: 0 },
    premium: { name: 'Premium', price: 99 },
    pro: { name: 'Pro', price: 199 },
  },
  // Cloudflare Turnstile — get keys from CF dashboard > Turnstile
  // Leave empty to disable (honeypot still active). Set TURNSTILE_SECRET on Worker too.
  turnstileSiteKey: '0x4AAAAAAC2NprEpuGpSGV_9',
} as const;
