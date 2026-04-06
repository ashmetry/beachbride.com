# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BeachBride.com is a destination wedding lead and affiliate site. Three revenue streams:

1. **Pay-per-lead** — brides matched to wedding planners, photographers, florists, caterers, DJs. Small operators who actively need clients. Vendors pay per qualified lead.
2. **Affiliate commissions** — high-ticket items where lead-gen doesn't fit: resorts/hotels (Sandals, Beaches, Booking.com affiliate), jewelry (Blue Nile, Brilliant Earth, James Allen — 5-10% on $3K-$15K+ orders), travel insurance, honeymoon packages. Woven into content naturally.
3. **Premium vendor directory** — free listing vs. paid tiers (~$99/mo featured, ~$199/mo pro). Predictable MRR that doesn't depend on lead volume.

**Do NOT model resorts or jewelers as pay-per-lead vendors.** They have established acquisition channels and won't buy email leads. They belong in affiliate links and the premium directory.

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

## Brand Palette (Option 1 — Warm Coastal Luxe)

```
brand:        #2A7F8F  (warm teal — ocean)
brand-light:  #E8F4F6
brand-dark:   #1A5F6F
accent:       #C9974A  (warm gold — sunset, rings, luxury)
accent-dark:  #A67A35
neutral:      #F9F5F0  (warm white — sand)
```

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
```

## Architecture

### Three deployment targets
1. **Cloudflare Pages** — static Astro site, auto-deploys on push to `main` (live) or `develop` (preview)
2. **Form handler Worker** (`workers/form-handler.ts`) — handles lead/vendor/contact form POSTs, auto-deploys with Pages
3. **Chat proxy Worker** (`workers/chat-proxy.ts`) — optional, manual deploy only (`wrangler deploy --config wrangler-chat.toml`)

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
- `/[slug]/` — articles (content collection)
- `/quiz/` — Stage 1 quiz (email capture) and Stage 2 (full lead form)
- `/lp/` — paid traffic landing pages (LandingPageLayout, minimal nav)

### Layout hierarchy
`BaseLayout.astro` (head/nav/footer/JSON-LD) → `ArticleLayout.astro` (TOC/breadcrumbs/FAQs/related) | `PageLayout.astro` (static pages) | `LandingPageLayout.astro` (paid traffic)

### Key files
- `src/lib/site-config.ts` — single source of truth for site constants
- `src/content/config.ts` — Zod schema for article collection
- `src/data/destinations.json` — canonical destination list (used by hub pages, vendor directory, quiz)
- `src/data/vendors.json` — vendor data with `tier` field (free/premium/pro)
- `scripts/content-engine/lib/config.js` — all content engine config (models, thresholds, paths, `LINK_TARGETS`)
- `scripts/content-engine/lib/openrouter.js` — OpenRouter client with rate limiting, retry, 429/500 handling
- `scripts/content-engine/pipeline.json` — pipeline state (committed)

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

Resort and jeweler `type` entries exist in the directory but are **not** enrolled in pay-per-lead. They appear via affiliate links in content and can purchase premium/pro directory tiers.

### Vendor directory tiers
- **Free**: basic profile, listed in directory, 1 destination
- **Premium ($99/mo)**: featured placement, verified badge, 3 destinations, lead alerts
- **Pro ($199/mo)**: all destinations, priority matching, branded profile, direct inquiry button

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
