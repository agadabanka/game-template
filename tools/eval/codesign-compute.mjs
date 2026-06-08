// CO-DESIGN LOOP, PLAY-AWARE (play agent ↔ design agent). The play agent can only
// grab coins on/over its walking routes; it reports the ones it CAN'T reach (high on
// isolated ledges). The design agent (Gemini) then brings each to the route — either
// RELOCATE it down onto the path, or add a SPRING that bounces the player up to it —
// and once all are reachable, keeps maximizing fun. Bakes states for /editor playback.
//   LEVEL=10 STEPS=14 node tools/eval/codesign-compute.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLevelById } from '../../src/game/levels.js';
import { predict, collectBeats } from '../../src/game/feelmodel.js';
import { playReach } from '../../src/game/reach.js';
import { applyOp, chooseFallback, critiquePrompt, ensureArrays } from '../../src/game/evolve.js';
import { generateText, geminiConfigured } from '../../lib/gemini.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEVEL = +(process.env.LEVEL || 10);
const STEPS = +(process.env.STEPS || 14);
const OUT = path.join(HERE, 'video', `codesign_L${LEVEL}.json`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

async function designerChoice(coin, gt) {
  const above = coin.gr != null ? (coin.gr - coin.r).toFixed(0) : '∞';
  let add = (coin.gr != null && coin.gr - coin.r <= 6) ? 'spring' : 'relocate', why = '';
  if (geminiConfigured()) {
    try {
      const raw = await generateText(`A coin is stranded where the player can't reach it (it floats high on an isolated ledge). Bring it to the player's route: "relocate" (move the reward down onto the path) or "spring" (add a bounce-pad on the ground below to launch the player up — only works if it's ≤6 tiles above ground; here it's ${above}). Reply ONLY JSON {"add":"relocate|spring","why":"<≤12 words>"}`,
        { generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.7, maxOutputTokens: 60 } });
      const m = String(raw).match(/\{[\s\S]*?\}/); if (m) { const j = JSON.parse(m[0]); if (j.add) add = String(j.add).toLowerCase().includes('spring') ? 'spring' : 'relocate'; why = String(j.why || '').slice(0, 80); }
    } catch (e) {}
  }
  if (add === 'spring' && !(coin.gr != null && coin.gr - coin.r <= 6)) add = 'relocate';
  return { add, why: why || (add === 'spring' ? 'a bounce-pad launches you up to it' : 'bring the reward down onto the route') };
}
async function funCritic(L, p) {
  if (!geminiConfigured()) return chooseFallback(L, p, new Set());
  try {
    const raw = await generateText(critiquePrompt({ name: L.name, theme: L.theme, W: L.W, curve: p.curve, components: p.components, deadAir: p.deadAir, beats: collectBeats(L), step: 0 }),
      { generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.85, maxOutputTokens: 90 } });
    const m = String(raw).match(/\{[\s\S]*?\}/); if (m) { const j = JSON.parse(m[0]); if (j.add || j.op) return { op: String(j.op || 'add').toLowerCase(), x: Math.round(j.x), to: j.to != null ? Math.round(j.to) : undefined, add: j.add && String(j.add).toLowerCase(), why: String(j.why || '').slice(0, 80) }; }
  } catch (e) {}
  return chooseFallback(L, p, new Set());
}

const L = ensureArrays(buildLevelById(LEVEL)); const gt = L.groundTop;
const frames = [];
function snap(caption, move, via) {
  const rr = playReach(L), p = predict(L);
  frames.push({ level: JSON.parse(JSON.stringify(L)), ...p, caption, move: move || null, via: via || null,
    reach: rr.reachable, total: rr.total, reachPct: Math.round(rr.reachable / Math.max(1, rr.total) * 100), unreach: rr.un.map((u) => ({ c: u.c, r: u.r })) });
  return { rr, p };
}

let { rr, p } = snap(`The PLAY agent sweeps "${L.name}" and can reach ${playReach(L).reachable}/${playReach(L).total} coins — ${playReach(L).un.length} are stranded out of reach (red). It asks the designer to fix them.`, null, null);
console.log(`SEED L${LEVEL} "${L.name}" · play-reachable ${rr.reachable}/${rr.total} · FUN ${p.fun}`);
for (let s = 1; s <= STEPS; s++) {
  rr = playReach(L); p = predict(L);
  const un = rr.un.slice().sort((a, b) => a.c - b.c);
  if (un.length) {
    const coin = un[0], before = rr.reachable;
    const ch = await designerChoice(coin, gt);
    let label;
    if (ch.add === 'spring') { const r = applyOp(L, { op: 'add', add: 'springat', x: Math.round(coin.c), r: coin.gr - 1 }); label = r.label; }
    else {
      // RELOCATE: find the coin and move it onto the nearest main-ground column, 2 above.
      const idx = L.coins.findIndex((c) => c.c === coin.c && c.r === coin.r);
      const ngc = rr.nearestGroundCol(coin.c); const ny = (rr.surf[ngc] != null ? rr.surf[ngc] : gt) - 2;
      if (idx >= 0) { L.coins[idx].c = ngc; L.coins[idx].r = ny; }
      label = `↧coin x${Math.round(coin.c)}→${ngc}`;
    }
    const nr = playReach(L);
    snap(`⚑ play: coin @x${Math.round(coin.c)} unreachable → ✦ designer: ${ch.add === 'spring' ? label : 'bring it to the route'} — ${ch.why}`,
      { op: 'add', label, x: ch.add === 'spring' ? Math.round(coin.c) : rr.nearestGroundCol(coin.c), type: ch.add, why: ch.why, kind: 'reach' }, 'gemini');
    console.log(`${s}. REACH coin@x${Math.round(coin.c)} → ${ch.add} · play-reachable ${nr.reachable}/${nr.total} (+${nr.reachable - before}) · FUN ${predict(L).fun} — ${ch.why}`);
  } else if (process.env.REACH_ONLY) {
    snap(`✦ all ${rr.total} coins are now on the player's route — designer done.`, null, 'gemini'); break;
  } else {
    const move = await funCritic(L, p); const r = applyOp(L, move);
    snap(`✦ designer (all coins reachable): ${r.label} @x${Math.round(r.x)} — ${move.why || ''}`, { op: r.op, label: r.label, x: r.x, type: r.type, why: move.why || '', kind: 'fun' }, 'gemini');
    console.log(`${s}. FUN ${r.label} @x${Math.round(r.x)} · FUN ${predict(L).fun} — ${move.why || ''}`);
  }
}
frames[frames.length - 1].final = true;
const last = playReach(L), lp = predict(L);
fs.writeFileSync(OUT, JSON.stringify({ level: LEVEL, name: L.name, steps: STEPS, frames }));
console.log(`\nwrote ${frames.length} states → ${OUT} · final play-reachable ${last.reachable}/${last.total} · FUN ${lp.fun}`);
