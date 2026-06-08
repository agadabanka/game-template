// ── GENERIC LEVEL MERGE ─────────────────────────────────────────────────────
// Concatenate several built levels into one longer level, end to end, with a
// bridged REST valley between segments. Used to consolidate the 13-level
// campaign into 5 longer levels (see merged.js) without losing any content.
//
// Why a bridge: a naive concat leaves a void between sections (the next
// section starts past the previous one's width) — every seam would be a death
// pit. We fill the seam columns with ground at groundTop, which both makes the
// level solvable AND creates the recovery "rest valley" a good interest arc
// wants between rising peaks (Schell). The segment ORDER is chosen upstream to
// place the climax late (see tools/merge-levels.mjs / merged.js).
//
// Generic: works for any set of same-floor levels (uniform H / groundTop),
// portable to other campaigns.

// every column-bearing array a level can carry
const C_ARRS = ['solids', 'bricks', 'qblocks', 'coins', 'enemies', 'pipes', 'piranhas',
  'springs', 'oneways', 'ices', 'stickies', 'conveyors', 'spouts', 'droppers', 'crumbles',
  'dashpads', 'bouncers', 'firebars', 'movers', 'zones', 'blastblocks'];
const DECOR = ['bushes', 'clouds', 'hills'];

// Merge `segments` (array of built level objects) left→right into one level.
//   opts: { id, name, theme, rest } — rest = seam width in tiles (default 6).
export function mergeGroup(segments, { id = 0, name = 'merged', theme, rest = 6, floorAerial = true } = {}) {
  const base = segments[0];
  const H = base.H, groundTop = base.groundTop;
  const out = { id, name, theme: theme || base.theme, H, groundTop };
  C_ARRS.forEach((k) => (out[k] = []));
  DECOR.forEach((k) => (out[k] = []));
  out.gaps = [];
  // CHECKPOINTS at each seam: a long world restarting from tile 0 on every death
  // is unplayable (and the AI can't finish it). Respawn at the last seam crossed
  // instead. The seam rest-valley is flat safe ground — an ideal checkpoint.
  out.checkpoints = [];

  let off = 0;
  segments.forEach((L, si) => {
    const segStart = off;
    for (const k of C_ARRS) (L[k] || []).forEach((e) => {
      const n = { ...e };
      if (n.c != null) n.c += off;
      if (n.c0 != null) n.c0 += off;
      if (n.c1 != null) n.c1 += off;
      // movers: `to` is a COLUMN only for horizontal movers; vertical `to` is a row.
      if (k === 'movers' && n.dir === 'h' && n.to != null) n.to += off;
      out[k].push(n);
    });
    for (const k of DECOR) (L[k] || []).forEach((e) => out[k].push({ ...e, c: (e.c || 0) + off }));
    // A dense AERIAL section (≥3 gaps, e.g. a cloud level) is solvable standalone
    // because you enter it slow; but mid-world the frog arrives at full run and
    // mistimes the narrow cloud-to-cloud jumps. So for an interior aerial segment
    // we lay a CONTINUOUS ground floor under the whole span — the frog can always
    // walk through, and the cloud platforms (and their coins) stay above as an
    // optional overhead route. (Floors the voids UNDER clouds, not just between.)
    const aerial = floorAerial && si > 0 && (L.gaps || []).length >= 3;
    if (aerial) { for (let c = segStart; c < segStart + L.W; c++) for (let r = groundTop; r < H; r++) out.solids.push({ c, r }); }
    else (L.gaps || []).forEach(([a, b]) => out.gaps.push([a + off, b + off]));

    // spawn from the FIRST segment's start; flag at the LAST segment's goal
    if (si === 0) out.start = { ...L.start, c: L.start.c + off };
    if (si === segments.length - 1) out.goal = { ...L.goal, c: L.goal.c + off };

    off += L.W;
    // bridge the seam to the next segment with solid ground (a rest valley)
    if (si < segments.length - 1) {
      for (let c = off; c < off + rest; c++) for (let r = groundTop; r < H; r++) out.solids.push({ c, r });
      out.checkpoints.push(off + Math.floor(rest / 2));   // checkpoint at the seam's middle
      off += rest;
    }
  });
  out.W = off;
  return out;
}

