/**
 * Content Engine — Gemini Image Generation
 * Generates hero images via Google Gemini REST API (gemini-3-pro-image-preview).
 */

import { writeFileSync } from 'fs';
import { env, GEMINI_MODEL } from './config.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Generate an image and save to disk.
 * @param {string} prompt - Image description
 * @param {string} outputPath - Where to save the image
 * @param {string} aspectRatio - e.g. '16:9', '1:1'
 * @returns {Promise<boolean>} true if image saved successfully
 */
export async function generateImage(prompt, outputPath, aspectRatio = '16:9') {
  if (!env.GEMINI_API_KEY) {
    console.log('  GEMINI_API_KEY not set — skipping image generation');
    return false;
  }

  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio },
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
        if (attempt < 1) {
          console.log('  Retrying in 5s...');
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        return false;
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
          writeFileSync(outputPath, imageBuffer);
          console.log(`  Image saved: ${outputPath} (${Math.round(imageBuffer.length / 1024)}KB)`);
          return true;
        }
      }

      console.log('  No image data in Gemini response');
      if (attempt < 1) {
        console.log('  Retrying in 5s...');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      console.log(`  Gemini error: ${err.message}`);
      if (attempt < 1) {
        console.log('  Retrying in 5s...');
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  return false;
}

/**
 * Generate a hero image for an article using the destination wedding scene library.
 * @param {string} slug - Article slug (used for filename)
 * @param {string} title - Article title (for context)
 * @param {string} topic - Primary keyword/topic
 * @param {string} outputDir - Directory to save to
 * @returns {Promise<{path: string, altText: string}|null>}
 */
export async function generateHeroImage(slug, title, topic, outputDir) {
  const prompt = buildHeroPrompt(title, topic);
  const outputPath = `${outputDir}/${slug}.jpg`;

  console.log(`  Generating hero image for "${slug}"...`);
  const ok = await generateImage(prompt, outputPath, '16:9');
  if (!ok) return null;

  const altText = buildAltText(topic);
  return { path: outputPath, altText };
}

/**
 * Build a destination wedding hero image prompt.
 * Aspirational, editorial-style imagery — not stock-photo generic.
 */
function buildHeroPrompt(title, topic) {
  const scenes = {
    'beach ceremony': 'An elegant beachfront wedding ceremony at golden hour, white wooden chairs on ivory sand, floral arch framing turquoise ocean in the distance, warm sunset light',
    'beach wedding': 'A bride in a flowing white gown walking along a pristine beach, barefoot on wet sand, soft golden reflections on the water, cinematic depth of field',
    'destination wedding': 'A couple exchanging vows on a clifftop terrace overlooking the Mediterranean, surrounded by bougainvillea and white-washed walls, late afternoon sun',
    'cancun': 'A romantic beachfront wedding setup in Cancun, turquoise Caribbean water, white sand, tropical flowers, resort terrace with elegant table settings',
    'bali': 'A dreamy Bali wedding ceremony in a lush jungle temple setting, stone carvings draped in white orchids, soft diffused tropical light through the canopy',
    'santorini': 'A couple at their Santorini wedding on a caldera-view terrace, iconic white and blue architecture, gold Aegean sunset, rose petal scattered aisle',
    'hawaii': 'A Hawaiian beachfront ceremony with a floral lei arch, volcanic mountains in the background, couples and guests barefoot in the sand, warm Pacific light',
    'jamaica': 'A lush Jamaica resort wedding at sunset, tropical flowers in deep jewel tones, white gazebo on a manicured lawn overlooking the turquoise sea',
    'punta cana': 'An all-inclusive resort wedding in Punta Cana, palm-tree lined ceremony aisle, white fabric draping, Caribbean Sea shimmering in the background',
    'tulum': 'A bohemian Tulum jungle wedding, wooden altar wrapped in macramé and tropical greenery, cenote nearby, dappled light through ancient trees',
    'costa rica': 'A Costa Rica eco-resort wedding on a canopy deck, tropical rainforest and misty mountains in the background, bird of paradise florals',
    'wedding planner': 'A wedding planner reviewing notes with a couple at a beautifully decorated outdoor venue, elegant table settings and floral arrangements visible',
    'wedding photographer': 'A destination wedding photographer capturing an intimate moment between a couple on a sun-drenched terrace overlooking the ocean',
    'wedding checklist': 'A couple sitting together at a table reviewing elegant wedding planning documents, coffee cups and floral samples nearby, soft natural light',
    'wedding cost': 'An intimate planning scene showing a couple reviewing a beautifully designed wedding budget worksheet with a glass of champagne, warmly lit setting',
    'engagement ring': 'A close-up of an elegant diamond engagement ring on a woman\'s hand, tropical flowers blurred in the background, golden light',
    'wedding flowers': 'A stunning tropical wedding floral arrangement — birds of paradise, white orchids, and lush greenery — against a sun-bright beachfront backdrop',
    'wedding dress': 'A bride in an elegant flowing white gown standing on a sun-washed villa terrace, tropical garden and ocean view behind her',
    'welcome dinner': 'A romantic welcome dinner setup on a resort terrace at dusk, candles and lanterns, tropical floral centerpieces, elegant table settings',
    'honeymoon': 'A couple toasting on an overwater bungalow deck at sunset, turquoise lagoon surrounding them, champagne glasses catching the golden light',
  };

  // Find best matching scene
  let scene = 'A stunning destination wedding ceremony on a tropical beach at golden hour, ocean breeze, romantic and aspirational atmosphere';
  const topicLower = topic.toLowerCase();
  for (const [key, value] of Object.entries(scenes)) {
    if (topicLower.includes(key)) {
      scene = value;
      break;
    }
  }

  return `${scene}. Editorial wedding photography style, warm golden hour light, cinematic quality, rich colors. No text overlays, no logos, no watermarks. Aspirational and romantic, not commercial stock photography.`;
}

function buildAltText(topic) {
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('beach')) return `${topic} — beachfront ceremony with ocean views`;
  if (topicLower.includes('santorini')) return `Santorini destination wedding ceremony with caldera views`;
  if (topicLower.includes('bali')) return `Bali jungle wedding ceremony with tropical florals`;
  if (topicLower.includes('hawaii')) return `Hawaii beachfront wedding ceremony at sunset`;
  if (topicLower.includes('cancun')) return `Cancun resort wedding with turquoise Caribbean backdrop`;
  return `${topic} — destination wedding inspiration`;
}
