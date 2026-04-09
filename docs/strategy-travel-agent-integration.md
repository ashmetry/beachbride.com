# Strategy: Travel Agent Integration — Conflict Resolution & Revised Plan

_April 2026. Replaces `dev-plan-travel-agent.md` as the implementation guide once approved._

---

## The Core Conflict

BeachBride.com today has **one audience** (brides planning destination weddings) and **two active revenue streams** that serve her:

1. Pay-per-lead → vendors
2. Affiliate commissions → jewelry, resorts, insurance

(The vendor directory exists for SEO and trust — paid tiers are not being pursued as a revenue stream.)

The travel agent business plan introduces a fourth revenue stream (room block commissions) — which still serves the bride — but its GTM strategy introduces a **second audience**: wedding planners as referral partners. The dev plan as written adds 11 items to the site, including a planner-facing partner portal, a standalone "travel coordination" service page, a new nav item, and a new email list. This fragments the site's singular purpose.

**The risk isn't the business model. The risk is the implementation.**

Room block coordination is the highest-value monetization possible ($3,500–6,000/wedding vs. $25–100/lead). It serves the exact same person BeachBride already captures. The problem is that the dev plan treats it as a separate product bolted onto the side of the site, when it should be an invisible extension of the existing funnel.

---

## The Principle: One Audience, One Journey

Everything visible on beachbride.com serves one person: **a bride planning a destination wedding.**

She doesn't need to know BeachBride is a travel agency. She doesn't need to see a "Travel" nav item. She doesn't need a separate "travel coordination service page" that reframes BeachBride as something other than what she already understands it to be: a planning resource that helps her find the right destination, the right vendors, and the right information.

Room block help is just another thing BeachBride does for her — like matching her with a photographer or sending her a destination guide. It's Step 3 in the journey, not a separate product.

**Everything planner-facing or B2B happens off-site.** Cold email outreach, planner partner enrollment, referral tracking — none of this touches the bride-facing experience.

---

## What's Working (Don't Touch)

| Asset | Status | Notes |
|---|---|---|
| Content engine | 33 published, 6 staged, 49 discovered | Automated pipeline, growing organic traffic |
| pSEO vendor pages | 957 vendors × 8+ destinations | Hundreds of indexed pages |
| Destination hub pages | 25 destinations with climate, vendors, resorts, legal info | High-intent entry points |
| Quiz funnel | Stage 1 (email) → Stage 2 (lead) | Working 2-stage capture |
| Real weddings gallery | 62 migrated posts with real photos | Social proof + SEO |
| Vendor directory | 957 vendors, all free tier | SEO and trust signal — not a subscription revenue stream |

---

## What Changes (Revised Dev Plan)

### Tier 1: Immediate (no new pages, pure revenue lift)

#### 1a. Verify Travel Guard Commission Structure — BEFORE Switching

**Problem with the current plan:** The business plan claims Travel Guard pays 10–15% per policy sale via CJ Affiliate, projecting $42/guest ($840/wedding) vs. InsureMyTrip's $7 flat. But research indicates Travel Guard's CJ program may pay **$16 per lead** (for quotes viewed), not a percentage of sale. If true, that's $16 vs. $7 — a 2.3x lift, not 6x.

**Action:**
1. Sign up for CJ Affiliate and check the actual Travel Guard program terms (commission type, rate, cookie duration, minimum payout)
2. Also check: Allianz via FlexOffers, Squaremouth affiliate ($3/click or rev share), travelinsurance.com (custom rates)
3. Compare all four programs side-by-side before switching anything

**Why this matters:** The $840/wedding insurance figure flows into the per-wedding revenue model. If it's actually $320/wedding ($16 × 20 guests), the conservative per-wedding net drops from ~$3,953 to ~$3,433. Still excellent — but the business plan should reflect reality.

#### 1b. Switch Insurance Affiliate (Once Verified)

