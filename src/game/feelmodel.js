// ── PREDICTED FEEL MODEL ───────────────────────────────────────────────────
// A fast, deterministic stand-in for feel.mjs's VLM scoring: it predicts the
// per-window interest curve straight from a level's ELEMENT PLACEMENT (using the
// same per-element interest weights as elements.js), then runs the EXACT four-
// component formulas feel.mjs uses. Good enough to drive a live editor + a design
// "evolution" loop with instant feedback; the real Gemini score is the ground truth
// you stamp at milestones. Pure (browser + node), no deps.

export const INTEREST = {
  ground: 1, ledge: 4, stair: 5, gap: 5, spring: 8, oneway: 6, ice: 6, pipe: 5,
  qblock: 5, brick: 4, conveyor: 6, spout: 8, dropper: 8, crumble: 7,
  walker: 6, flyer: 6, boss: 9, piranha: 7, dashpad: 8, wind: 6, updraft: 7,
  lowgrav: 7, water: 7, sticky: 6, bounce: 6, firebar: 8, mover: 8, coin: 2,
};
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function pearson(a, b) { const n = a.length, ma = mean(a), mb = mean(b); let nu = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { nu += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? nu / Math.sqrt(da * db) : 0; }
function slope(y) { const n = y.length; if (n < 2) return 0; const mx = (n - 1) / 2, my = mean(y); let nu = 0, de = 0; for (let i = 0; i < n; i++) { nu += (i - mx) * (y[i] - my); de += (i - mx) ** 2; } return de ? nu / de : 0; }
export const idealAt = (t) => 4 + 4 * t + 2.2 * Math.exp(-(((t - 0.84) / 0.11) ** 2));

// every "beat" in the level → { x (tile), type, interest }
export function collectBeats(L) {
  const b = [], gt = L.groundTop;
  (L.enemies || []).forEach((e) => b.push({ x: e.c, type: e.boss ? 'boss' : e.fly ? 'flyer' : 'walker', interest: INTEREST[e.boss ? 'boss' : e.fly ? 'flyer' : 'walker'] }));
  (L.springs || []).forEach((s) => b.push({ x: s.c, type: 'spring', interest: INTEREST.spring }));
  (L.pipes || []).forEach((p) => b.push({ x: p.c, type: 'pipe', interest: INTEREST.pipe }));
  (L.piranhas || []).forEach((p) => b.push({ x: p.c, type: 'piranha', interest: INTEREST.piranha }));
  (L.spouts || []).forEach((s) => b.push({ x: s.c, type: 'spout', interest: INTEREST.spout }));
  (L.droppers || []).forEach((d) => b.push({ x: d.c, type: 'dropper', interest: INTEREST.dropper }));
  (L.crumbles || []).forEach((c) => b.push({ x: c.c, type: 'crumble', interest: INTEREST.crumble }));
  (L.conveyors || []).forEach((c) => b.push({ x: c.c, type: 'conveyor', interest: INTEREST.conveyor }));
  (L.dashpads || []).forEach((d) => b.push({ x: d.c, type: 'dashpad', interest: INTEREST.dashpad }));
  (L.bouncers || []).forEach((d) => b.push({ x: d.c, type: 'bounce', interest: INTEREST.bounce }));
  (L.ices || []).forEach((d) => b.push({ x: d.c, type: 'ice', interest: INTEREST.ice }));
  (L.stickies || []).forEach((d) => b.push({ x: d.c, type: 'sticky', interest: INTEREST.sticky }));
  (L.oneways || []).forEach((d) => b.push({ x: d.c, type: 'oneway', interest: INTEREST.oneway }));
  (L.qblocks || []).forEach((q) => b.push({ x: q.c, type: 'qblock', interest: INTEREST.qblock }));
  (L.firebars || []).forEach((f) => b.push({ x: f.c, type: 'firebar', interest: INTEREST.firebar }));
  (L.movers || []).forEach((m) => b.push({ x: m.c0, type: 'mover', interest: INTEREST.mover }));
  (L.zones || []).forEach((z) => b.push({ x: (z.c0 + z.c1) / 2, type: z.type, interest: INTEREST[z.type] || 6 }));
  (L.gaps || []).forEach(([a, c]) => b.push({ x: (a + c) / 2, type: 'gap', interest: INTEREST.gap }));
  return b;
}

// predict the interest curve + the four components + FUN from placement alone
export function predict(L, { nWin } = {}) {
  const W = L.W;
  const n = nWin || Math.max(16, Math.min(34, Math.round(W / 6)));
  const beats = collectBeats(L);
  const win = Array.from({ length: n }, () => ({ peak: 0, dom: null, count: 0, coins: 0 }));
  const wi = (x) => Math.max(0, Math.min(n - 1, Math.floor((x / W) * n)));
  beats.forEach((bt) => { const w = win[wi(bt.x)]; w.count++; if (bt.interest > w.peak) { w.peak = bt.interest; w.dom = bt.type; } });
  (L.coins || []).forEach((c) => win[wi(c.c)].coins++);
  const seen = new Set();
  let prevDom = null;
  const curve = win.map((w) => {
    let v = 2.4;                                            // bare ground is a touch dull
    if (w.peak > 0) v = 2.0 + w.peak * 0.72;                // dominant beat sets the height
    if (w.count > 1) v += Math.min(1.2, (w.count - 1) * 0.4); // combos add interest
    v += w.coins >= 3 ? 0.8 : w.coins > 0 ? 0.3 : 0;        // a collectible beat
    if (w.dom && !seen.has(w.dom)) { seen.add(w.dom); v += 1.1; }   // NOVELTY — first time we meet a verb
    else if (w.dom && w.dom === prevDom) v *= 0.84;          // FATIGUE — same verb twice running
    prevDom = w.dom || prevDom;
    return Math.max(0, Math.min(10, +v.toFixed(2)));
  });
  return { curve, n, W, ...score(curve, W, n) };
}

// the EXACT feel.mjs component math, over a predicted curve
export function score(curve, W, n) {
  const ideal = curve.map((_, i) => idealAt(n > 1 ? i / (n - 1) : 0));
  const engagement = clamp(mean(curve) / 8);
  const meanAbsDiff = curve.length > 1 ? mean(curve.slice(1).map((v, i) => Math.abs(v - curve[i]))) : 0;
  const dynamics = clamp(meanAbsDiff / 2.5);
  const arcCorr = (pearson(curve, ideal) + 1) / 2;
  const peakPos = curve.indexOf(Math.max(...curve)) / Math.max(1, n - 1);
  const lateBonus = clamp(1 - Math.abs(peakPos - 0.84) / 0.45);
  const trend = clamp((slope(curve) + 0.1) / 0.4);
  const arc = 0.5 * arcCorr + 0.3 * lateBonus + 0.2 * trend;
  let longestFlat = 0, run = 0;
  for (let i = 1; i < curve.length; i++) { if (Math.abs(curve[i] - curve[i - 1]) <= 1 && curve[i] <= 5) { run++; longestFlat = Math.max(longestFlat, run); } else run = 0; }
  const deadIdx = curve.map((v, i) => (v < 3.4 ? i : -1)).filter((i) => i >= 0);
  const flow = clamp(1 - (deadIdx.length / n) * 1.5 - (longestFlat / n) * 1.0);
  const fun = +(100 * (0.35 * engagement + 0.15 * dynamics + 0.25 * arc + 0.25 * flow)).toFixed(1);
  // dead-air windows → tile ranges (for the lens shading)
  const deadAir = deadIdx.map((i) => `${Math.round(i * W / n)}-${Math.round((i + 1) * W / n)}`);
  return {
    components: { engagement: +engagement.toFixed(2), dynamics: +dynamics.toFixed(2), arc: +arc.toFixed(2), flow: +flow.toFixed(2) },
    fun, deadAir, peakPos: +peakPos.toFixed(2), deadIdx,
  };
}
