/**
 * Shared vendor type constants and labels.
 * Single source of truth — import this instead of inlining type labels.
 */

export const VENDOR_TYPES = [
  'planner', 'photographer', 'florist', 'caterer', 'dj', 'officiant', 'resort', 'venue',
] as const;

export type VendorType = (typeof VENDOR_TYPES)[number];

/** Types eligible for pay-per-lead matching */
export const LEAD_TYPES: VendorType[] = ['planner', 'photographer', 'florist', 'caterer', 'dj', 'officiant'];

/** Venue/resort types (listed separately in directory) */
export const VENUE_TYPES: VendorType[] = ['resort', 'venue'];

/** Singular display labels */
export const typeLabels: Record<VendorType, string> = {
  planner: 'Wedding Planner',
  photographer: 'Photographer',
  florist: 'Florist',
  caterer: 'Caterer',
  dj: 'DJ / Entertainment',
  officiant: 'Officiant',
  resort: 'Resort',
  venue: 'Venue',
};

/** Plural display labels */
export const typePluralLabels: Record<VendorType, string> = {
  planner: 'Wedding Planners',
  photographer: 'Photographers',
  florist: 'Florists',
  caterer: 'Caterers',
  dj: 'DJs & Entertainment',
  officiant: 'Officiants',
  resort: 'Resorts',
  venue: 'Venues',
};

/** SEO-focused labels for title tags (always includes "Wedding") */
export const typeSEOLabels: Record<VendorType, string> = {
  planner: 'Wedding Planners',
  photographer: 'Wedding Photographers',
  florist: 'Wedding Florists',
  caterer: 'Wedding Caterers',
  dj: 'Wedding DJs & Entertainment',
  officiant: 'Wedding Officiants',
  resort: 'Wedding Resorts',
  venue: 'Wedding Venues',
};

/** Sort vendors by tier (pro > premium > free), then alphabetically */
export function sortByTier<T extends { tier: string; name: string }>(a: T, b: T): number {
  const tierOrder: Record<string, number> = { pro: 0, premium: 1, free: 2 };
  const tierDiff = (tierOrder[a.tier] ?? 2) - (tierOrder[b.tier] ?? 2);
  if (tierDiff !== 0) return tierDiff;
  return a.name.localeCompare(b.name);
}
