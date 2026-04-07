import { defineCollection, z } from 'astro:content';

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.string().default('BeachBride Editorial Team'),
    reviewer: z.string().optional(),
    tags: z.array(z.string()),
    destination: z.string().optional(), // e.g. "cancun" — links article to destination hub
    heroImage: z.string().optional(),
    schemaType: z.enum(['article', 'howto', 'review', 'hub']),
    howToSteps: z
      .array(z.object({ name: z.string(), text: z.string() }))
      .optional(),
    faqs: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .optional(),
    related: z.array(z.string()).optional(),
    disclaimers: z
      .array(z.enum(['financial', 'professional', 'referral', 'ai']))
      .optional(),
    affiliateDisclosure: z.boolean().default(false),
    noIndex: z.boolean().default(false),
  }),
});

const realWeddings = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    location: z.string().optional(),
    photographer: z.string().optional(),
    heroImage: z.string().optional(),
    images: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    destination: z.string().optional(), // links to destination hub slug
    noIndex: z.boolean().default(false),
  }),
});

export const collections = { articles, realWeddings };
