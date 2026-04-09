# Dev Plan — Travel Agent / Room Block Feature

_For review. No changes made yet._

This document specifies every website change required to support the travel agent / room block coordination service described in `travel-agent-business-plan.md`. Changes are grouped by priority: ship these in order.

---

## Overview of Changes

| # | Change | Type | Priority |
|---|---|---|---|
| 1 | Switch travel insurance affiliate: InsureMyTrip → Travel Guard | Config/content | **Immediate** |
| 2 | New page: `/travel-coordination/` | New page | High |
| 3 | Stage 2 quiz: add room block opt-in question | Quiz change | High |
| 4 | Stage 2 confirmation: add Travel Guard CTA | Template change | High |
| 5 | New tool: `/tools/room-block-calculator/` | New React component + page | High |
| 6 | Form handler: new `travel` form type | Worker change | Medium |
| 7 | New email sequence: room block nurture | Sendy config | Medium |
| 8 | Planner partner portal: `/partners/wedding-planners/` | New page | Medium |
| 9 | Footer: surface travel coordination service | Layout change | Low |
| 10 | Nav: add "Travel" link | Layout change | Low |
| 11 | Content: seed room block articles | Content engine | Low |

---

## 1. Switch Travel Insurance Affiliate — Immediate

**What:** Replace InsureMyTrip ($7 flat per policy) with Travel Guard via CJ Affiliate (10–15% of premium). 6x revenue per click, same traffic, zero new pages needed.

**Files to change:**
- `src/pages/quiz.astro` — quiz confirmation/results section; swap InsureMyTrip link for Travel Guard CJ affiliate link
- Any article content that links to InsureMyTrip — run a grep to find all occurrences

**How:**
1. Sign up for Travel Guard affiliate at CJ Affiliate (cj.com) — get your unique tracking link
2. Sign up for Allianz at FlexOffers as a secondary
- `grep -r "insuremytrip" src/` to find every hardcoded link
- Replace primary CTAs with Travel Guard link; keep InsureMyTrip as a secondary comparison link where it appears in comparison tables

**No new components needed.** Pure link swap.

---

## 2. New Page: `/travel-coordination/`

**What:** Service page explaining the room block coordination service. Positions it as free to couples (resort-paid). CTA is a Calendly intake call.

**File:** `src/pages/travel-coordination.astro`

**Layout:** `BaseLayout` (not `PageLayout` — this needs full-width sections, not the narrow 3-col prose layout)

**Page structure:**
1. **Hero** — "Free Guest Travel Coordination for Your Destination Wedding." Headline + 2-line description + CTA button → Calendly link
2. **How it works** — 3 steps: (1) Tell us your destination + guest count, (2) We secure a group rate and send your guests a booking link, (3) Guests book their own rooms — you collect perks, we handle everything
3. **What you get** — bulleted: locked-in group rate, complimentary rooms/upgrades at thresholds, no liability if guests cancel, one point of contact for all 40 guests' questions
4. **Resort logos/names** — Sandals, Secrets, Hard Rock, Palace, Karisma — "We work with the best all-inclusive resorts in your destination"
5. **Disclosure block** — "BeachBride earns a commission from the resort for coordinating your group. There is no cost to you, and the rates we secure are the same as or better than booking direct."
6. **CTA section** — Book a free 30-minute consultation → Calendly embed or link

**Data needed:**
- Calendly link (your actual link once created)
- Resort logos (use text names or source from resort press kits — do not hotlink)

**Schema:** `Service` JSON-LD (not `Article` or `LocalBusiness`)

**Sitemap:** Exclude from sitemap (like `/contact/`) — this is a conversion page, not an SEO target initially.

---

## 3. Stage 2 Quiz: Add Room Block Opt-In

**What:** After the existing Stage 2 lead form fields (phone, budget, date, guest count, services needed), add one new yes/no question before the submit button:

> "Would you like free help securing a group room block for your guests?"
> ◉ Yes, tell me more  ○ No thanks

**File:** `src/pages/quiz.astro` (or wherever Stage 2 is rendered — check `src/components/quiz/`)

**Behavior:**
- If "Yes": set a flag in the form payload (`roomBlockInterest: true`) before submission
- This flag gets passed to the form handler Worker with the existing lead payload
- No new form submit — just an extra field on the existing Stage 2 POST

