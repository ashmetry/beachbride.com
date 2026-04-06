interface VendorProfile {
  name: string;
  description: string;
  slug: string;
  type: string;
  destination?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
}

export function getVendorSchema(vendor: VendorProfile) {
  const typeMap: Record<string, string> = {
    planner: 'ProfessionalService',
    photographer: 'ProfessionalService',
    florist: 'Florist',
    caterer: 'FoodEstablishment',
    dj: 'EntertainmentBusiness',
    officiant: 'ProfessionalService',
    resort: 'Resort',
    jeweler: 'JewelryStore',
  };

  const schemaType = typeMap[vendor.type] ?? 'LocalBusiness';

  return {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: vendor.name,
    description: vendor.description,
    url: vendor.website ?? `https://beachbride.com/vendors/${vendor.slug}/`,
    ...(vendor.phone && { telephone: vendor.phone }),
    ...(vendor.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: vendor.rating,
        reviewCount: vendor.reviewCount ?? 1,
        bestRating: 5,
      },
    }),
    ...(vendor.destination && {
      areaServed: {
        '@type': 'TouristDestination',
        name: vendor.destination,
      },
    }),
  };
}
