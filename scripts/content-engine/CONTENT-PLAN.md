# Content Engine — Architecture, Lessons & Configuration

This document is the single source of truth for the content pipeline. It is
structured in two parts:

1. **Universal architecture** — the system design, dedup layers, and lessons
   that apply to any niche. Copy this knowledge when porting to a new project.
2. **Project configuration** — beachbride.com-specific settings, competitors,
   filters, and current queue state.

**Standing rule:** Any commit touching `scripts/content-engine/` must update
this file in the same commit. This prevents cross-session drift where the same
architectural problems get re-solved from scratch.

---

## Part 1 — Universal Architecture

### Pipeline Overview

```
discover.js  →  generate.js  →  publish.js
     ↓               ↓               ↓
pipeline.json   content-queue/  src/content/articles/
```

**discover.js** — fetches keyword candidates from 2–3 sources, scores them,
runs deduplication, saves to `pipeline.json` (status: `discovered`)

**generate.js** — brief → intent gate → research → write → quality gate →
image (status: `staged`)

**publish.js** — picks oldest staged article, adds internal links, stamps `publishDate` to the actual go-live date (overwriting the generation date), commits + pushes to repo (status: `published`)

Pipeline is **resume-safe**: every sub-step checks `topic.status` before
running and skips already-completed stages. A run can be interrupted and
restarted safely.

---

### Deduplication — Four Layers

Intent overlap is the real enemy. Two articles serving identical search intent
waste ~$5–10 in research + writing credits and damage SEO by splitting
authority across pages. The system catches duplicates as early and cheaply as
possible.

```
Layer 1: Deterministic    → free, instant, runs on every candidate
Layer 2a: LLM vs. articles → one Sonnet call per batch (~$0.05)
Layer 2b: LLM vs. itself  → one Sonnet call per batch (~$0.05)
Layer 3: LLM intent gate  → one Sonnet call per topic (~$0.005)
```

#### Layer 1 — Deterministic (free, instant)

Four checks, in order. Any match skips the candidate immediately:

1. **Keyword normalization** — strips stopwords, lowercases. Catches
   `"destination wedding cost"` = `"cost of a destination wedding"`. Checked
   against `pipelineKeywords` Set built from all existing `pipeline.topics`.

2. **Persistent blacklist** — `pipeline.rejectedKeywords[]` stores normalized
   form of every keyword ever rejected by Layers 2a/2b. A free Set lookup
   means the LLM never re-evaluates the same bad keyword across runs. Grows
   over time; never shrinks (articles are never deleted in practice).

3. **Slug collision** — `slugify(keyword)` checked against actual article
   files on disk (`existingSlugs`). Catches articles created outside the
   pipeline (manual writes, CMS migrations) that have no pipeline entry.

4. **Pipeline ID match** — `slugify(keyword)` checked against all existing
   `pipeline.topics[].id`. Catches topics in any status, including
   `skipped-intent-overlap` — prevents a previously-rejected topic from
   re-entering if worded slightly differently.

**Critical gotcha:** Articles created outside the pipeline (manual writing,
CMS migration, direct file creation) are invisible to the pipeline until
registered. The slug check handles this automatically for keyword-matched
candidates, but the article must also be registered in `pipeline.json` as a
published entry to prevent it from being re-discovered:

```json
{ "id": "article-slug", "status": "published", "source": "manual", "addedAt": "YYYY-MM-DD" }
```

Guard all pipeline topic loops with `t.keyword &&` — manually-registered
entries have no keyword field.

#### Layer 2a — LLM semantic filter: candidates vs. existing articles

One Sonnet call per batch. Compares all surviving candidates against the full
inventory of existing articles, passing rich context — not just titles:

```
/slug/ — "Title"
  Description: meta description
  Sections: H2 heading 1 | H2 heading 2 | H2 heading 3
  FAQs: Question 1? | Question 2?
```

