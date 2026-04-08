# BeachBride.com

Destination wedding lead-gen and affiliate site. Three revenue streams: pay-per-lead vendor matching, affiliate commissions (resorts, jewelry, travel insurance), and premium vendor directory listings.

## Tech Stack

- **Framework:** Astro 5 (static output), MDX, React, Tailwind CSS
- **Hosting:** Cloudflare Pages + Cloudflare Workers
- **Content engine:** Node.js scripts using OpenRouter (Claude, Perplexity) + Gemini for images
- **Email:** Mailgun (transactional), Sendy (nurture sequences)
- **TypeScript:** strict mode, path aliases `@components/*`, `@layouts/*`, `@lib/*`, `@data/*`

## Commands

```bash
# Dev (two terminals)
npm run dev                                          # Astro dev server at localhost:4321
wrangler dev --config wrangler.toml --port 8787      # Form handler Worker

# Build & preview
npm run build
npm run preview

# Content engine
npm run content:discover -- --dry-run --limit 5      # Preview topic discovery
npm run content:discover -- --limit 20               # Discover topics
npm run content:generate -- --dry-run --limit 1      # Preview generation
npm run content:generate -- --limit 5                # Generate articles
npm run content:generate -- --topic "topic-id"       # Generate specific topic
npm run content:publish -- --dry-run                 # Preview publish
npm run content:publish                              # Publish oldest queued article
npm run content:status                               # Pipeline status
```

## Site Structure

### Page types

| URL pattern | File | Purpose |
|---|---|---|
| `/` | `src/pages/index.astro` | Homepage — email capture primary CTA |
| `/destinations/` | `src/pages/destinations/index.astro` | Destinations index |
| `/destinations/[slug]/` | `src/pages/destinations/[destination].astro` | Destination hub (costs, weather, legal, resorts, vendors) |
| `/vendors/` | `src/pages/vendors/index.astro` | Full vendor directory — all types, filterable by type |
| `/vendors/[type]/` | `src/pages/vendors/[type]/index.astro` | Vendor type hub — all planners, photographers, etc. |
| `/vendors/[type]/[dest]/` | `src/pages/vendors/[type]/[destination].astro` | **pSEO** — e.g. "Wedding Planners in Cancun" |
| `/vendors/[dest]/` | `src/pages/vendors/[destination]/index.astro` | All vendors in one destination |
| `/vendors/[slug]/` | `src/pages/vendors/[slug].astro` | Individual vendor profile |
| `/[slug]/` | `src/pages/[...slug].astro` | Articles (content collection `articles`) |
| `/guides/` | `src/pages/guides/index.astro` | Guide index grouped by category |
| `/real-weddings/` | `src/pages/real-weddings/index.astro` | Gallery listing |
| `/quiz/` | `src/pages/quiz/index.astro` | Stage 1 (email) + Stage 2 (full lead form) |
| `/lp/` | `src/pages/lp/` | Paid traffic landing pages |

### Layout hierarchy

```
BaseLayout.astro (head/nav/footer/JSON-LD)
  ├── ArticleLayout.astro    (TOC, breadcrumbs, FAQs, related)
  ├── PageLayout.astro       (static pages)
  └── LandingPageLayout.astro (paid traffic, minimal nav)
```

## Data

| File | Contents |
|---|---|
| `src/data/destinations.json` | 25 destinations — costs, weather, legal, micro-destinations, resort affiliates, guest burden scores |
| `src/data/vendors.json` | 957 vendors — slug, name, type, tier, claimed, destinations[], description, rating, reviewCount |
| `src/data/guide-categories.ts` | Guide category definitions + `getCategoryForSlug()` auto-assignment |
| `src/lib/vendors.ts` | Shared vendor type constants — `VENDOR_TYPES`, `typeLabels`, `typePluralLabels`, `typeSEOLabels`, `sortByTier` |
| `src/lib/site-config.ts` | Site-wide constants |

### Vendor data model

```json
{
  "slug": "azure-weddings-cancun",
  "name": "Azure Weddings Cancun",
  "type": "planner",
  "tier": "free | premium | pro",
  "claimed": false,
  "destinations": ["cancun", "tulum"],
  "description": "...",
  "website": "",
  "contact": { "email": "", "phone": "" },
  "rating": 4.9,
  "reviewCount": 87,
  "featured": false,
  "image": ""
}
```

Vendor types: `planner`, `photographer`, `florist`, `caterer`, `dj`, `officiant`, `resort`, `venue`

Resorts and venues are **not** enrolled in pay-per-lead. They belong in affiliate links and the premium directory only.

### Vendor directory tiers

| Tier | Price | Features |
|---|---|---|
| Free | $0 | Basic profile, 1 destination, listed in directory |
| Premium | $99/mo | Featured placement, verified badge, 3 destinations, lead alerts |
| Pro | $199/mo | All destinations, priority matching, branded profile, direct inquiry |

