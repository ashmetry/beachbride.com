/**
 * Generate hero images for quiz option cards.
 *
 * Generates 17 fixed images (6 vibes, 5 seasons, 3 guest counts, 3 budgets)
 * via Gemini, then resizes to 480×360 (4:3) at 85% quality — small enough
 * for fast quiz loads (~30-50KB each vs ~900KB raw).
 *
 * Usage:
 *   node scripts/content-engine/gen-quiz-images.js
 *   node scripts/content-engine/gen-quiz-images.js --skip-existing
 *   node scripts/content-engine/gen-quiz-images.js vibe-luxury season-winter
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { env, GEMINI_MODEL } from './lib/config.js';

const QUIZ_IMAGES_DIR = join(process.cwd(), 'public', 'images', 'quiz');
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const args = process.argv.slice(2);
const skipExisting = args.includes('--skip-existing');
const targetKeys = args.filter(a => a !== '--skip-existing');

// ── Image definitions ─────────────────────────────────────────────────────────

const QUIZ_IMAGES = [
  // Vibe options
  {
    key: 'vibe-luxury',
    prompt: 'Elegant champagne toast at a luxurious beachfront dinner — crystal flutes catching golden sunset light, white roses, tall candles, linen tablecloth, turquoise ocean softly blurred behind. Editorial fine-dining photography, warm and glamorous.',
  },
  {
    key: 'vibe-tropical',
    prompt: 'Laughing couple under swaying palm trees on a white sand beach, colorful tropical hibiscus flowers in the foreground, turquoise water behind them, vibrant and joyful. Warm editorial photography.',
  },
  {
    key: 'vibe-boho',
    prompt: 'Boho beach ceremony setup — macramé arch wrapped in dried pampas grass and wildflowers in earthy tones, barefoot bride in flowing dress, golden dunes behind. Relaxed, sun-drenched editorial photography.',
  },
  {
    key: 'vibe-adventurous',
    prompt: 'Couple on the edge of a dramatic sea cliff with crashing waves far below, windswept and exhilarated, epic blue ocean stretching to the horizon. Cinematic adventure photography, wide angle.',
  },
  {
    key: 'vibe-mediterranean',
    prompt: 'Iconic white-washed terrace with blue dome, a candlelit dinner for two at the cliff edge, Aegean Sea shimmering in gold and pink at sunset, Santorini. Aspirational Mediterranean photography.',
  },
  {
    key: 'vibe-rustic',
    prompt: 'Romantic Tuscan vineyard wedding table at dusk — rustic stone walls draped in olive branches, tall candles in terracotta holders, wine glasses catching amber light, rolling hills beyond. Warm editorial photography.',
  },

  // Season options
  {
    key: 'season-winter',
    prompt: 'Intimate winter beach wedding at twilight — couple in white on soft sand, surrounded by glowing paper lanterns and candles, soft warm light against a cool misty ocean. Cozy, romantic editorial photography.',
  },
  {
    key: 'season-spring',
    prompt: 'Spring beach wedding in soft pastel light — couple on a petal-strewn path to the sea, surrounded by white and blush tropical blooms and breezy light fabrics, pale blue sky. Dreamy, fresh editorial photography.',
  },
  {
    key: 'season-summer',
    prompt: 'Peak summer beach wedding at midday — vibrant turquoise water, golden white sand, bride in a flowing dress catching sea breeze, joyful outdoor celebration under brilliant blue sky. Bright editorial photography.',
  },
  {
    key: 'season-fall',
    prompt: 'Fall beach wedding at golden hour — couple on the shore, warm amber and copper tones in the sky, dramatic sunset reflecting on wet sand, long shadows. Cinematic editorial photography.',
  },
  {
    key: 'season-flexible',
    prompt: 'Overhead flat-lay of a wedding planning calendar surrounded by flowers from every season — spring blossoms, summer tropical leaves, autumn berries, winter pinecones — on warm linen. Aspirational editorial photography.',
  },

  // Guest count options
  {
    key: 'guests-intimate',
    prompt: 'Just-married couple walking barefoot hand-in-hand along an empty beach at sunset, only their two silhouettes, gentle waves beside them, golden sky. Intimate, cinematic editorial photography.',
  },
  {
    key: 'guests-medium',
    prompt: 'Beach terrace wedding dinner for 40 guests — round tables draped in white linen, fairy lights strung overhead, guests laughing and toasting, calm ocean visible beyond. Warm candlelit editorial photography.',
  },
  {
    key: 'guests-large',
    prompt: 'Grand beachfront wedding reception with 100+ guests — long banquet tables on a manicured lawn, spectacular ocean resort in the background, towering floral arrangements, festive and celebratory. Editorial photography.',
  },

  // Budget options
  {
    key: 'budget-budget',
    prompt: 'Simple but stunning beach elopement — driftwood arch adorned with wildflowers, couple alone on a pristine beach, bright clear water. Proving that a small budget still creates a breathtaking wedding. Editorial photography.',
  },
  {
    key: 'budget-mid',
    prompt: 'Well-appointed outdoor beach wedding reception — elegant white draped fabric, styled centerpieces with tropical flowers, glowing candles, guests in evening wear. Polished and beautiful without being over the top. Editorial photography.',
  },
  {
    key: 'budget-luxury',
    prompt: 'Ultra-luxurious beach wedding — crystal chandeliers hanging over outdoor tables, towering white orchid arrangements, marble elements, a resort infinity pool visible beyond, impeccably dressed guests. Editorial luxury photography.',
  },
];

// ── Image generation ──────────────────────────────────────────────────────────

async function generateRaw(prompt) {
  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio: '4:3' },
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        console.log(`  Gemini error (${res.status}): ${err}`);
        if (attempt < 1) { await sleep(5000); continue; }
        return null;
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }

      console.log('  No image in Gemini response');
      if (attempt < 1) { await sleep(5000); continue; }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
      if (attempt < 1) { await sleep(5000); continue; }
    }
  }
  return null;
}

async function resizeForWeb(buffer, outputPath) {
  await sharp(buffer)
    .resize(480, 360, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outputPath);
  const { size } = (await import('fs')).statSync(outputPath);
  return size;
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

if (!existsSync(QUIZ_IMAGES_DIR)) {
  mkdirSync(QUIZ_IMAGES_DIR, { recursive: true });
}

const targets = targetKeys.length > 0
  ? QUIZ_IMAGES.filter(img => targetKeys.includes(img.key))
  : QUIZ_IMAGES;

if (targets.length === 0) {
  console.error(`No matching keys found. Available: ${QUIZ_IMAGES.map(i => i.key).join(', ')}`);
  process.exit(1);
}

console.log(`Generating ${targets.length} quiz image(s)${skipExisting ? ' (skip existing)' : ''}...\n`);

let ok = 0, skipped = 0, failed = 0;

for (const img of targets) {
  const outputPath = join(QUIZ_IMAGES_DIR, `${img.key}.jpg`);

  if (skipExisting && existsSync(outputPath)) {
    console.log(`[${img.key}] skipped`);
    skipped++;
    continue;
  }

  console.log(`[${img.key}] generating...`);
  const raw = await generateRaw(img.prompt);

  if (!raw) {
    console.log(`  FAILED\n`);
    failed++;
    continue;
  }

  const bytes = await resizeForWeb(raw, outputPath);
  console.log(`  saved ${Math.round(bytes / 1024)}KB → ${outputPath}\n`);
  ok++;
}

console.log(`Done. ${ok} generated, ${skipped} skipped, ${failed} failed.`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
