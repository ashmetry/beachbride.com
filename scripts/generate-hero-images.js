/**
 * One-time script to generate hero images for all articles.
 * Run: node scripts/generate-hero-images.js
 */

import { generateImage } from './content-engine/lib/gemini-image.js';
import { IMAGES_DIR } from './content-engine/lib/config.js';
import { join } from 'path';

const images = [
  {
    file: '5-best-options-for-beach-bridal-shoes.jpg',
    prompt: 'Close-up photograph of elegant bridal sandals resting on white sand beach. Golden afternoon sunlight. Soft bokeh of turquoise ocean waves in background. Warm coastal color palette. No text.',
  },
  {
    file: 'beach-wedding-checklist.jpg',
    prompt: 'Overhead flat lay of wedding planning items on natural linen surface: handwritten checklist, white tropical flowers, small seashells, a gold pen. Warm natural window light. Clean and organized. No text.',
  },
  {
    file: 'beautiful-beach-wedding-color-schemes.jpg',
    prompt: 'Beach wedding tablescape at golden hour. Terracotta linen napkins, dried pampas grass centerpiece, sage greenery, warm candlelight. Turquoise ocean softly visible in the background. Romantic and editorial. No text.',
  },
  {
    file: 'bridal-bouquets.jpg',
    prompt: 'Lush tropical bridal bouquet held by a bride at a beach wedding. White orchids, anthuriums, and tropical greenery. Soft focus ocean background with bright natural light. Elegant and natural. No text.',
  },
  {
    file: 'delicious-beach-style-wedding-punch-recipes.jpg',
    prompt: 'Clear glass beverage dispensers filled with colorful tropical punch on an outdoor decorated wedding table. Citrus slices and hibiscus flower garnishes. Bright beach setting in background. Festive and inviting. No text.',
  },
  {
    file: 'destination-wedding-budget-hacks-that-dont-sacrifice-luxury.jpg',
    prompt: 'Luxurious beach wedding reception setup at sunset. Candlelit tables with tropical floral arrangements, linen tablecloths. Turquoise ocean glowing in golden light in the background. Aspirational and romantic. No text.',
  },
  {
    file: 'destination-wedding-cost.jpg',
    prompt: 'Happy couple sitting at a resort terrace overlooking the ocean, reviewing wedding plans together. Laptop open, notes on the table, tropical surroundings. Bright daytime light. Relaxed and optimistic. No text.',
  },
  {
    file: 'destination-wedding-guide.jpg',
    prompt: 'Wide cinematic beach wedding ceremony. White bamboo chairs lined on white sand, elaborate floral arch with tropical blooms, couple standing at the altar, brilliant turquoise ocean behind them, golden hour light. Cinematic and breathtaking. No text.',
  },
  {
    file: 'key-west-beach-wedding-destination.jpg',
    prompt: 'Key West beach wedding at sunset. Sky blazing with purple, orange, and coral. Silhouette of a couple standing at a simple ceremony arch near the water. A few palm trees. Warm and evocative tropical atmosphere. No text.',
  },
];

async function run() {
  console.log(`Generating ${images.length} hero images...\n`);
  let ok = 0;
  for (const { file, prompt } of images) {
    const outputPath = join(IMAGES_DIR, file);
    process.stdout.write(`  ${file} ... `);
    const success = await generateImage(prompt, outputPath, '16:9');
    if (success) { ok++; console.log('done'); }
    else { console.log('FAILED'); }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n${ok}/${images.length} images generated.`);
}

run().catch(console.error);
