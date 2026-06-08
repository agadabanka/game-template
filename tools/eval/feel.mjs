// ── FELT-EXPERIENCE EVAL: simulate how a HUMAN feels playing the level ──────
// Correctness (0-death AI) says nothing about FUN. This walks the level as a
// first-time player and emits a moment-to-moment INTEREST/EMOTION curve, then
// scores it against an IDEAL interest curve (Schell: hook early → rising peaks
// with rest valleys → CLIMAX near the end). Long flat / low stretches = boredom.
//
// Hardened for repeatability: the LLM persona sim is NOISY, so we run it SIMS
// times and average per-window, and collapse everything into one FUN SCORE
// (0-100) with a transparent breakdown + deterministic structural metrics.
//
//   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json LEVEL=3 SIMS=3 node tools/eval/feel.mjs
import { generateText } from '../../lib/gemini.js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCORES = path.join(HERE, 'scores');
fs.mkdirSync(SCORES, { recursive: true });
const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const LEVEL = process.env.LEVEL || '1';
const WIN = Number(process.env.WIN || 6);     // window width in tiles
const SIMS = Number(process.env.SIMS || 3);   // persona runs to average (noise reduction)

// ── math helpers ────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[clamp(Math.round(p * (s.length - 1)), 0, s.length - 1)]; };
function pearson(a, b) {
  const n = Math.min(a.length, b.length); if (n < 2) return 0;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
function slope(y) { const n = y.length; if (n < 2) return 0; const mx = (n - 1) / 2, my = mean(y); let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (i - mx) * (y[i] - my); den += (i - mx) ** 2; } return den ? num / den : 0; }
const bars = '▁▂▃▄▅▆▇█';
const spark = (c) => c.map((v) => bars[clamp(Math.round(v / 10 * 7), 0, 7)]).join('');
// IDEAL interest curve over normalized position t∈[0,1]: rises, peaks late (~0.84)
const idealAt = (t) => 4 + 4 * t + 2.2 * Math.exp(-(((t - 0.84) / 0.11) ** 2));

// ── 1) drive the game: pull level features + the lived playthrough events ──
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}/?r=canvas&level=${LEVEL}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => window.__rec.begin());
for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  await page.evaluate(() => window.__rec.step());
}
const data = await page.evaluate(async () => {
  const sc = window.__PLATFORMER.scene.scenes.find((s) => s.player);
  const L = sc.level, W = L.W, T = 64;
  const has = (arr, c) => arr.some((e) => e.c === c);
  const gapAt = (c) => (L.gaps || []).some(([a, b]) => c >= a && c <= b);
  const solidSet = new Set(L.solids.map((s) => `${s.c},${s.r}`));
  const groundTopAt = (c) => { for (let r = 0; r < L.H; r++) if (solidSet.has(`${c},${r}`)) return r; return null; };
  window.__game.autopilot(true);
  for (let i = 0; i < 9000; i++) { window.__rec.step(); const s = window.__game.snapshot(); if (s.won) break; const d = window.__PLATFORMER.registry.get('autopilot_done'); if (d && d !== false) break; if (i % 400 === 0) await new Promise((r) => setTimeout(r, 0)); }
  const events = (window.__PLATFORMER.registry.get('autopilot_events') || []).map((e) => ({ t: e.type, x: e.x != null ? Math.round(e.x / T) : null }));
  return {
    W, theme: L.theme, name: L.name,
    counts: { enemies: L.enemies.length, coins: L.coins.length, pipes: L.pipes.length, gaps: (L.gaps || []).length, piranhas: (L.piranhas || []).length, springs: (L.springs || []).length, oneways: (L.oneways || []).length, ices: (L.ices || []).length, conveyors: (L.conveyors || []).length, spouts: (L.spouts || []).length, droppers: (L.droppers || []).length, crumbles: (L.crumbles || []).length, powerups: L.qblocks.filter((q) => q.power).length },
    tiles: Array.from({ length: W }, (_, c) => ({ c, gap: gapAt(c), gtop: groundTopAt(c), enemy: has(L.enemies, c), pipe: has(L.pipes, c), piranha: (L.piranhas || []).some((p) => Math.round(p.c) === c), spring: (L.springs || []).some((s) => s.c === c), oneway: (L.oneways || []).some((o) => o.c === c), ice: (L.ices || []).some((s) => s.c === c), conveyor: (L.conveyors || []).some((s) => s.c === c), spout: (L.spouts || []).some((s) => s.c === c), dropper: (L.droppers || []).some((s) => s.c === c), crumble: (L.crumbles || []).some((s) => s.c === c), coin: has(L.coins, c), qblock: has(L.qblocks, c), brick: has(L.bricks, c) })),
    events,
  };
});
await browser.close();

