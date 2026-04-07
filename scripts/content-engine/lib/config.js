/**
 * Content Engine — Shared Configuration
 * Paths, env vars, model names, quality thresholds, pipeline helpers.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..', '..', '..');

// Load .env from project root (local dev only — CI uses process.env)
loadDotenv({ path: join(ROOT, '.env') });

// ── Paths ──────────────────────────────────────────────────────────────────────
export const ARTICLES_DIR = join(ROOT, 'src', 'content', 'articles');
export const IMAGES_DIR = join(ROOT, 'public', 'images');
export const QUEUE_DIR = join(ROOT, 'content-queue');
export const QUEUE_IMAGES_DIR = join(ROOT, 'content-queue', 'images');
export const PIPELINE_PATH = join(ROOT, 'scripts', 'content-engine', 'pipeline.json');

// ── OpenRouter Models ──────────────────────────────────────────────────────────
export const MODEL_BRIEF = 'anthropic/claude-sonnet-4-6';
export const MODEL_WRITE = 'anthropic/claude-opus-4-6';
export const MODEL_GATE = 'anthropic/claude-sonnet-4-6';
export const MODEL_RESEARCH = 'perplexity/sonar-pro';
export const MODEL_ALT = 'anthropic/claude-haiku-4-5';

// ── Gemini (image generation) ──────────────────────────────────────────────────
export const GEMINI_MODEL = 'gemini-3-pro-image-preview';

// ── Quality Thresholds ─────────────────────────────────────────────────────────
export const SEO_THRESHOLD = 80;
export const AI_DETECTION_THRESHOLD = 25;
export const MAX_REWRITES = 2;
export const MIN_WORD_COUNT = 1500;
export const MAX_WORD_COUNT = 2500;

// ── Environment Variables ──────────────────────────────────────────────────────
export const env = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'beachbride.com',
  NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || '',
  GSC_KEY_PATH: process.env.GSC_KEY_PATH || '',
  GSC_SERVICE_ACCOUNT_KEY: process.env.GSC_SERVICE_ACCOUNT_KEY || '', // base64 JSON (CI)
  DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN || '',
  DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD || '',
};

// ── Internal Link Targets ──────────────────────────────────────────────────────
// keyword patterns → slug (used by generate + publish for internal linking)
export const LINK_TARGETS = [
  { patterns: ['destination wedding guide', 'plan a destination wedding', 'destination wedding planning'], slug: 'destination-wedding-guide' },
  { patterns: ['destination wedding cost', 'how much does a destination wedding cost', 'destination wedding budget'], slug: 'destination-wedding-cost' },
  { patterns: ['beach wedding checklist', 'beach wedding planning', 'beach wedding timeline'], slug: 'beach-wedding-checklist' },
  { patterns: ['cancun wedding', 'wedding in cancun', 'cancun destination wedding'], slug: 'destinations/cancun' },
  { patterns: ['bali wedding', 'wedding in bali', 'bali destination wedding'], slug: 'destinations/bali' },
  { patterns: ['santorini wedding', 'wedding in santorini', 'santorini destination wedding'], slug: 'destinations/santorini' },
  { patterns: ['hawaii wedding', 'wedding in hawaii', 'hawaii destination wedding'], slug: 'destinations/hawaii' },
  { patterns: ['jamaica wedding', 'wedding in jamaica', 'jamaica destination wedding'], slug: 'destinations/jamaica' },
  { patterns: ['punta cana wedding', 'wedding in punta cana'], slug: 'destinations/punta-cana' },
  { patterns: ['tulum wedding', 'wedding in tulum'], slug: 'destinations/tulum' },
  { patterns: ['costa rica wedding', 'wedding in costa rica'], slug: 'destinations/costa-rica' },
  { patterns: ['key west wedding', 'wedding in key west', 'florida keys wedding'], slug: 'destinations/key-west' },
  { patterns: ['wedding planner', 'local wedding planner', 'destination wedding planner', 'find a planner'], slug: 'vendors' },
  { patterns: ['los cabos wedding', 'cabo san lucas wedding', 'cabo wedding', 'cabo destination wedding'], slug: 'destinations/los-cabos' },
  { patterns: ['st lucia wedding', 'saint lucia wedding', 'st lucia destination wedding'], slug: 'destinations/st-lucia' },
  { patterns: ['riviera maya wedding', 'playa del carmen wedding', 'riviera maya destination wedding'], slug: 'destinations/riviera-maya' },
  { patterns: ['turks and caicos wedding', 'turks caicos wedding', 'grace bay wedding'], slug: 'destinations/turks-and-caicos' },
  { patterns: ['aruba wedding', 'aruba destination wedding'], slug: 'destinations/aruba' },
  { patterns: ['amalfi coast wedding', 'positano wedding', 'ravello wedding', 'amalfi wedding'], slug: 'destinations/amalfi-coast' },
  { patterns: ['tuscany wedding', 'tuscan wedding', 'tuscany vineyard wedding', 'italian vineyard wedding'], slug: 'destinations/tuscany' },
  { patterns: ['portugal wedding', 'algarve wedding', 'algarve destination wedding'], slug: 'destinations/algarve' },
  { patterns: ['dubrovnik wedding', 'croatia wedding', 'adriatic wedding', 'dubrovnik destination wedding'], slug: 'destinations/dubrovnik' },
  { patterns: ['maldives wedding', 'maldives destination wedding', 'overwater bungalow wedding'], slug: 'destinations/maldives' },
  { patterns: ['fiji wedding', 'fiji destination wedding', 'south pacific wedding'], slug: 'destinations/fiji' },
  { patterns: ['holbox wedding', 'isla holbox wedding', 'holbox island wedding'], slug: 'destinations/holbox' },
  { patterns: ['roatan wedding', 'roatan destination wedding', 'honduras wedding'], slug: 'destinations/roatan' },
  { patterns: ['kotor wedding', 'montenegro wedding', 'bay of kotor wedding'], slug: 'destinations/kotor' },
  { patterns: ['azores wedding', 'sao miguel wedding', 'azores destination wedding'], slug: 'destinations/azores' },
  { patterns: ['koh lanta wedding', 'thailand beach wedding', 'koh lanta destination wedding'], slug: 'destinations/koh-lanta' },
  { patterns: ['symbolic ceremony', 'symbolic wedding', 'legal vs symbolic'], slug: 'guides/symbolic-ceremony' },
  { patterns: ['hidden gem destination', 'undiscovered wedding destination', 'hidden gem wedding'], slug: 'destinations/hidden-gems' },
  { patterns: ['wedding photographer', 'destination wedding photographer', 'find a photographer'], slug: 'vendors' },
  { patterns: ['personalized match', 'vendor match', 'matched with vendors', 'take the quiz'], slug: 'quiz' },
];

// ── Affiliate Link Targets ─────────────────────────────────────────────────────
// keyword patterns → affiliate URL (inserted by generate script for resort/jewelry content)
export const AFFILIATE_TARGETS = [
  { patterns: ['sandals resort', 'sandals cancun', 'sandals jamaica', 'sandals barbados'], url: 'https://www.sandals.com/', rel: 'sponsored' },
  { patterns: ['beaches resort', 'beaches turks', 'beaches negril'], url: 'https://www.beaches.com/', rel: 'sponsored' },
  { patterns: ['engagement ring', 'diamond ring', 'solitaire ring', 'halo ring'], url: 'https://www.bluenile.com/', rel: 'sponsored' },
  { patterns: ['lab grown diamond', 'lab diamond ring', 'ethical diamond'], url: 'https://www.brilliantearth.com/', rel: 'sponsored' },
  { patterns: ['custom engagement ring', 'design your ring', 'james allen'], url: 'https://www.jamesallen.com/', rel: 'sponsored' },
];

// ── Existing Articles Inventory ────────────────────────────────────────────────

/**
 * Read all articles from src/content/articles/, parse frontmatter.
 * Returns [{ slug, title, tags, schemaType, related, disclaimers }]
 */
