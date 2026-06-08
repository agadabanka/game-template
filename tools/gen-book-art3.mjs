// New chapter art for the extended book (matches the original STYLE).
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateImage } from '../lib/gemini.js';

mkdirSync('book/img/art', { recursive: true });
const STYLE = 'Cohesive children\'s-storybook-meets-retro-videogame illustration: lush painterly pixel-art landscapes fused with delicate blueprint linework and faint brass clockwork gears, cinematic volumetric lighting, a warm blue-and-amber palette, rich and beautiful. Absolutely NO text, NO words, NO letters, NO numbers, NO captions anywhere.';

const JOBS = [
  ['consolidate', '2:3', 'A grand "consolidation" tableau: thirteen short glowing scrolls of pixel-art level maps being magically fused by an AI hand into FIVE long, majestic world-banners that stretch into the distance; above each long world a luminous rising ribbon of light (an interest curve) climbs to a single bright peak near its end; little glowing checkpoint flags dot the long path, and faint brass gears and measuring calipers frame the scene. Warm amber and electric blue. Keep a calm band at the top for a title.'],
  ['checkpoints', '2:3', 'A long heroic side-scroller world rendered as a winding luminous path through several fused biomes (cavern, dunes, storm), with glowing flag-shaped CHECKPOINT beacons planted at the seams; a tiny brave green pixel frog mid-run, a soft ghost-trail showing it respawning at the nearest beacon instead of the far start; gentle engineering grid and a small risk-gauge dial. Hopeful, cinematic. Keep a calm area at the top for a title.'],
  ['generalize', '2:3', 'A portable, engine-agnostic "machine of making": a beautiful brass-and-glass apparatus with four glowing modules connected by light — a shield (a hard correctness gate), an eye reading a rising curve (a soft quality evaluator), a small benevolent AI brain turning a crank (the agent loop), and a press fusing small tiles into a long ribbon (content operations) — the frog mascot stepping out of the machine to show it is no longer game-specific. Blueprint margins, warm light. Keep a calm area at the top for a title.'],
];

for (const [name, aspectRatio, scene] of JOBS) {
  try {
    const { mimeType, base64 } = await generateImage(`${STYLE} ${scene}`, { aspectRatio });
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    writeFileSync(`book/img/art/${name}.${ext}`, Buffer.from(base64, 'base64'));
    console.log(`OK ${name}.${ext} (${aspectRatio})`);
  } catch (e) { console.log(`FAIL ${name}: ${e.message}`); }
}
console.log('NEW BOOK ART DONE');
