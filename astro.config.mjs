import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://beachbride.com',
  integrations: [
    tailwind(),
    react(),
    sitemap({
      filter: (page) => !page.includes('/thank-you'),
    }),
    mdx(),
  ],
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/workers': 'http://localhost:8787',
      },
    },
  },
});