The H2s and FAQs are what make this useful. An article titled "Destination
Wedding Cost" that has H2s covering every major destination will correctly
block a candidate keyword like "how much does a Cancun destination wedding
cost" — even though the titles don't match.

Rejected keywords are added to `pipeline.rejectedKeywords` (the blacklist) so
they're never evaluated again. The blacklist only grows when discovery actually
runs — it stays empty when the queue threshold prevents discovery from firing.

Also checks `skipped-intent-overlap` pipeline topics (with their briefs where
available) so the filter is aware of topics that were already rejected.

#### Layer 2b — LLM semantic filter: candidates vs. each other (intra-batch dedup)

One Sonnet call per batch, runs after Layer 2a. Compares the surviving
candidates against each other.

**Why this is necessary:** Layer 2a checks candidates against existing
articles. But when a keyword source (DataForSEO, competitor gap) returns
multiple variants of the same intent in one batch — e.g., 5 "beach wedding
songs" variants or 9 "destination wedding invitation wording" variants — all
of them pass Layer 2a because none overlap with any published article. They
all enter the queue as separate topics.

Without this layer, those clusters contaminate the queue. The pipeline would:
1. Generate article A from the cluster (passes intent gate — nothing published yet)
2. Try topic B next run → brief generated ($0.01) → intent gate blocks it
3. Same for C, D, E — each wasting a brief and a generate run slot

**Cost:** ~$0.05 per discovery run. Prevents dozens of wasted brief
generations and unproductive generate runs over weeks.

Rejected keywords from this pass are also added to `pipeline.rejectedKeywords`.

**Batching note:** The cleanup runs in batches of 40 topics. Topics at the
boundary between batches are not cross-compared. Any cross-batch duplicates
will be caught by the Layer 3 intent gate when generating. Run
`scripts/content-engine/cleanup-queue.js` after any large bulk import to
catch cross-batch stragglers via a dedicated LLM pass over the full queue.

#### Layer 3 — LLM intent gate at generate time

One Sonnet call per topic. Runs after brief generation, before research and
writing. This is the final safety net.

**Why after the brief?** The keyword alone has weak signal. The brief's full
H2 outline + FAQ topics + unique angle give 10× more context to judge true
intent overlap. A keyword like "destination wedding checklist" looks different
from "beach wedding checklist" — but if the brief's H2s are identical, it's
the same article.

**What it checks against:**
1. All published articles (with H2s and FAQs read from disk)
2. All in-queue topics with status `briefed/researched/written/passed/staged`
   — prevents two articles on the same intent from both being staged before
   either is published

**Cost comparison:**
- Intent gate: ~$0.005 (one Sonnet call)
- Research + writing it prevents: ~$5–10 (Perplexity + Opus)

**Refresh articles (`isRefresh: true`) skip the intent gate** — they're
improving an existing page, not creating a competing one. The brief's slug
is forced to match the existing article's slug.

**On failure:** Topic gets status `skipped-intent-overlap`. It stays in
`pipeline.json` permanently (preventing re-discovery via Layer 1 pipeline ID
check) but is never processed again. The pipeline automatically picks the
next-highest-scoring valid topic.

**failReason format:** `Intent overlap with /slug/: explanation`. Strip
leading/trailing slashes from the LLM-returned slug — models sometimes return
`/slug/` with slashes, producing `//slug//` without the strip.

---

### Efficiency Controls

#### Queue Threshold

`DISCOVERY_QUEUE_THRESHOLD` (default: 20) — discovery exits immediately when
the number of `discovered` topics in the pipeline meets or exceeds this value.
No fetches, no LLM calls, nothing added.

**How the queue self-regulates:**
- Queue ≥ threshold: discovery is a no-op every scheduled run
- Queue < threshold: discovery runs, refills with new deduplicated topics
- The queue naturally drains as generate runs consume discovered topics

**Setting the threshold:** ~6–8 weeks of generate runway. At 3 articles/run ×
2 runs/week = 6/week generated, threshold of 20 = ~3 weeks minimum runway.
Err on the side of a larger buffer (30–40) to absorb the weeks where the
intent gate blocks some topics and effective throughput drops.

