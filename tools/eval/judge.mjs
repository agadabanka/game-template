// Vision-model judge: scores eval screenshots against the rubric using Gemini.
// Reproducible quality score (0-100) to hill-climb. Reuses the rig's gemini helper.
// Run:  node tools/eval/judge.mjs            (scores the default frame set)
//       node tools/eval/judge.mjs 01_title.png   (single frame)
import { analyzeImage } from '../../lib/gemini.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const SCORES = path.join(HERE, 'scores');
fs.mkdirSync(SCORES, { recursive: true });

const DIMS = ['cohesion', 'color', 'character', 'depth', 'environment', 'hud', 'marioness', 'juice', 'polish'];
const FRAMES = (process.argv[2] ? [process.argv[2]]
  : ['01_title.png', '03_play_run.png', '05_play_mid.png', '06_play_late.png'])
  .filter((f) => fs.existsSync(path.join(OUT, f)));

const RUBRIC = `You are a senior art director at a AAA studio reviewing a screenshot of an in-development BROWSER platformer meant to rival Super Mario (Super Mario World / New Super Mario Bros) in polish.
Score the IMAGE on each dimension 0-10 (0 = placeholder/sloppy, 5 = competent indie, 8 = shippable, 10 = Nintendo-grade):
- cohesion: one consistent, intentional art style across all elements
- color: saturation, value contrast, palette appeal
- character: hero/enemy silhouette, readability, appeal
- depth: parallax / background layering / atmosphere
- environment: ground, tiles, blocks, pipes craft (not flat/sloppy)
- hud: UI legibility, composition, no glitches/broken glyphs
- marioness: instantly reads as a great platformer of this lineage
- juice: visible particles/animation/squash/effects (a static frame limits this; judge what's visible)
- polish: overall gestalt "this is NOT sloppy"
Be a harsh, specific critic. Return ONLY strict JSON, no prose, no markdown fences:
{"scores":{"cohesion":N,"color":N,"character":N,"depth":N,"environment":N,"hud":N,"marioness":N,"juice":N,"polish":N},"top_fixes":["...","...","..."]}`;

function parseScores(t) {
  const sm = t.match(/"scores"\s*:\s*\{([^}]*)\}/);
  if (!sm) throw new Error('no scores in: ' + t.slice(0, 160));
  const scores = {};
  for (const m of sm[1].matchAll(/"(\w+)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/g)) scores[m[1]] = Number(m[2]);
  let fixes = [];
  const fm = t.match(/"top_fixes"\s*:\s*\[([\s\S]*?)\]/);
  if (fm) fixes = (fm[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map((s) => s.slice(1, -1));
  return { scores, top_fixes: fixes };
}

// The vision judge is HIGH-VARIANCE on a single call (~±30 on identical input).
// Average SAMPLES calls per frame to get a stable score worth hill-climbing on.
const SAMPLES = Number(process.env.JUDGE_SAMPLES || 3);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

const results = {};
const agg = Object.fromEntries(DIMS.map((d) => [d, []]));
for (const f of FRAMES) {
  const b64 = fs.readFileSync(path.join(OUT, f)).toString('base64');
  const perDimSamples = Object.fromEntries(DIMS.map((d) => [d, []]));
  const allFixes = [];
  for (let s = 0; s < SAMPLES; s++) {
    try {
      const txt = await analyzeImage({ base64: b64, mimeType: 'image/png', prompt: RUBRIC });
      const r = parseScores(txt);
      DIMS.forEach((d) => { const v = Number(r.scores?.[d]); if (!Number.isNaN(v)) perDimSamples[d].push(v); });
      (r.top_fixes || []).forEach((x) => allFixes.push(x));
    } catch (e) { /* skip a bad sample */ }
  }
  // median across samples per dimension → robust to outliers
  const scores = Object.fromEntries(DIMS.map((d) => [d, +med(perDimSamples[d]).toFixed(1)]));
  results[f] = { scores, samples: SAMPLES, top_fixes: allFixes.slice(0, 4) };
  DIMS.forEach((d) => agg[d].push(scores[d]));
  console.log(`\n${f} (median of ${SAMPLES}): ${JSON.stringify(scores)}\n  fixes: ${allFixes.slice(0, 3).join(' | ')}`);
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const perDim = Object.fromEntries(DIMS.map((d) => [d, +mean(agg[d]).toFixed(2)]));
const visual = +(mean(DIMS.map((d) => perDim[d])) * 10).toFixed(1);
const summary = { visual_score_0_100: visual, per_dimension: perDim, frames: results, ts: new Date().toISOString() };
fs.writeFileSync(path.join(SCORES, `score_${Date.now()}.json`), JSON.stringify(summary, null, 2));
console.log('\n=== VISUAL SCORE (0-100):', visual, '===');
console.log('per-dimension:', JSON.stringify(perDim));
