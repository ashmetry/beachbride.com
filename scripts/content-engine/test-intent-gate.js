/**
 * Test the intent overlap gate with synthetic briefs.
 *
 * Loads real existing articles from disk, then runs fake candidate briefs
 * through the same checkIntentOverlap logic used by generate.js.
 *
 * Cost: ~$0.005 per test case (one Sonnet call each). 6 cases = ~$0.03.
 *
 * Usage:
 *   node scripts/content-engine/test-intent-gate.js
 */

import { getExistingArticles, loadPipeline, MODEL_BRIEF } from './lib/config.js';
import { callModelJSON } from './lib/openrouter.js';

// ── Test cases ────────────────────────────────────────────────────────────────
// Each has: keyword, brief fields, and expected result (should it be blocked?)

const TEST_CASES = [
  // SHOULD BLOCK — obviously overlaps with destination-wedding-cost article
  {
    name: 'Obvious overlap: budget breakdown',
    expectBlock: true,
    topic: {
      id: 'test-budget-breakdown',
      keyword: 'destination wedding budget breakdown',
      isRefresh: false,
      brief: {
        title: 'Destination Wedding Budget Breakdown: Where Every Dollar Goes',
        uniqueAngle: 'Detailed cost breakdown by category',
        h2Outline: [
          'How Much Does a Destination Wedding Cost in 2026?',
          'What Goes Into a Destination Wedding Budget?',
          'Cost Breakdown by Destination',
          'Hidden Fees You Need to Know About',
          'How to Save on Your Destination Wedding',
        ],
        faqTopics: [
          'What is the average cost of a destination wedding?',
          'Is a destination wedding cheaper than a traditional wedding?',
          'What are the hidden costs of a destination wedding?',
        ],
      },
    },
  },

  // SHOULD BLOCK — same intent as beach-wedding-checklist
  {
    name: 'Obvious overlap: planning timeline',
    expectBlock: true,
    topic: {
      id: 'test-planning-timeline',
      keyword: 'beach wedding planning timeline step by step',
      isRefresh: false,
      brief: {
        title: 'Step-by-Step Beach Wedding Planning Timeline',
        uniqueAngle: 'Month-by-month planning guide',
        h2Outline: [
          'When Should You Start Planning a Beach Wedding?',
          '18-12 Months Before: Book Venue and Planner',
          '12-9 Months Before: Book Photographer and Vendors',
          '6-3 Months Before: Finalize Details',
          'Final Month Checklist',
        ],
        faqTopics: [
          'How far in advance should you plan a beach wedding?',
          'What do you book first for a beach wedding?',
          'Do you need a permit for a beach wedding?',
        ],
      },
    },
  },

  // SHOULD PASS — destination-specific angle not covered by general cost article
  {
    name: 'Unique: Bali-specific costs',
    expectBlock: false,
    topic: {
      id: 'test-bali-costs',
      keyword: 'bali wedding cost breakdown',
      isRefresh: false,
      brief: {
        title: 'How Much Does a Bali Wedding Cost? (2026 Local Pricing)',
        uniqueAngle: 'Bali-specific vendor rates, villa pricing, permit costs, and rupiah budgeting tips',
        h2Outline: [
          'Why Are Bali Wedding Costs So Different From Other Destinations?',
          'Bali Wedding Venue Costs: Villas vs Resorts vs Clifftop',
          'Local Vendor Rates in Bali (Photographer, Planner, Florist)',
          'Bali-Specific Hidden Costs: Permits, Temple Fees, Import Taxes',
          'Sample Bali Wedding Budgets at Three Price Points',
          'Best Time of Year for an Affordable Bali Wedding',
        ],
        faqTopics: [
          'How much does a villa wedding cost in Bali?',
          'Do you need a special permit to get married in Bali?',
          'Is Bali cheaper than Mexico for a destination wedding?',
        ],
      },
    },
  },

  // SHOULD PASS — completely different topic
  {
    name: 'Unique: beach wedding DJ guide',
    expectBlock: false,
    topic: {
      id: 'test-dj-guide',
      keyword: 'beach wedding DJ tips',
      isRefresh: false,
      brief: {
        title: 'How to Hire a DJ for Your Beach Wedding (Without Sound Disasters)',
        uniqueAngle: 'Beach-specific audio challenges: wind, sand, power, permits',
        h2Outline: [
          'Why Beach Weddings Are Uniquely Hard for DJs',
          'What Equipment Does a Beach DJ Actually Need?',
          'How to Audition a DJ for an Outdoor Beach Ceremony',
          'Battery vs Generator: Power Options on Sand',
          'Volume Restrictions and Noise Permits by Location',
        ],
        faqTopics: [
          'Can you have a DJ on the beach?',
          'How much does a beach wedding DJ cost?',
          'What if it rains during an outdoor DJ set?',
        ],
      },
    },
  },

  // SHOULD BLOCK — overlaps with destination-wedding-guide
  {
    name: 'Overlap: how to plan a destination wedding',
    expectBlock: true,
    topic: {
      id: 'test-plan-destination',
      keyword: 'how to plan a destination wedding from start to finish',
      isRefresh: false,
      brief: {
        title: 'How to Plan a Destination Wedding: The Complete Guide',
        uniqueAngle: 'End-to-end planning walkthrough',
        h2Outline: [
          'How Do You Choose the Right Destination?',
          'How Do You Set Your Budget?',
          'What Are the Legal Requirements for Marrying Abroad?',
          'How Do You Find and Book Your Venue?',
          'How Do You Build a Vendor Team Remotely?',
          'How Do You Handle Guest Travel Logistics?',
        ],
        faqTopics: [
          'How far in advance should you plan a destination wedding?',
          'Is a destination wedding more expensive?',
          'Do guests pay their own way?',
        ],
      },
    },
  },

  // SHOULD PASS — different audience/intent (vendor-focused, not couple-focused)
  {
    name: 'Unique: vendor guide for photographers',
    expectBlock: false,
    topic: {
      id: 'test-photographer-business',
      keyword: 'how to become a destination wedding photographer',
      isRefresh: false,
      brief: {
        title: 'How to Build a Destination Wedding Photography Business',
        uniqueAngle: 'B2B guide for photographers wanting to break into the destination wedding market',
        h2Outline: [
          'What Makes Destination Wedding Photography Different From Local Work?',
          'How Do You Price Destination Wedding Packages?',
          'Building a Portfolio That Attracts Destination Clients',
          'Logistics: Shipping Gear, Insurance, and Backup Plans',
          'Getting Listed on Destination Wedding Directories',
        ],
        faqTopics: [
          'How much should a destination wedding photographer charge?',
          'Do destination wedding photographers need special insurance?',
          'How do you find destination wedding clients?',
        ],
      },
    },
  },
];