**The queue does not grow unboundedly.** Discovery is a timer-triggered
job but the threshold makes it a no-op when the queue is healthy. It only
fires when the queue actually needs refilling.

#### Persistent Blacklist

`pipeline.rejectedKeywords[]` in `pipeline.json`. Normalized keyword strings
of every candidate ever rejected by Layers 2a or 2b. Checked in Layer 1
before any LLM call — free Set lookup, zero cost.

Compounds over time: after a few discovery cycles, most bad candidates (vendor
career content, generic non-niche keywords, low-quality variants) are already
blacklisted and never reach the LLM.

**Two separate rejection mechanisms:**
- Layer 2a/2b rejections → added to `pipeline.rejectedKeywords` (permanent blacklist)
- Layer 3 rejections → topic marked `skipped-intent-overlap` in pipeline (permanent skip via ID dedup)

These serve different purposes. The blacklist prevents re-discovery of rejected
keywords. The pipeline ID check prevents re-queueing of topics that were
structurally unique enough to pass discovery but failed the deeper intent check
at generate time.

---

### Scoring

Each candidate is scored 0–100 before entering the queue. Higher score = gets
generated first.

**Scoring factors (in order of impact):**
1. Search volume × intent multiplier × win probability (base score)
2. +15 if already ranking in strike zone (positions 8–50) — easier to push up
3. +10 if from competitor gap source — validated demand, net-new opportunity
4. +10/+5 if CPC > $5/$2 — commercial intent signal
5. +8–25 for refresh of thin article (word count < 2000) — existing authority

**Intent multiplier:**
- Commercial keywords (cost, price, book, hire, best, luxury): 1.5×
- Transactional keywords (plan, guide, checklist, how to): 1.3×
- Informational: 1.0×

**Log normalization:** Raw score is passed through `log10 * 20` to compress
the range. Without this, high-volume keywords (100K+ searches) score 1000×
higher than mid-volume keywords (1K searches), burying the long-tail.

---

### Quality Gate

All generated articles must pass before staging:

| Check | Threshold |
|---|---|
| SEO score | ≥ 80/100 |
| AI detection | ≤ 25% |
| Factual check | PASS (disclaimers present, no unverified superlatives) |
| Word count | 1500–2500 |
| Max rewrites before fail | 2 |

Failed articles get status `failed` and trigger an email notification.
The pipeline moves on to the next topic — a quality failure does not block
the run.

---

### Content Rules (enforced by quality gate)

These are enforced by the quality gate heuristic and should be reflected in
the writing prompt for any niche:

- No H1 in article body (layout renders the title from frontmatter)
- ≥50% of H2s phrased as questions
- Question H2s start with a 15–30 word direct answer
- Every factual claim cites a research source
- At least 1 data/comparison table per article
- FAQs only in frontmatter (not repeated as body H2s)
- Banned patterns: em-dashes, "game-changer", "seamlessly", "cutting-edge",
  "robust", "comprehensive", "In conclusion", "delve", "leverage", "foster",
  "navigate", "empower"

---

### Models

| Role | Model | Why |
|---|---|---|
| Brief, semantic filter, intent gate, cleanup | `claude-sonnet-4-6` | Fast, cheap, sufficient for structured JSON |
| Research | `perplexity/sonar-pro` | Live web access + citation annotations |
| Writing | `claude-opus-4-6` | Best quality for long-form content |
| Image prompts | `claude-haiku-4-5` | Cheap, fast, prompt generation only |
| Images | `gemini-3-pro-image-preview` | Native portrait ratio, atmosphere anchors |

Perplexity citations come back as `annotations` on the message object, not in
the text body. Parse them from `message.annotations`, not from the response
text.

---

### Cost Per Generate Run (Estimated)

Assumes queue threshold is not active (discovery runs) and 3 articles generated:

