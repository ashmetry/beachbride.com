# Content Engine — Architecture & Lessons Learned

This document captures design decisions, gotchas, and hard-won lessons from
running the content pipeline in production. Update it whenever the architecture
changes so future runs don't repeat the same mistakes.

---

## Pipeline Overview

```
discover.js  →  generate.js  →  publish.js
   ↓                ↓               ↓
pipeline.json   content-queue/  src/content/articles/
```

**discover.js** — finds keyword opportunities, deduplicates, scores, saves to `pipeline.json` (status: `discovered`)
**generate.js** — brief → intent gate → research → write → quality gate → image (status: `staged`)
**publish.js** — picks oldest staged article, adds internal links, commits + pushes (status: `published`)

Pipeline is **resume-safe**: every sub-step checks status before running and skips completed stages.

---

## Discovery Sources

### 1. GSC Strike Zone
Keywords beachbride.com already ranks for in positions 8–50 with ≥10 impressions.
These are the easiest wins — existing authority, just needs better content.

### 2. DataForSEO Ranked Keywords
Our own site's full ranked keyword set (top 100). Overlaps heavily with GSC but
catches commercial queries not in the strike zone.

### 3. Competitor Keyword Gap ← added 2026-04-08
Keywords the top 5 destination wedding competitors rank for (positions 1–30)
that beachbride.com does NOT rank for at all. This is the primary source of
net-new topic discovery — the other two sources are reactive (our own data),
this one is proactive.

**Competitors in priority order:**
1. `destinationweddingdetails.com` — #1 destination wedding content site, pure niche, highest signal
2. `destify.com` — exact same model (lead gen + content), high commercial intent keywords
3. `junebugweddings.com` — large library, strong destination wedding section
4. `destinationido.com` — similar audience + vendor directory model
5. `destinationweddings.com` — commercial-intent planning content

**Why NOT:** The Knot, WeddingWire, Brides.com — too broad, thousands of irrelevant
local wedding keywords would pollute the gap analysis.

**Relevance filters applied:**
- Must match: destination/beach wedding, location name, elopement, resort/villa/outdoor wedding
- Must exclude: vendor business advice, dress/gown queries, registry, local wedding, photographer career content

---

## Deduplication — Three Layers

Intent overlap is the real enemy. Two different keywords serving identical search
intent waste ~$5–10 in research + writing credits per duplicate article.

