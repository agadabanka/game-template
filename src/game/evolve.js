// Shared design-evolution ops (pure; browser + node). seedRough() strips a level to
// a rough starting point; applyEdit() places one mechanic; chooseFallback() is the
// deterministic critic used when Gemini is unavailable. The Gemini critic itself is
// supplied per-environment (fetch in the browser, lib/gemini in node).
export const GT = (L) => L.groundTop;
export const cloneLevel = (L) => JSON.parse(JSON.stringify(L));

export function seedRough(level) {
  const L = cloneLevel(level);
  ['springs', 'spouts', 'droppers', 'crumbles', 'dashpads', 'bouncers', 'conveyors',
    'firebars', 'movers', 'zones', 'stickies', 'ices', 'oneways', 'piranhas'].forEach((k) => { L[k] = []; });
  L.enemies = [{ c: Math.round(L.W * 0.12), r: GT(L) - 1, kind: 'goomba' }];   // one early threat
  L.coins = (L.coins || []).filter((_, i) => i % 5 === 0).slice(0, 8);          // a few stray coins
  L.qblocks = (L.qblocks || []).slice(0, 1);
  return L;
}

export function ensureArrays(L) {
  ['solids', 'coins', 'enemies', 'springs', 'spouts', 'droppers', 'crumbles', 'conveyors', 'dashpads', 'bouncers', 'ices', 'stickies', 'oneways', 'qblocks', 'firebars', 'movers', 'zones', 'pipes', 'piranhas', 'gaps'].forEach((k) => { if (!L[k]) L[k] = []; });
  return L;
}
export function applyEdit(L, x, add, r) {
  ensureArrays(L);
  const gt = GT(L); x = Math.max(2, Math.min(L.W - 4, Math.round(Number(x) || L.W / 2)));
  const span = (n, f) => { for (let i = 0; i < n; i++) f(x + i); };
  switch (add) {
    case 'spring': L.springs.push({ c: x, r: gt - 1 }); [9, 7, 5].forEach((r) => L.coins.push({ c: x, r })); break;
    case 'spout': L.spouts.push({ c: x, r: gt - 1, phase: 0 }); break;
    case 'dropper': L.droppers.push({ c: x, phase: 0 }); break;
    case 'crumble': span(3, (c) => L.crumbles.push({ c, r: gt })); break;
    case 'dashpad': span(4, (c) => L.dashpads.push({ c, r: gt, dir: 1 })); break;
    case 'bounce': span(4, (c) => L.bouncers.push({ c, r: gt })); break;
    case 'conveyor': span(6, (c) => L.conveyors.push({ c, r: gt, dir: 1 })); break;
    case 'ice': span(6, (c) => L.ices.push({ c, r: gt })); break;
    case 'sticky': span(6, (c) => L.stickies.push({ c, r: gt })); break;
    case 'walker': L.enemies.push({ c: x, r: gt - 1, kind: 'goomba' }); break;
    case 'flyer': L.enemies.push({ c: x, r: 8, kind: 'bat', fly: true }); break;
    case 'mover': L.movers.push({ c0: x, r0: gt, dir: 'h', to: Math.min(L.W - 2, x + 5), w: 3, speed: 70 }); break;
    case 'qblock': L.qblocks.push({ c: x, r: gt - 4, power: false }); L.coins.push({ c: x, r: gt - 6 }); break;
    case 'firebar': L.firebars.push({ c: x, len: 2, up: 6, phase: 0 }); break;
    case 'wind': L.zones.push({ type: 'wind', c0: x, c1: Math.min(L.W - 2, x + 8), r0: gt - 7, r1: gt - 1, dir: 1 }); break;
    case 'updraft': L.zones.push({ type: 'updraft', c0: x, c1: Math.min(L.W - 2, x + 5), r0: gt - 7, r1: gt - 1 }); break;
    case 'coins': span(4, (c) => L.coins.push({ c, r: gt - 3 })); break;
    // ── reachability repairs (design agent makes a coin reachable) ──
    case 'ledge': { const rr = r != null ? r : gt - 3; for (let i = -1; i <= 1; i++) { L.solids.push({ c: x + i, r: rr }); L.solids.push({ c: x + i, r: rr + 1 }); } break; }
    case 'springat': L.springs.push({ c: x, r: r != null ? r : gt - 1 }); break;
    case 'gap': L.solids = L.solids.filter((s) => !(s.c >= x && s.c <= x + 2)); (L.gaps ||= []).push([x, x + 2]); break;
    default: L.coins.push({ c: x, r: gt - 3 }); return 'coins';
  }
  return add;
}

export const VARIETY = ['spring', 'spout', 'dropper', 'crumble', 'dashpad', 'mover', 'bounce', 'conveyor', 'firebar', 'walker', 'ice', 'updraft'];

