# BeachBride Lead Email Sequence — List 2
# Sendy list: SENDY_LIST_ID
# Triggered by: Stage 2 quiz completion
# Audience: Couples who submitted full lead form (name, phone, budget, date, guest count, services)
# Goal: Confirm, keep warm while vendors respond, surface room block service, drive insurance
# Note: Remove from SENDY_NURTURE_LIST_ID on entry (already converted past nurture stage)
# Exit: No automated exit — this is the main subscriber list
#
# Merge tags (all from lead payload — Destination fix added to Worker April 2026):
#   [Name,fallback=]             — first name
#   [Destination,fallback=]      — readable name e.g. "Cancun"
#   [DestinationSlug,fallback=]  — URL slug e.g. "cancun"
#   [WeddingDate,fallback=]      — e.g. "June 2027"
#   [GuestCount,fallback=]       — "intimate", "medium", "large"
#   [Budget,fallback=]           — "budget", "mid", "luxury"
#   [Services,fallback=]         — comma-separated e.g. "planner, photographer"
#
# INSURANCE LINKS: Replace [TRAVEL_GUARD_AFFILIATE_LINK] with CJ Affiliate link once enrolled.

---

## Email 1 — Send: Immediately (on Stage 2 submission)

**Subject:** You're matched — here's what happens next
**Preview text:** We're lining up your [Services,fallback=vendors] in [Destination,fallback=your destination].

---

Hi [Name,fallback=],

You're in — your request is with our team and we're matching you with [Services,fallback=vendors] in [Destination,fallback=your destination] for your [WeddingDate,fallback=upcoming] wedding.

Here's exactly what happens next:

- **Within 24 hours:** You'll receive vendor matches by email — [Services,fallback=planners, photographers, and florists] — each vetted for destination wedding experience in [Destination,fallback=your destination].
- **You choose who to contact.** There are no auto-calls or sharing of your information without your consent.
- **After that, it's between you and the vendor.** We step back — our job is the match, not the relationship.

---

**Before deposits start hitting:**

If you haven't sorted travel insurance yet, now is the moment. Once you have a signed venue contract, you want cancellation coverage in place for you and your guests.

[Compare destination wedding insurance plans →]([TRAVEL_GUARD_AFFILIATE_LINK])

Takes 2 minutes. Covers trip cancellation, vendor no-shows, and medical coverage abroad.

---

Reply here if anything's unclear or if you don't hear from vendors within 48 hours.

— The BeachBride Team

beachbride.com

---
[Unsubscribe] | [View in browser]

---

## Email 2 — Send: Day 3

**Subject:** Something most [Destination,fallback=destination wedding] couples forget to plan
**Preview text:** Your guests need to book too. Here's how to make it easy.

---

Hi [Name,fallback=],

While you're connecting with vendors — a quick thought about your guests.

Sourcing your [Services,fallback=planner and photographer] is the part couples plan for. The part that catches them off guard: your [GuestCount,fallback=] group also needs to book international flights, coordinate arrival times, and find accommodation in [Destination,fallback=an unfamiliar destination] — with no central guidance.

Left to their own devices, guests end up at different properties, at different rates, arriving on different days. It creates coordination overhead you didn't budget for.

**For a [GuestCount,fallback=medium or large] wedding, a group hotel block solves this:**

- One booking link for all your guests
- Group rate locked in (typically 10–15% below public prices at most all-inclusives)
- At 20+ rooms: complimentary room or suite upgrade for the couple
- At 30+ rooms: cocktail reception often included as standard

And we handle the negotiation, contract, and guest booking link for free — the resort pays us.

[See what a group block looks like for your guest count →](https://beachbride.com/tools/room-block-calculator/)

— The BeachBride Team

---
[Unsubscribe] | [View in browser]

---

## Email 3 — Send: Day 14

**Subject:** Quick check-in, [Name,fallback=]
**Preview text:** How are the [Destination,fallback=destination] vendor conversations going?

---

Hi [Name,fallback=],

Two weeks in — how's the planning going for your [WeddingDate,fallback=upcoming] [Destination,fallback=destination] wedding?

If vendors have reached out and conversations are moving forward, great. Let us know if you need more matches, a different style, or a different price range.

If it's been quieter than expected, reply and we'll check our network — there may be better fits for [Destination,fallback=your destination], your [Budget,fallback=] budget, or your date that weren't in the first round.

And if circumstances have changed and you're not actively planning right now, no worries at all. The destination guides at beachbride.com are there whenever you're ready.

---

P.S. If guest hotel logistics is still on your list, the [room block calculator](https://beachbride.com/tools/room-block-calculator/) shows exactly what group rates look like for [Destination,fallback=your destination] and what perks come at your [GuestCount,fallback=] guest count. Takes 60 seconds.

— The BeachBride Team

---
[Unsubscribe] | [View in browser]