// ── 2) build WIN-tile windows + deterministic structural metrics ──────────
const W = data.W, windows = [];
for (let x0 = 0; x0 < W; x0 += WIN) {
  const x1 = Math.min(W, x0 + WIN), seg = data.tiles.slice(x0, x1), feat = {};
  for (const t of seg) for (const k of ['gap', 'enemy', 'pipe', 'piranha', 'spring', 'oneway', 'ice', 'conveyor', 'spout', 'dropper', 'crumble', 'coin', 'qblock', 'brick']) if (t[k]) feat[k] = (feat[k] || 0) + 1;
  const heights = seg.map((t) => t.gtop).filter((v) => v != null);
  const relief = heights.length ? Math.max(...heights) - Math.min(...heights) : 0;
  const evs = [...new Set(data.events.filter((e) => e.x != null && e.x >= x0 && e.x < x1).map((e) => e.t))];
  const empty = Object.keys(feat).length === 0 && relief <= 1;
  windows.push({ x0, x1, feat, relief, events: evs, empty });
}
const n = windows.length;
const deadAir = windows.filter((w) => w.empty).map((w) => `${w.x0}-${w.x1}`);
const distinctVerbs = new Set(windows.flatMap((w) => Object.keys(w.feat))).size;

// SNAPSHOT: dump the level's window fingerprint (no Gemini) so feel-ab.mjs can
// score two versions in ONE prompt — cancelling the persona mood-drift that makes
// the absolute FUN SCORE too noisy (~±5pts) to resolve a single element change.
if (process.env.SNAP) {
  const snap = { level: LEVEL, name: data.name, theme: data.theme, W, win: WIN, counts: data.counts, windows };
  fs.writeFileSync(path.join(SCORES, `snap_${process.env.SNAP}.json`), JSON.stringify(snap, null, 2));
  console.log(`snapshot → scores/snap_${process.env.SNAP}.json  (${n} windows, verbs ${distinctVerbs}, dead-air ${deadAir.length})`);
  if (process.env.SNAP_ONLY) process.exit(0);
}

// ── 3) LLM persona simulation, averaged over SIMS runs (noise reduction) ──
const prompt = `You are role-playing a FIRST-TIME human player of one 2D platformer level (Mario-like). Walk it left→right and report your felt experience, honestly. Boring is a real verdict.

Level "${data.name}" (theme ${data.theme}), width ${W} tiles. Element counts: ${JSON.stringify(data.counts)}.
Each window below is ${WIN} tiles. feat = elements present (counts), relief = vertical height variation (0-2 flat, 5+ dramatic), events = what the AI playtest actually did there, empty=true means flat ground with NOTHING.

WINDOWS (in order):
${windows.map((w) => `  [${w.x0}-${w.x1}] feat=${JSON.stringify(w.feat)} relief=${w.relief} events=${JSON.stringify(w.events)}${w.empty ? ' EMPTY' : ''}`).join('\n')}

Return ONE interest value 0-10 for EACH window IN ORDER (0=bored/walking through nothing, 5=fine, 8=engaged, 10=peak thrill). Then judge the whole arc vs Schell's interest curve (HOOK early, RISING peaks with short rest VALLEYS, CLIMAX near the end). Repetition and dead air are the enemy.
Return ONLY strict JSON: {"interest":[${windows.map(() => 'N').join(',')}],"flattest_stretch":"x0-x1 (why)","verdict":"2 sentences","fixes":["3-6 SPECIFIC additions/changes by tile-x to raise low points & sharpen the curve"]}`;

const runs = [];
for (let attempt = 0; attempt < SIMS + 3 && runs.length < SIMS; attempt++) {
  try { const txt = await generateText(prompt); const j = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]); if (Array.isArray(j.interest) && j.interest.length) runs.push(j); }
  catch (e) { /* retry on a bad/unparseable run */ }
}
if (!runs.length) { console.error('all sims failed (Gemini creds?)'); process.exit(1); }

// average per-window interest across runs; keep the run nearest the mean for prose
const curve = Array.from({ length: n }, (_, i) => mean(runs.map((r) => Number(r.interest[i]) || 0).filter((v) => !Number.isNaN(v))));
const runMeans = runs.map((r) => mean(r.interest.slice(0, n).map(Number)));
const noise = +(Math.sqrt(mean(runMeans.map((m) => (m - mean(runMeans)) ** 2))) || 0).toFixed(2);
const repr = runs[runMeans.map((m, i) => [Math.abs(m - mean(curve)), i]).sort((a, b) => a[0] - b[0])[0][1]];

