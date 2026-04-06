# beachbride.com — Project Blueprint

Extracted from moldguide.com. Everything here is battle-tested and running in production. Adapt to destination wedding niche; the architecture is niche-agnostic.

---

## 1. Business Model (Proven Pattern)

**Revenue:** Pay-per-lead. Vendors (resorts, planners, photographers, florists, caterers) pay per qualified bride lead.

**Flow:**
```
Bride searches → lands on content page
→ Quiz: "What's your dream destination wedding?"
→ Captures: name, email, phone, destination, budget, date, guest count, services needed
→ Matched to vendors in database
→ Lead delivered via email to vendor
→ Vendor billed $X per lead via Stripe
```

**Validation rule (from moldguide):** 2 vendor "yes I'll pay" calls before building anything beyond content.

---

## 2. Tech Stack (Exact Versions)

### Package.json skeleton

```json
{
  "name": "beachbride-site",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "content:discover": "node scripts/content-engine/discover.js",
    "content:generate": "node scripts/content-engine/generate.js",
    "content:publish": "node scripts/content-engine/publish.js",
    "content:status": "node scripts/content-engine/status.js"
  },
  "dependencies": {
    "@astrojs/mdx": "^4.0.0",
    "@astrojs/react": "^4.0.0",
    "@astrojs/sitemap": "^3.0.0",
    "@astrojs/tailwind": "^5.0.0",
    "@fontsource/inter": "^5.0.0",
    "@tailwindcss/typography": "^0.5.0",
    "astro": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "zipcodes": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "dotenv": "^17.4.0",
    "googleapis": "^171.4.0",
    "typescript": "^5.0.0",
    "wrangler": "^4.80.0",
    "yaml": "^2.8.3"
  }
}
```

### Astro Config

```js
// astro.config.mjs
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
```

