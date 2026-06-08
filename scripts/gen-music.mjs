#!/usr/bin/env node
// Render a looping background track per biome with Lyria → src/assets/music/<theme>.wav.
// Run once Lyria is enabled for the GCP project:  node scripts/gen-music.mjs
// (The live game already has a chiptune fallback per biome; these tracks, when present,
//  would be loaded in Boot and preferred — see audio.js / Music.)
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateMusic, lyriaConfigured } from '../lib/lyria.js';

if (!lyriaConfigured()) { console.error('No Vertex service account configured.'); process.exit(2); }
mkdirSync('src/assets/music', { recursive: true });

// one mood per biome — instrumental, loopable
const PROMPTS = {
  day:     'A bright, bouncy and cheerful instrumental overworld theme, light and adventurous, gentle percussion',
  cave:    'A mysterious, sparse and echoing underground ambience, slow, slightly tense, instrumental',
  sky:     'An airy, uplifting and weightless instrumental theme, fast and bright, a sense of soaring',
  castle:  'A tense, marching minor-key instrumental theme with a stately, dangerous feel',
  dusk:    'A warm, wistful minor-key instrumental theme at sunset, mid tempo, reflective',
  snow:    'A delicate, gentle and icy instrumental lullaby, soft and calm, glassy timbres',
  desert:  'An exotic, shimmering desert instrumental theme with a hypnotic groove',
  jungle:  'A rhythmic, lively jungle instrumental theme with playful percussion',
  swamp:   'A murky, slow and brooding instrumental ambience, heavy and damp',
  volcano: 'An intense, fast and driving instrumental theme, danger and heat, urgent',
  crystal: 'A sparkling, bright and wondrous instrumental theme, crystalline and magical',
  storm:   'A dark, driving and energetic instrumental theme, electric tension, fast',
  bastion: 'An epic, heroic and climactic orchestral-chiptune finale theme, grand and resolute',
};

let ok = 0;
for (const [theme, prompt] of Object.entries(PROMPTS)) {
  try {
    const { base64 } = await generateMusic(prompt, { seed: 7, negativePrompt: 'vocals, singing, speech' });
    writeFileSync(`src/assets/music/${theme}.wav`, Buffer.from(base64, 'base64'));
    console.log(`✓ ${theme}`); ok++;
  } catch (e) { console.log(`✗ ${theme}: ${e.message}`); }
}
console.log(`\n${ok}/${Object.keys(PROMPTS).length} tracks written.`);
if (!ok) console.log('Lyria likely not enabled for this project — request access, then re-run.');
