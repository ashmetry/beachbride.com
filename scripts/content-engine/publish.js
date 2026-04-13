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
  loadPipeline, savePipeline, getExistingArticles, LINK_TARGETS, AFFILIATE_TARGETS, cliFlags,
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

  // Collect section images (slug-2.jpg, slug-3.jpg, ...) generated for visual-intent articles
  const sectionImages = [];
  for (let i = 2; i <= 5; i++) {
    const src = join(QUEUE_IMAGES_DIR, `${slug}-${i}.jpg`);
    if (existsSync(src)) sectionImages.push({ src, dest: join(IMAGES_DIR, `${slug}-${i}.jpg`) });
  }

  console.log(`  Publishing: ${slug}`);

  let articleContent = readFileSync(srcArticle, 'utf8');
  const { frontmatter, body } = splitFrontmatter(articleContent);
  const title = frontmatter.title || slug;

  console.log(`  Title: ${title}`);

  // Stamp publishDate to today (generation date is stale by the time an article is published)
  const today = new Date().toISOString().slice(0, 10);
  frontmatter.publishDate = today;

  // 2. Internal link integration
  const existingArticles = getExistingArticles();
  const modifiedFiles = [];

  // 2a. Ensure outbound links in new article (read-only — modifies in-memory body only)
  let updatedBody = ensureOutboundLinks(body, slug);

  // 2a-ii. Ensure affiliate links where topic matches (max 3 per article)
  const { body: affiliatedBody, added: affiliateCount } = ensureAffiliateLinks(updatedBody);
  if (affiliateCount > 0) {
    updatedBody = affiliatedBody;
    frontmatter.affiliateDisclosure = true;
  }

  // Reassemble article
  articleContent = assembleFrontmatter(frontmatter, updatedBody);

  if (dryRun) {
    console.log(`\n  [DRY RUN] Would:`);
    console.log(`    - Move ${srcArticle} → ${destArticle}`);
    if (hasImage) console.log(`    - Move ${srcImage} → ${destImage}`);
    if (sectionImages.length) console.log(`    - Move ${sectionImages.length} section image(s): ${sectionImages.map(i => basename(i.src)).join(', ')}`);
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
  for (const { src, dest } of sectionImages) copyFileSync(src, dest);

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
    for (const { dest } of sectionImages) { if (existsSync(dest)) unlinkSync(dest); }

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
  for (const { src } of sectionImages) { if (existsSync(src)) unlinkSync(src); }

  // 6. Update pipeline status BEFORE git add so the write is on disk when staged
  const pipeline = loadPipeline();
  const topic = pipeline.topics.find(t => t.articleSlug === slug);
  if (topic) {
    topic.status = 'published';
    topic.publishedAt = new Date().toISOString();
    savePipeline(pipeline);
  }

  // 7. Git commit + push
  console.log('\n  Committing...');

  if (process.env.CI) {
    exec('git config user.name "BeachBride Bot"');
    exec('git config user.email "bot@beachbride.com"');
  }

  exec(`git add "${destArticle}"`);
  if (hasImage) exec(`git add "${destImage}"`);
  for (const { dest } of sectionImages) exec(`git add "${dest}"`);
  for (const mod of modifiedFiles) {
    exec(`git add "${mod.path}"`);
  }
  exec(`git add "${join(ROOT, 'scripts', 'content-engine', 'pipeline.json')}"`);
  // Stage removal of queue files (use git rm --cached in case already deleted from disk)
  exec(`git rm --cached --ignore-unmatch "${srcArticle}"`);
  if (hasImage) exec(`git rm --cached --ignore-unmatch "${srcImage}"`);
  for (const { src } of sectionImages) exec(`git rm --cached --ignore-unmatch "${src}"`);

  const commitMsg = `Publish: ${title}\n\nContent Engine automated publish.\nSlug: ${slug}`;
  exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
  exec('git push origin main');
  console.log('  Pushed to main');

  // 8. Wait for Cloudflare Pages to build and deploy before notifying/pinging
  const DEPLOY_WAIT_MS = 5 * 60 * 1000;
  console.log(`\n  Waiting ${DEPLOY_WAIT_MS / 60000} minutes for Cloudflare to deploy...`);
  await new Promise(resolve => setTimeout(resolve, DEPLOY_WAIT_MS));

  // 9. Email notification
  await notifyPublished(title, slug);

  // 10. IndexNow ping — notify search engines the URL is live
  await pingIndexNow(slug);

  // 11. Weekly digest — send on Fridays only (last publish of the week)
  if (new Date().getDay() === 5) {
    await sendWeeklyDigest(pipeline);
  }

  console.log(`\n  Done. Article live at: https://beachbride.com/${slug}/`);
}

// ── IndexNow ──────────────────────────────────────────────────────────────────

const INDEXNOW_KEY = 'c6ae39507a11a3503ba9d535de85814c';

async function pingIndexNow(slug) {
  const url = `https://beachbride.com/${slug}/`;
  const body = JSON.stringify({
    host: 'beachbride.com',
    key: INDEXNOW_KEY,
    keyLocation: `https://beachbride.com/${INDEXNOW_KEY}.txt`,
    urlList: [url],
  });

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
    });
    if (res.ok || res.status === 202) {
      console.log(`  IndexNow: pinged (${res.status}) — ${url}`);
    } else {
      console.warn(`  IndexNow: unexpected status ${res.status}`);
    }
  } catch (err) {
    console.warn(`  IndexNow: ping failed — ${err.message}`);
  }
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

// ── Affiliate Linking ──────────────────────────────────────────────────────────

function ensureAffiliateLinks(body) {
  const MAX_AFFILIATE_LINKS = 3;
  let updated = body;
  let added = 0;
  const linked = new Set();

  for (const target of AFFILIATE_TARGETS) {
    if (added >= MAX_AFFILIATE_LINKS) break;
    if (linked.has(target.url)) continue;

    // Skip if this affiliate URL is already in the article
    if (updated.includes(target.url)) {
      linked.add(target.url);
      continue;
    }

    for (const pattern of target.patterns) {
      if (added >= MAX_AFFILIATE_LINKS) break;

      const regex = new RegExp(`\\b(${escapeRegex(pattern)})\\b`, 'i');
      const match = updated.match(regex);
      if (!match) continue;

      const idx = match.index;
      // Don't link inside existing links, headings, image alts, or frontmatter
      const before = updated.slice(Math.max(0, idx - 10), idx);
      if (before.includes('[') || before.includes('(') || before.includes('#') || before.includes('!')) continue;

      // Don't link in the first paragraph after an H2 (answer capsule rule)
      const linesBefore = updated.slice(0, idx).split('\n');
      const lastH2Idx = linesBefore.findLastIndex(l => l.startsWith('## '));
      if (lastH2Idx >= 0) {
        const linesBetween = linesBefore.slice(lastH2Idx + 1).filter(l => l.trim()).length;
        if (linesBetween < 1) continue; // Still in the first paragraph
      }

      updated = updated.slice(0, idx) +
        `<a href="${target.url}" target="_blank" rel="${target.rel} noopener">${match[1]}</a>` +
        updated.slice(idx + match[1].length);
      linked.add(target.url);
      added++;
      break;
    }
  }

  if (added > 0) {
    console.log(`    Affiliate links added: ${added}`);
  }
  return { body: updated, added };
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
