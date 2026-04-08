/**
 * One-time queue cleanup: find and remove intent duplicates from pipeline.json
 * that slipped in before intra-batch dedup was implemented.
 *
 * Sends all 'discovered' topics to the LLM, groups by intent cluster,
 * keeps the highest-scored representative from each cluster, marks the rest
 * as 'skipped-intent-overlap' so they never waste generate runs.
 *
 * Cost: ~$0.10–0.15 (one or two Sonnet calls over ~80 topics)
 * Run once, then delete (or keep for future re-runs after large imports).
 *
 * Usage:
 *   node scripts/content-engine/cleanup-queue.js [--dry-run]
 */

import { loadPipeline, savePipeline, MODEL_BRIEF } from './lib/config.js';
import { callModelJSON } from './lib/openrouter.js';

const dryRun = process.argv.includes('--dry-run');

function normalizeKeyword(kw) {
  return kw.toLowerCase().replace(/\b(a|an|the|in|on|of|for|to|and|is|are|how|do|does|can|my|your)\b/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('\n=== Queue Intent Cleanup ===\n');
  if (dryRun) console.log('  [DRY RUN — no changes will be saved]\n');

  const pipeline = loadPipeline();
  if (!pipeline.rejectedKeywords) pipeline.rejectedKeywords = [];

  const discovered = pipeline.topics.filter(t => t.status === 'discovered');
  console.log(`  Found ${discovered.length} discovered topics\n`);

  if (discovered.length === 0) {
    console.log('  Nothing to clean up.');
    return;
  }

  // Process in batches of 40 to keep LLM context manageable
  const BATCH_SIZE = 40;
  const batches = [];
  for (let i = 0; i < discovered.length; i += BATCH_SIZE) {
    batches.push(discovered.slice(i, i + BATCH_SIZE));
  }

  console.log(`  Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} topics each...\n`);

  const allSkipIds = new Set();

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`  Batch ${batchIdx + 1}/${batches.length}: ${batch.length} topics`);

    const candidateList = batch
      .map((t, i) => `${i} [score:${t.score.toFixed(0)}]: "${t.keyword}" (id: ${t.id})`)
      .join('\n');

    const result = await callModelJSON(MODEL_BRIEF,
      `You are an SEO content strategist for beachbride.com, a destination wedding website. Identify keywords that serve identical search intent so we only publish ONE article per intent.

Two keywords are the SAME intent if a reader searching for one would be equally satisfied by an article written for the other.

SAME intent examples:
- "beach wedding songs" / "music for beach wedding" / "songs for a beach wedding" / "beach wedding song" — all want a list of songs
- "destination wedding invitation wording" / "destination wedding invitations wording" / "destination wedding invite wording" / "destination wedding invitation text" — all want sample text
- "beach wedding nail ideas" / "beach wedding nails" — both want nail inspiration
- "autumn beach wedding" / "fall beach wedding" / "beach wedding in the fall" / "beach fall wedding" — all about fall beach weddings

DIFFERENT intent examples:
- "destination wedding invitation etiquette" vs "destination wedding invitation wording" → the rules vs. the actual sample text
- "save the date wording for destination wedding" vs "destination wedding invitation wording" → different documents
- "destination wedding welcome bags" vs "destination wedding party favors" → arrival welcome gift vs. ceremony takeaway favor
- "destination wedding gift registry" vs "destination wedding guest gifts" → what couple wants vs. what couple gives guests
- "beach bride" / "coastal bride" → slightly different persona angles, keep both

For clusters, keep the HIGHEST-SCORED topic (the score is shown in brackets). If scores are tied, keep the one with the broadest/most searchable keyword.`,

      `Find all intent clusters in this list. For each cluster of near-duplicates, keep ONE and skip the rest.

TOPICS:
${candidateList}

Return JSON:
{
  "keep": [list of indices to keep — include ALL topics with no duplicates],
  "clusters": [
    {
      "keep": 2,
      "skip": [0, 5, 8],
      "intent": "one-line description of the shared intent"
    }
  ]
}

Every index must appear in either "keep" OR a cluster's "skip" — no topic left unaccounted.`,
      { temperature: 0 }
    );

    const keepIndices = new Set(result.keep || []);

    // Log the clusters
    let clustersFound = 0;
    if (result.clusters?.length) {
      for (const cluster of result.clusters) {
        if (!cluster.skip?.length) continue;
        const keepTopic = batch[cluster.keep];
        const skipTopics = cluster.skip.map(i => batch[i]).filter(Boolean);
        console.log(`\n    CLUSTER: ${cluster.intent}`);
        console.log(`      Keep:  [${keepTopic?.score?.toFixed(0)}] "${keepTopic?.keyword}"`);
        for (const t of skipTopics) {
          console.log(`      Skip:  [${t?.score?.toFixed(0)}] "${t?.keyword}"`);
          allSkipIds.add(t.id);
        }
        clustersFound++;
      }
    }
    if (clustersFound === 0) {
      console.log('    No clusters found in this batch.');
    }
  }

  console.log(`\n  Total topics to mark skipped: ${allSkipIds.size}`);
  console.log(`  Topics that survive: ${discovered.length - allSkipIds.size}\n`);

  if (allSkipIds.size === 0) {
    console.log('  Queue is already clean — nothing to do.');
    return;
  }

  if (!dryRun) {
    let skipped = 0;
    for (const topic of pipeline.topics) {
      if (topic.status === 'discovered' && allSkipIds.has(topic.id)) {
        topic.status = 'skipped-intent-overlap';
        topic.failReason = 'Intra-batch duplicate: another topic in the same discovery batch serves this intent';
        // Also add to blacklist
        const normalized = normalizeKeyword(topic.keyword);
        if (!pipeline.rejectedKeywords.includes(normalized)) {
          pipeline.rejectedKeywords.push(normalized);
        }
        skipped++;
      }
    }
    savePipeline(pipeline);
    console.log(`  Saved: ${skipped} topics marked skipped-intent-overlap`);
    console.log(`  Remaining discovered: ${pipeline.topics.filter(t => t.status === 'discovered').length}`);
  } else {
    console.log('  [DRY RUN] Would mark the topics listed above as skipped-intent-overlap');
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
