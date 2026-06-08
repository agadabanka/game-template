// Lush cartoon BACKDROPS per world — style-coherent with the model sheet (palette),
// environment only (no characters), designed as a far parallax background.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { generateImage } from '../lib/gemini.js';
mkdirSync('src/assets/bg', { recursive: true });
const ref = { base64: readFileSync('art-src/STYLE_modelsheet.jpg').toString('base64'), mimeType: 'image/jpeg' };
const STYLE = 'Match the ART STYLE and COLOR PALETTE of the attached sheet: bright Saturday-morning-cartoon, bold thick outlines, flat cel shading, saturated colors. A wide GAME BACKGROUND, ENVIRONMENT ONLY — absolutely NO characters, NO bunny, NO text. Keep the lower third simpler/darker so gameplay reads in front. Layered depth for parallax.';
const W = {
  cave:    `${STYLE} A whimsical underground cavern world: glowing crystal clusters, layered cartoon rock strata, soft teal-and-violet glow, distant tunnels.`,
  dusk:    `${STYLE} A warm dusk world: a big cartoon sunset, gradient orange-to-purple sky, silhouetted rolling hills and a far cartoon keep.`,
  desert:  `${STYLE} A sunny cartoon desert: rolling sand dunes, a bright blue sky with puffy clouds, a few far sci-fi domes and cacti silhouettes.`,
  volcano: `${STYLE} A dramatic cartoon volcano world: dark basalt rock, rivers of glowing orange lava, ember sparks, a smoky red sky.`,
  storm:   `${STYLE} A moody cartoon storm world: dark teal stormclouds, distant lightning, rain streaks, tall spire silhouettes.`,
};
for (const [t, p] of Object.entries(W)) { try { const { mimeType, base64 } = await generateImage(p, { aspectRatio: '16:9', refs: [ref] }); const e = mimeType.includes('png') ? 'png' : 'jpg'; writeFileSync(`src/assets/bg/${t}.${e}`, Buffer.from(base64, 'base64')); console.log('OK', t + '.' + e); } catch (e) { console.log('FAIL', t, e.message); } }
console.log('BACKDROPS DONE');
