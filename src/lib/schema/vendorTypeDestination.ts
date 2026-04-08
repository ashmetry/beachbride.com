/**
 * Schema markup for vendor type + destination pSEO pages.
 * Produces an ItemList with ListItem entries linking to individual vendor profiles.
 */

interface VendorListItem {
  name: string;
  slug: string;
  rating?: number | null;
  reviewCount?: number | null;
}

interface VendorTypeDestinationParams {
  typeName: string;
  destinationName: string;
  country: string;
  vendors: VendorListItem[];
  url: string;
}

export function getVendorTypeDestinationSchema(params: VendorTypeDestinationParams) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${params.typeName} in ${params.destinationName}`,
    description: `Vetted ${params.typeName.toLowerCase()} serving ${params.destinationName}, ${params.country} for destination weddings`,
    url: params.url,
    numberOfItems: params.vendors.length,
    itemListElement: params.vendors.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://beachbride.com/vendors/${v.slug}/`,
      name: v.name,
      ...(v.rating && {
        item: {
          '@type': 'LocalBusiness',
          name: v.name,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: v.rating,
            reviewCount: v.reviewCount ?? 1,
            bestRating: 5,
          },
        },
      }),
    })),
  };
}
