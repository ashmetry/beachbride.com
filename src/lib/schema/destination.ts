interface Destination {
  name: string;
  country: string;
  description: string;
  slug: string;
}

export function getDestinationSchema(dest: Destination) {
  return {
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
}
