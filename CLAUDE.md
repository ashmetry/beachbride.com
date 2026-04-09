# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BeachBride.com is a destination wedding planning resource for brides. Three revenue streams:

1. **Pay-per-lead** — brides matched to wedding planners, photographers, florists, caterers, DJs. Small operators who actively need clients. Vendors pay per qualified lead.
2. **Affiliate commissions** — high-ticket items: resorts/hotels (Sandals, Beaches, Booking.com affiliate), jewelry (Blue Nile, Brilliant Earth, James Allen — 5-10% on $3K-$15K+ orders), travel insurance, honeymoon packages. Woven into content naturally.
3. **Room block coordination** — BeachBride acts as a travel advisor (via Fora host agency), securing group room blocks at all-inclusive resorts for destination wedding couples. Free to couples — revenue is 10–21% resort commission, ~$3,500–6,000 net per wedding. Scales via wedding planner referral partners ($400 flat per referral).

**Do NOT model resorts or jewelers as pay-per-lead vendors.** They belong in affiliate links and the directory. The vendor directory exists for discoverability — paid directory tiers are not being pursued as a revenue stream.

## Conversion Funnel

```
Content page (organic)
  → Stage 1 quiz: 3 fun questions + EMAIL only
  → Immediate value: personalized destination guide (resort affiliate links, budget snapshot, planning timeline)
  → Nurture sequence (Sendy, 4 emails over 14 days):
      Email 1 (immediate): Destination guide with resort affiliate links
      Email 2 (day 3):     Jewelry affiliate — beach-ready rings/bands (Blue Nile etc.)
      Email 3 (day 7):     Planning content — checklist, legal requirements at destination
      Email 4 (day 14):    Soft lead capture — "Ready to talk to a local planner?"
  → Stage 2 quiz: full fields (phone, budget, date, guest count, services needed)
  → Lead delivered to pay-per-lead vendors
  → Vendor billed per lead via Stripe
```

**Homepage primary CTA**: Stage 1 quiz (email only). Do NOT put a full 8-field lead form above the fold.

## Homepage Structure

1. **Hero** — full-bleed beach wedding image, aspirational headline, one CTA → Stage 1 quiz
2. **Destination grid** — 6-8 cards (Cancun, Punta Cana, Jamaica, Hawaii, Bali, Santorini, Tulum, Costa Rica) → destination hub pages
3. **How it works** — 3 steps, simple
4. **Featured articles** — 3 content cards
5. **Social proof** — stats or quote
6. **Vendor CTA strip** (near footer) — "List your business →"

## Tech Stack

- **Framework**: Astro 5 (static output) with MDX, React, Tailwind CSS
- **Hosting**: Cloudflare Pages + Cloudflare Workers
- **Content engine**: Node.js scripts using OpenRouter (Claude, Perplexity) + Gemini for images
- **Email**: Mailgun (transactional), Sendy (nurture sequences + list management)
- **TypeScript**: strict mode, path aliases `@components/*`, `@layouts/*`, `@lib/*`, `@data/*`

## Brand Palette (Warm Coastal Luxe — Navy + Gold)

```
brand:        #1C2B4A  (deep navy — premium, coastal)
brand-light:  #E8ECF4
brand-dark:   #111B30
accent:       #C9974A  (warm gold — sunset, rings, luxury)
accent-dark:  #A67A35
neutral:      #F9F5F0  (warm white — sand)
```

Teal was replaced with navy in April 2026. Navy pairs naturally with the gold accent and cream background, reads more premium, and harmonizes with the dark footer. Do not reintroduce teal.

Font: DM Sans (already in blueprint). Warm teal reads as ocean without nautical baggage. Gold accent fits jewelry affiliate content naturally. Warm white background complements beach photography.

## Commands