| Step | Cost |
|---|---|
| GSC fetch | free |
| DataForSEO own site (100 keywords) | ~$0.02 |
| DataForSEO competitor gap (N competitors × 200 keywords) | ~$0.05–0.15 |
| Semantic filter — Pass A (1 Sonnet call, ~20K tokens) | ~$0.10 |
| Semantic filter — Pass B, intra-batch (1 Sonnet call) | ~$0.05 |
| Brief × 3 (Sonnet) | ~$0.09 |
| Intent gate × 3 (Sonnet) | ~$0.05 |
| Research × 3 (Perplexity Sonar Pro, 10 sections each) | ~$0.36 |
| Writing × 3 (Opus, ~18K in / 5K out each) | ~$1.95 |
| Images × 3 (Gemini) | ~$0.15 |
| **Total per generate run** | **~$2.90–3.00** |

Discovery is skipped when queue ≥ threshold, saving ~$0.22 on those runs.
The blacklist compounds: each rejected keyword saves ~$0.001 on every future run.

---

### Porting to a New Niche — What to Change

When copying this pipeline to a new project, these are the only things that
need to change. The dedup logic, quality gate, and efficiency controls are
niche-agnostic.

**In `lib/config.js`:**
- `ARTICLES_DIR`, `IMAGES_DIR`, `QUEUE_DIR` — point to new project's paths
- `LINK_TARGETS` — internal link patterns for the new site's key pages
- `AFFILIATE_TARGETS` — affiliate URL patterns for the new niche

**In `discover.js`:**
- `COMPETITORS` — the 3–5 closest niche competitors for keyword gap analysis.
  Choose sites with: same audience, similar content model, established
  keyword ranking. Avoid broad aggregators (too much noise).
- `GAP_REQUIRE_PATTERNS` — regex patterns that a competitor keyword must match
  to be considered relevant. Be specific: 1 false negative (missed opportunity)
  costs nothing; 1 false positive (irrelevant topic) pollutes the queue.
- `GAP_EXCLUDE_PATTERNS` — regex patterns that immediately disqualify a keyword
  (vendor business advice, irrelevant product categories, out-of-niche content).
- `getIntentMultiplier()` — update the commercial/transactional keyword lists
  to match your niche's high-value query patterns.

**In `generate.js`:**
- System prompt in `generateBrief()` — site description, destinations/topics,
  revenue model, brand voice.
- `getOutlineGuide()` — H2 structure templates per content type. Add
  niche-specific content types as needed.
- Writing system prompt — brand voice, content rules, banned patterns.

**In `pipeline.json`:**
- Start fresh with `{ "topics": [], "rejectedKeywords": [], "lastDiscoveryRun": null, "lastGenerationRun": null }`
- Register any articles that exist before the pipeline is first run as
  `{ "id": "slug", "status": "published", "source": "manual", "addedAt": "..." }`

**In `lib/config.js` quality thresholds:**
- `SEO_THRESHOLD`, `AI_DETECTION_THRESHOLD`, `MIN_WORD_COUNT`, `MAX_WORD_COUNT`
  — adjust to niche content norms (some niches need shorter, punchier content)

---

### Known Limitations

- **Discovery is partially reactive.** GSC and own-site DataForSEO only surface
  keywords you already rank for. Competitor gap is proactive but only finds
  what competitors have already validated. Truly novel trends require a separate
  input (e.g., Reddit/forum topic mining, Google Trends API) not yet implemented.

- **Blacklist has no expiry.** If an article is deleted, its rejected variants
  stay blacklisted. Acceptable in practice since articles are never deleted.

- **Refresh articles skip the intent gate.** Intentional, but a refresh brief
  could theoretically produce a second article on the same topic if the brief's
  generated slug differs from `existingSlug`. Not seen in practice — the forced
  `_forcedSlug` field prevents this when seeding explicitly.

- **`getExistingArticles()` reads from disk, not the live site.** If an article
  exists live but not in the repo, it's invisible to the pipeline. In practice
  this can't happen since `publish.js` commits everything before pushing.

