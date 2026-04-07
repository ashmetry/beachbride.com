/**
 * Guide category definitions.
 * Articles are auto-assigned to a category by matching their slug against
 * the `slugPatterns` list. First match wins. Articles that don't match
 * any pattern fall into 'planning' as the default.
 */

export interface GuideCategory {
  slug: string;
  label: string;
  description: string;
  heroEmoji: string;
  /** Substrings matched against the article slug (lowercase) */
  slugPatterns: string[];
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    slug: 'planning',
    label: 'Planning & Budgeting',
    description: 'From setting a budget to building your timeline — everything you need to plan a destination wedding without losing your mind.',
    heroEmoji: '📋',
    slugPatterns: [
      'planning', 'plan-', 'guide', 'tips', 'checklist', 'budget',
      'cost', 'save-money', 'pros-and-cons', 'transportation',
      'shoe-valet', 'bachelorette', 'honeymoon', 'destination-wedding-',
      'considering-having', 'find-the-perfect', 'dos-and-dont',
    ],
  },
  {
    slug: 'food-drink',
    label: 'Food & Drink',
    description: 'Menus, cakes, dessert bars, and signature cocktails — coastal catering ideas your guests will actually rave about.',
    heroEmoji: '🍹',
    slugPatterns: [
      'menu', 'seafood', 'food', 'cake', 'dessert', 'candy',
      'punch', 'bridal-shower', 'edible-', 'tropical-menu',
    ],
  },
  {
    slug: 'decor-style',
    label: 'Décor & Style',
    description: 'Centerpieces, color palettes, lighting, and tablescapes — inspiration to make your beach wedding look as stunning as the setting.',
    heroEmoji: '🌸',
    slugPatterns: [
      'decor', 'centerpiece', 'color-scheme', 'lighting', 'tabletop',
      'indoor', 'unique-beach-wedding', 'sea-glass', 'gilded',
      'diy-', 'beautiful-beach-wedding-color',
    ],
  },
  {
    slug: 'bride',
    label: 'Bride & Wedding Party',
    description: 'Dresses, accessories, shoes, bouquets, and bridesmaid gifts — style guidance for the whole bridal crew.',
    heroEmoji: '👰',
    slugPatterns: [
      'accessories', 'shoes', 'bridal-shoes', 'looks', 'bouquet',
      'bridesmaid', 'favors', 'dress', 'jewelry', 'rings',
      'light-accessories', 'breathtaking-beach-wedding-looks',
    ],
  },
  {
    slug: 'destinations',
    label: 'Destinations',
    description: 'Deep dives into the world\'s best beach wedding locations — from Key West to Bali, with real costs and local tips.',
    heroEmoji: '🌍',
    slugPatterns: [
      'key-west', 'palm-beach', 'cancun', 'punta-cana', 'jamaica',
      'hawaii', 'bali', 'santorini', 'tulum', 'costa-rica',
      'celebrity-beach-wedding', 'celebrity-wedding-venue',
      'awesome-beach-destinations', 'elevated-trip',
    ],
  },
];

export function getCategoryForSlug(articleSlug: string): GuideCategory {
  const lower = articleSlug.toLowerCase();
  for (const cat of GUIDE_CATEGORIES) {
    if (cat.slugPatterns.some(p => lower.includes(p))) {
      return cat;
    }
  }
  // Default fallback
  return GUIDE_CATEGORIES[0];
}