```bash
# Dev (two terminals)
npm run dev                                          # Astro dev server at localhost:4321
wrangler dev --config wrangler.toml --port 8787      # Form handler Worker (proxied via /workers/*)

# Build
npm run build           # Static build → /dist/
npm run preview         # Preview built site

# Content engine (requires .env with API keys)
npm run content:discover -- --dry-run --limit 5      # Preview topic discovery
npm run content:discover -- --limit 20               # Discover topics
npm run content:generate -- --dry-run --limit 1      # Preview generation
npm run content:generate -- --limit 5                # Generate articles
npm run content:generate -- --topic "topic-id"       # Generate specific topic
npm run content:publish -- --dry-run                 # Preview publish
npm run content:publish                              # Publish oldest queued article
npm run content:status                               # Pipeline status

# pSEO page enrichment (vendor type+destination editorial copy)
npm run content:enrich-pseo -- --dry-run             # Preview
npm run content:enrich-pseo -- --skip-existing       # Only add missing entries
npm run content:enrich-pseo -- --type planner --destination hawaii
npm run content:enrich-pseo -- --all                 # Regenerate all priority combos

# Destination climate data
npm run fetch-climate                                # Fetch missing climate data
npm run fetch-climate:force                          # Force-refresh all destinations
npm run fetch-climate:validate                       # Validate existing data

# WP migration audit
npm run wp:audit                                     # Audit WordPress migration
npm run wp:audit:dry                                 # Dry run audit
```

No linter or test framework is configured. Validation happens via `npm run build` (Astro type-checks and catches broken references) and the content engine's quality gate.

## Architecture

### CI/CD (GitHub Actions)
- **`deploy.yml`** — triggers on push to `main` (production) or `develop` (preview). Runs `npm ci && npm run build`, deploys to Cloudflare Pages, then deploys form-handler Worker on `main` only.
- **`content-generate.yml`** — runs content generation pipeline
- **`content-publish.yml`** — runs content publish pipeline

### Three deployment targets
1. **Cloudflare Pages** — static Astro site, auto-deploys on push to `main` (live at beachbride.com) or `develop` (preview at develop.beachbride-site.pages.dev)
2. **Form handler Worker** (`workers/form-handler.ts`) — handles lead/vendor/contact form POSTs at `/workers/form` and `/workers/contact`, auto-deploys with Pages on `main`
3. **www redirect Worker** (`workers/www-redirect.ts`) — redirects www → apex; config in `wrangler-www.toml`, manual deploy

