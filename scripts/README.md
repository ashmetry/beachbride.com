# Scripts

Utility and automation scripts for beachbride.com.

## Content Engine (`content-engine/`)

Automated content pipeline. Run from the project root via `npm run content:*`.

### Pipeline flow

```
discover.js  →  pipeline.json (discovered)
                  ↓
generate.js  →  content-queue/[slug]/  (staged)
                  ↓
publish.js   →  src/content/articles/[slug].mdx
                src/public/images/[slug].jpg
                git commit + push → deploy
```

State is tracked in `pipeline.json` (committed). Each stage checks status before running, so the pipeline is safe to re-run after failures.

### `discover.js`

Finds new article topics from two sources:

1. **GSC strike zone** — keywords ranking positions 11-50 where improving would meaningfully increase traffic. Pulls from `sc-domain:beachbride.com` via Google Search Console API.
2. **DataForSEO ranked keywords** — what beachbride.com currently ranks for, surfacing gaps.

Scores topics by: `volume × intent_multiplier × win_probability`. Deduplicates against existing articles and pipeline topics.

```bash
npm run content:discover -- --dry-run --limit 5   # preview without writing
npm run content:discover -- --limit 20             # discover and save to pipeline
```

Config: `lib/config.js` — models, thresholds, `LINK_TARGETS` for internal linking.

### `generate.js`

Generates a full article for a staged topic:

1. **Brief** (Claude Sonnet) — outline, FAQs, schema type, affiliate opportunities
2. **Research** (Perplexity Sonar Pro) — live web research with citations
3. **Write** (Claude Opus) — full MDX article with frontmatter
4. **Quality gate** — heuristic checks: word count, H2 question ratio, table presence, banned phrases
5. **Image** (Gemini) — hero image generation, saved to `content-queue/[slug]/`

```bash
npm run content:generate -- --dry-run --limit 1        # preview
npm run content:generate -- --limit 5                  # generate next 5 topics
npm run content:generate -- --topic "topic-slug"       # generate specific topic
```

### `publish.js`

Takes oldest staged article from `content-queue/` and publishes it:

1. Reads article, resolves internal links (outbound + inbound + related arrays)
2. Moves files to `src/content/articles/` and `public/images/`
3. Runs `npm run build` — **reverts all changes if build fails**
4. Git commit + push (triggers deploy via GitHub Actions)
5. Sends email notification via Mailgun

```bash
npm run content:publish -- --dry-run   # preview what would be published
npm run content:publish                # publish oldest queued article
```

### `regen-image.js`

Regenerates hero images for existing articles using Gemini.

```bash
node scripts/content-engine/regen-image.js --slug beach-wedding-color-schemes
node scripts/content-engine/regen-image.js --skip-existing   # bulk regen, skip already-done
```

**Always use `--skip-existing` for bulk regeneration.** Never use `--all` after targeted runs — it overwrites images that were intentionally kept.

### `status.js`

Shows pipeline state summary.

```bash
npm run content:status
```

### `enrich-pseo-pages.js`

Generates destination-specific editorial copy for vendor type+destination pSEO pages. Output goes to `src/data/pseo-editorial.json`, keyed by `"type-destination"` (e.g. `"planner-hawaii"`). The Astro template reads this file and falls back to hardcoded generic templates when a key is absent.

Targets the top 20 highest-volume type+destination combos (Hawaii planner, Cancun planner, Bali photographer, etc.) to prevent thin-content penalties and differentiate pages beyond just swapping vendor names.

```bash
npm run content:enrich-pseo -- --dry-run                    # preview without writing
npm run content:enrich-pseo                                  # enrich all priority combos
npm run content:enrich-pseo -- --skip-existing              # only add missing entries
npm run content:enrich-pseo -- --type planner --destination hawaii   # single combo
```

**Run `--skip-existing` for routine updates.** Never use plain `--all` after targeted runs — it overwrites copy that was manually improved.

### `lib/`

Shared utilities for the content engine:

| File | Purpose |
|---|---|
| `config.js` | All config: models, thresholds, paths, `LINK_TARGETS`, env loading |
| `openrouter.js` | OpenRouter API client with rate limiting, retry logic, 429/500 handling |

---

## One-time / utility scripts

### `seed-editorial-topics.js`

Manually seeds topics into `pipeline.json` at `discovered` status, bypassing the discovery step. Used to onboard WP-migrated articles that need refresh, or to queue specific topics directly.

```bash
node scripts/seed-editorial-topics.js
```

Edit the `TOPICS` array at the top of the file before running.

### `seed-vendor-guide-topics.js`

Seeds 10 high-intent "how to find a [vendor type] in [destination]" topics into `pipeline.json`. These articles target queries like "how to find a wedding planner in hawaii" and link back to the pSEO directory pages (`/vendors/planner/hawaii/`), creating editorial content that feeds and reinforces the directory pages.

Uses the `destination_vendor_guide` content type (defined in `generate.js`) which structures content around: why local expertise matters, vetting criteria, questions to ask, price ranges, and where to find vendors.

```bash
node scripts/seed-vendor-guide-topics.js --dry-run   # preview
node scripts/seed-vendor-guide-topics.js             # seed into pipeline
```

After seeding: `npm run content:generate -- --limit 10` to generate the articles.

### `migrate-real-weddings.js`

One-time migration of WordPress gallery posts to the `realWeddings` Astro content collection. Already run — do not re-run without understanding the implications.

### `fetch-destination-climate.js`

Fetches monthly weather/climate data for destinations and writes to `src/data/destinations.json`. Uses an external climate API. Run when adding new destinations.

```bash
node scripts/fetch-destination-climate.js
```

### `generate-destination-images.js` / `generate-hero-images.js`

Generates hero images for destination hub pages and articles using Gemini. Run when adding new destinations or when images need refreshing.

```bash
node scripts/generate-destination-images.js
node scripts/generate-hero-images.js --skip-existing
```

### `generate-missing-destination-images.js`

Targeted version — only generates images for destinations that don't have a hero image yet.

### `seed-vendors-places.js`

Seeds vendor data into `src/data/vendors.json` using Google Places API to find real local businesses. Run when adding vendors to a new destination.

```bash
node scripts/seed-vendors-places.js --destination cancun --type planner
```

### `wp-migration/audit.js`

Audits the WordPress migration — checks for broken redirects, missing images, and content gaps.

```bash
npm run wp:audit        # full audit
npm run wp:audit:dry    # dry run
```

---

## Environment variables

Required in `.env` for local script execution:

```
OPENROUTER_API_KEY=
GEMINI_API_KEY=
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
SENDY_URL=
SENDY_API_KEY=
SENDY_LIST_ID=
SENDY_NURTURE_LIST_ID=
GOOGLE_APPLICATION_CREDENTIALS=path/to/search-console-key.json
```

See `.env.example` for the full list.
