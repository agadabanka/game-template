// ── COIN REACHABILITY (the play agent's "can I get there?") ────────────────
// A geometric heuristic: a coin is reachable if the frog can stand somewhere and
// reach it — by a JUMP off a platform ≤~3.4 tiles below it (±2 cols), a SPRING within
// reach (~6 tiles), a MOVER deck that passes it, or it sits just above walkable
// ground. Coins that float over a pit/lava with no launch point come back unreachable
// → the play agent reports them to the design agent. Pure (browser + node).
export function coinReach(L) {
  const H = L.H, JUMP = 2.8, SPRING = 6.3;   // "comfortable" jump (not a pixel-perfect max) — the design bar
  const surf = {};                                         // topmost solid row per column
  const addSolid = (c, r) => { if (surf[c] == null || r < surf[c]) surf[c] = r; };
  (L.solids || []).forEach((s) => addSolid(s.c, s.r));
  (L.oneways || []).forEach((s) => addSolid(s.c, s.r));
  (L.pipes || []).forEach((p) => addSolid(p.c, p.r));
  const springs = (L.springs || []);
  const movers = (L.movers || []);
  const surfaceBelow = (cc, cr) => {                       // nearest solid surface below the coin (±2 cols)
    let best = null;
    for (let c = Math.round(cc) - 2; c <= Math.round(cc) + 2; c++) { const r = surf[c]; if (r != null && r > cr) best = best == null ? r : Math.min(best, r); }
    return best;
  };
  const reach = [], un = [];
  (L.coins || []).forEach((coin) => {
    const cc = coin.c, cr = coin.r; let how = null;
    const sb = surfaceBelow(cc, cr);
    if (sb != null && sb - cr <= JUMP) how = sb - cr <= 1.6 ? 'walk' : 'jump';
    if (!how) for (const sp of springs) if (Math.abs(sp.c - cc) <= 2 && sp.r > cr && sp.r - cr <= SPRING) { how = 'spring'; break; }
    if (!how) for (const mv of movers) {
      const xlo = mv.c0 - 1, xhi = (mv.dir === 'h' ? mv.to : mv.c0) + (mv.w || 3);
      const rlo = Math.min(mv.r0, mv.dir === 'v' ? mv.to : mv.r0), rhi = Math.max(mv.r0, mv.dir === 'v' ? mv.to : mv.r0);
      if (cc >= xlo && cc <= xhi && cr >= rlo - JUMP && cr <= rhi + 1) { how = 'mover'; break; }
    }
    (how ? reach : un).push({ c: cc, r: cr, how, sb });
  });
  return { reach, un, total: (L.coins || []).length, reachable: reach.length, surfaceBelow };
}

// PLAY-AWARE reachability: stricter — matches what the route-planner play agent can
// ACTUALLY grab, i.e. coins floating ≤~3.2 tiles above the MAIN walkable ground (or a
// spring up to one from the path). Coins stranded on high isolated ledges come back
// unreachable → the design agent brings them to the route (relocate / spring).
export function playReach(L) {
  const gt = L.groundTop, JUMP = 3.2;
  const surf = {}; const add = (c, r) => { if (surf[c] == null || r < surf[c]) surf[c] = r; };
  (L.solids || []).forEach((s) => add(s.c, s.r)); (L.oneways || []).forEach((s) => add(s.c, s.r)); (L.pipes || []).forEach((p) => add(p.c, p.r));
  const groundRow = (cc) => { for (let c = Math.round(cc) - 1; c <= Math.round(cc) + 1; c++) { const r = surf[c]; if (r != null && r >= gt - 1) return r; } return null; };
  const nearestGroundCol = (cc) => { for (let d = 0; d <= L.W; d++) for (const c of [Math.round(cc) - d, Math.round(cc) + d]) if (surf[c] != null && surf[c] >= gt - 1) return c; return Math.round(cc); };
  const reach = [], un = [];
  (L.coins || []).forEach((co) => {
    const cc = co.c, cr = co.r; let how = null;
    const gr = groundRow(cc);
    if (gr != null && gr - cr >= 0 && gr - cr <= JUMP) how = 'jump';                    // over the main walkable ground
    if (!how) for (const sp of (L.springs || [])) if (Math.abs(sp.c - cc) <= 2 && sp.r > cr && sp.r - cr <= 6.2 && sp.r >= gt - 1) { how = 'spring'; break; }
    (how ? reach : un).push({ c: cc, r: cr, how, gr });
  });
  return { reach, un, total: (L.coins || []).length, reachable: reach.length, groundRow, nearestGroundCol, surf };
}