- **Intra-batch dedup batches of 40 don't cross-compare.** Topics at batch
  boundaries can slip through as duplicates. The intent gate catches them at
  generate time. Run `cleanup-queue.js` after any large bulk import.

- **`DISCOVERY_QUEUE_THRESHOLD` is topic count, not coverage quality.** A queue
  of 20 high-quality unique topics is healthier than 60 with clusters. The
  intra-batch dedup (Layer 2b) addresses this at source, but the threshold
  number alone doesn't guarantee queue quality.

- **`savePipeline()` must run before `git add pipeline.json`.** If the status
  write happens after staging, git sees no diff and silently drops the file
  from the commit — the `published` status and `publishedAt` timestamp are
  then missing from the repo copy of `pipeline.json`. Fixed: step 6 is now
  `savePipeline()` and step 7 is `git add / commit / push`.

---

## Part 2 — beachbride.com Configuration

### Discovery Sources

**Source 1 — GSC Strike Zone**
Keywords beachbride.com already ranks for in positions 8–50 with ≥10 impressions.
Reactive (our own data). Easiest wins — existing authority, just needs better
content.

**Source 2 — DataForSEO Own Site**
Full ranked keyword set, top 100. Reactive. Overlaps with GSC but catches
commercial queries not in the strike zone.

**Source 3 — Competitor Keyword Gap**
Keywords the top 5 destination wedding competitors rank for (positions 1–30)
that beachbride.com does NOT rank for at all. Proactive — the primary source
of net-new topic ideas.

Competitors in priority order:
1. `destinationweddingdetails.com` — #1 destination wedding content site, pure niche
2. `destify.com` — same lead-gen + content model as us, high commercial intent
3. `junebugweddings.com` — large library, strong destination wedding section
4. `destinationido.com` — similar vendor directory model
5. `destinationweddings.com` — commercial-intent planning content

**Why NOT** The Knot, WeddingWire, Brides.com — too broad, thousands of
irrelevant local wedding keywords would pollute the gap analysis.

**Relevance filters:**
- Must match: destination/beach wedding, location name, elopement, resort/villa/outdoor wedding, tropical/intimate wedding
- Must exclude: vendor business advice, dress/gown queries, registry, local wedding, photographer career content

---

### Schedule

| Workflow | Schedule | What it does |
|---|---|---|
| `content-generate.yml` | Mon 4am UTC + Thu 4am UTC | Discover (if queue low) + generate 3 articles |
| `content-publish.yml` | Mon–Fri 2pm UTC (9am ET) | Publish 1 article from queue |

**Publish rate:** 5/week. **Generate rate:** 3 per run × 2 runs/week = up to 6/week.

---

### Manually Seeded Topics

Use `npm run content:status` for live queue counts — don't record them here.

Document manual seeds when they explain a structural decision or non-obvious
rationale that future sessions would otherwise re-derive.

**Queue cleanup — 2026-04-08:**
The intra-batch dedup (Layer 2b) was added after discovery had already run
without it. `cleanup-queue.js` was run retroactively to remove 27 duplicate
clusters. 4 cross-batch stragglers removed manually. One-time correction —
future discovery runs won't accumulate clusters because Layer 2b runs at
discovery time.

**Room block topics — 2026-04-08:**
Four topics seeded directly (source: `room-block-seed`) to support the room
block coordination revenue stream. All link to `/tools/room-block-calculator/`
via a LINK_TARGETS entry in `lib/config.js`. Auto-categorize to `planning`.

- `destination-wedding-room-block-guide` — how to set up a room block
- `how-many-hotel-rooms-to-block-destination-wedding` — calculator companion
- `destination-wedding-hotel-block-cost` — cost breakdown
- `all-inclusive-resort-group-rates-destination-weddings` — negotiation guide

---

### Section Images for Visual-Intent Articles ← added 2026-04-08

