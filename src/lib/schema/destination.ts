interface Destination {
  name: string;
  country: string;
  description: string;
  slug: string;
  avgCostUSD?: { min: number; max: number };
  guestBurden?: { score: number };
  legalCeremonyType?: string;
}

export function getDestinationSchema(dest: Destination) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: `${dest.name} Destination Wedding`,
    description: dest.description,
    url: `https://beachbride.com/destinations/${dest.slug}/`,
    touristType: 'Honeymooners',
    includesAttraction: {
      '@type': 'TouristAttraction',
      name: `${dest.name}, ${dest.country}`,
      description: dest.description,
    },
  };

  // Add price range if cost data available
  if (dest.avgCostUSD) {
    schema.priceRange = `$${(dest.avgCostUSD.min / 1000).toFixed(0)}k–$${(dest.avgCostUSD.max / 1000).toFixed(0)}k`;
  }

  return schema;
}