Worker secrets (set via `wrangler secret put` or CF dashboard): `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `NOTIFY_EMAIL`, `SENDY_URL`, `SENDY_API_KEY`, `SENDY_LIST_ID`, `SENDY_NURTURE_LIST_ID`, `SENDY_ROOM_BLOCK_LIST_ID`, `TURNSTILE_SECRET`

### Content engine pipeline
`discover.js` → `generate.js` → `publish.js`, driven by `pipeline.json` state file.

- **discover**: GSC API + DataForSEO → scored/deduped keywords → `pipeline.json` (status: `discovered`)
- **generate**: brief (Sonnet) → research (Perplexity Sonar Pro) → write (Opus) → quality gate (heuristic) → image (Gemini) → `content-queue/` (status: `staged`)
- **publish**: picks oldest from queue → adds internal links (outbound + inbound + related arrays) → moves to `src/content/articles/` + `public/images/` → `npm run build` (reverts all changes on failure) → git commit+push → email notification

Pipeline is **resume-safe**: each topic checks its status before sub-steps and skips completed stages.

### Key page types
- `/` — homepage (email capture primary CTA)
- `/destinations/[slug]/` — destination hub pages (content + vendors + resort affiliate links for a single destination). High commercial intent. First-class pages, not just vendor filters.
- `/vendors/` — directory landing
- `/vendors/[slug]` — individual vendor profile (LocalBusiness JSON-LD)
- `/vendors/[destination]/[slug]` — vendor within destination
- `/[slug]/` — articles (content collection `articles`)
- `/guides/` — articles index, grouped by category (3 preview cards + "see all" per category)
- `/guides/[category]/` — category sub-pages: `planning`, `food-drink`, `decor-style`, `bride`, `destinations`
- `/real-weddings/` — gallery listing (62 migrated WP posts with real photos)
- `/real-weddings/[slug]/` — individual gallery page (hero + text + masonry photo grid + quiz CTA)
- `/quiz/` — Stage 1 quiz (email capture) and Stage 2 (full lead form)
- `/lp/` — paid traffic landing pages (LandingPageLayout, minimal nav)
- `/vendors/[type]/[destination]/` — pSEO vendor type+destination pages (e.g. `/vendors/planner/hawaii/`). Editorial copy served from `src/data/pseo-editorial.json`; falls back to hardcoded templates when key absent.
- `/tools/room-block-calculator/` — interactive React calculator (Astro island, `client:load`). Uses `src/data/room-block-tiers.json` for budget/perk thresholds. Email capture at bottom subscribes to `SENDY_ROOM_BLOCK_LIST_ID`.
- `/book/` — room block consultation intake page (`noIndex: true`). Linked from destination hubs and calculator CTA via `SITE_CONFIG.roomBlockCalendlyUrl`.

### Layout hierarchy
`BaseLayout.astro` (head/nav/footer/JSON-LD) → `ArticleLayout.astro` (TOC/breadcrumbs/FAQs/related) | `PageLayout.astro` (static pages) | `LandingPageLayout.astro` (paid traffic)

### Content collections
- `articles` — editorial content. Schema in `src/content/config.ts`. Files in `src/content/articles/`. Served at `/[slug]/`.
- `realWeddings` — photo gallery posts migrated from WP. Files in `src/content/realWeddings/`. Served at `/real-weddings/[slug]/`. Images in `public/images/real-weddings/[slug]/`.

### Guide category auto-assignment
Articles are auto-assigned to a guide category by `getCategoryForSlug()` in `src/data/guide-categories.ts`. It matches the article **slug** against keyword patterns. The 5 categories are:
- `planning` — planning, budget, tips, checklist, cost, transportation, bachelorette, honeymoon, destination-wedding-*
- `food-drink` — menu, seafood, cake, dessert, candy, bridal-shower, edible, punch
- `decor-style` — decor, centerpiece, color-scheme, lighting, tabletop, indoor, sea-glass, diy-
- `bride` — accessories, shoes, looks, bouquet, bridesmaid, favors, dress, jewelry
- `destinations` — key-west, palm-beach, cancun, hawaii, bali, santorini, celebrity-beach-wedding

**When seeding new topics:** choose a slug that includes one of the above patterns so the article auto-categorizes correctly. If no pattern matches, the article falls back to `planning`. Update `guide-categories.ts` if you need a new category or pattern.

### Key files
- `src/lib/site-config.ts` — single source of truth for site constants
- `src/content/config.ts` — Zod schemas for `articles` and `realWeddings` collections
- `src/data/destinations.json` — canonical destination list (used by hub pages, vendor directory, quiz)
- `src/data/vendors.json` — vendor data with `tier` field (free/premium/pro)
- `src/data/guide-categories.ts` — guide category definitions + `getCategoryForSlug()` auto-assignment
- `scripts/content-engine/lib/config.js` — all content engine config (models, thresholds, paths, `LINK_TARGETS`)
- `scripts/content-engine/lib/openrouter.js` — OpenRouter client with rate limiting, retry, 429/500 handling
- `scripts/content-engine/pipeline.json` — pipeline state (committed)
- `src/data/pseo-editorial.json` — generated editorial copy for vendor type+destination pages, keyed by `"type-destination"` (e.g. `"planner-hawaii"`)
- `src/data/destination-climate.json` — climate/weather data per destination, generated by `fetch-destination-climate.js`
- `src/data/room-block-tiers.json` — budget tiers and perk thresholds for room block calculator
- `scripts/seed-editorial-topics.js` — manually seed WP-migrated topics into pipeline bypassing discovery
- `scripts/seed-vendor-guide-topics.js` — seed "how to find a [vendor] in [destination]" articles; link to pSEO type+destination pages
- `scripts/seed-vendors-places.js` — seed vendor entries from Google Places API
- `scripts/content-engine/enrich-pseo-pages.js` — generate editorial copy for pSEO pages → `pseo-editorial.json`
- `scripts/content-engine/regen-image.js` — regenerate article images via Gemini; use `--skip-existing` for bulk runs
- `scripts/migrate-real-weddings.js` — one-time WP gallery migration script (already run)

### Vendor data model
```json
{
  "slug": "...",
  "name": "...",
  "type": "planner|photographer|florist|caterer|dj|officiant|resort|jeweler",
  "tier": "free|premium|pro",
  "destinations": ["cancun", "punta-cana"],
  "description": "...",
  "website": "...",
  "contact": { "email": "...", "phone": "..." },
  "image": "...",
  "rating": 4.8,
  "reviewCount": 42,
  "featured": false
}
```

Resort and jeweler `type` entries exist in the directory but are **not** enrolled in pay-per-lead. They appear via affiliate links in content.

### Vendor directory tiers
The `tier` field (`free`/`premium`/`pro`) exists in `vendors.json` and the data model but paid tiers are not being actively monetized. All 957 vendors are currently `free`. The directory exists for SEO (pSEO vendor pages) and trust, not as a subscription revenue stream.

## Content Rules (enforced by quality gate)

- No H1 in article body (layout renders title from frontmatter)
- ≥50% of H2s phrased as questions; question H2s start with 15-30 word direct answer
- Every factual claim cites a research source
- At least 1 data/comparison table per article
- FAQs only in frontmatter (not repeated as body H2s)
- Word count 1500-2500; SEO score threshold 80/100
- Affiliate links woven naturally into relevant content — resort comparisons, jewelry recommendations, travel insurance
- Banned patterns: em-dashes, "game-changer", "seamlessly", "cutting-edge", "robust", "comprehensive", "In conclusion", "delve", "leverage", "foster", "navigate", "empower"

## Gotchas

- Worker routes need `zone_name` in `wrangler.toml` matching Cloudflare DNS. Don't use Workers and Pages Functions for the same route.
- `publish.js` uses `stdio: 'inherit'` for build subprocess — buffering caused OOM on GitHub Actions with large sites.
- DataForSEO supports up to 100 tasks per request and 2,000 calls/minute. The moldguide "1 task" limitation was a billing plan restriction, not an API constraint. Batch tasks in a single request array when querying multiple domains/keywords.
- Perplexity citations come as `annotations` on the message object, not in text body.
- `generate.js` uses regex frontmatter parsing; `publish.js` uses the `yaml` npm package for robust read/write during internal linking.
- `GH_PAT` secret is required because `GITHUB_TOKEN` can't trigger other workflows (publish push needs to trigger deploy).
- www redirect is handled in Cloudflare DNS, not in code.
- Destination hub pages (`/destinations/[slug]/`) must be generated from `src/data/destinations.json` — do not hardcode individual destination pages.
- `schemaType` in article frontmatter must be lowercase: `article`, `howto`, `review`, `hub`. The content engine brief sometimes returns `"Article"` or `"HowTo"` — `generate.js` normalizes this with `.toLowerCase()` after brief generation.
- `realWeddings` collection MDX files must use `tags: []` (not bare `tags:`) and `images: []` when empty, otherwise Astro reads them as null and fails schema validation.
- GSC property for beachbride.com is `sc-domain:beachbride.com` (not `https://beachbride.com/`). Service account has access to the domain property only.
- The local dev server may conflict with other projects on port 4321. Run `npm run dev -- --port 4324` for beachbride if needed.