**Worker change required:** See item 6. The Worker needs to handle the `roomBlockInterest` field and trigger a different follow-up email when true.

**Do not gate the lead submission on this answer.** It's optional — the lead submits regardless.

---

## 4. Stage 2 Confirmation Page: Travel Guard CTA

**What:** On the thank-you / confirmation state after Stage 2 quiz submission, add a Travel Guard insurance CTA before or after the existing confirmation message.

**Copy:** "Before your guests travel, make sure they're covered. We recommend Travel Guard — trusted by destination wedding groups." → [Get a quote] (Travel Guard CJ affiliate link)

**Files:** `src/pages/thank-you.astro` or the inline confirmation state in `src/pages/quiz.astro` — check which one renders after Stage 2.

This is a single link addition, no new component.

---

## 5. New Tool: `/tools/room-block-calculator/`

**What:** Interactive React calculator — couples enter their guest info and get a personalized room block recommendation. Gates the full output behind email capture (feeds Stage 1 funnel).

**File:** New page `src/pages/tools/room-block-calculator.astro` + new component `src/components/calculators/RoomBlockCalculator.tsx`

**Layout:** `BaseLayout` with `client:load` React island for the calculator

**Calculator inputs:**
- Guest count (slider or number input: 10–200)
- Destination (dropdown: Cancun, Punta Cana, Jamaica, Hawaii, Bali, Santorini, Tulum, Costa Rica)
- Estimated % of guests who will travel (slider: 40–90%, default 70%)
- Average nights (3 / 4 / 5 / 7+)
- Budget per room per night (dropdown: Under $150 / $150–250 / $250–400 / $400+)

**Calculator outputs (gated behind email capture):**
- Rooms needed (guest count × travel %)
- Estimated cost per guest (nights × room rate)
- Total block value (for context on perks)
- Recommended resort tier (budget → resort category mapping)
- Perks to expect at their block size (e.g., "At 25 rooms, expect 2 complimentary rooms and a welcome cocktail reception at Sandals")
- CTA: "Want us to secure this block for you? It's free." → `/travel-coordination/`

**Email gate:** Show teaser output (rooms needed, cost estimate) without email. Show full resort recommendation + perks breakdown after email capture. Use the existing Stage 1 quiz email capture mechanism — POST to `/workers/form` with `type: 'stage1'` or a new `type: 'tool-roomblock'`.

**Data file needed:** `src/data/room-block-tiers.json` — maps budget tier + destination to resort recommendations and expected perks at various room counts. This is static data, not fetched at runtime.

**Sitemap:** Include at priority 0.7 — this is an SEO target ("destination wedding room block calculator").

---

## 6. Form Handler: New Form Type

**What:** Two changes to `workers/form-handler.ts`:

**A — `roomBlockInterest` field on lead payload:**
```typescript
interface LeadPayload {
  // ... existing fields ...
  roomBlockInterest?: boolean; // new
}
```
When `roomBlockInterest: true`, send a second notification email to owner with subject "Room block interest — [couple name]" alongside the existing lead notification. This is a high-value signal worth surfacing separately.

**B — New `travel` form type (for the planner partner portal, item 8):**
```typescript
interface TravelInquiryPayload {
  type: 'travel';
  name: string;
  email: string;
  phone?: string;
  destination: string;
  guestCount: string;
  weddingDate?: string;
  message?: string;
  source: 'couple' | 'planner'; // where the inquiry originated
}
```
Routes to owner notification only (no Sendy subscription for planners). Subject: `[Travel Coordination Inquiry] [source] — [name]`.

---

## 7. New Email Sequence: Room Block Nurture

**What:** A separate 3-email Sendy sequence triggered when a Stage 2 lead has `roomBlockInterest: true` (or submits via the travel coordination form).

**Sequence:**
- **Email 1 (immediate):** "Here's how your room block works" — explains the process, links to `/travel-coordination/`, CTA to book a consultation call (Calendly)
- **Email 2 (day 3):** "What your guests will experience" — resort perks, what the booking link looks like, social proof that this is free and common
- **Email 3 (day 7):** "Ready to lock in your group rate?" — urgency framing (blocks fill up, rates change), direct CTA to book consultation

**Sendy config needed:**
- New list or new campaign in Sendy for room block leads (separate from the main nurture list)
- Worker needs to know the new Sendy list ID: add `SENDY_TRAVEL_LIST_ID` to Worker secrets

