// Precompute a design EVOLUTION offline (reliable Gemini calls, no browser): seed a
// rough level, then for K steps ask the Gemini design critic for the highest-impact
// edit, apply it, and re-score with the predicted feel model — saving every step's
// state. The /editor ?play=1 mode then plays the baked sequence back smoothly for
// recording (no live latency).
//   LEVEL=1 STEPS=11 node tools/eval/evolve-compute.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLevelById } from '../../src/game/levels.js';
import { predict, collectBeats } from '../../src/game/feelmodel.js';
import { seedRough, applyOp, chooseFallback, critiquePrompt } from '../../src/game/evolve.js';
import { generateText, geminiConfigured } from '../../lib/gemini.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEVEL = +(process.env.LEVEL || 1);
const STEPS = +(process.env.STEPS || 11);
const OUT = path.join(HERE, 'video', `evolution_L${LEVEL}.json`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

async function gemini(L, p, step) {
  if (!geminiConfigured()) return null;
  try {
    const raw = await generateText(critiquePrompt({ name: L.name, theme: L.theme, W: L.W, curve: p.curve, components: p.components, deadAir: p.deadAir, beats: collectBeats(L), step }),
      { generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.85, maxOutputTokens: 90 } });
    const m = String(raw).match(/\{[\s\S]*?\}/); if (!m) return null;
    const j = JSON.parse(m[0]);
    const op = String(j.op || 'add').toLowerCase().trim();
    if (op === 'add' && !j.add) return null;
    return { op, x: Math.round(j.x), to: j.to != null ? Math.round(j.to) : undefined, add: j.add ? String(j.add).toLowerCase().trim() : undefined, why: String(j.why || '').slice(0, 90) };
  } catch (e) { return null; }
}

const base = buildLevelById(LEVEL);
let L = seedRough(base);
const used = new Set();
const frames = [];
const snap = (caption, move, via) => { const p = predict(L); frames.push({ level: L, ...p, caption, move: move || null, via: via || null }); return p; };

let p = snap('SEED — a rough first pass: flat, one early threat, lots of dead air.', null, null);
console.log(`SEED L${LEVEL} "${base.name}" · FUN ${p.fun}`);
for (let s = 1; s <= STEPS; s++) {
  p = predict(L);
  let move = await gemini(L, p, s); const via = move ? 'gemini' : 'heuristic';
  if (!move) move = chooseFallback(L, p, used);
  const before = p.fun;
  const r = applyOp(L, move); if (r.type) used.add(r.type);
  const np = snap(`${via === 'gemini' ? '✦ GEMINI' : '◦ heuristic'}: ${r.label} @ x${Math.round(r.x)} — ${move.why || ''}`, { op: r.op, label: r.label, x: r.x, type: r.type, why: move.why || '' }, via);
  console.log(`${s}. ${via} ${r.label} @x${Math.round(r.x)} · FUN ${np.fun} (${(np.fun - before >= 0 ? '+' : '')}${(np.fun - before).toFixed(1)}) — ${move.why || ''}`);
}
frames[frames.length - 1].final = true;
fs.writeFileSync(OUT, JSON.stringify({ level: LEVEL, name: base.name, steps: STEPS, frames }));
console.log(`\nwrote ${frames.length} states → ${OUT} · final FUN ${frames[frames.length - 1].fun}`);