Swap InsureMyTrip links across:
- Destination hub pages (travel insurance section)
- Email nurture sequences (day 0, day 7)
- Any article content mentioning travel insurance

**Files:** `src/pages/destinations/[destination].astro`, Sendy email templates, grep for `insuremytrip` across all content.

No new pages. Pure link swap.

---

### Tier 2: Funnel Integration (minimal new code, high leverage)

#### 2. Room Block Opt-In on Stage 2 Quiz

Add one yes/no question to the existing Stage 2 quiz (`src/components/quiz/LeadQuiz.tsx`), after the services multi-select:

> "Would you like free help booking hotel rooms for your guests?"
> ◉ Yes  ○ No thanks

This adds `roomBlockInterest: boolean` to the existing lead payload. No new form, no new endpoint — just one extra field on the existing `type: 'lead'` POST to `/workers/form`.

**Worker change:** When `roomBlockInterest: true`, send a separate notification email to owner with subject "[Room Block Interest] — {name}" alongside the standard lead notification. This is a high-priority signal.

**What this does NOT do:** Create a separate Sendy list. Instead, the existing nurture sequence can branch on this field (Sendy supports conditional content). This avoids the operational complexity of managing a third list.

#### 3. Thank-You Page Enhancement

The current thank-you page (`src/pages/thank-you.astro`) shows "Check your inbox!" with links to destinations and guides. After Stage 2 submission, enhance it with:

1. **Insurance CTA:** "Before your guests travel, make sure they're covered." → affiliate link
2. **Room block CTA (conditional, if `roomBlockInterest` was true):** "We'll reach out within 24 hours about your group room block. In the meantime, here's how it works:" → brief explainer + Calendly link for impatient couples

These are two small content blocks on an existing page. No new pages needed.

#### 4. Destination Hub Pages: Add "Guest Accommodations" Section

Each destination hub page already has sections for resorts, vendors, insurance, and guides. Add one more section: **"Group Rates & Guest Accommodations"** — positioned after the resort affiliate section.

Content per destination (can be templated, then enriched per-destination):
- "Planning a destination wedding in {destination}? Most couples block 20–30 rooms for their guests. BeachBride can secure a group rate at no cost to you — the resort covers our fee."
- Bullet: What guests get (locked-in rate, easy booking link, no individual negotiations)
- Bullet: What you get (complimentary room upgrades at thresholds, one point of contact)
- CTA: "Get a free group rate quote" → Calendly link or short inline form

