# BeachBride Room Block Email Sequence — List 3
# Sendy list: SENDY_ROOM_BLOCK_LIST_ID
# Triggered by: (a) Email capture on room block calculator, OR
#               (b) Stage 2 quiz with roomBlockInterest = true
# Audience: Couples actively thinking about guest hotel logistics — highest-intent segment
# Goal: Book a consultation call (https://beachbride.com/book/)
# This is a pure conversion sequence — every email leads to the Calendly call.
# Length: 4 emails over 10 days
# Note: Subscribers may also be on SENDY_NURTURE_LIST_ID or SENDY_LIST_ID simultaneously.
#       That's fine — these emails don't overlap in topic.
# Exit: No automated exit. Stop the sequence manually once a call is booked.
#       (Sendy: tag subscribers as "booked" and suppress remaining emails.)
#
# Merge tags (limited — room-block-capture payload only passes firstName + destination):
#   [Name,fallback=]             — first name (passed as firstName from calculator form)
#   [Destination,fallback=]      — readable name e.g. "Cancun"
#
# NOTE: If subscriber came from Stage 2 quiz (roomBlockInterest=true) they're on SENDY_LIST_ID too.
# Consider adding GuestCount and Budget to the SENDY_ROOM_BLOCK_LIST_ID subscription call
# in form-handler.ts so this sequence can be more personalized for those subscribers.

---

## Email 1 — Send: Immediately

**Subject:** Your room block estimate for [Destination,fallback=your destination]
**Preview text:** What you can negotiate at your guest count — and how to lock it in.

---

Hi [Name,fallback=],

Here's the short version of what a group hotel block looks like for [Destination,fallback=your destination].

**What you can typically negotiate at your room count:**

Most all-inclusive resorts in [Destination,fallback=your destination] follow this general schedule:

- **10–15 rooms:** Group rate locked in (10–15% below public pricing), dedicated group sales contact at the resort
- **15–20 rooms:** Complimentary cocktail reception on guest arrival (1-hour open bar)
- **20–25 rooms:** 1 complimentary room for the couple + cocktail reception
- **30+ rooms:** Suite upgrade for the couple, 2 complimentary rooms, private dinner option
- **45+ rooms (Sandals):** 1 complimentary room per 9 booked

These aren't perks you have to ask for by name — they're standard. But you do have to request them in writing before signing anything.

---

**Want us to handle this for you?**

We contact the resort's group sales team, request proposals from 2–3 properties, negotiate the perks at your room count, and send you a plain-English summary. No cost to you — the resort pays us.

[Book a free 20-minute call →](https://beachbride.com/book/)

We'll have resort proposals in your inbox within 48 hours of the call.

— The BeachBride Team

---
[Unsubscribe] | [View in browser]

---

## Email 2 — Send: Day 2

**Subject:** What 30 rooms gets you at an all-inclusive resort
**Preview text:** Most couples don't know these perks exist until after they signed.

---

Hi [Name,fallback=],

One thing most couples don't know: the perks available at group block volumes aren't advertised. You only find out what's on the table when you ask — in writing, before signing a room block agreement.

Here's what "asking well" looks like at a few of the most popular resort families:

**Sandals/Beaches** — Up to 21% commission tier; every 9 rooms booked = 1 complimentary room; cocktail reception at 5+ rooms; highest perk ceiling in the industry.

**Secrets/Dreams (AMR Collection)** — Now under Hyatt. Cocktail party included when booked 12+ months out; possible complimentary flights on larger groups; every 5th–7th room free depending on property.

**Hard Rock** — Crown points system; couple cash incentive based on room night total; WOW Specialist pricing unlocks preferred coordinator support.

**Palace Resorts (Moon Palace, Le Blanc)** — $50–100 cash per booking on top of commission; Colin Cowie wedding program access at higher volumes.

**Karisma (El Dorado, Azul Beach)** — "Always and Forever" complimentary wedding ceremony included on many packages when block is confirmed.

Most couples negotiate none of this because they go directly to the resort without a group sales background. We do this regularly — and we know what each property will and won't budge on.

[Book a free call and let us handle it →](https://beachbride.com/book/)

— The BeachBride Team

---
[Unsubscribe] | [View in browser]

---

## Email 3 — Send: Day 5

**Subject:** The window most couples miss
**Preview text:** Peak season blocks at Sandals and Secrets fill 12–18 months out.

---

Hi [Name,fallback=],

One thing I want to make sure you know before it becomes relevant:

The resorts couples most want — Sandals, Secrets, Hard Rock, Palace — have limited group inventory for peak wedding season (December through April for most Caribbean destinations). Their group sales teams start filling those blocks 12–18 months before travel dates.

Couples who assume they can sort out hotel logistics at the 6-month mark often find:
- Their preferred resort has no group availability for their dates
- The only remaining blocks require contracted attrition (liability for unsold rooms)
- A less desirable property becomes the only option

If your wedding date is in the next 18 months, the right time to start the conversation is now.

We reach out to the resort's group sales team on your behalf today. You review proposals. You choose. There's no obligation until you sign a block agreement — and we never sign contracted attrition blocks without a clear explanation of the liability.

[Book a 20-minute call →](https://beachbride.com/book/)

We'll have 2–3 resort proposals in your inbox within 48 hours.

— The BeachBride Team

---
[Unsubscribe] | [View in browser]

---

## Email 4 — Send: Day 10

**Subject:** What this actually looked like for a real couple
**Preview text:** 28 guests, Cancun, 3 resort proposals, one booking link. Here's the breakdown.

---

Hi [Name,fallback=],

I want to show you what the room block process actually looks like in practice — because most people don't know until after.

---

**Sarah and Marcus — 28 guests, Cancun, March wedding**

After using the calculator, we reached out to three resorts on their behalf. Within 48 hours, they had three proposals:

| Resort | Rate | Minimum | Perks |
|---|---|---|---|
| Moon Palace | $189/person/night | 20 rooms | Courtesy block, no attrition penalty, cocktail reception |
| Hard Rock Cancun | $214/person/night | 15 rooms | Crown Room upgrade for couple, WOW Specialist pricing |
| Hyatt Ziva Cancun | $197/person/night | 10 rooms | Swim-up suite upgrade for couple |

They chose Hard Rock — the couple upgrade mattered more to them than the lowest nightly rate. All 28 guests booked through one link. Sarah and Marcus received a Crown Room at no additional charge.

**Time spent on hotel logistics:** One 20-minute call + reviewing three proposals.

**Cost to them:** $0.

---

That's what this is. If it sounds useful, the calendar link is below.

[Book your free consultation →](https://beachbride.com/book/)

This is the last email in this series. If the timing isn't right yet, the calculator and the booking page are there whenever you're ready.

— The BeachBride Team

---
[Unsubscribe] | [View in browser]