// ── Run the intent gate against each test case ────────────────────────────────

async function checkIntentOverlap(topic, existingArticles, pipeline) {
  const brief = topic.brief;

  const existingContent = existingArticles
    .map(a => {
      let entry = `/${a.slug}/ — "${a.title}"`;
      if (a.description) entry += `\n  Description: ${a.description}`;
      if (a.h2s?.length) entry += `\n  H2 sections: ${a.h2s.join(' | ')}`;
      if (a.faqQuestions?.length) entry += `\n  FAQs: ${a.faqQuestions.join(' | ')}`;
      return entry;
    })
    .join('\n\n');

  const queuedContent = pipeline.topics
    .filter(t => ['briefed', 'researched', 'written', 'passed', 'staged'].includes(t.status) && t.id !== topic.id)
    .map(t => {
      let entry = `"${t.keyword}" (${t.status})`;
      if (t.brief?.title) entry += ` — "${t.brief.title}"`;
      if (t.brief?.h2Outline?.length) entry += `\n  H2 sections: ${t.brief.h2Outline.join(' | ')}`;
      if (t.brief?.faqTopics?.length) entry += `\n  FAQs: ${t.brief.faqTopics.join(' | ')}`;
      return entry;
    })
    .join('\n\n');

  const candidateBrief = `Keyword: "${topic.keyword}"
Title: "${brief.title}"
Unique angle: ${brief.uniqueAngle || 'none specified'}
H2 outline: ${(brief.h2Outline || []).join(' | ')}
FAQ topics: ${(brief.faqTopics || []).join(' | ')}`;

  const result = await callModelJSON(MODEL_BRIEF,
    `You are an SEO cannibalization detector for beachbride.com, a destination wedding site. You prevent wasted content creation by catching intent overlap BEFORE expensive research and writing steps.

Your test: "If a searcher googled this candidate's keyword and landed on any existing article, would that article fully satisfy their query?" If yes, the candidate is redundant — the existing article already serves that intent, even if the keyword is worded differently.

Be strict. The cost of a false negative (wasted $5-$10 in API calls for a redundant article) is much higher than a false positive (skipping a marginally unique topic that can be re-evaluated later).`,
    `Does this candidate article overlap in search intent with any existing content?

CANDIDATE BRIEF:
${candidateBrief}

EXISTING PUBLISHED ARTICLES:
${existingContent}

${queuedContent ? `ARTICLES IN QUEUE (not yet published):
${queuedContent}` : ''}

Rules:
- If the candidate's H2 outline covers substantially the same ground as an existing article's H2 sections (>60% topical overlap), it's a duplicate intent.
- If the candidate's FAQs are already answered in an existing article's FAQs or body sections, it's a duplicate intent.
- A candidate with a genuinely distinct angle (different destination, different vendor type, different audience segment) is NOT overlap even if the broad topic is similar.

Return JSON:
- If NO overlap: { "overlaps": false }
- If overlap found: { "overlaps": true, "slug": "existing-article-slug", "reason": "specific explanation of the overlap" }`,
    { temperature: 0 }
  );

  return result;
}

async function main() {
  console.log('\n=== Intent Gate Test ===\n');

  const existingArticles = getExistingArticles();
  const pipeline = loadPipeline();
  console.log(`Loaded ${existingArticles.length} existing articles for comparison\n`);

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    process.stdout.write(`  ${tc.name}... `);

    const result = await checkIntentOverlap(tc.topic, existingArticles, pipeline);
    const blocked = result.overlaps === true;
    const correct = blocked === tc.expectBlock;

    if (correct) {
      passed++;
      console.log(`\x1b[32mPASS\x1b[0m ${blocked ? `(blocked: ${result.slug} — ${result.reason})` : '(allowed through)'}`);
    } else {
      failed++;
      console.log(`\x1b[31mFAIL\x1b[0m — expected ${tc.expectBlock ? 'BLOCK' : 'PASS'}, got ${blocked ? `BLOCK (${result.slug})` : 'PASS'}`);
      if (result.reason) console.log(`    Reason: ${result.reason}`);
    }
  }

  console.log(`\n  Results: ${passed}/${TEST_CASES.length} correct${failed > 0 ? ` (${failed} failed)` : ''}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