**This replaces the standalone `/travel-coordination/` page.** The bride discovers this in context (on the destination she's already researching), not as a separate product she has to navigate to.

**Schema:** No separate Service JSON-LD. The existing destination page schema is sufficient.

---

### Tier 3: SEO Asset (new page, high long-term value)

#### 5. Room Block Calculator — `/tools/room-block-calculator/`

This is the single highest-value new page to build. It serves the bride directly AND is an SEO target for high-intent keywords.

**Keep the spec from the original dev plan (item 5)** — it's well-designed:
- Guest count, destination, travel %, nights, budget tier
- Gated output (rooms needed shown free; resort recommendation + perks gated behind email)
- CTA flows to Calendly for consultation

**One change:** The CTA after email capture should NOT link to `/travel-coordination/` (that page won't exist). Instead: "Want us to secure this rate for free? Book a quick call." → Calendly embed.

**Data file:** `src/data/room-block-tiers.json` needs real resort data. Use these baseline rates:

| Resort Family | Budget Tier | Avg/Person/Night | Group Minimum |
|---|---|---|---|
| Sandals/Beaches | $250–400+ | $180–500 | 10 rooms |
| AMR (Secrets/Dreams) | $200–350 | $150–400 | 5–7 rooms |
| Hard Rock | $200–300 | $170–350 | 5 rooms |
| Palace (Moon Palace) | $150–300 | $140–350 | 10 rooms |
| Karisma (El Dorado) | $200–350 | $160–380 | 10 rooms |

Perk thresholds (general, varies by property):
- 10 rooms: group rate locked, possible welcome drink
- 15 rooms: cocktail reception
- 20–25 rooms: 1 complimentary room + reception
- 30+ rooms: 2 complimentary rooms + upgraded suite for couple
- 45+ rooms (Sandals): 1 comp per 9 rooms, private dinner

**SEO opportunity — validated via DataForSEO (April 2026, US):**

| Keyword | Volume | CPC | Notes |
|---|---|---|---|
| `hotel room block wedding` | 2,400 | $19.36 | Primary target cluster |
| `wedding hotel block` | 2,400 | $19.36 | Same cluster |
| `wedding room block` | 880 | $16.58 | Core |
| `how many hotel rooms to block for wedding` | 90 | **$87.41** | Calculator keyword — $87 CPC = extreme commercial intent |
| `destination wedding travel agent` | 720 | $17.27 | Broader positioning keyword |

The $87.41 CPC on the calculator keyword is the signal. Advertisers don't pay $87/click unless the person searching is about to spend money. A free calculator that gates the full output behind email capture turns this traffic into leads. Build it.

**Sitemap:** Include at priority 0.7.

---

### Tier 4: Content (automated, low effort)

#### 6. Seed Room Block Articles

Add 3–5 topics to the content pipeline via `seed-editorial-topics.js`. Same slugs as the original plan:
- `destination-wedding-room-block-guide` → planning
- `how-many-hotel-rooms-to-block-destination-wedding` → planning
- `destination-wedding-hotel-block-cost` → planning
- `all-inclusive-resort-group-rates-destination-weddings` → planning

These flow through the normal generate → publish pipeline. No manual writing.

**LINK_TARGETS additions** (add to `scripts/content-engine/lib/config.js`):
```js
{ patterns: ['room block', 'hotel block', 'group rooms', 'room block calculator'], slug: 'tools/room-block-calculator' },
```

Note: No `travel-coordination` link target — that page doesn't exist in the revised plan.

---

## What Gets Killed

| Original Dev Plan Item | Verdict | Why |
|---|---|---|
| `/travel-coordination/` standalone page | **Kill** | Creates a second product identity. Room block CTA lives on destination hubs and thank-you page instead. |
| "Travel" in main nav | **Kill** | Competes with quiz CTA. Adds confusion about what BeachBride is. |
| "Wedding Travel" in footer | **Kill** | Same reason. Footer should serve the bride's existing journey. |
| Separate Sendy room block nurture list | **Kill** | Use conditional content within existing nurture sequence. One audience, one list, branching logic. |
| `/partners/wedding-planners/` on main site | **Relocate** | See below. |

---

## How to Handle a Bride Call (The Logistics Framing)

The concern "I don't know enough about resorts" misunderstands the job. Couples calling about room blocks already know which resort they want — they've spent months on Instagram and Sandals.com. They're not asking "which resort is better?" They're asking "how do I get 30 rooms there for a good price?"

**The call is four questions:**
1. Which resort are you looking at?
2. How many guests are traveling?
3. What are your dates?
4. What's the rough budget per room per night?

Then: "Great. I'll reach out to their group sales team and get you a proposal within 48 hours — rates, perks at your room count, what the attrition terms look like. No obligation."

That's it. The resort sales rep sends back a detailed proposal. You forward it with a plain English explanation. You're the logistics coordinator, not a resort reviewer.

**If asked about the resort experience:** "For the property experience itself — beach quality, food, room categories — I'd point you to recent TripAdvisor reviews and the resort's on-site wedding coordinator. My specialty is the group rate and logistics side, which is usually where couples get stuck."

**Knowledge acquisition (before taking calls):** Complete Sandals Specialist (training.sandals.com), AMR Confidant Learning, and Hard Rock WOW Specialist certifications — all free, 1–2 weeks total. These cover group perks, attrition rules, and what each brand delivers. After one FAM trip (available through Fora, heavily discounted or free) you can speak with genuine firsthand authority.

---

## What Moves Off-Site

### Planner Partner Program — The Craigslist Play

The planner referral model is the fastest path to volume. Wedding planners already have your couples, hate dealing with room blocks, and currently get nothing for it.

**The pitch:** Flat $400 per wedding referred. Simplest deal in the industry. Competitors pay planners ~$175–280 and use percentage-share math. BeachBride pays more, faster, no complexity.

**The script:**
1. Run Apify wedding vendor scraper (~$75 in credits) — pulls name, email, phone from The Knot, WeddingWire, Zola. Filter: destination wedding planners, 4+ stars, 10+ reviews.
2. Load into Instantly.ai. 4-touch sequence over 14 days. Lead with their pain (room blocks), not the offer. Touch 1 subject: *"Do your destination wedding clients ask you to handle hotel blocks?"*
3. Planners who respond get a simple partner form (Tally or Typeform) — name, business, email, how many destination weddings/year, primary destinations.
4. Each enrolled planner submits referrals through the same form. You handle it. They collect $400 after the block is confirmed.

**Scale:** At 1% conversion from 10,000 planners = 100 partners. At 2 referrals/year each = 200 weddings = $700K+ gross at full scale.

**Key requirement:** None of this touches the main site. No link in nav, footer, or articles. Planners arrive via cold email only. The bride never sees any of it.

**V1 partner form:** Tally.so (free, 30 min to set up). Graduate to `partners.beachbride.com` subdomain once you have 20+ enrolled planners.

---

## Competitive Landscape — Researched April 2026

### Engine.com
- The Knot's **exclusive lodging partner** since June 2025. Automated group hotel platform.
- **Has an active affiliate program** for wedding planners/coordinators at `engine.com/groups-partner-lp/affiliate-program`. Commission rate undisclosed — requires application.
- **Critical gap: domestic US hotels only.** Engine does Marriott, Hilton, Hyatt chains. Their destination wedding page mentions nothing about Sandals, Secrets, Hard Rock, or Palace Resorts. This is where 70%+ of destination weddings happen.
- **Threat level: Low** for BeachBride's all-inclusive niche. High for domestic weddings (not BeachBride's audience).

### Kleinfeld Hotel Blocks
- Legacy service, licensed meeting planners. 6,000 blocks/year; 12% are destination weddings (~720/yr).
- **Has an affiliate/referral program.** Partners earn 10% of Kleinfeld's commission. On a $28K block, Kleinfeld earns ~$2,800, referrer gets **~$280**. Paid 60–90 days after checkout.
- **BeachBride's flat $400 beats this by 43%**, paid faster, no revenue-share math.
- Destination resort capability is limited — their own FAQ warns that all-inclusive resort blocks have "very different rules" from US hotel blocks (deposits, attrition, penalties). This complexity makes planners nervous.
- **Threat level: Medium** (established brand, some destination wedding presence). Differentiate on all-inclusive specialization and superior planner payout.

### The Room Block Source
- Closest real competitor. Specializes in destination weddings. Targets wedding planners directly.
- Pays planners **5% of their commission** — roughly $175–350 per wedding.
- BeachBride's flat $400 is simpler and higher.
- **Threat level: Medium-High** — same niche, same GTM approach.

### Where Will They Stay / roomblocks.com
- General event room block services. Not destination-wedding-focused.
- **Threat level: Low.**

### Updated Competitor Summary

| Competitor | Planner Program | Destination Resort Strength | Planner Payout | Threat |
|---|---|---|---|---|
| **Engine.com** | Yes — undisclosed | None | Unknown | Low (domestic only) |
| **Kleinfeld** | Yes — 10% of their cut | Moderate | ~$280 avg | Medium |
| **The Room Block Source** | Yes — 5% of commission | Strong | ~$175–350 | **Medium-High** |
| **Where Will They Stay** | None found | Weak | — | Low |

**BeachBride's planner pitch edge:** Flat $400 vs. percentage-share, faster payment, all-inclusive resort specialization. Lead with: "We handle Sandals, Secrets, Hard Rock, Palace, Karisma. If your client is going all-inclusive, that's exactly us."

**BeachBride's organic edge:** None of these competitors have a content engine. Engine.com owns the The Knot integration but that's post-decision; BeachBride captures the couple 12–18 months earlier through content → quiz → email. The room block offer surfaces when the bride already trusts the site.

**The anti-pattern:** Don't try to out-feature Engine.com on technology. BeachBride's advantage is early capture and trust, not platform automation.

---

## Revenue Model Corrections

### Insurance Affiliate — Needs Verification

| Metric | Business Plan Assumption | Research Finding |
|---|---|---|
| Travel Guard commission | 10–15% per policy sale | Possibly **$16 per lead** (quote viewed), not % of sale |
| Per-guest revenue | $42 (at 12% of $350) | Possibly $16 per quote |
| Per-wedding insurance revenue | $840 (20 guests × $42) | Possibly $320 (20 guests × $16) |

**Impact on per-wedding model:**

| Scenario | With 12% assumption | With $16/lead assumption |
|---|---|---|
| Conservative (12% resort, 70/30 Fora) | $3,953 | $3,433 |
| Optimistic (17% resort, 80/20 Fora) | $6,165 | $5,645 |

Still excellent economics. But the insurance line is $520/wedding less than projected in the optimistic-insurance scenario. Verify before updating projections.

### Resort Commission — Solid

The $250/night average used in the business plan aligns with research:
- Sandals: $180–500/person/night (avg ~$300 for mid-tier)
- AMR/Secrets: $150–400 (avg ~$250)
- Hard Rock: $170–350 (avg ~$225)

Conservative $250 average is reasonable.

---

## Revised Implementation Order

**Week 1 (no new code):**
1. Sign up for CJ Affiliate → check Travel Guard program terms
2. Compare Travel Guard vs. Allianz vs. Squaremouth vs. travelinsurance.com
3. Run DataForSEO keyword query on room block terms (validate SEO opportunity)
4. Set up partner form (Tally/Typeform) for planner outreach

**Week 2 (small code changes):**
5. Swap insurance affiliate links across site + email templates
6. Add `roomBlockInterest` field to Stage 2 quiz
7. Update form handler Worker to flag room block leads
8. Add room block CTA to thank-you page (conditional)

**Week 3–4 (destination hub enhancement):**
9. Add "Guest Accommodations" section to destination hub template
10. Write per-destination copy (can be templated with enrichment via content engine)

**Week 5–6 (if keyword volume validates):**
11. Build room block calculator at `/tools/room-block-calculator/`
12. Create `room-block-tiers.json` data file
13. Seed room block articles into pipeline + add LINK_TARGETS

**Ongoing (offline, not on site):**
14. Fora onboarding + certifications
15. Planner cold email outreach via Instantly.ai
16. ABC partnership inquiry
17. FAM trip planning

---

## Summary: What the Site Looks Like After

The bride's experience:

1. Lands on article/destination page via organic search
2. Takes Stage 1 quiz → gets email + destination guide
3. Nurture sequence delivers resort links, jewelry affiliate, planning content
4. Returns for Stage 2 quiz → matched with vendors + asked about room block
5. Thank-you page shows insurance CTA + room block next steps
6. If room block interest: personal follow-up within 24 hours → Calendly → booking

The bride never sees:
- A "travel coordination" service page
- A "Travel" nav item
- Any mention of BeachBride being a travel agency
- Any planner-facing content

She just sees a site that helps her plan her destination wedding — and one of the things it helps with is getting her guests a good hotel rate.

That's the singular focus.
