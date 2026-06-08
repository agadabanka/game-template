// One-off: generate the book's cohesive illustration set with nano-banana-pro.
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateImage } from '../lib/gemini.js';

mkdirSync('book/img/art', { recursive: true });
const STYLE = 'Cohesive children\'s-storybook-meets-retro-videogame illustration: lush painterly pixel-art landscapes fused with delicate blueprint linework and faint brass clockwork gears, cinematic volumetric lighting, a warm blue-and-amber palette, rich and beautiful. Absolutely NO text, NO words, NO letters, NO numbers, NO captions anywhere.';

const JOBS = [
  ['cover', '2:3', 'Epic vertical book cover. A heroic cute chunky green pixel-art frog mid-leap in rim-light toward a tall checkered flag on a castle tower at golden hour; behind it, dreamlike layered biomes recede into mist — grassy hills, a lava castle, icy peaks, a glowing purple crystal cavern, a stormy spire — with faint blueprint gears drifting in the sky. Keep the upper third a calm open sky for a title.'],
  ['ch1', '2:3', 'A luminous artificial-intelligence mind as a glowing orb of circuitry and constellations floating in a dark studio, projecting a tiny radiant pixel-platformer world into being on a beam of light beneath it; brass gears turn slowly in the gloom. Keep a calm dark area across the top for a title.'],
  ['ch2', '2:3', 'A grand vertical diorama tower of stacked game worlds, each floor a different biome — sunny grassland, dark cavern, cloud-tops, a lava castle, snowy peaks, a golden desert dune, green jungle ruins, a toxic swamp, a red volcano, a purple crystal cavern, a stormy spire, a dark bastion — like a cutaway dollhouse of levels. Keep a calm sky at the top for a title.'],
  ['ch3', '2:3', 'A friendly robot\'s softly glowing hand operating a small arcade joystick, guiding a tiny pixel frog across floating stone platforms; translucent cyan telemetry trajectory arcs and a fine measurement grid overlay the scene, evoking precision and determinism. Keep a calm area at the top for a title.'],
  ['ch4', '2:3', 'A giant luminous rising line-graph ribbon of light, like an aurora of "interest", arcing over a small pixel game landscape; a gentle glowing benevolent eye watches from the sky, and floating hearts and stars hover like gauges. Warm amber and electric blue. Keep a calm band at the top for a title.'],
  ['ch5', '2:3', 'An ornate architect\'s blueprint of a platformer level drawn as four ascending stone staircases, each larger than the last, leading up to a triumphant checkered flag on a tower; unrolled parchment, compass and ruler motifs, brass gears in the margins. Keep a calm area at the top for a title.'],
  ['ch6', '2:3', 'A whimsical factory assembly-line conveyor carrying glowing rectangular game-level frames through two inspection gates — one stamped with a glowing checkmark, one with a glowing star — ending at a tiny rocket lifting off toward a luminous cloud-server; pipes, gauges and gears around. Keep a calm area at the top for a title.'],
  ['ch7', '2:3', 'A central glowing engine-core machine with interchangeable mechanic-blocks — a coiled spring, a flame, a brass gear, an ice crystal, a conveyor belt — plugging into it, radiating conveyor belts that produce many different miniature themed game worlds; a hopeful blueprint "factory of creativity". Keep a calm area at the top for a title.'],
  ['back', '2:3', 'A serene closing scene at sunset: the cute chunky green pixel-art frog stands triumphant on the highest castle battlement having just planted a tall checkered flag, vast layered glowing biomes spread far below under a starry sky threaded with faint blueprint constellations. Peaceful and warm.'],
  ['panorama', '16:9', 'A wide seamless side-scrolling parallax panorama stitching many platformer biomes left to right — grassland, cavern, cloud sky, lava castle, snowy peaks, golden desert dune, jungle ruins, toxic swamp, red volcano, purple crystal cavern, stormy spire, dark bastion — one continuous dreamy landscape.'],
];

for (const [name, aspectRatio, scene] of JOBS) {
  try {
    const { mimeType, base64 } = await generateImage(`${STYLE} ${scene}`, { aspectRatio });
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    writeFileSync(`book/img/art/${name}.${ext}`, Buffer.from(base64, 'base64'));
    console.log(`✓ ${name}.${ext} (${aspectRatio})`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
  }
}
console.log('BOOK ART DONE');