### Layer 1: Deterministic (free, instant)
- **Keyword normalization** — strips stopwords, catches "destination wedding cost" = "cost of a destination wedding"
- **Slug collision** — `slugify(keyword)` checked against actual files in `src/content/articles/` (catches manually-created articles the pipeline doesn't know about)
- **Pipeline ID match** — checked against all existing `pipeline.topics[].id`
- **Persistent blacklist** — `pipeline.rejectedKeywords[]` stores normalized keywords previously rejected by the LLM; free Set lookup prevents re-evaluating the same keyword twice across runs

### Layer 2: LLM semantic filter at discovery (two Sonnet calls per batch)

**Pass A — Candidates vs. existing articles** (was the only pass before 2026-04-08)
Compares ALL candidate keywords as a batch against existing articles with their
H2 headings and FAQ questions — not just title/slug. Passes the rich context:

```
/slug/ — "Title"
  Description: meta description text
  H2 sections: Section 1 | Section 2 | Section 3
  FAQs: Question 1? | Question 2?
```

Rejected keywords are added to `pipeline.rejectedKeywords` so the LLM never
sees them again on future runs.

**Pass B — Candidates vs. each other (intra-batch dedup)** ← added 2026-04-08
After Pass A filters against existing articles, a second call compares the
surviving candidates against each other. This catches cases like DataForSEO
returning 5 "beach wedding songs" variants in one batch — all pass Pass A
because none overlap with published articles, but only 1 should enter the queue.

**Why this matters:** Without Pass B, intent clusters contaminate the queue.
Each cluster produces 1 real article and N-1 blocked runs (brief wasted per
block, ~$0.01 each). With 83 topics before cleanup, 58 were in clusters — 31
extra generate runs would have wasted slots producing 0 articles.

**Cost:** Pass B adds one Sonnet call per discovery run (~$0.05). Saves multiple
wasted brief generations ($0.01 each) and ~15 unproductive generate runs.

### Layer 3: LLM intent gate at generate time (one Sonnet call per topic)
Runs **after brief generation, before research**. The brief's full H2 outline +
FAQ topics + unique angle give 10× more signal than the keyword alone.

Checks against:
1. All published articles (with H2s + FAQs from disk)
2. All in-queue topics with status `briefed/researched/written/passed/staged`
   (prevents publishing two articles on the same intent before either is live)

Cost comparison:
- Intent gate: ~$0.005 (one Sonnet call)
- Research + writing avoided: ~$5–10 (Perplexity + Opus)

Refresh articles (`isRefresh: true`) skip the intent gate — they're intentionally
updating existing content, not creating competing content.

Topics that fail get status `skipped-intent-overlap` — they stay in `pipeline.json`
(preventing re-discovery via keyword/ID dedup) but never burn credits again.

**The failReason field** stores `Intent overlap with /slug/: explanation`. The slug
is stripped of any leading/trailing slashes to prevent `//double-slash//` formatting
from LLM responses that include slashes in the slug value.

---

## Efficiency Controls

### Queue Threshold (`DISCOVERY_QUEUE_THRESHOLD = 20`)
Discovery skips all API fetches when ≥20 topics are already `discovered` in
the pipeline. At 3 articles/week generated, 20 topics = ~7 weeks runway.
Saves ~$0.07/run on unnecessary fetches.

**Observed behavior (2026-04-08):** With 86 topics in queue, every generate run
that day skipped discovery entirely. This is correct. The queue refills when it
drops below 20 — no manual intervention needed.

### Persistent Blacklist
`pipeline.rejectedKeywords[]` — normalized strings of every keyword the semantic
overlap LLM has ever rejected. Checked before any LLM call in the dedup loop.
Grows over time so the LLM progressively sees only genuinely novel candidates.

**Why this matters:** Without it, each discovery run re-evaluates the same bad
keywords, burning ~$0.001 per keyword per run. At hundreds of candidates, this
compounds significantly over weeks.

**Important:** The blacklist is populated by the semantic filter in `discover.js`.
The intent gate in `generate.js` does NOT add to the blacklist — it marks topics
`skipped-intent-overlap` in pipeline.json instead (which prevents re-discovery
via the pipeline ID check). Two different mechanisms for two different layers.

### Intent Gate Self-Correction
Topics blocked by the intent gate get status `skipped-intent-overlap` and stay
in `pipeline.json`. This means:
1. They never burn credits again (status check before any processing)
2. Future discover runs don't re-add them (pipeline ID dedup)
3. The next-highest-scoring valid topic automatically gets picked up

**Observed (2026-04-08 run):** Hawaii cost + Punta Cana cost blocked → pipeline
skipped to `destination-wedding-announcement` (score 70) → perfect article
generated (SEO 100%, AI Detection 0%). The system self-corrects without manual
intervention.

---

## Articles Outside the Pipeline — Critical Lesson

**Problem (encountered 2026-04-08):** Articles created manually or migrated from
WordPress have no `pipeline.json` entry. The discover step was blind to them — it
would re-discover them as fresh keyword opportunities and generate duplicate content.

**Root cause:** `pipelineKeywords` dedup only catches exact keyword matches.
DataForSEO candidates have no `currentPageUrl` so `checkCannibalization()` doesn't
fire. The slug check didn't exist.

**Fix applied:**
1. `topicId = slugify(keyword)` computed before pushing to pipeline; checked against
   `existingSlugs` (actual files) and `pipelineIds` (pipeline entries)
2. 8 orphan articles manually registered in `pipeline.json` as `status: published`
   with no `keyword` field — guarded everywhere with `t.keyword &&`

**Rule going forward:** Any article added outside the pipeline (manual writing,
WP migration, direct file creation) must be registered in `pipeline.json`:
```json
{ "id": "article-slug", "status": "published", "source": "manual", "addedAt": "2026-04-08" }
```

---

## Cost Per Run (Estimated)

| Step | Cost |
|---|---|
| GSC fetch | free |
| DataForSEO own site (100 keywords) | ~$0.02 |
| DataForSEO competitor gap (5 × 200 keywords) | ~$0.05 |
| Semantic overlap filter (1 Sonnet call, ~20K tokens) | ~$0.10 |
| Brief × 3 (Sonnet) | ~$0.09 |
| Intent gate × 3 (Sonnet) | ~$0.05 |
| Research × 3 (Perplexity Sonar Pro, 10 sections each) | ~$0.36 |
| Writing × 3 (Opus, ~18K in / 5K out each) | ~$1.95 |
| Images × 3 (Gemini) | ~$0.15 |
| **Total per generate run** | **~$2.90** |

Discovery is skipped when queue has ≥20 topics, saving ~$0.17 on those runs.
The blacklist compounds: each rejected keyword saves ~$0.001 on every future run.

---

## Schedule

| Workflow | Schedule | What it does |
|---|---|---|
| `content-generate.yml` | Mon 4am UTC + Thu 4am UTC | Discover (if queue low) + generate 3 articles |
| `content-publish.yml` | Mon–Fri 2pm UTC (9am ET) | Publish 1 article from queue |

**Publish rate:** 5/week. **Generate rate:** 3 per run × 2 runs/week = up to 6/week.
Queue should stay healthy. Monitor with `npm run content:status`.

---

## Quality Gate Thresholds

- SEO score: ≥80/100 (10 checks × 10 points each)
- AI detection: ≤25% (banned patterns + sentence uniformity)
- Factual: PASS (disclaimers present, no unverified superlatives)
- Word count: 1500–2500
- Max rewrites before fail: 2

---

## Intent Gate Test

Run `node scripts/content-engine/test-intent-gate.js` to validate the intent
overlap logic against 6 synthetic test cases (~$0.03). Run this whenever the
`checkIntentOverlap` prompt or `getExistingArticles()` enrichment changes.

Expected: 5/6 pass (the Bali cost case is intentionally blocked by the strict
"existing article covers this destination" logic — this is correct behavior).

---

## Models Used

| Role | Model | Why |
|---|---|---|
| Brief, semantic filter, intent gate | `claude-sonnet-4-6` | Fast, cheap, sufficient for structured JSON tasks |
| Research | `perplexity/sonar-pro` | Live web access + citation annotations |
| Writing | `claude-opus-4-6` | Best quality for long-form content |
| Image prompts | `claude-haiku-4-5` | Cheap, fast, prompt generation only |
| Images | `gemini-3-pro-image-preview` | Native portrait ratio, atmosphere anchors |

---

## Queue Health

**State after 2026-04-08 cleanup:**
- 52 unique discovered topics (down from 83 before intra-batch dedup was added)
- 31 marked `skipped-intent-overlap` (26 via cleanup-queue.js, 4 fixed manually)
- 5 already `staged` (in content-queue, ready to publish)
- 33 published

**Healthy queue range:** 20–60 discovered topics. Below 20, discovery runs to
refill. Above 60, discovery is skipped (DISCOVERY_QUEUE_THRESHOLD = 20 triggers
the skip check; the current ~52 discovered puts us comfortably above threshold
for ~8+ weeks at publish rate of 5/week).

**`scripts/content-engine/cleanup-queue.js`** — one-time queue cleanup script.
Runs LLM over all discovered topics in batches of 40, clusters near-duplicate
intents, keeps the highest-scored representative, marks the rest
`skipped-intent-overlap`. Run this anytime a large batch of topics is imported
without going through the intra-batch dedup (e.g., bulk seeding from a new
competitor analysis). Cost: ~$0.10-0.15 per run.

---

## How to Keep This Document Current

**Standing rule (in CLAUDE.md):** Any commit touching `scripts/content-engine/`
must update this file in the same commit. This prevents session-to-session drift
where the same architectural question gets re-solved from scratch.

What to capture here:
- What changed and in which function
- The problem it solved (with a concrete example if possible)
- Cost/efficiency implications
- New gotchas or edge cases discovered

This is the primary input for any new session working on the content engine.
The goal is that CONTENT-PLAN.md + `lib/config.js` together answer every
"how does this work and why" question without reading all 600+ lines of the scripts.

---

## Known Limitations / Future Work

- **Discovery is still partially reactive** — GSC and DataForSEO own-site sources
  only return keywords we already rank for. The competitor gap source is proactive,
  but it only finds keywords competitors rank for. Truly novel topic ideas (new
  trends, underserved questions) require a third input not yet implemented.

- **Blacklist has no expiry** — if an article is deleted, its rejected variants
  remain blacklisted. Acceptable given articles are never deleted in practice.

- **Refresh articles skip the intent gate** — intentional, but means a refresh
  brief could theoretically create a second article on the same topic if the
  brief's slug differs from `existingSlug`. Not seen in practice.

- **`getExistingArticles()` reads from disk, not live site** — if an article
  exists on the live site but is somehow not in the repo, it's invisible to the
  pipeline. In practice this can't happen since publish.js commits everything.
