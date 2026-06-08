// Use Gemini as "eyes" to assess the generated candidate assets for usability.
import { analyzeImage } from '../../lib/gemini.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GEN = path.join(HERE, 'gen');
const ROLE = {
  'hero.png': 'a HERO CHARACTER SPRITE (needs a clean alpha/transparent or easily-removable solid background, strong silhouette, and would need consistent run/jump animation frames)',
  'enemy.png': 'an ENEMY SPRITE (needs transparent/removable background, clear silhouette)',
  'tile.png': 'a SEAMLESS GROUND TILE (must tile edge-to-edge with no visible seam, fixed grid)',
  'bg.png': 'a PARALLAX BACKGROUND (single wide image behind gameplay; tiling/transparency not required)',
};
for (const [f, role] of Object.entries(ROLE)) {
  const p = path.join(GEN, f);
  if (!fs.existsSync(p)) { console.log(`${f}: missing`); continue; }
  const b64 = fs.readFileSync(p).toString('base64');
  const prompt = `You are a game art director. This image is a candidate for ${role}.
In 2-3 sentences: what does it actually depict, what's its style, and is its background solid/transparent/busy?
Then rate how usable it is AS-IS for a cohesive 2D platformer and end with exactly "USABILITY: N/10".`;
  try { console.log(`\n### ${f}\n` + (await analyzeImage({ base64: b64, mimeType: 'image/png', prompt }))); }
  catch (e) { console.log(`${f}: FAIL ${e.message}`); }
}