// ── 4) FUN SCORE (0-100) = engagement · dynamics · arc · flow ─────────────
const ideal = curve.map((_, i) => idealAt(n > 1 ? i / (n - 1) : 0));
const engagement = clamp(mean(curve) / 8);                       // are moments interesting?
// rhythm: how much the curve MOVES window-to-window (tension/rest texture). Raw
// spread saturates — a single spike maxes it — so use mean |Δ|, which a flat
// stretch can't fake and a one-off peak can't dominate.
const meanAbsDiff = curve.length > 1 ? mean(curve.slice(1).map((v, i) => Math.abs(v - curve[i]))) : 0;
const dynamics = clamp(meanAbsDiff / 2.5);
const arcCorr = (pearson(curve, ideal) + 1) / 2;                 // shape vs ideal
const peakPos = curve.indexOf(Math.max(...curve)) / Math.max(1, n - 1);
const lateBonus = clamp(1 - Math.abs(peakPos - 0.84) / 0.45);    // climax near the end?
const trend = clamp((slope(curve) + 0.1) / 0.4);                 // rising overall?
const arc = 0.5 * arcCorr + 0.3 * lateBonus + 0.2 * trend;
let longestFlat = 0, run = 0;
for (let i = 1; i < curve.length; i++) { if (Math.abs(curve[i] - curve[i - 1]) <= 1 && curve[i] <= 5) { run++; longestFlat = Math.max(longestFlat, run); } else run = 0; }
const flow = clamp(1 - (deadAir.length / n) * 1.5 - (longestFlat / n) * 1.0);
const comp = { engagement: +engagement.toFixed(2), dynamics: +dynamics.toFixed(2), arc: +arc.toFixed(2), flow: +flow.toFixed(2) };
const fun = +(100 * (0.35 * engagement + 0.15 * dynamics + 0.25 * arc + 0.25 * flow)).toFixed(1);

// ── AUTO-DIAGNOSIS: name the ONE highest-leverage fix (deterministic, no Gemini)
// so each level self-prescribes the right lesson — the fast path to iterating the
// next levels without a manual read. Picks the weakest lever by weighted shortfall.
function diagnose() {
  if (flow < 0.6 && (deadAir.length || longestFlat >= 3))
    return `FLOW — kill dead air${deadAir.length ? ' at ' + deadAir.join(',') : ''}: drop a beat (enemy/relief/verb) into the flat run.`;
  if (arc < 0.5) {
    if (peakPos < 0.6) return `ARC — peak too early (${(peakPos * 100).toFixed(0)}%): pump the LATE climax above the current mid peak (or tone the mid peak down).`;
    if (slope(curve) < 0.05) return `ARC — not rising: escalate intensity toward the end so it builds, not plateaus.`;
    return `ARC — shape off-ideal: hook earlier and concentrate the strongest beat near ~84%.`;
  }
  if (engagement < 0.6) return `ENGAGEMENT — low interest: add a STRUCTURAL verb (spring/mover/relief that changes the rhythm), not more coins.`;
  if (distinctVerbs <= 3) return `VARIETY — only ${distinctVerbs} verbs: introduce a new mechanic and reuse it (introduce→develop→climax).`;
  return `BALANCED — minor polish only; protect the arc when editing.`;
}
const diagnosis = diagnose();

const report = { level: LEVEL, name: data.name, sims: runs.length, windows: n, fun_score_0_100: fun, components: comp, diagnosis, curve: curve.map((v) => +v.toFixed(1)), spark: spark(curve), curveMean: +mean(curve).toFixed(2), simNoise: noise, peakPosition: +peakPos.toFixed(2), deadAir, distinctVerbs, longestFlatRun: longestFlat, flattest_stretch: repr.flattest_stretch, verdict: repr.verdict, fixes: repr.fixes, ts: new Date().toISOString() };
fs.writeFileSync(path.join(SCORES, `feel_L${LEVEL}_${Date.now()}.json`), JSON.stringify(report, null, 2));
console.log(`=== FELT EXPERIENCE · L${LEVEL} ${data.name}  (avg of ${runs.length} sims) ===`);
console.log('interest curve :', spark(curve), ` mean ${report.curveMean}  sim-noise ±${noise}`);
console.log('ideal curve    :', spark(ideal), `  (rising → climax near the end)`);
console.log(`FUN SCORE      : ${fun}/100   [engagement ${comp.engagement} · dynamics ${comp.dynamics} · arc ${comp.arc} · flow ${comp.flow}]`);
console.log('peak at        :', `${(peakPos * 100).toFixed(0)}% through`, '| dead-air', deadAir.length, '| distinct verbs', distinctVerbs, '| longest flat', longestFlat);
console.log('flattest       :', report.flattest_stretch || '(n/a)');
console.log('▶ DIAGNOSIS     :', diagnosis);
console.log('verdict        :', report.verdict || '(n/a)');
console.log('fixes:'); (report.fixes || []).forEach((f) => console.log('  -', f));