## Programmatic SEO

189 pages at `/vendors/[type]/[destination]/` targeting queries like "wedding planner in Cancun" (volume: 8,000-12,000/mo aggregate, LOW competition, $2-8 CPC). Added April 2026.

### Page hierarchy

```
/vendors/                          (all vendors, all types)
  /vendors/planner/                (all planners, all destinations)
    /vendors/planner/cancun/       (planners in Cancun — pSEO target)
    /vendors/planner/hawaii/
    ...
  /vendors/photographer/
    /vendors/photographer/cancun/
    ...
/vendors/cancun/                   (all vendor types in Cancun)
```

### Keyword research

Full DataForSEO research stored in `marketing/pseo-keyword-research.json`. Top opportunities:

| Keyword | Vol/mo | CPC |
|---|---|---|
| wedding planner in hawaii | 1,300 | $2.92 |
| wedding officiant in hawaii | 880 | $3.16 |
| wedding photographer in hawaii | 720 | $3.03 |
| wedding planner in jamaica | 320 | $7.89 |
| wedding planner in bali | 320 | $5.18 |

### Schema markup

- Type hub pages (`/vendors/[type]/`): `ItemList` schema
- Type+destination pages (`/vendors/[type]/[dest]/`): `ItemList` with nested `LocalBusiness` + `AggregateRating`
- Schema helper: `src/lib/schema/vendorTypeDestination.ts`

## Content Engine

Pipeline: `discover.js` → `generate.js` → `publish.js`, driven by `scripts/content-engine/pipeline.json`.

- **discover:** GSC strike zone + DataForSEO ranked keywords → scored/deduped → `pipeline.json` (status: `discovered`)
- **generate:** brief (Sonnet) → research (Perplexity Sonar Pro) → write (Opus) → quality gate → image (Gemini) → `content-queue/` (status: `staged`)
- **publish:** picks oldest from queue → adds internal links → moves to `src/content/articles/` + `public/images/` → `npm run build` (reverts on failure) → git commit+push → email notification

Pipeline is resume-safe: each topic checks its status before sub-steps and skips completed stages.

See `scripts/README.md` for detailed script documentation.

## CI/CD

- **`deploy.yml`** — triggers on push to `main` (production) or `develop` (preview). Runs `npm ci && npm run build`, deploys to Cloudflare Pages, then deploys form-handler Worker on `main` only.
- **`content-generate.yml`** — runs content generation pipeline
- **`content-publish.yml`** — runs content publish pipeline

### Deployment targets

1. **Cloudflare Pages** — static Astro site. Live at beachbride.com (main) or develop.beachbride-site.pages.dev (develop)
2. **Form handler Worker** (`workers/form-handler.ts`) — handles lead/vendor/contact form POSTs at `/workers/form` and `/workers/contact`
3. **Chat proxy Worker** (`workers/chat-proxy.ts`) — optional, manual deploy only

Worker secrets (set via `wrangler secret put`): `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `SENDY_URL`, `SENDY_API_KEY`, `SENDY_LIST_ID`, `SENDY_NURTURE_LIST_ID`

## Brand

```
brand:        #2A7F8F  (warm teal)
brand-light:  #E8F4F6
brand-dark:   #1A5F6F
accent:       #C9974A  (warm gold)
accent-dark:  #A67A35
neutral:      #F9F5F0  (warm white / sand)
```

Font: DM Sans

## Conversion Funnel

```
Content page (organic)
  → Stage 1 quiz: 3 questions + EMAIL only
  → Immediate value: personalized destination guide (resort affiliate links, budget snapshot, timeline)
  → Nurture sequence (Sendy, 4 emails over 14 days)
  → Stage 2 quiz: full fields (phone, budget, date, guest count, services)
  → Lead delivered to pay-per-lead vendors
  → Vendor billed per lead via Stripe
```

## Gotchas

- Worker routes need `zone_name` in `wrangler.toml` matching Cloudflare DNS
- `publish.js` uses `stdio: 'inherit'` for build subprocess — buffering caused OOM on GitHub Actions with large sites
- Perplexity citations come as `annotations` on the message object, not in text body
- `generate.js` uses regex frontmatter parsing; `publish.js` uses the `yaml` npm package
- `GH_PAT` secret required — `GITHUB_TOKEN` can't trigger other workflows
- www redirect is handled in Cloudflare DNS, not in code
- Destination hub pages generated from `src/data/destinations.json` — do not hardcode individual destination pages
- `schemaType` in article frontmatter must be lowercase (`article`, `howto`, `review`, `hub`)
- GSC property: `sc-domain:beachbride.com` (not `https://beachbride.com/`)
- Local dev port conflict: run `npm run dev -- --port 4324` if 4321 is taken
- Type slugs (`planner`, `photographer`, etc.) must never collide with destination slugs — build-time assertion in `[type]/index.astro` catches this