// ── remove / relocate ops (let the critic de-cluster, not just pile on) ─────
const ARRAYS = ['enemies', 'springs', 'pipes', 'piranhas', 'spouts', 'droppers', 'crumbles', 'conveyors', 'dashpads', 'bouncers', 'ices', 'stickies', 'oneways', 'qblocks', 'firebars', 'movers', 'zones'];
const elemX = (k, e) => (k === 'movers' ? e.c0 : k === 'zones' ? (e.c0 + e.c1) / 2 : e.c);
const K2ADD = { enemies: 'walker', springs: 'spring', spouts: 'spout', droppers: 'dropper', crumbles: 'crumble', conveyors: 'conveyor', dashpads: 'dashpad', bouncers: 'bounce', ices: 'ice', stickies: 'sticky', qblocks: 'qblock', firebars: 'firebar', movers: 'mover' };
function removeNearest(L, x, within = 14) {
  let best = null;
  for (const k of ARRAYS) (L[k] || []).forEach((e, i) => { const d = Math.abs(elemX(k, e) - x); if (best == null || d < best.d) best = { k, i, d }; });
  if (best && best.d <= within) { const e = L[best.k].splice(best.i, 1)[0]; return { k: best.k, e, type: K2ADD[best.k] || best.k }; }
  return null;
}

// apply one critic move: {op:'add'|'remove'|'relocate', x, add, to} → {op,label,x,type}
export function applyOp(L, move) {
  const op = move.op || 'add';
  if (op === 'remove') { const r = removeNearest(L, move.x); if (r) return { op, label: `−${r.type}`, x: move.x, type: r.type }; const a = applyEdit(L, move.x, move.add || 'coins'); return { op: 'add', label: `+${a}`, x: move.x, type: a }; }
  if (op === 'relocate') { const r = removeNearest(L, move.x); const type = (r && r.type) || move.add || 'spring'; const to = move.to != null ? move.to : move.x; applyEdit(L, to, type); return { op, label: `↦${type}`, x: to, type }; }
  const a = applyEdit(L, move.x, move.add, move.r); return { op: 'add', label: `+${a}`, x: move.x, type: a };
}
export function chooseFallback(L, p, used) {
  const W = L.W, n = p.n;
  const pick = VARIETY.find((v) => !used.has(v)) || VARIETY[used.size % VARIETY.length];
  if (p.deadIdx && p.deadIdx.length) {
    const wi = p.deadIdx.slice().sort((a, b) => p.curve[a] - p.curve[b])[0];
    return { x: Math.round((wi + 0.5) * W / n), add: pick, why: `fill the dead-air window at ~${Math.round((wi + 0.5) * W / n)}` };
  }
  if (p.peakPos < 0.7) return { x: Math.round(W * 0.86), add: 'spring', why: 'push the climax into the last quarter' };
  return { x: Math.round(W * (0.3 + (used.size % 5) * 0.12)), add: pick, why: 'add contrast / variety' };
}

// The critic PROMPT — shared so the node precompute and the server endpoint agree.
export function critiquePrompt({ name, theme, W, curve, components, deadAir, beats, step }) {
  const MECHS = 'spring, spout, dropper, crumble, dashpad, bounce, walker, conveyor, coins, mover, qblock, ice, sticky, wind, updraft, firebar, gap';
  return `You are a master platformer level designer (Mark Brown / Nintendo "four-step": introduce, develop, twist, resolve), tuning a level for the felt-interest curve (hook early, rising peaks with short rest valleys, CLIMAX near ~84%).
LEVEL "${name}" (${theme}), width ${W} tiles. Design step ${step}.
Per-window interest curve (0-10, left→right): [${(curve || []).map((v) => v.toFixed(1)).join(', ')}]
Scores: engagement ${components?.engagement}, dynamics ${components?.dynamics}, arc ${components?.arc}, flow ${components?.flow}.
Dead-air tile ranges (interest too low): ${(deadAir || []).join(', ') || 'none'}.
Existing beats (tile:type): ${(beats || []).slice(0, 40).map((b) => `${Math.round(b.x)}:${b.type}`).join(', ')}.
Pick the SINGLE highest-impact edit. You may ADD a beat, REMOVE a redundant/over-clustered beat, or RELOCATE one to a better spot. Prefer: fill the worst dead-air zone with a fitting verb; SPREAD beats so the level isn't lopsided; if the peak is early, put a STRONG beat (spring/firebar/mover) in the last quarter; vary verbs; remove a beat only where two of the same kind sit adjacent.
Allowed mechanics: ${MECHS}.
Reply with ONLY compact JSON, one of:
  {"op":"add","x":<tile>,"add":"<mechanic>","why":"<≤12 words>"}
  {"op":"remove","x":<tile>,"why":"<≤12 words>"}
  {"op":"relocate","x":<from tile>,"to":<tile>,"add":"<mechanic>","why":"<≤12 words>"}`;
}