**This is Sendy/email config — no site code changes except the Worker.**

---

## 8. Planner Partner Portal: `/partners/wedding-planners/`

**What:** A landing page for wedding planners who want to enroll as referral partners. Explains the deal ($400 flat per wedding referred), what's required (just a form submission), and has a referral submission form.

**File:** `src/pages/partners/wedding-planners.astro`

**Layout:** `BaseLayout` (or optionally `LandingPageLayout` if you want minimal nav for B2B pitch)

**Page structure:**
1. **Headline:** "Earn $400 per destination wedding you refer — zero extra work."
2. **How it works:** 3 steps: refer couple → we handle everything → you get paid
3. **What you do:** Nothing. One form. We take it from there.
4. **Disclosure note:** You disclose to your client that you receive a referral fee. (Required.)
5. **Partner signup form:** Name, business name, email, website, primary destinations, how many destination weddings/year. Submits to Worker as `type: 'travel'` with `source: 'planner'`.
6. **FAQ:** When do I get paid? Do I need to be a travel agent? What if my client has fewer than 10 guests?

**Sitemap:** Exclude (like `/vendors/upgrade/`) — this is a B2B acquisition page, not SEO.

**No payment processing here** — you manually send referral fees until volume justifies automation.

---

## 9. Footer: Surface the Service

**What:** Add "Wedding Travel" link to the Plan column in `src/components/layout/SiteFooter.astro`.

```
Plan
  Get Matched
  Find Vendors
  Wedding Guides
  Cost Calculator
  Wedding Travel         ← add this → /travel-coordination/
  List Your Business
  Advertise With Us
```

One line addition to the existing footer component.

---

## 10. Nav: Optional "Travel" Link

**What:** Consider adding a "Travel" item to the main nav, linking to `/travel-coordination/`.

**Current nav** (check `src/components/layout/SiteNav.astro` or equivalent): Guides, Destinations, Vendors, Quiz.

**Options:**
- Add "Travel" as a top-level nav item
- Or put it under a "Services" dropdown with Vendors and the travel coordination service

**Recommendation:** Hold on this until the page exists and gets traction. The footer link (item 9) is enough for now. Adding top nav items has cost — it competes for attention with the quiz CTA.

**Decision needed from you before implementing.**

---

## 11. Content: Room Block Articles

**What:** Seed 3–5 new article topics into the content pipeline targeting room block keywords. These feed organic traffic to the calculator tool and travel coordination service.

**Target slugs (feed to `seed-editorial-topics.js`):**
- `destination-wedding-room-block-guide` → planning category
- `how-many-hotel-rooms-to-block-destination-wedding` → planning category
- `destination-wedding-room-block-cancun` → destinations category
- `all-inclusive-resort-group-rates-destination-weddings` → planning category
- `destination-wedding-hotel-block-cost` → planning category

**How:** Add to `EDITORIAL_TOPICS` array in `scripts/seed-editorial-topics.js` and run `node scripts/seed-editorial-topics.js`. These flow through the normal generate → publish pipeline. Internal links in these articles should point to `/tools/room-block-calculator/` and `/travel-coordination/` — add both to `LINK_TARGETS` in `scripts/content-engine/lib/config.js`.

**LINK_TARGETS additions:**
```js
{ patterns: ['room block', 'hotel block', 'group rooms', 'room block calculator'], slug: 'tools/room-block-calculator' },
{ patterns: ['travel coordination', 'guest travel', 'room block service'], slug: 'travel-coordination' },
```

---

## Implementation Order

**Do immediately (no new code):**
1. Swap Travel Guard for InsureMyTrip across existing content
2. Add footer link to travel coordination (even before the page exists — it can 404 temporarily)

**Before taking any bookings:**
3. `/travel-coordination/` page
4. Stage 2 quiz room block opt-in
5. Stage 2 confirmation Travel Guard CTA
6. Worker: `roomBlockInterest` field support

**Before running planner outreach:**
7. Room block calculator tool (this is the embed planners share)
8. Planner partner portal page
9. Worker: `travel` form type
10. Sendy room block nurture sequence

**Ongoing after launch:**
11. Seed room block articles into content pipeline
12. Add LINK_TARGETS for new pages
