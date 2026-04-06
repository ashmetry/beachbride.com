interface ArticleFrontmatter {
  title: string;
  description: string;
  publishDate: Date;
  updatedDate?: Date;
  author?: string;
  heroImage?: string;
}

export function getArticleSchema(frontmatter: ArticleFrontmatter, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: frontmatter.title,
    description: frontmatter.description,
    url,
    datePublished: frontmatter.publishDate.toISOString(),
    dateModified: (frontmatter.updatedDate ?? frontmatter.publishDate).toISOString(),
    author: {
      '@type': 'Person',
      name: frontmatter.author ?? 'BeachBride Editorial Team',
      url: 'https://beachbride.com/about/',
    },
    publisher: {
      '@type': 'Organization',
      name: 'BeachBride',
      logo: {
        '@type': 'ImageObject',
        url: 'https://beachbride.com/logo.png',
      },
    },
    image: frontmatter.heroImage
      ? `https://beachbride.com${frontmatter.heroImage}`
      : 'https://beachbride.com/images/og-default.jpg',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}