// ── VERTICALIZER ──────────────────────────────────────────────────────────────
// Jazz is a more VERTICAL game than the frog's horizontal romp (see STORY.md:
// caverns/towers/fortress). This pass adds optional vertical set-pieces — stacked
// ONE-WAY platforms with carrot stacks — over long flat spans. One-ways are the
// safe choice: you jump UP THROUGH them from below, so the grounded 0-death
// autopilot (which never climbs them) passes underneath untouched, exactly like
// the hand-authored `sky()` coin routes. Pure additive reward verticality.
import { THEME_MATERIAL } from './materials.js';
export function verticalize(level, { every = 20, minSpan = 12 } = {}) {
  const { H, groundTop, W } = level;
  const mat = THEME_MATERIAL[level.theme] || 'wood';   // tower platforms read as this world
  // occupancy: which (c,r) cells are already taken (don't stack onto structure)
  const occ = new Set();
  const mark = (c, r) => occ.add(`${Math.round(c)},${Math.round(r)}`);
  (level.solids || []).forEach((s) => mark(s.c, s.r));
  (level.oneways || []).forEach((s) => mark(s.c, s.r));
  (level.pipes || []).forEach((p) => { for (let r = p.r; r < H; r++) { mark(p.c, r); mark(p.c + 1, r); } });
  (level.coins || []).forEach((c) => mark(c.c, c.r));
  // FLAT, OPEN columns only: the highest solid is exactly groundTop (so there's
  // NO stair/step/raised block above the floor here). Critical — a tower next to a
  // stair lets the grounded autopilot DROP onto the tower's aerial one-way (which
  // its navigation can't see) and stall. We only build over genuinely flat ground.
  const topSolid = {};
  (level.solids || []).forEach((s) => { if (topSolid[s.c] == null || s.r < topSolid[s.c]) topSolid[s.c] = s.r; });
  const floorCol = { has: (c) => topSolid[c] === groundTop };
  // keep clear of threats / moving parts / the seams' checkpoints / start & goal
  const avoid = new Set();
  const pad = (c, w = 3) => { for (let i = -w; i <= w; i++) avoid.add(Math.round(c) + i); };
  // wide clearance: the autopilot only JUMPS near threats/gaps — keep platforms far
  // from anything that triggers a jump, so the grounded AI never leaps onto one.
  ['enemies', 'movers', 'firebars', 'spouts', 'droppers', 'dashpads', 'bouncers', 'springs', 'crumbles', 'pipes']
    .forEach((k) => (level[k] || []).forEach((e) => { pad(e.c != null ? e.c : (e.c0 + e.c1) / 2, 7); }));
  (level.gaps || []).forEach(([a, b]) => { for (let c = a - 7; c <= b + 7; c++) avoid.add(c); });
  (level.checkpoints || []).forEach((c) => pad(c, 2));
  if (level.start) pad(level.start.c, 5);
  if (level.goal) pad(level.goal.c, 5);

  const freeCell = (c, r) => !occ.has(`${c},${r}`);
  const freeRun = (c0, n, r) => { for (let i = 0; i < n; i++) if (!freeCell(c0 + i, r)) return false; return true; };
  // a flat span is `minSpan` consecutive floor columns, none in the avoid set
  let added = 0;
  for (let c = 4; c < W - minSpan; c++) {
    let flat = true;
    // the span itself AND a 3-tile approach on each side must be flat & open, so the
    // autopilot can never walk/drop onto the tower from adjacent raised terrain.
    for (let i = -3; i < minSpan + 3; i++) { if (!floorCol.has(c + i) || avoid.has(c + i)) { flat = false; break; } }
    if (!flat) continue;
    const base = c + 2;                       // build a couple tiles in from the span edge
    // player-reachable tiers (low ≈ a single big jump up; high = step off the low
    // one). Lower now so the bigger jump clears them comfortably. The AI ignores
    // them (aerial → not in its solid set) and never jumps on this clearance-
    // padded flat span, so it strolls under — like the `sky()` routes.
    const lowR = groundTop - 3, highR = groundTop - 6;   // 3 & 6 tiles up (reachable)
    if (freeRun(base, 3, lowR) && freeRun(base, 3, lowR - 1)) {
      for (let i = 0; i < 3; i++) { level.oneways.push({ c: base + i, r: lowR, aerial: true, mat }); level.coins.push({ c: base + i, r: lowR - 1 }); mark(base + i, lowR); mark(base + i, lowR - 1); }
      // a taller second tier a bit further along, when there's room (a real climb)
      const hb = base + 4;
      if (hb + 3 < c + minSpan && freeRun(hb, 2, highR) && freeRun(hb, 2, highR - 1)) {
        for (let i = 0; i < 2; i++) { level.oneways.push({ c: hb + i, r: highR, aerial: true, mat }); mark(hb + i, highR); }
        // SHOOT+JUMP beat: a blast crate guards the top, with a carrot cache above
        // it — jump the tower, blast the crate, grab the reward. (Optional/aerial →
        // gate-safe: the no-fire autopilot just never climbs up here.)
        level.blastblocks.push({ c: hb, r: highR - 1 }); mark(hb, highR - 1);
        level.coins.push({ c: hb, r: highR - 2 }, { c: hb + 1, r: highR - 2 }, { c: hb + 1, r: highR - 1 });
        // every 3rd tower, a POWER-UP up top (the bunny's mushroom — now fixed)
        if (added % 3 === 2) { level.qblocks.push({ c: hb + 1, r: highR - 3, power: true }); }
      }
      // a NEW-TYPE ground bot patrolling the flat span (stompable; the shield-bot
      // also deflects front rockets so you stomp/dive it). Note #11 more enemies.
      level.enemies.push({ c: c - 1, r: groundTop - 1, kind: added % 2 ? 'spiderbot' : 'shieldbot' });
      added++;
      c += every;                              // space the set-pieces out
    }
  }
  level._verticalized = added;
  return level;
}

// ── ARC SHAPING ─────────────────────────────────────────────────────────────
// A merged level inherits each original's early NOVELTY hook, so interest opens
// hot and the climax can't read as "late". `shapeArc` calms the opening so
// interest starts low and builds toward the late set-pieces — a real rising arc.
// Strictly gate-SAFE: it only removes THREATS (enemies/hazards) and OPTIONAL
// REWARDS (?-blocks) from the opening band — never traversal aids. Dashpads,
// bouncers, springs and movers can be the only way across a gap, so removing
// them would strand the player; they stay. Ground/structure untouched.
//   calmCols: how many opening columns to gentle-ify (default ~8% of W, capped).
const THREATS = ['enemies', 'spouts', 'droppers', 'firebars', 'piranhas'];
const REWARDS = ['qblocks'];   // optional pickups — safe to thin; NOT dashpads/bouncers/springs
export function shapeArc(level, { calmFrac = 0.08, calmMax = 26 } = {}) {
  const calmCols = Math.min(calmMax, Math.round(level.W * calmFrac));
  const drop = (k) => { if (level[k]) level[k] = level[k].filter((e) => (e.c == null ? true : e.c >= calmCols)); };
  THREATS.forEach(drop);
  REWARDS.forEach(drop);
  return level;
}
