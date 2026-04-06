export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BeachBride',
    url: 'https://beachbride.com',
    logo: {
      '@type': 'ImageObject',
      url: 'https://beachbride.com/logo.png',
    },
    description:
      'BeachBride helps couples plan unforgettable destination weddings — from finding vetted vendors to expert guides for every beach destination.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'hello@beachbride.com',
    },
    sameAs: [
      'https://instagram.com/beachbride',
      'https://pinterest.com/beachbride',
    ],
  };
}

export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BeachBride',
    url: 'https://beachbride.com',
    description:
      'Expert destination wedding guides, vendor matching, and planning resources for couples worldwide.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://beachbride.com/?s={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
