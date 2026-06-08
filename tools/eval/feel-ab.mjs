// ── PAIRED A/B FELT-EXPERIENCE EVAL: measure the DELTA of one change ─────────
// The absolute FUN SCORE (feel.mjs) has ~±5pt run-to-run variance because each
// persona run has a global "mood" that shifts the whole curve — larger than the
// effect of adding one element. So you can't trust a single before/after diff.
//
// This shows the persona BOTH versions in ONE prompt and asks it to rate each
// window for A and for B. The shared mood cancels in the difference, so the
// per-window DELTA (B−A) is stable. We run SIMS times and report the mean delta
// plus how CONSISTENTLY each sim agreed on the sign — that's the confidence.
//
//   1) capture snapshots:  SNAP=before SNAP_ONLY=1 LEVEL=7 node tools/eval/feel.mjs
//      (edit the level)    SNAP=after  SNAP_ONLY=1 LEVEL=7 node tools/eval/feel.mjs
//   2) compare:            GOOGLE_APPLICATION_CREDENTIALS=sa.json node tools/eval/feel-ab.mjs before after
import { generateText } from '../../lib/gemini.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCORES = path.join(HERE, 'scores');
const SIMS = Number(process.env.SIMS || 5);
const [A, B] = process.argv.slice(2);
if (!A || !B) { console.error('usage: node tools/eval/feel-ab.mjs <snapA> <snapB>'); process.exit(1); }
const load = (name) => JSON.parse(fs.readFileSync(path.join(SCORES, `snap_${name}.json`), 'utf8'));
const sa = load(A), sb = load(B);

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const bars = '▁▂▃▄▅▆▇█';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const spark = (c) => c.map((v) => bars[clamp(Math.round(v / 10 * 7), 0, 7)]).join('');
// signed sparkline for deltas: ▼ below, ▲ above, · ~0
const dspark = (d) => d.map((v) => (v <= -1.5 ? '▼' : v <= -0.5 ? '▽' : v < 0.5 ? '·' : v < 1.5 ? '△' : '▲')).join('');

const n = Math.min(sa.windows.length, sb.windows.length);
const fmt = (s) => s.windows.map((w) => `[${w.x0}-${w.x1}] feat=${JSON.stringify(w.feat)} relief=${w.relief} events=${JSON.stringify(w.events)}${w.empty ? ' EMPTY' : ''}`).join('\n');

const prompt = `You are role-playing the SAME first-time human player trying TWO versions (A and B) of one 2D platformer level (Mario-like). They are nearly identical — B differs from A by a small edit. Play each left→right and report felt interest, honestly; rate them on the SAME scale so they're directly comparable.

Each window is ${sa.win} tiles. feat=elements present (counts), relief=vertical variation (0-2 flat, 5+ dramatic), events=what an AI playtest did, EMPTY=flat ground with nothing.

VERSION A "${sa.name}" — counts ${JSON.stringify(sa.counts)}
${fmt(sa)}

VERSION B "${sb.name}" — counts ${JSON.stringify(sb.counts)}
${fmt(sb)}

Rate interest 0-10 for EVERY window of A, then EVERY window of B, on one shared scale (0=bored walking through nothing, 5=fine, 8=engaged, 10=peak thrill). Then judge whether B is more FUN than A and WHERE the edit helped or hurt.
Return ONLY strict JSON: {"a":[${sa.windows.map(() => 'N').join(',')}],"b":[${sb.windows.map(() => 'N').join(',')}],"net":"B is better/worse/same — one sentence why","where_better":["x-range: why"],"where_worse":["x-range: why"]}`;

const runs = [];
for (let attempt = 0; attempt < SIMS + 4 && runs.length < SIMS; attempt++) {
  try { const txt = await generateText(prompt); const j = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]); if (Array.isArray(j.a) && Array.isArray(j.b)) runs.push(j); }
  catch (e) { /* retry */ }
}
if (!runs.length) { console.error('all sims failed (Gemini creds?)'); process.exit(1); }

// per-run delta = mean(B) - mean(A); cancels that run's mood. Average over runs.
const runDeltas = runs.map((r) => mean(r.b.slice(0, n).map(Number)) - mean(r.a.slice(0, n).map(Number)));
const overallDelta = mean(runDeltas);
const posFrac = runDeltas.filter((d) => d > 0).length / runDeltas.length;     // sign agreement = confidence
const agree = Math.max(posFrac, 1 - posFrac);
const curveA = Array.from({ length: n }, (_, i) => mean(runs.map((r) => Number(r.a[i]) || 0)));
const curveB = Array.from({ length: n }, (_, i) => mean(runs.map((r) => Number(r.b[i]) || 0)));
const perWin = curveB.map((v, i) => +(v - curveA[i]).toFixed(2));

const repr = runs[0];
console.log(`=== PAIRED A/B · "${A}" vs "${B}"  (${runs.length} sims, mood-cancelled) ===`);
console.log('A interest :', spark(curveA), ` mean ${mean(curveA).toFixed(2)}`);
console.log('B interest :', spark(curveB), ` mean ${mean(curveB).toFixed(2)}`);
console.log('Δ (B−A)    :', dspark(perWin), `  per-window  (▲ up ▽▼ down · flat)`);
console.log(`NET DELTA  : ${overallDelta >= 0 ? '+' : ''}${overallDelta.toFixed(2)} interest/window`,
            `| sign-agreement ${(agree * 100).toFixed(0)}% across ${runs.length} sims`,
            `(${overallDelta > 0.15 && agree >= 0.8 ? 'B clearly better' : overallDelta < -0.15 && agree >= 0.8 ? 'B clearly worse' : 'within noise — inconclusive'})`);
console.log('per-run Δs :', runDeltas.map((d) => (d >= 0 ? '+' : '') + d.toFixed(2)).join('  '));
console.log('net        :', repr.net || '(n/a)');
console.log('better at  :', (repr.where_better || []).join(' | ') || '(none)');
console.log('worse at   :', (repr.where_worse || []).join(' | ') || '(none)');
