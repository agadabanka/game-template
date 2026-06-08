// Design pass: score every level with the deterministic feel model (no LLM,
// no server) and print a FUN leaderboard + component breakdown + dead-air flags.
//   node tools/eval/design-pass.mjs
import { LEVELS, buildLevelById, WORLDS } from '../../src/game/levels.js';
import { predict } from '../../src/game/feelmodel.js';
import { ensureArrays } from '../../src/game/evolve.js';

const NAME = { 1:'First Steps', 2:'Into the Caverns', 3:'Cloudtop Run', 4:'The Keep', 5:'Emberfall', 6:'Frostpeak', 7:'Dune Sea', 8:'Verdant Ruins', 9:'Mire of Woe', 10:'Cinder Depths', 11:'Crystal Hollow', 12:'Stormspire', 13:'Final Bastion' };
const bars = '▁▂▃▄▅▆▇█';
const spark = (c) => c.map((v) => bars[Math.max(0, Math.min(7, Math.round(v / 10 * 7)))]).join('');

const rows = [];
for (const meta of LEVELS) {
  const L = ensureArrays(buildLevelById(meta.id));
  const p = predict(L);
  rows.push({ id: meta.id, name: NAME[meta.id] || meta.name, ...p });
}

console.log('\n=== DESIGN PASS — predicted felt-experience across the campaign ===\n');
console.log('  L  NAME              FUN   eng  dyn  arc  flow  peak@  curve');
for (const r of rows) {
  const c = r.components;
  console.log(
    `  ${String(r.id).padStart(2)}  ${r.name.padEnd(16)}  ${String(r.fun).padStart(4)}  ` +
    `${c.engagement.toFixed(2)} ${c.dynamics.toFixed(2)} ${c.arc.toFixed(2)} ${c.flow.toFixed(2)}  ` +
    `${String(Math.round(r.peakPos*100)).padStart(3)}%  ${spark(r.curve)}`
  );
}
const funs = rows.map(r => r.fun);
const avg = (funs.reduce((s,x)=>s+x,0)/funs.length).toFixed(1);
const sorted = [...rows].sort((a,b)=>a.fun-b.fun);
console.log(`\n  campaign avg FUN: ${avg}`);
console.log(`  weakest: ${sorted.slice(0,3).map(r=>`L${r.id} (${r.fun})`).join(', ')}`);
console.log(`  strongest: ${sorted.slice(-3).reverse().map(r=>`L${r.id} (${r.fun})`).join(', ')}`);
const flags = rows.filter(r => r.deadAir.length >= 3);
if (flags.length) console.log(`  dead-air flags (≥3 dull windows): ${flags.map(r=>`L${r.id}`).join(', ')}`);

// ── the consolidated 5-world campaign (the 13→5 merge) ──
if (WORLDS && WORLDS.length) {
  console.log('\n=== CONSOLIDATED CAMPAIGN — 5 merged worlds ===\n');
  console.log('  W   NAME              FUN   eng  dyn  arc  flow  peak@  curve');
  const wrows = WORLDS.map((w) => ({ w, p: predict(ensureArrays(buildLevelById(w.id))) }));
  for (const { w, p } of wrows) {
    const c = p.components;
    console.log(
      `  ${String(w.id - 100)}   ${w.name.padEnd(16)}  ${String(p.fun).padStart(4)}  ` +
      `${c.engagement.toFixed(2)} ${c.dynamics.toFixed(2)} ${c.arc.toFixed(2)} ${c.flow.toFixed(2)}  ` +
      `${String(Math.round(p.peakPos*100)).padStart(3)}%  ${spark(p.curve)}`
    );
  }
  const wavg = (wrows.reduce((s, r) => s + r.p.fun, 0) / wrows.length).toFixed(1);
  console.log(`\n  5-world avg FUN: ${wavg}   (vs 13-level avg ${avg})`);
}
console.log('');