## Memory — Standing Rule

**Proactively save to memory without being asked.** The user will not remember to ask. Save automatically whenever a conversation contains:

- **Strategy** — revenue models, monetization approaches, partnership structures, business model decisions
- **Architecture** — new page types, new pipeline stages, tech stack decisions, API integrations chosen
- **Research** — specific platforms, vendors, tools, services evaluated (with names, URLs, commission rates, pricing)
- **Decisions made** — why one approach was chosen over another, what was ruled out and why
- **Contacts/providers** — any specific company, tool, or service discussed as a candidate for integration

**What to save:** Write to `C:\Users\ash\.claude\projects\c--Users-ash-Documents-Projects-CC-beachbride-com\memory\` and update `MEMORY.md` index. Use `project_` prefix for business/site context, `feedback_` for preferences, `reference_` for external resources.

**When to save:** During the conversation as topics emerge — not just at the end. If it would take more than 2 minutes to reconstruct, save it now.

**What not to save:** Code that's already in the repo, git history, temporary task state, anything derivable by reading the current codebase.

## Content Engine — Standing Rule

**Any time you modify a file in `scripts/content-engine/`, update `scripts/content-engine/CONTENT-PLAN.md` in the same commit** to reflect what changed and why. This is the living architecture doc for the pipeline — it must stay current across sessions. Specifically capture:
- What changed (which file, which function, what behavior)
- Why it changed (the problem it solved, the lesson learned)
- Any cost/efficiency implications
- Any new gotchas discovered

This applies to all scripts: `discover.js`, `generate.js`, `publish.js`, `lib/config.js`, `lib/openrouter.js`, workflow YAMLs, and any new scripts added.
