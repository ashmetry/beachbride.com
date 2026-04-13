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
      filter: (page) => {
        const excluded = [
          '/thank-you',
          '/quiz/',
          '/vendors/upgrade/',
          '/contact/',
          '/advertise/',
          '/go/',
        ];
        return !excluded.some(path => page.includes(path));
      },
      serialize(item) {
        const url = item.url;

        // Homepage
        if (url === 'https://beachbride.com/') {
          return { ...item, changefreq: 'weekly', priority: 1.0, lastmod: new Date() };
        }

        // Destination hub pages — highest commercial value
        if (/\/destinations\/[^/]+\/$/.test(url) && !url.endsWith('/destinations/')) {
          return { ...item, changefreq: 'weekly', priority: 0.9 };
        }

        // Destination index
        if (url.endsWith('/destinations/')) {
          return { ...item, changefreq: 'weekly', priority: 0.8 };
        }

        // Articles / guides
        if (
          /\/(destination-wedding|beach-wedding|beautiful-|gorgeous-|tips-|unique-|is-it-|7-ways-|a-delicious-|5-best-)/.test(url) ||
          url.includes('/guides/')
        ) {
          return { ...item, changefreq: 'monthly', priority: 0.8 };
        }

        // Vendor type+destination pSEO pages (high commercial intent)
        if (/\/vendors\/(planner|photographer|florist|caterer|dj|officiant|resort|venue)\/[^/]+\/$/.test(url)) {
          return { ...item, changefreq: 'weekly', priority: 0.8 };
        }

        // Vendor type hub pages
        if (/\/vendors\/(planner|photographer|florist|caterer|dj|officiant|resort|venue)\/$/.test(url)) {
          return { ...item, changefreq: 'weekly', priority: 0.7 };
        }

        // Vendor destination pages
        if (/\/vendors\/[^/]+\/$/.test(url) && !url.endsWith('/vendors/')) {
          return { ...item, changefreq: 'weekly', priority: 0.7 };
        }

        // Vendor directory index
        if (url.endsWith('/vendors/')) {
          return { ...item, changefreq: 'weekly', priority: 0.7 };
        }

        // Blog / real-weddings index
        if (url.endsWith('/blog/') || url.endsWith('/real-weddings/')) {
          return { ...item, changefreq: 'weekly', priority: 0.6 };
        }

        // Individual real weddings
        if (url.includes('/real-weddings/')) {
          return { ...item, changefreq: 'monthly', priority: 0.5 };
        }

        // Quiz
        if (url.endsWith('/quiz/')) {
          return { ...item, changefreq: 'monthly', priority: 0.6 };
        }

        // Legal / utility pages
        if (
          url.endsWith('/privacy-policy/') ||
          url.endsWith('/terms-of-service/') ||
          url.endsWith('/disclaimers/') ||
          url.endsWith('/about/') ||
          url.endsWith('/advertise/')
        ) {
          return { ...item, changefreq: 'yearly', priority: 0.2 };
        }

        return { ...item, changefreq: 'monthly', priority: 0.5 };
      },
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
