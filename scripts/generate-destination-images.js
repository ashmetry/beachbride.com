/**
 * Generate hero photography for each destination card.
 * Run: node scripts/generate-destination-images.js
 */

import { generateImage } from './content-engine/lib/gemini-image.js';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const OUT_DIR = join('public', 'images', 'destinations');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const destinations = [
  {
    slug: 'cancun',
    prompt: 'Breathtaking aerial photograph of Cancun Mexico hotel zone. Impossibly turquoise Caribbean water on one side, deep blue lagoon on the other, white sand strip stretching to the horizon. Crystal clear water in shades of aquamarine and cobalt. Bright midday sun. Cinematic, photorealistic, no people, no text.',
  },
  {
    slug: 'punta-cana',
    prompt: 'Stunning wide-angle photograph of Punta Cana Dominican Republic beach. Tall coconut palms arching over white powder sand. Water the color of liquid turquoise, perfectly clear. Thatched palapa beach chairs. Idyllic Caribbean afternoon. Photorealistic, golden light, no text.',
  },
  {
    slug: 'jamaica',
    prompt: 'Dramatic photograph of Negril Jamaica at sunset. Seven Mile Beach curving into the distance, lush tropical vegetation, cliffs on the right catching the last orange light. Sky blazing with color. Warm, electric, Caribbean magic. Photorealistic, no text.',
  },
  {
    slug: 'hawaii',
    prompt: 'Epic wide photograph of Maui Hawaii. Lush green volcanic mountains cascading to a pristine beach, turquoise water meeting dramatic coastline. Tropical jungle foreground. The classic Hawaiian scene: wild beauty where land meets sea. Golden hour, photorealistic, cinematic composition, no text.',
  },
  {
    slug: 'bali',
    prompt: 'Magical photograph of Tanah Lot temple in Bali Indonesia at sunset. Ancient Hindu temple on a dramatic rocky outcrop surrounded by crashing ocean waves. Sky gradient of orange, pink, and purple. Sacred, ethereal atmosphere. Photorealistic, stunning composition, no text.',
  },
  {
    slug: 'santorini',
    prompt: 'Iconic photograph of Santorini Greece caldera view from Oia. White cubic Cycladic buildings with famous blue-domed churches cascade down volcanic cliffs. Deep blue Aegean sea below, warm golden sunset light. The most beautiful view in the world. Photorealistic, sharp detail, no text.',
  },
  {
    slug: 'tulum',
    prompt: 'Breathtaking photograph of Tulum Mexico ruins on clifftop above Caribbean sea. Ancient Mayan temple perched dramatically at the edge of a turquoise bay. Jungle behind, pristine beach below, brilliant aquamarine water. Wild, mystical, cinematic. Photorealistic, golden light, no text.',
  },
  {
    slug: 'costa-rica',
    prompt: 'Stunning photograph of Costa Rica Pacific coast. Dense jungle cascading down to a secluded black sand beach, dramatic waves, misty green mountains in background. Wild and untouched tropical paradise. Lush, saturated colors, moody light. Photorealistic, cinematic, no text.',
  },
  {
    slug: 'key-west',
    prompt: 'Beautiful photograph of Key West Florida at golden hour. Mallory Square waterfront with sailboats and a magnificent sunset blazing orange and crimson over the Gulf of Mexico. Colorful bougainvillea in foreground, historic buildings. Warm, vibrant, quintessential Florida Keys. Photorealistic, no text.',
  },
  // ── New destinations ──────────────────────────────────────────────
  {
    slug: 'los-cabos',
    prompt: 'Dramatic aerial photograph of El Arco rock arch at Lands End, Cabo San Lucas Mexico. Golden desert cliffs meeting deep blue Pacific Ocean and turquoise Sea of Cortez. Dramatic rock formations, crashing waves, blazing sunset sky. Cinematic, photorealistic, wide angle, no people, no text.',
  },
  {
    slug: 'st-lucia',
    prompt: 'Stunning photograph of the Pitons in St Lucia at golden hour. Twin volcanic peaks rising dramatically from turquoise Caribbean water. Lush tropical rainforest covering the mountains. Sugar Beach visible below. The most dramatic landscape in the Caribbean. Photorealistic, vivid colors, no text.',
  },
  {
    slug: 'riviera-maya',
    prompt: 'Beautiful aerial photograph of Riviera Maya Mexico coastline. Turquoise Caribbean water, white sand beach, luxury resort pools visible, lush jungle stretching inland. A cenote (natural sinkhole) visible among the trees. Bright tropical midday, crystal clear water. Photorealistic, vibrant, no text.',
  },
  {
    slug: 'turks-and-caicos',
    prompt: 'Breathtaking photograph of Grace Bay Beach, Turks and Caicos. The most pristine white powder sand beach in the world. Impossibly turquoise water in multiple shades of blue and green. Minimal development, pure Caribbean perfection. Bright sunshine, photorealistic, sharp detail, no text.',
  },
  {
    slug: 'aruba',
    prompt: 'Striking photograph of Aruba Eagle Beach with iconic divi-divi tree bent by trade winds. White sand, turquoise water, single windswept tree creating a dramatic silhouette. Desert cacti visible in background. Bright blue sky with scattered clouds. The Caribbean meets the desert. Photorealistic, no text.',
  },
  {
    slug: 'amalfi-coast',
    prompt: 'Iconic photograph of Positano, Amalfi Coast Italy. Colorful pastel houses cascading down steep cliffs to deep blue Mediterranean Sea. Lemon trees in foreground, terracotta rooftops, church dome visible. Golden afternoon light. The most romantic coastline in the world. Photorealistic, editorial quality, no text.',
  },
  {
    slug: 'tuscany',
    prompt: 'Classic photograph of Tuscan rolling hills at golden hour. Cypress tree-lined road leading to a stone villa. Vineyard rows in green and gold, soft misty hills in background. Warm golden light bathing everything. The quintessential Italian countryside dream. Photorealistic, painterly, no text.',
  },
  {
    slug: 'algarve',
    prompt: 'Dramatic photograph of the Algarve Portugal sea cliffs. Golden limestone rock formations and natural arches over turquoise Atlantic water. Ponta da Piedade grottos visible. Bright sun, vivid blue water, golden orange rock. Wild, dramatic, beautiful. Photorealistic, wide angle, no text.',
  },
  {
    slug: 'dubrovnik',
    prompt: 'Stunning aerial photograph of Dubrovnik Croatia old town. Medieval stone walls surrounding terracotta rooftops on a peninsula jutting into the deep blue Adriatic Sea. Fortress of St Lawrence visible. Golden hour light. UNESCO World Heritage beauty. Photorealistic, cinematic, no text.',
  },
  {
    slug: 'maldives',
    prompt: 'Dreamy photograph of Maldives overwater bungalows at sunset. Wooden villas on stilts over crystal clear turquoise lagoon. Infinite ocean stretching to the horizon. Sky painted in pink, orange, and purple. Perfect tropical luxury. Photorealistic, ethereal, no text.',
  },
  {
    slug: 'fiji',
    prompt: 'Stunning photograph of a Fiji island from above. Small palm-fringed island surrounded by pristine coral reef and turquoise lagoon. Deep blue Pacific Ocean beyond. Lush tropical vegetation, white sand beaches. South Pacific paradise. Photorealistic, aerial perspective, no text.',
  },
  {
    slug: 'holbox',
    prompt: 'Magical photograph of Isla Holbox Mexico. Shallow turquoise lagoon with flamingos wading, white sand, no buildings in sight. Golf cart tracks in sand. Bioluminescent water hints at dusk. Wild, undiscovered, car-free island paradise. Photorealistic, dreamy golden light, no text.',
  },
  {
    slug: 'roatan',
    prompt: 'Crystal clear underwater-to-surface split photograph at Roatan Honduras. Turquoise Caribbean water so clear you can see coral reef below. Lush tropical hillside and dock above water. The second largest barrier reef in the world. Pristine, uncrowded, wild. Photorealistic, vivid, no text.',
  },
  {
    slug: 'kotor',
    prompt: 'Dramatic photograph of Bay of Kotor Montenegro. Fjord-like bay surrounded by steep mountains, medieval walled town of Kotor visible below. Our Lady of the Rocks island church in the bay. Deep blue water, dramatic mountain peaks. European fjord beauty. Photorealistic, golden hour, no text.',
  },
  {
    slug: 'azores',
    prompt: 'Breathtaking photograph of Sete Cidades twin volcanic lakes in Azores Portugal. One lake green, one lake blue, surrounded by lush green crater rim. Dramatic clouds, vivid colors, volcanic landscape. Like Iceland meets the tropics. Wild, otherworldly, stunning. Photorealistic, aerial perspective, no text.',
  },
  {
    slug: 'koh-lanta',
    prompt: 'Beautiful photograph of Koh Lanta Thailand beach at sunset. Long golden sand beach with longtail boats, palm trees, calm Andaman Sea water reflecting orange sky. Traditional Thai fishing boats in foreground. Authentic, peaceful, uncrowded. Photorealistic, warm golden light, no text.',
  },
];

async function run() {
  console.log(`Generating ${destinations.length} destination images...\n`);
  let ok = 0;
  for (const { slug, prompt } of destinations) {
    const outputPath = join(OUT_DIR, `${slug}.jpg`);
    process.stdout.write(`  ${slug} ... `);
    const success = await generateImage(prompt, outputPath, '16:9');
    if (success) { ok++; console.log('done'); }
    else { console.log('FAILED'); }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n${ok}/${destinations.length} destination images generated.`);
}

run().catch(console.error);
