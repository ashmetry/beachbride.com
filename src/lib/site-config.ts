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
  // Vendor directory tiers
  vendorTiers: {
    free: { name: 'Free', price: 0 },
    premium: { name: 'Premium', price: 99 },
    pro: { name: 'Pro', price: 199 },
  },
  // Lead-eligible vendor types (NOT resorts or jewelers)
  leadVendorTypes: ['planner', 'photographer', 'florist', 'caterer', 'dj', 'officiant'],
} as const;
