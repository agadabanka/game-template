// R&D: stress-test Gemini image-gen for game assets, to pick the art lane.
import { generateImage } from '../../lib/gemini.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'gen');
fs.mkdirSync(OUT, { recursive: true });

const jobs = [
  ['hero', 'Game sprite of an original side-scrolling platformer hero mascot, full body facing right, chibi proportions, bold clean dark outline, vibrant saturated flat colors with simple cel shading, red cap, blue overalls, white gloves, big expressive eyes, SNES 16-bit style, centered, isolated on a flat solid magenta #FF00FF background, no drop shadow, no text'],
  ['tile', 'Seamless horizontally-tileable ground block for a 2D platformer: bright green grass top with brown soil and small pebbles below, 16-bit SNES pixel-art style, bold dark outline, vibrant, single overhead-left light source, single square tile, edges line up to tile seamlessly, no text'],
  ['bg', 'Wide parallax background for a cheerful side-scrolling platformer: bright daytime sky with a soft vertical gradient, rolling layered green hills, fluffy stylized rounded clouds, distant hazy blue mountains, Super Mario World inspired, clean shapes with gentle shading, no characters, no UI, no text'],
  ['enemy', 'Game sprite of a cute original walking enemy for a platformer (mushroom-goomba style), front-facing, angry eyebrows, two little feet, bold dark outline, vibrant flat cel-shaded colors, SNES 16-bit style, isolated on flat solid magenta #FF00FF background, no shadow, no text'],
];

for (const [name, prompt] of jobs) {
  try {
    const { base64, mimeType } = await generateImage(prompt);
    const ext = (mimeType || '').includes('png') ? 'png' : 'jpg';
    const p = path.join(OUT, `${name}.${ext}`);
    fs.writeFileSync(p, Buffer.from(base64, 'base64'));
    console.log('ok  ', name, mimeType, '->', p);
  } catch (e) {
    console.log('FAIL', name, '->', e.message);
  }
}