### TypeScript Config

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@data/*": ["src/data/*"]
    }
  }
}
```

### Tailwind Config (change brand colors for wedding niche)

```js
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#CHANGE_ME',      // primary brand color
          light: '#CHANGE_ME',
          dark: '#CHANGE_ME',
          accent: '#CHANGE_ME',       // CTA / highlight color
          'accent-dark': '#CHANGE_ME',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
```

---

## 3. Architecture (What to Build)

### Directory Structure

```
beachbride.com/
├── .env                              # Local secrets (copy from .env.example)
├── .env.example                      # Template for all env vars
├── .github/workflows/
│   ├── deploy.yml                    # Cloudflare Pages + Worker auto-deploy
│   ├── content-generate.yml          # Discover + generate articles (weekly cron)
│   └── content-publish.yml           # Publish from queue (3x/week cron)
├── content-queue/                    # Staged articles + images (committed)
│   └── images/
├── functions/api/                    # Cloudflare Pages Functions (auto-deployed)
├── public/images/                    # Hero images (committed)
├── scripts/content-engine/
│   ├── discover.js                   # Topic discovery (GSC + DataForSEO)
│   ├── generate.js                   # Brief → research → write → quality gate → image
│   ├── publish.js                    # Queue → internal links → build verify → commit → email
│   ├── status.js                     # Pipeline status reporter
│   ├── pipeline.json                 # Pipeline state (committed)
│   └── lib/
│       ├── config.js                 # Paths, models, thresholds, LINK_TARGETS, helpers
│       ├── openrouter.js             # OpenRouter API client with retry + rate limiting
│       ├── email.js                  # Mailgun notifications (publish, failure, digest)
│       └── gemini-image.js           # Gemini image generation
├── src/
│   ├── components/
│   │   ├── quiz/                     # Lead capture quiz (React, client:load)
│   │   ├── forms/                    # Contact/vendor signup forms
│   │   ├── layout/                   # Nav, footer, sidebar
│   │   ├── article/                  # TOC, related cards, author bio
│   │   ├── calculators/              # Interactive tools
│   │   └── meta/                     # SEO components
│   ├── content/
│   │   ├── articles/                 # MDX articles (content collection)
│   │   └── config.ts                 # Collection schema (Zod)
│   ├── data/                         # JSON data files (committed)
│   ├── layouts/
│   │   ├── BaseLayout.astro          # Head/nav/footer/schema for all pages
│   │   ├── ArticleLayout.astro       # TOC, breadcrumbs, FAQs, related articles
│   │   ├── PageLayout.astro          # Non-article pages (calculators, static)
│   │   └── LandingPageLayout.astro   # Paid traffic landing pages
│   ├── lib/
│   │   ├── site-config.ts            # Single source of truth for site constants
│   │   └── schema/                   # JSON-LD builders (Organization, BlogPosting, etc.)
│   └── pages/
│       ├── [...slug].astro           # Article routes (content collection)
│       ├── index.astro               # Homepage
│       ├── quiz.astro                # Standalone quiz page
│       ├── lp/                       # Landing pages for paid traffic
│       ├── vendors/                  # Vendor directory (replaces "contractors")
│       │   ├── index.astro           # Directory landing
│       │   ├── [slug].astro          # Individual vendor profile
│       │   ├── [destination]/        # By destination
│       │   │   ├── index.astro       # Destination landing
│       │   │   └── [slug].astro      # Vendor within destination
│       ├── contact.astro
│       ├── about.astro
│       ├── privacy-policy.astro
│       ├── terms-of-service.astro
│       └── thank-you.astro
├── workers/
│   ├── form-handler.ts               # POST handler: leads, vendor signups, contact
│   └── chat-proxy.ts                 # LLM chat widget proxy (optional)
├── wrangler.toml                     # Form handler Worker config
└── wrangler-chat.toml                # Chat proxy Worker config (optional)
```

### Site Config (single source of truth)

```ts
// src/lib/site-config.ts
export const SITE_CONFIG = {
  email: 'you@beachbride.com',
  emailHref: 'mailto:you@beachbride.com',
  name: 'BeachBride',
  url: 'https://beachbride.com',
  founderMetro: 'Houston, TX',
  spotsPerDestination: 5,
} as const;
```

### Content Collection Schema

```ts
// src/content/config.ts
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
    heroImage: z.string().optional(),
    schemaType: z.enum(['article', 'howto', 'review', 'hub']),
    howToSteps: z.array(z.object({ name: z.string(), text: z.string() })).optional(),
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
    related: z.array(z.string()).optional(),
    disclaimers: z.array(z.enum(['financial', 'professional', 'referral', 'ai'])).optional(),
    noIndex: z.boolean().default(false),
  }),
});

export const collections = { articles };
```

---

## 4. Deployment (Three Targets)

### deploy.yml (auto on git push)

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=beachbride-site --branch=${{ github.ref_name }}

      - name: Deploy Worker (form-handler)
        if: github.ref_name == 'main'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### Wrangler Configs

```toml
# wrangler.toml
name = "beachbride-workers"
main = "workers/form-handler.ts"
compatibility_date = "2024-01-01"

[[routes]]
pattern = "beachbride.com/workers/form"
zone_name = "beachbride.com"

[[routes]]
pattern = "beachbride.com/workers/contact"
zone_name = "beachbride.com"
```

```toml
# wrangler-chat.toml (deploy manually: wrangler deploy --config wrangler-chat.toml)
name = "beachbride-chat"
main = "workers/chat-proxy.ts"
compatibility_date = "2024-01-01"

[[routes]]
pattern = "beachbride.com/workers/chat"
zone_name = "beachbride.com"
```

### Deployment summary:
- **Pages + form-handler Worker**: auto-deploy on `git push` to `main` (live) or `develop` (preview)
- **Chat Worker**: manual deploy only (`wrangler deploy --config wrangler-chat.toml`)
- **Pages Functions**: auto-deploy with Pages (any function in `functions/` directory)

---

## 5. Workers (Form Handler)

The form handler is niche-agnostic. Adapt the payload types and email templates.

### Payload Types

```ts
export interface Env {
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  NOTIFY_EMAIL: string;
  SENDY_URL: string;
  SENDY_API_KEY: string;
  SENDY_LIST_ID: string;
}

type FormType = 'lead' | 'vendor' | 'contact';

interface LeadPayload {
  type: 'lead';
  name: string;
  email: string;
  phone: string;
  destination: string;       // e.g. "Cancun, Mexico"
  weddingDate?: string;
  guestCount?: string;
  budget?: string;
  servicesNeeded?: string[];  // ["venue", "photographer", "planner"]
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface VendorPayload {
  type: 'vendor';
  name: string;
  email: string;
  phone: string;
  businessName: string;
  website?: string;
  destination?: string;
  vendorType?: string;       // "resort", "planner", "photographer", etc.
  notes?: string;
}

interface ContactPayload {
  type: 'contact';
  name: string;
  email: string;
  message: string;
}
```

### Key implementation details (from moldguide):
- CORS origin locked to production domain
- Mailgun sends plain text email (not HTML) — fast and reliable
- Sendy subscription passes UTM params + all lead fields as custom fields
- Owner notification email sent for ALL form types
- Confirmation email sent to leads only
- Worker secrets set via Cloudflare dashboard or `wrangler secret put <NAME>`

---

## 6. Content Engine (Complete Pipeline)

This is the most valuable piece. It runs fully automated: discovers topics, writes articles, quality-gates them, generates images, and publishes 3x/week.

### Pipeline Flow

```
discover.js          generate.js                              publish.js
    |                    |                                        |
 GSC API ----+     discovered                                    |
 DataForSEO -+         |                                        |
    |           [A] Brief (Sonnet)                               |
 keyword            |                                            |
 dedup           briefed                                         |
    |               |                                            |
 semantic       [B] Research (Perplexity Sonar Pro)              |
 overlap            |  BLOCKING: no citations = stop             |
 check           researched                                      |
    |               |                                            |
    v           [C] Write (Opus)                                 |
 pipeline.json      |                                            |
                 written                                         |
                    |                                            |
                [D] Quality Gate (heuristic + Opus rewrite)      |
                    |  fail + rewrites < 2 = auto-rewrite        |
                    |  fail after 2 rewrites = email + stop      |
                 passed                                          |
                    |                                            |
                [E] Image (Gemini Pro) + alt text (Haiku)        |
                    |                                            |
                 staged --> content-queue/{slug}.md          pick oldest
                            content-queue/images/{slug}.jpg      |
                                                             internal links
                                                             (outbound + inbound
                                                              + related arrays)
                                                                 |
                                                             move to src/content/
                                                             + public/images/
                                                                 |
                                                             npm run build
                                                             (safety check,
                                                              reverts on failure)
                                                                 |
                                                             git commit + push
                                                             (triggers deploy.yml)
                                                                 |
                                                             email notification
                                                                 |
                                                              published
```

### State Management

- **`pipeline.json`** (committed to git): tracks every topic through statuses: `discovered` > `briefed` > `researched` > `written` > `passed` > `staged` > `published` (or `failed`)
- **`content-queue/`** (committed): staged articles + images waiting for publish
- **Resume-safe**: generate.js checks status before each sub-step, skips completed stages. Safe to re-run after crashes.

### AI Models (all via OpenRouter except images)

| Role | Model | Config constant |
|---|---|---|
| Briefs | `anthropic/claude-sonnet-4-6` | `MODEL_BRIEF` |
| Research | `perplexity/sonar-pro` | `MODEL_RESEARCH` |
| Writing + rewrites | `anthropic/claude-opus-4-6` | `MODEL_WRITE` |
| Quality gate | Heuristic (no LLM) | N/A |
| Alt text | `anthropic/claude-haiku-4-5` | `MODEL_ALT` |
| Images | `gemini-3-pro-image-preview` | `GEMINI_MODEL` |
| Semantic overlap | `anthropic/claude-sonnet-4-6` | `MODEL_BRIEF` |

### Content Engine Config (lib/config.js)

Single source of truth for everything. What you need to change for the new niche:

```js
// ── Paths (same pattern, just change project root) ──
export const ARTICLES_DIR = join(ROOT, 'src', 'content', 'articles');
export const IMAGES_DIR = join(ROOT, 'public', 'images');
export const QUEUE_DIR = join(ROOT, 'content-queue');
export const QUEUE_IMAGES_DIR = join(ROOT, 'content-queue', 'images');
export const PIPELINE_PATH = join(ROOT, 'scripts', 'content-engine', 'pipeline.json');

// ── Models (same) ──
export const MODEL_BRIEF = 'anthropic/claude-sonnet-4-6';
export const MODEL_WRITE = 'anthropic/claude-opus-4-6';
export const MODEL_GATE = 'anthropic/claude-sonnet-4-6';
export const MODEL_RESEARCH = 'perplexity/sonar-pro';
export const MODEL_ALT = 'anthropic/claude-haiku-4-5';
export const GEMINI_MODEL = 'gemini-3-pro-image-preview';

// ── Quality Thresholds (same) ──
export const SEO_THRESHOLD = 80;
export const AI_DETECTION_THRESHOLD = 25;
export const MAX_REWRITES = 2;
export const MIN_WORD_COUNT = 1500;
export const MAX_WORD_COUNT = 2500;

// ── Environment Variables (same keys, different default domain/email) ──
export const env = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'beachbride.com',
  NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || 'you@beachbride.com',
  GSC_KEY_PATH: process.env.GSC_KEY_PATH || '',
  GSC_SERVICE_ACCOUNT_KEY: process.env.GSC_SERVICE_ACCOUNT_KEY || '',
  DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN || '',
  DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD || '',
};

// ── CHANGE THIS: Internal Link Target Map ──
// keyword patterns → slug (used by generate + publish for internal linking)
export const LINK_TARGETS = [
  { patterns: ['destination wedding cost', 'how much does a destination wedding cost'], slug: 'destination-wedding-cost' },
  { patterns: ['beach wedding', 'wedding on the beach'], slug: 'beach-wedding-guide' },
  { patterns: ['destination wedding planner', 'wedding planner'], slug: 'destination-wedding-planner' },
  // ... add as articles are published
];
```

### OpenRouter Client (lib/openrouter.js) — Copy As-Is

Key features to preserve:
- **Rate limiting**: 300ms minimum gap between calls
- **Retry with backoff**: 3 attempts, exponential backoff (1s, 4s, 16s)
- **429 handling**: respects Retry-After header
- **500 handling**: retries with backoff
- **Perplexity citation extraction**: parses `annotations` from Perplexity responses to extract source URLs
- **Token logging**: logs prompt/completion tokens per call
- **JSON mode**: `callModelJSON()` strips markdown code fences and parses

```js
// Headers to change:
headers: {
  'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://beachbride.com',       // ← change
  'X-Title': 'BeachBride Content Engine',           // ← change
}
```

### Gemini Image Generation (lib/gemini-image.js) — Adapt Prompts

The image generation code is generic. Only the prompt builder (`buildHeroPrompt`) needs niche adaptation:

```js
// Change scene library from mold scenarios to wedding scenarios:
const scenes = {
  'beach wedding': 'A bride and groom standing barefoot on white sand...',
  'destination wedding planning': 'A couple reviewing venue options at a beachside table...',
  'wedding venue': 'A stunning oceanfront resort terrace decorated for a wedding ceremony...',
  'wedding budget': 'A couple reviewing destination wedding costs together on a laptop...',
  // etc.
};

// Base prompt ending (keep this — it produces good images):
return `${scene}. Natural lighting, warm and romantic atmosphere, candid photography style.
Shot at eye level, shallow depth of field. No text overlays, no logos, no watermarks.`;
```

### Email Notifications (lib/email.js) — Copy, Change Brand

Change:
- `from` field: `BeachBride Content Engine <noreply@${env.MAILGUN_DOMAIN}>`
- URLs in notification emails: `https://beachbride.com/${slug}/`
- Weekly digest subject: `BeachBride Content Engine — Weekly Digest`

### Discovery (discover.js) — What to Change

The discovery script is mostly niche-agnostic. Change:

1. **GSC site URL**: `siteUrl: 'https://beachbride.com/'`
2. **DataForSEO target**: `target: 'beachbride.com'`
3. **Semantic overlap system prompt**: Change "mold remediation website" to "destination wedding website"
4. **Intent multiplier keywords**:
```js
function getIntentMultiplier(keyword) {
  const kw = keyword.toLowerCase();
  const commercial = ['cost', 'price', 'best', 'package', 'resort', 'vendor', 'planner', 'near', 'hire'];
  const transactional = ['book', 'plan', 'organize', 'find', 'compare'];
  if (commercial.some(w => kw.includes(w))) return 1.5;
  if (transactional.some(w => kw.includes(w))) return 1.3;
  return 1.0;
}
```
5. **Content type detection regex**: adapt from mold keywords to wedding keywords
6. **GSC fallback key path**: update to your local path

### Generation (generate.js) — What to Change

1. **Brief system prompt**: Change site description from mold to wedding
2. **Outline guides**: Adapt `getOutlineGuide()` content types for wedding content
3. **Writing system prompt**: Change voice, disclaimers, and rules. Keep:
   - Citation requirements
   - Banned AI patterns (same list works)
   - Structure rules (question H2s, answer capsules, tables)
   - Quality checklist (same 10 checks)
4. **Disclaimer types**: Change from `['medical', 'professional', 'referral']` to `['financial', 'professional', 'referral']`

### Quality Gate (generate.js `analyzeQuality()`) — Copy As-Is

The quality gate is 100% niche-agnostic. It checks:

**SEO Score (10 checks × 10 points, threshold 80%):**
1. Meta description 140-165 chars
2. Keyword in title
3. Keyword in first paragraph
4. Keyword in at least one H2
5. >= 2 internal links
6. >= 1 external link
7. Word count 1500-2500
8. >= 3 FAQs in frontmatter
9. >= 3 cited sources
10. Related array has 3-5 entries

**Factual accuracy:**
- Disclaimers present
- No excessive unverified superlatives (> 3 fails)

**AI detection heuristic (<= 25%):**
- Banned patterns: em-dashes, "game-changer", "seamlessly", "cutting-edge", "robust", "comprehensive", "In conclusion", "delve", "leverage", "foster", "navigate", "empower"
- Sentence length uniformity: CV < 0.15 = penalty
- Formula: `(patternCount * 3 + uniformityPenalty) / totalSentences * 100`

**On failure:** auto-rewrites up to 2 times, then marks `failed` and emails.

### Publishing (publish.js) — What to Change

1. **Git config**: Change bot name/email
2. **Email URLs**: Change `moldguide.com` to `beachbride.com`
3. **Internal linking**: Works automatically from `LINK_TARGETS` in config.js

Everything else (outbound linking, inbound linking, related array updates, build verification, revert-on-failure, weekly digest) is 100% niche-agnostic.

---

## 7. GitHub Actions Workflows

### content-generate.yml

```yaml
name: Content Engine — Generate

on:
  schedule:
    - cron: '0 4 * * 1'   # Monday 4am UTC
  workflow_dispatch: {}

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci

      - name: Write GSC service account key
        run: echo "$GSC_KEY" | base64 -d > /tmp/gsc-key.json
        env:
          GSC_KEY: ${{ secrets.GSC_SERVICE_ACCOUNT_KEY }}

      - name: Discover topics
        run: node scripts/content-engine/discover.js --limit 20
        env:
          GSC_KEY_PATH: /tmp/gsc-key.json
          DATAFORSEO_LOGIN: ${{ secrets.DATAFORSEO_LOGIN }}
          DATAFORSEO_PASSWORD: ${{ secrets.DATAFORSEO_PASSWORD }}

      - name: Generate articles
        run: node scripts/content-engine/generate.js --limit 5
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}
          NOTIFY_EMAIL: you@beachbride.com
        timeout-minutes: 20

      - name: Commit generated content
        run: |
          git config user.name "BeachBride Bot"
          git config user.email "bot@beachbride.com"
          git add scripts/content-engine/pipeline.json content-queue/ || true
          git diff --cached --quiet || git commit -m "Content engine: generate batch $(date +%Y-%m-%d)"
          git push || true
```

### content-publish.yml

```yaml
name: Content Engine — Publish

on:
  schedule:
    - cron: '0 14 * * 1,3,5'   # Mon/Wed/Fri 2pm UTC (9am ET)
  workflow_dispatch: {}

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}   # PAT so push triggers deploy.yml
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci

      - name: Publish one article from queue
        run: node scripts/content-engine/publish.js
        env:
          CI: true
          MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}
          NOTIFY_EMAIL: you@beachbride.com
```

### Why GH_PAT is needed
`GITHUB_TOKEN` can't trigger other workflows. The publish workflow pushes to `main`, which needs to trigger `deploy.yml`. A Personal Access Token (GH_PAT) is required for this chain: publish push → triggers deploy → Cloudflare Pages + Worker.

---

## 8. Secrets Checklist

| Secret | Purpose | Where to set |
|---|---|---|
| `GH_PAT` | Push triggers deploy.yml | GitHub repo secrets |
| `OPENROUTER_API_KEY` | All LLM calls | GitHub + `.env` |
| `GEMINI_API_KEY` | Hero image generation | GitHub + `.env` |
| `MAILGUN_API_KEY` | Email notifications (content engine + worker) | GitHub + Cloudflare Worker |
| `MAILGUN_DOMAIN` | Mailgun sending domain | Cloudflare Worker |
| `NOTIFY_EMAIL` | Where to send notifications | Hardcode or Cloudflare Worker |
| `GSC_SERVICE_ACCOUNT_KEY` | Base64-encoded GSC JSON key | GitHub |
| `DATAFORSEO_LOGIN` | Topic discovery | GitHub + `.env` |
| `DATAFORSEO_PASSWORD` | Topic discovery | GitHub + `.env` |
| `CLOUDFLARE_API_TOKEN` | Pages + Worker deployment | GitHub |
| `CLOUDFLARE_ACCOUNT_ID` | Pages + Worker deployment | GitHub |
| `SENDY_URL` | Email list subscription | Cloudflare Worker |
| `SENDY_API_KEY` | Email list subscription | Cloudflare Worker |
| `SENDY_LIST_ID` | Email list subscription | Cloudflare Worker |

### .env.example template

```bash
# Content Engine
OPENROUTER_API_KEY=
GEMINI_API_KEY=
GSC_KEY_PATH=
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=

# Email notifications
MAILGUN_API_KEY=
MAILGUN_DOMAIN=beachbride.com
NOTIFY_EMAIL=you@beachbride.com

# Worker (local dev via wrangler dev)
SENDY_URL=
SENDY_API_KEY=
SENDY_LIST_ID=
```

---

## 9. Layouts & Schema (Niche-Agnostic)

### Layout hierarchy (same pattern):
- `BaseLayout.astro` — `<head>`, nav, footer, JSON-LD injection for all pages
- `ArticleLayout.astro` — wraps articles: TOC, breadcrumbs, author bio, FAQs, related cards, hero image
- `PageLayout.astro` — thin wrapper around BaseLayout for non-article pages
- `LandingPageLayout.astro` — for paid traffic pages (minimal nav, focused CTA)

### Schema generation (`src/lib/schema/`):
Build JSON-LD functions for: `Organization`, `BlogPosting`, `HowTo`, `FAQ`, `LocalBusiness` (for vendor profiles). Inject via layouts into `<head>`.

### Key architectural detail:
`ArticleLayout.astro` checks `existsSync(join('public', heroImage))` at build time. Missing images are silently skipped (no broken `<img>` tags).

---

## 10. Article Body Rules (Enforced by Writing Prompt + Quality Gate)

These work across niches. Keep all of them:

- No H1 in body (layout renders title from frontmatter)
- Body starts with opening paragraph, then H2 sections
- >= 50% of H2s phrased as questions
- Question H2s: first sentence is a 15-30 word direct answer (answer capsule)
- Every factual claim cites a source from research
- At least 1 data/comparison table
- FAQs only in frontmatter (not repeated as H2 in body)
- Ends with CTA linking to vendor signup page
- Banned words/patterns: em-dashes, "game-changer", "seamlessly", "cutting-edge", "robust", "comprehensive", "In conclusion", "delve", "leverage", "foster", "navigate", "empower"

---

## 11. Build Verification (Critical Safety Net)

publish.js runs `npm run build` after moving article + image to final locations. If the build fails:
1. Reverts the new article file
2. Reverts the new image file
3. Reverts ALL modified existing articles (from inbound link + related array changes) using backups
4. Sets topic status to `failed` in pipeline.json
5. Sends failure email
6. Exits with code 1

**Important**: Uses `stdio: 'inherit'` to stream build output directly to CI log. Buffering caused OOM kills on GitHub Actions runners when building 8000+ pages.

---

## 12. What NOT to Copy (Niche-Specific)

These are moldguide-specific and should be built fresh for the wedding niche:

- Quiz flow/questions (mold severity assessment → wedding preference quiz)
- Data files (cities.json, contractors.json, etc.)
- Data pipeline scripts (fetch-climate, scrape-contractors, expand-cities)
- Enrichment scripts (IICRC, NORMI, state licenses → wedding vendor certifications if any)
- Hero image scene library in `buildHeroPrompt()` — needs wedding scenes
- Disclaimer types (`medical` → maybe `financial`)
- Intent multiplier keywords in `scoreTopic()`
- Content type detection regex in `detectContentType()`

---

## 13. Local Dev Commands

```bash
# Two terminals:
npm run dev                                          # Astro at localhost:4321 (proxies /workers/* to :8787)
wrangler dev --config wrangler.toml --port 8787      # Form handler Worker

# Content engine (needs .env with API keys):
npm run content:discover -- --dry-run --limit 5      # Preview what topics would be found
npm run content:generate -- --dry-run --limit 1      # Preview what would be generated
npm run content:generate -- --topic "topic-id"       # Generate specific topic
npm run content:publish -- --dry-run                 # Preview what would be published
npm run content:status                               # Show pipeline status

npm run build                                        # Full static build → /dist/
npm run preview                                      # Preview built site
```

---

## 14. Gotchas Learned from moldguide.com

1. **Worker routes vs Pages Functions**: Worker routes need `zone_name` in wrangler.toml matching Cloudflare DNS. Pages Functions just go in `functions/` dir and auto-deploy. Don't use both for the same route.

2. **GH Actions OOM**: `execSync` with default `stdio: 'pipe'` buffers ALL build output in memory. For large sites (8000+ pages), use `stdio: 'inherit'` to stream directly.

3. **DataForSEO batch limit**: Current plan allows only 1 task per request. Batch requests return error 40000. Loop domains individually.

4. **Perplexity citations**: They come as `annotations` on the message object, not in the text. Extract via: `data.choices[0].message.annotations.filter(a => a.type === 'url_citation').map(a => a.url_citation.url)`.

5. **Build-breaking data files**: Some JSON data files must exist or the build fails (even as `{}`). In moldguide this was `iicrc-matches.json` and `normi-matches.json`. If you have similar patterns, document them.

6. **Frontmatter parsing**: generate.js uses a simple regex parser for speed. publish.js uses the `yaml` npm package for robust read/write (needed for modifying existing articles' frontmatter during internal linking).

7. **www redirect**: Set up in Cloudflare DNS, not in code. Don't try to handle it in Workers.

8. **Content engine is resume-safe**: If a run crashes mid-way, just re-run. Each topic checks its status before each sub-step and skips completed stages.