export function getExistingArticles() {
  if (!existsSync(ARTICLES_DIR)) return [];
  const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
  return files.map(f => {
    const slug = f.replace(/\.(mdx|md)$/, '');
    const raw = readFileSync(join(ARTICLES_DIR, f), 'utf8');
    const fm = parseFrontmatter(raw);
    return {
      slug,
      title: fm.title || slug,
      tags: fm.tags || [],
      schemaType: fm.schemaType || 'article',
      related: fm.related || [],
      disclaimers: fm.disclaimers || [],
      destination: fm.destination || null,
    };
  });
}

/**
 * Minimal frontmatter parser — extracts YAML between --- delimiters.
 * Returns a plain object. Uses simple regex for speed; publish.js uses
 * the `yaml` package for robust read/write.
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  // Parse simple key: value pairs and arrays
  let currentKey = null;
  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
    if (kvMatch) {
      const [, key, val] = kvMatch;
      if (val.startsWith('[') || val.startsWith('"[')) {
        // Inline array: ["a", "b"]
        try { result[key] = JSON.parse(val.replace(/'/g, '"')); } catch { result[key] = val; }
      } else {
        result[key] = val.replace(/^["']|["']$/g, '');
      }
      currentKey = key;
    } else if (line.match(/^  - /)) {
      // YAML array item
      if (currentKey) {
        if (!Array.isArray(result[currentKey])) result[currentKey] = [];
        const itemMatch = line.match(/^  - ["']?(.+?)["']?\s*$/);
        if (itemMatch) result[currentKey].push(itemMatch[1]);
      }
    } else if (line.match(/^\w[\w-]*\s*:$/)) {
      // Key with no value (start of block)
      currentKey = line.match(/^(\w[\w-]*)/)[1];
      result[currentKey] = [];
    }
  }
  return result;
}

// ── Pipeline State ─────────────────────────────────────────────────────────────

const EMPTY_PIPELINE = { topics: [], lastDiscoveryRun: null, lastGenerationRun: null };

export function loadPipeline() {
  if (!existsSync(PIPELINE_PATH)) return structuredClone(EMPTY_PIPELINE);
  try {
    return JSON.parse(readFileSync(PIPELINE_PATH, 'utf8'));
  } catch {
    return structuredClone(EMPTY_PIPELINE);
  }
}

export function savePipeline(data) {
  const tmp = PIPELINE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, PIPELINE_PATH);
}

// ── Directory Helpers ──────────────────────────────────────────────────────────

export function ensureDirs() {
  for (const dir of [QUEUE_DIR, QUEUE_IMAGES_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ── CLI Helpers ────────────────────────────────────────────────────────────────

export function cliFlags() {
  const args = process.argv;
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const topicIdx = args.indexOf('--topic');
  const topicId = topicIdx !== -1 ? args[topicIdx + 1] : null;
  const force = args.includes('--force');
  return { dryRun, limit, topicId, force };
}
