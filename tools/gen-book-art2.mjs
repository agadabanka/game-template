// Generate the NEW chapter art for the extended book (matches the original STYLE).
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateImage } from '../lib/gemini.js';

mkdirSync('book/img/art', { recursive: true });
const STYLE = 'Cohesive children\'s-storybook-meets-retro-videogame illustration: lush painterly pixel-art landscapes fused with delicate blueprint linework and faint brass clockwork gears, cinematic volumetric lighting, a warm blue-and-amber palette, rich and beautiful. Absolutely NO text, NO words, NO letters, NO numbers, NO captions anywhere.';

const JOBS = [
  ['mechanics', '2:3', 'A whimsical "physics toy box": a chunky green pixel frog bouncing through a wonderland of glowing gadgets — a coiled spring launchpad, a swirling wind current of arrows, an upward fan thermal, a pool of buoyant water, a sticky mud patch, a spinning wheel of fire on a pivot, and a moving stone platform on dashed rails — each gadget rendered like a blueprint contraption with brass gears. Keep a calm area at the top for a title.'],
  ['lens', '2:3', 'A luminous "design lens": a great glowing rising ribbon of light shaped like an interest curve, perfectly aligned above a cutaway side-scroller level map, connected by faint vertical measurement lines and little glowing pin-markers; a gentle benevolent AI eye studies it from above, fine engineering grids and gauges around. Electric blue and warm amber. Keep a calm band at the top for a title.'],
  ['feeling', '2:3', 'A designer\'s glowing hand gently placing a radiant heart of "feeling" onto a point of a pixel-art level map; from that point an AI genie of soft light conjures exactly the right game gadget (a spring, a flame) into being; tiny floating emotion icons — a spark, a calm wave, a thrill — drift around. Warm, magical, blueprint margins. Keep a calm area at the top for a title.'],
  ['codesign', '2:3', 'Two friendly glowing AI orbs collaborating over a large unrolled level blueprint on a drafting table: a cyan "player" orb traces a running path and points at unreachable coins glowing red; an amber "designer" orb redraws the level to bring those coins down onto the path, springs and ledges appearing. Looping arrows of light flow between the two orbs. Brass compasses and gears. Keep a calm area at the top for a title.'],
  ['gameai', '2:3', 'A generic game-playing AI brain rendered as a glowing crystalline core, reading a floating "reward map" of a level where coins, stars, mushrooms and enemies each wear a soft value-halo; beams of light weigh the rewards and trace the best path through them, with small risk gauges and a shield icon glowing at a dangerous spot. A portable, engine-agnostic machine of decision-making. Keep a calm area at the top for a title.'],
];

for (const [name, aspectRatio, scene] of JOBS) {
  try {
    const { mimeType, base64 } = await generateImage(`${STYLE} ${scene}`, { aspectRatio });
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    writeFileSync(`book/img/art/${name}.${ext}`, Buffer.from(base64, 'base64'));
    console.log(`✓ ${name}.${ext} (${aspectRatio})`);
  } catch (e) { console.log(`✗ ${name}: ${e.message}`); }
}
console.log('NEW BOOK ART DONE');
