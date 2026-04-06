/**
 * Content Engine — Pipeline Status Reporter
 * Reads pipeline.json and prints a human-readable summary.
 *
 * Usage:
 *   node scripts/content-engine/status.js
 */

import { readdirSync, existsSync } from 'fs';
import { loadPipeline, QUEUE_DIR } from './lib/config.js';

function main() {
  const pipeline = loadPipeline();
  const topics = pipeline.topics;
  const today = new Date().toISOString().slice(0, 10);

  console.log(`\nPipeline Status (${today})`);
  console.log('='.repeat(40));

  // Status counts
  const counts = {};
  for (const t of topics) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }

  const statusOrder = ['discovered', 'briefed', 'researched', 'written', 'passed', 'staged', 'published', 'failed'];
  console.log('\nTopics by status:');
  for (const status of statusOrder) {
    if (counts[status]) {
      console.log(`  ${status.padEnd(14)} ${counts[status]}`);
    }
  }
  console.log(`  ${'TOTAL'.padEnd(14)} ${topics.length}`);

  // Queue depth
  const queueFiles = existsSync(QUEUE_DIR)
    ? readdirSync(QUEUE_DIR).filter(f => f.endsWith('.md'))
    : [];
  console.log(`\nQueue depth: ${queueFiles.length} articles ready to publish`);
  if (queueFiles.length > 0) {
    for (const f of queueFiles) {
      console.log(`  - ${f.replace('.md', '')}`);
    }
  }

  // Next publish days
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const publishDays = [1, 3, 5]; // Mon, Wed, Fri
  const now = new Date();
  const currentDay = now.getDay();
  let nextPublishDay = publishDays.find(d => d > currentDay);
  if (nextPublishDay === undefined) nextPublishDay = publishDays[0] + 7;
  const daysUntil = (nextPublishDay - currentDay + 7) % 7 || 7;
  const nextDate = new Date(now.getTime() + daysUntil * 86400000);
  console.log(`\nNext publish: ${days[nextDate.getDay()]} ${nextDate.toISOString().slice(0, 10)}`);

  // Recent publications
  const published = topics
    .filter(t => t.status === 'published' && t.publishedAt)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 5);

  if (published.length > 0) {
    console.log('\nRecent publications:');
    for (const t of published) {
      console.log(`  ${t.publishedAt.slice(0, 10)}  ${t.articleSlug || t.id}`);
    }
  }

  // Failed topics
  const failed = topics.filter(t => t.status === 'failed');
  if (failed.length > 0) {
    console.log('\nFailed topics:');
    for (const t of failed) {
      console.log(`  ${t.id} — ${t.failReason || 'unknown reason'}`);
    }
  }

  // Timestamps
  console.log(`\nLast discovery: ${pipeline.lastDiscoveryRun || 'never'}`);
  console.log(`Last generation: ${pipeline.lastGenerationRun || 'never'}`);
}

main();