Articles on visual-intent topics (colors, cakes, florals, decor, nails, attire,
invitations, etc.) generate 2–3 contextual section images in addition to the
hero image. Each image is specific to an H2 heading, not a generic repeat of
the hero.

**How it works:**
1. `detectVisualIntent(keyword)` checks the keyword against pattern list
2. `getSectionImageCount(keyword)` returns 3 for color/palette topics, 2 for others
3. After hero generation, `generateSectionImages()` selects H2s evenly distributed
   across the outline (skipping first and last — those positions are awkward)
4. Claude Haiku writes a section-specific prompt per H2, Gemini generates the image
5. `insertSectionImagesIntoArticle()` inserts `![alt](/images/slug-N.jpg)` tags
   immediately after each selected H2, before the section body — deterministic
   placement, not LLM-placed

**Cost:** ~$0.15 extra per visual article (3 Haiku prompt calls + 3 Gemini images)

**Naming:** `{slug}.jpg` (hero), `{slug}-2.jpg`, `{slug}-3.jpg`, `{slug}-4.jpg`

**publish.js** moves all `slug-N.jpg` files (checks indices 2–5), handles revert,
git add, and git rm alongside the hero image.

**Testing on existing articles:** `scripts/content-engine/test-section-images.js`
generates section images for an already-published article without re-running the
full pipeline. Writes directly to `public/images/` and updates the article body.
Cost: ~$0.15–0.20 per run.

**Visual intent patterns** (in `generate.js`):
colors/palettes, cakes, bouquets/florals, nails, decor/centerpieces, dress/attire,
shoes/sandals, tablescapes, invitations/stationery, favors, boutonnieres, lighting,
arches/arbors, hair/updo.

---

### Intent Gate Test

Run `node scripts/content-engine/test-intent-gate.js` to validate the intent
overlap logic against 6 synthetic test cases (~$0.03). Run this whenever the
`checkIntentOverlap` prompt or `getExistingArticles()` enrichment changes.

Expected: 5/6 pass (the Bali cost case is intentionally blocked — a general
destination cost article that covers Bali in its breakdown correctly blocks a
Bali-specific cost article. This is the right behavior under the strict
false-negative cost model).
</content>
</invoke>
---

### Editorial Notes (_editorialNotes) — added 2026-04-09

A mechanism for injecting pre-verified facts into the pipeline so generated
articles use accurate, researched data rather than hallucinated numbers.

**How it works:**
- Add `_editorialNotes` (string) to any topic in `pipeline.json`
- For topics with an existing brief (status `staged`), also add `verifiedFacts`
  to `topic.brief` — this ensures the notes survive into the write step
- `generate.js` injects the notes into both:
  1. The **brief prompt** (so brief structure reflects verified angles)
  2. The **write prompt** (so the article body uses the verified data)
- Label in prompt: "EDITORIAL NOTES — Pre-verified facts that MUST be
  incorporated accurately. Do not contradict these."

**When to use:**
- When you've done external research and verified specific numbers before the
  article is generated
- When a topic covers factual territory where hallucinated figures would be
  misleading (pricing, perk thresholds, contract terms, return policies)
- When a topic is about a subject where common industry claims are wrong and
  you want the article to reflect current reality

**Current usage:**
- `how-many-hotel-rooms-to-block-destination-wedding` (staged) — verified
  Sandals/AMR/Hard Rock/Hyatt Ziva perk thresholds, attrition norms, timing
- `destination-wedding-hotel-block-cost` (discovered) — same verified data

**Verified room block data (April 2026):**
Sandals: perks from 5 rooms, AMR: 1 comp per 5-7 rooms + cocktail at 10+,
Hard Rock: room-night thresholds (30-59 nights = 2hr dinner), Hyatt Ziva: $1,200
off at 30+ rooms. Post-COVID: value is perks not rate discounts. Attrition range
70-90%; negotiate toward 70-75%. Timing: 12-18 months for peak Caribbean.
Full data in memory: `reference_room_block_verified_data.md`.

**Cost:** No additional API cost — notes are injected into existing prompts.
