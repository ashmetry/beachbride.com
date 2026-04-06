interface HowToStep {
  name: string;
  text: string;
}

interface HowToFrontmatter {
  title: string;
  description: string;
  howToSteps: HowToStep[];
}

export function getHowToSchema(frontmatter: HowToFrontmatter, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: frontmatter.title,
    description: frontmatter.description,
    url,
    step: frontmatter.howToSteps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };
}
