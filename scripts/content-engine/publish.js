/**
 * Content Engine — Publisher
 * Picks one article from content-queue, integrates internal links across
 * existing articles, verifies the Astro build, then commits + pushes + emails.
 *
 * Usage:
 *   node scripts/content-engine/publish.js [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, copyFileSync, unlinkSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  ROOT, ARTICLES_DIR, IMAGES_DIR, QUEUE_DIR, QUEUE_IMAGES_DIR,
  loadPipeline, savePipeline, getExistingArticles, LINK_TARGETS, cliFlags,
} from './lib/config.js';
import { notifyPublished, notifyDigest } from './lib/email.js';

const { dryRun } = cliFlags();

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Content Engine: Publish ===`);
  console.log(`  dry-run: ${dryRun}\n`);

  // 1. Pick oldest article from queue
  const queueFiles = existsSync(QUEUE_DIR)
    ? readdirSync(QUEUE_DIR).filter(f => f.endsWith('.md')).sort()
    : [];

  if (queueFiles.length === 0) {
    console.log('  Queue empty. Nothing to publish.');
    return;
  }

  const filename = queueFiles[0];
  const slug = filename.replace(/\.md$/, '');
  const srcArticle = join(QUEUE_DIR, filename);
  const destArticle = join(ARTICLES_DIR, filename);
  const srcImage = join(QUEUE_IMAGES_DIR, `${slug}.jpg`);
  const destImage = join(IMAGES_DIR, `${slug}.jpg`);
  const hasImage = existsSync(srcImage);

  console.log(`  Publishing: ${slug}`);

  let articleContent = readFileSync(srcArticle, 'utf8');
  const { frontmatter, body } = splitFrontmatter(articleContent);
  const title = frontmatter.title || slug;

  console.log(`  Title: ${title}`);

  // 2. Internal link integration
  const existingArticles = getExistingArticles();
  const modifiedFiles = [];

  // 2a. Ensure outbound links in new article (read-only — modifies in-memory body only)
  let updatedBody = ensureOutboundLinks(body, slug);

  // Reassemble article
  articleContent = assembleFrontmatter(frontmatter, updatedBody);

  if (dryRun) {
    console.log(`\n  [DRY RUN] Would:`);
    console.log(`    - Move ${srcArticle} → ${destArticle}`);
    if (hasImage) console.log(`    - Move ${srcImage} → ${destImage}`);
    console.log(`    - Add inbound links + update related arrays in existing articles`);
    console.log(`    - Commit and push to main`);
    console.log(`    - Send email notification`);
    return;
  }

  // 2b. Add inbound links from existing articles to the new one (writes to disk)
  const inboundUpdates = addInboundLinks(slug, frontmatter, existingArticles);
  modifiedFiles.push(...inboundUpdates);

  // 2c. Update related arrays bidirectionally (writes to disk)
  const relatedUpdates = updateRelatedArrays(slug, frontmatter, existingArticles);
  modifiedFiles.push(...relatedUpdates);

  // 3. Move files to their final locations
  writeFileSync(destArticle, articleContent);
  if (hasImage) copyFileSync(srcImage, destImage);

  // 4. Build verification — CRITICAL safety check
  //    Use stdio:'inherit' to stream output directly to CI log without buffering
  console.log('\n  Verifying build...');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit', timeout: 600000 });
    console.log('  Build: PASSED');
  } catch (err) {
    // Build failed — revert
    console.error('  Build: FAILED — reverting');
    console.error(`  Exit code: ${err.status}, signal: ${err.signal}`);
    if (existsSync(destArticle)) unlinkSync(destArticle);
    if (hasImage && existsSync(destImage)) unlinkSync(destImage);

    // Revert any modified existing articles
    for (const mod of modifiedFiles) {
      if (mod.backup) {
        writeFileSync(mod.path, mod.backup);
      }
    }

    // Update pipeline
    const pipeline = loadPipeline();
    const topic = pipeline.topics.find(t => t.articleSlug === slug);
    if (topic) {
      topic.status = 'failed';
      topic.failReason = 'Build verification failed';
      savePipeline(pipeline);
    }

    const { notifyFailed } = await import('./lib/email.js');
    await notifyFailed(slug, 'Astro build failed after moving article to src/content/articles/. Article reverted.');
    process.exit(1);
  }

  // 5. Clean up queue
  unlinkSync(srcArticle);
  if (hasImage && existsSync(srcImage)) unlinkSync(srcImage);

  // 6. Git commit + push
  console.log('\n  Committing...');

  if (process.env.CI) {
    exec('git config user.name "BeachBride Bot"');
    exec('git config user.email "bot@beachbride.com"');
  }

  exec(`git add "${destArticle}"`);
  if (hasImage) exec(`git add "${destImage}"`);
  for (const mod of modifiedFiles) {
    exec(`git add "${mod.path}"`);
  }
  exec(`git add "${join(ROOT, 'scripts', 'content-engine', 'pipeline.json')}"`);
  // Stage removal of queue file
  exec(`git add "${srcArticle}"`);
  if (hasImage) exec(`git add "${srcImage}"`);

  const commitMsg = `Publish: ${title}\n\nContent Engine automated publish.\nSlug: ${slug}`;
  exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
  exec('git push origin main');
  console.log('  Pushed to main');

  // 7. Update pipeline
  const pipeline = loadPipeline();
  const topic = pipeline.topics.find(t => t.articleSlug === slug);
  if (topic) {
    topic.status = 'published';
    topic.publishedAt = new Date().toISOString();
    savePipeline(pipeline);
  }

  // 8. Email notification
  await notifyPublished(title, slug);

  // 9. Weekly digest — send on Fridays only (last publish of the week)
  if (new Date().getDay() === 5) {
    await sendWeeklyDigest(pipeline);
  }

  console.log(`\n  Done. Article live at: https://beachbride.com/${slug}/`);
}

// ── Weekly Digest (Fridays) ────────────────────────────────────────────────────

async function sendWeeklyDigest(pipeline) {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const topics = pipeline.topics;

  const publishedThisWeek = topics.filter(t =>
    t.status === 'published' && t.publishedAt && t.publishedAt >= oneWeekAgo
  );
  const failedThisWeek = topics.filter(t =>
    t.status === 'failed' && t.discoveredAt && t.discoveredAt >= oneWeekAgo.slice(0, 10)
  );
  const queueFiles = existsSync(QUEUE_DIR)
    ? readdirSync(QUEUE_DIR).filter(f => f.endsWith('.md'))
    : [];

  await notifyDigest({
    discovered: topics.filter(t => t.discoveredAt >= oneWeekAgo.slice(0, 10)).length,
    generated: publishedThisWeek.length + queueFiles.length,
    passed: publishedThisWeek.length + queueFiles.length,
    failed: failedThisWeek.length,
    queueDepth: queueFiles.length,
    failures: failedThisWeek.map(t => ({ id: t.id, reason: t.failReason })),
    published: publishedThisWeek.map(t => ({
      title: t.brief?.title || t.id,
      slug: t.articleSlug,
      date: t.publishedAt?.slice(0, 10),
    })),
  });
}

// ── Internal Linking: Outbound ─────────────────────────────────────────────────

function ensureOutboundLinks(body, currentSlug) {
  let linked = new Set();
  let updated = body;

  for (const target of LINK_TARGETS) {
    if (target.slug === currentSlug) continue;
    if (linked.has(target.slug)) continue;

    // Check if already linked
    if (updated.includes(`(/${target.slug}/)`)) {
      linked.add(target.slug);
      continue;
    }

    // Find first mention of any pattern
    for (const pattern of target.patterns) {
      const regex = new RegExp(`\\b(${escapeRegex(pattern)})\\b`, 'i');
      const match = updated.match(regex);
      if (match) {
        // Don't link inside existing links, headings, or frontmatter
        const idx = match.index;
        const before = updated.slice(Math.max(0, idx - 5), idx);
        if (before.includes('[') || before.includes('#')) continue;

        updated = updated.slice(0, idx) +
          `[${match[1]}](/${target.slug}/)` +
          updated.slice(idx + match[1].length);
        linked.add(target.slug);
        break;
      }
    }
  }

  const linkCount = (updated.match(/\]\(\//g) || []).length;
  console.log(`    Outbound links: ${linkCount}`);
  return updated;
}

// ── Internal Linking: Inbound ──────────────────────────────────────────────────

function addInboundLinks(newSlug, newFrontmatter, existingArticles) {
  const modified = [];
  const newTitle = newFrontmatter.title || newSlug;
  const newTags = newFrontmatter.tags || [];

  // Find 2-3 most related existing articles by shared tags
  const scored = existingArticles.map(a => ({
    ...a,
    sharedTags: a.tags.filter(t => newTags.includes(t)).length,
  })).filter(a => a.sharedTags > 0).sort((a, b) => b.sharedTags - a.sharedTags).slice(0, 3);

  for (const target of scored) {
    const ext = existsSync(join(ARTICLES_DIR, `${target.slug}.mdx`)) ? '.mdx' : '.md';
    const filePath = join(ARTICLES_DIR, `${target.slug}${ext}`);
    if (!existsSync(filePath)) continue;

    const original = readFileSync(filePath, 'utf8');

    // Skip if already links to new article
    if (original.includes(`(/${newSlug}/)`)) continue;

    // Find a natural place to insert a link
    const { frontmatter: fm, body: b } = splitFrontmatter(original);
    const keyword = newSlug.replace(/-/g, ' ');
    const regex = new RegExp(`\\b(${escapeRegex(keyword)})\\b`, 'i');
    const match = b.match(regex);

    if (match) {
      const idx = match.index;
      const before = b.slice(Math.max(0, idx - 5), idx);
      if (!before.includes('[') && !before.includes('#')) {
        const updatedBody = b.slice(0, idx) +
          `[${match[1]}](/${newSlug}/)` +
          b.slice(idx + match[1].length);
        const updatedContent = assembleFrontmatter(fm, updatedBody);
        writeFileSync(filePath, updatedContent);
        modified.push({ path: filePath, backup: original });
        console.log(`    Added inbound link from /${target.slug}/ → /${newSlug}/`);
      }
    }
  }

  return modified;
}

// ── Related Array Updates ──────────────────────────────────────────────────────

function updateRelatedArrays(newSlug, newFrontmatter, existingArticles) {
  const modified = [];
  const newTags = newFrontmatter.tags || [];

  // Find 2-3 most related
  const scored = existingArticles.map(a => ({
    ...a,
    sharedTags: a.tags.filter(t => newTags.includes(t)).length,
  })).filter(a => a.sharedTags > 0).sort((a, b) => b.sharedTags - a.sharedTags).slice(0, 3);

  for (const target of scored) {
    const ext = existsSync(join(ARTICLES_DIR, `${target.slug}.mdx`)) ? '.mdx' : '.md';
    const filePath = join(ARTICLES_DIR, `${target.slug}${ext}`);
    if (!existsSync(filePath)) continue;

    const original = readFileSync(filePath, 'utf8');
    const { frontmatter: fm, body: b } = splitFrontmatter(original);

    // Add new slug to related if not already there
    if (!fm.related) fm.related = [];
    if (fm.related.includes(newSlug)) continue;

    // Cap at 5
    if (fm.related.length >= 5) continue;

    fm.related.push(newSlug);
    const updatedContent = assembleFrontmatter(fm, b);
    writeFileSync(filePath, updatedContent);

    // Only add to modified if not already tracked
    if (!modified.find(m => m.path === filePath)) {
      modified.push({ path: filePath, backup: original });
    }
    console.log(`    Added "${newSlug}" to related array of /${target.slug}/`);
  }

  return modified;
}

// ── Frontmatter Helpers (using yaml package) ───────────────────────────────────

function splitFrontmatter(content) {
  const match = content.trimStart().match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const frontmatter = parseYaml(match[1]);
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

function assembleFrontmatter(fm, body) {
  const yamlStr = stringifyYaml(fm, { lineWidth: 0 }).trim();
  return `---\n${yamlStr}\n---\n${body}`;
}

// ── Shell Helper ───────────────────────────────────────────────────────────────

function exec(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
  } catch (err) {
    console.error(`  git error: ${err.message}`);
    throw err;
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Run ────────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
