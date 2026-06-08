// Shared level-authoring toolkit. A builder calls `levelKit()` for fresh tile
// arrays + helpers, lays out the level by calling helpers, then returns the
// arrays in its level object. Keeps levels 3+ mostly data (see LEVEL_DESIGN.md).
export function levelKit({ H = 15, groundTop = 13 } = {}) {
  const solids = [], bricks = [], qblocks = [], coins = [], enemies = [], pipes = [], piranhas = [], ceiling = [], springs = [], oneways = [], ices = [];
  const conveyors = [], spouts = [], droppers = [], crumbles = [], dashpads = [], zones = [], stickies = [];
  const firebars = [], bouncers = [], movers = [], blastblocks = [];
  const baseStep = groundTop - 1;   // a step/stair "base" sits one row above the floor

  return {
    solids, bricks, qblocks, coins, enemies, pipes, piranhas, ceiling, springs, oneways, ices,
    conveyors, spouts, droppers, crumbles, dashpads, zones, stickies, firebars, bouncers, movers, blastblocks,

    // a BLAST CRATE at (c,r): a destructible block you can only clear with the
    // BAZOOKA (Jazz's shoot verb). Solid to the player; a rocket pops it. Used to
    // GUARD reward caches up on platforms (shoot it, then jump up) — Jazz's
    // signature shoot+jump beat. Kept OFF the grounded autopilot's ground path so
    // the 0-death gate (which never fires) is unaffected.
    blastblock: (c, r) => blastblocks.push({ c, r }),
    // a vertical stack of n crates from row rTop down (a destructible wall to blast)
    blastwall: (c, rTop, n = 2) => { for (let i = 0; i < n; i++) blastblocks.push({ c, r: rTop + i }); },

    // a FIRE BAR at column c: a bar of fireballs pivoted `up` tiles above the floor,
    // rotating on a cycle (deadly on contact). Mounted OVERHEAD by default (up=5,
    // len=2 → its lowest sweep stays ~2 tiles above the floor) so the grounded
    // autopilot strolls under it like a flyer, while a JUMPING player must not leap
    // into it. Keep it over flat ground with NO coin/gap/enemy under it that would
    // bait a jump. (A floor-reaching bar is a wide hazard the narrow standoff can't
    // cross — keep the lowest point ≥2 tiles up so `overhead` stays true.)
    firebar: (c, len = 2, up = 5, phase = 0) => firebars.push({ c, len, up, phase }),

    // a BOUNCE TILE strip (cols c0..c1 at row r): an auto-trampoline floor — landing on
    // it flings you up (a permanent low spring). Surface tag; place over CONTINUOUS
    // flat ground (a safety net) so the repeating bounce always lands safe.
    bouncer: (c0, c1, r = groundTop) => { for (let c = c0; c <= c1; c++) bouncers.push({ c, r }); },

    // a MOVING PLATFORM: a kinematic ledge `w` tiles wide that patrols between two
    // points and CARRIES the frog. dir 'h' (horizontal c0→c1 at row r) or 'v' (vertical
    // r0→r1 at col c0). Travels at `speed` px/s. The AI boards when it arrives and rides.
    mover: (c0, r0, { dir = 'h', to = c0 + 4, w = 3, speed = 90, phase = 0 } = {}) =>
      movers.push({ c0, r0, dir, to, w, speed, phase }),

    // a STICKY / MUD surface (cols c0..c1 at row r): the inverse of ice — high drag,
    // capped top speed (you trudge). Spatial for the AI (just slower); place over
    // continuous ground. The opposite pole of the ice/slick family.
    sticky: (c0, c1, r = groundTop) => { for (let c = c0; c <= c1; c++) stickies.push({ c, r }); },

    // ── FIELD ZONES (new physics): rectangular regions of cols c0..c1 × rows r0..r1
    // that modify movement while the frog is inside. All are "helpers/feel" fields —
    // they never trap, so the deterministic autopilot reads through them. Types:
    //   wind    — a steady horizontal air current (dir ±1). Pushes in the air; place
    //             with travel (dir +1) over safe ground so it speeds, never strands.
    //   updraft — an upward FAN column: gentle lift (caps your rise). Place over a
    //             climb you'd make anyway; it eases the ascent, never forces a fall.
    //   lowgrav — a floaty bubble: gravity scaled down (moon jump). Over flat ground.
    //   water   — a buoyant pool: slow sink + weak repeating swim-strokes. Over ground.
    zone: (type, c0, c1, r0, r1, opts = {}) => { zones.push({ type, c0, c1, r0, r1, ...opts }); },
    wind: (c0, c1, r0, r1, dir = 1, strength = 1) => zones.push({ type: 'wind', c0, c1, r0, r1, dir, strength }),
    updraft: (c0, c1, r0, r1, strength = 1) => zones.push({ type: 'updraft', c0, c1, r0, r1, strength }),
    lowgrav: (c0, c1, r0, r1, scale = 0.5) => zones.push({ type: 'lowgrav', c0, c1, r0, r1, scale }),
    water: (c0, c1, r0, r1) => zones.push({ type: 'water', c0, c1, r0, r1 }),

    // a DASH PAD strip (cols c0..c1 at row r): launches you along dir at turbo speed
    // (a one-shot burst, capped so it lands safe). Place over continuous flat ground.
    dashpad: (c0, c1, dir = 1, r = groundTop) => { for (let c = c0; c <= c1; c++) dashpads.push({ c, r, dir }); },

    // a CONVEYOR surface (cols c0..c1 at row r): the belt pushes you dir (+1 right,
    // -1 left). Push < run accel, so the frog always wins — fight or ride. Place
    // over continuous ground (a slide must not carry into a pit).
    conveyor: (c0, c1, dir = 1, r = groundTop) => { for (let c = c0; c <= c1; c++) conveyors.push({ c, r, dir }); },
    // a FIRE SPOUT at column c: erupts upward on a cycle, deadly while up. The AI
    // reads its phase and waits in a safe cell, then dashes — generous dormant window.
    spout: (c, phase = 0) => spouts.push({ c, r: groundTop - 1, phase }),
    // a FALLING ROCK dropper at column c: a rock drops from the ceiling on a cycle,
    // deadly while falling; pass between drops. Same periodic-column AI handling.
    dropper: (c, phase = 0) => droppers.push({ c, phase }),
    // a CRUMBLING platform tile at (c,r): collapses ~0.6s after you land. Lay short
    // runs (≤3) over SOLID ground so a late frog drops one tile, never into a pit.
    crumble: (c0, n, r) => { for (let i = 0; i < n; i++) crumbles.push({ c: c0 + i, r }); },

    // a spring/bounce pad standing on top of row r (its plate is what you land on)
    spring: (c, r = groundTop - 1) => springs.push({ c, r }),

    // a one-way platform: n tiles wide at row r — land on it from above, jump up
    // through it from below. (Spatial for the AI: approached like a normal ledge.)
    oneway: (c0, n, r) => { for (let i = 0; i < n; i++) oneways.push({ c: c0 + i, r }); },

    // mark an existing ground SURFACE (cols c0..c1 at row r) as ICY — low friction,
    // you slide. Spatial for the AI; place over continuous ground (no pit right
    // after) so a slide can't overshoot into a fall.
    ice: (c0, c1, r = groundTop) => { for (let c = c0; c <= c1; c++) ices.push({ c, r }); },

    // a run of solid FLOOR from col c0..c1 (inclusive), filled rTop..bottom.
    // `mat` (optional) themes the surface to a MATERIAL (grass/stone/metal/lava/
    // wood/sand) — look + footing + AI-grounding travel with the tile (materials.js).
    ground: (c0, c1, rTop = groundTop, mat) => { for (let c = c0; c <= c1; c++) for (let r = rTop; r < H; r++) solids.push(mat ? { c, r, mat } : { c, r }); },
    // a FLOATING platform: n tiles wide at top row rTop, `thick` rows deep (void below)
    ledge: (c0, n, rTop, thick = 2, mat) => { for (let i = 0; i < n; i++) for (let r = rTop; r < rTop + thick; r++) solids.push(mat ? { c: c0 + i, r, mat } : { c: c0 + i, r }); },
    // a themed PLATFORM — sugar for a material'd ledge (e.g. platform(10,4,8,'metal'))
    platform: (c0, n, rTop, mat = 'stone', thick = 2) => { for (let i = 0; i < n; i++) for (let r = rTop; r < rTop + thick; r++) solids.push({ c: c0 + i, r, mat }); },
    // ascending / descending staircases (each step 1 taller), sitting on the floor
    stairUp: (c0, n, baseR = baseStep) => { for (let i = 0; i < n; i++) for (let r = baseR - i; r <= baseR; r++) solids.push({ c: c0 + i, r }); },
    stairDown: (c0, n, baseR = baseStep) => { for (let i = 0; i < n; i++) for (let r = baseR - (n - 1 - i); r <= baseR; r++) solids.push({ c: c0 + i, r }); },

    coinRow: (c0, n, r) => { for (let i = 0; i < n; i++) coins.push({ c: c0 + i, r }); },
    coin: (c, r) => coins.push({ c, r }),
    // A ground WALKER (stompable): kind picks the look/speed (goomba, beetle, ghoul,
    // snowman, spider, lavaslug). enemy(c, r, 'beetle').
    enemy: (c, r, kind = 'goomba') => enemies.push({ c, r, kind }),
    // A high-flying enemy (deadly on contact, but the autopilot passes safely under
    // it): patrols between c0..c1 at row r (keep r ≤ 9 so it clears the grounded frog,
    // and over CLEAR flat ground with no gap/coin-hop in range). flyer(c0,c1,'bat',r).
    flyer: (c0, c1, kind = 'bat', r = 8) => enemies.push({ c: (c0 + c1) / 2, r, kind, fly: true, c0, c1 }),
    // The BOSS (L13): a big multi-hit enemy that GATES the exit — defeated by N stomps.
    boss: (c, r = groundTop - 1, hp = 3) => enemies.push({ c, r, kind: 'boss', hp, boss: true }),
    qblock: (c, r, power = false) => qblocks.push({ c, r, power }),
    brick: (c, r) => bricks.push({ c, r }),
    // a pipe (2 wide, height h) optionally guarded by a piranha that times in/out
    pipe: (c, h, withPiranha = false) => { pipes.push({ c, r: groundTop - h, h }); if (withPiranha) piranhas.push({ c: c + 0.5, topR: groundTop - h }); },
  };
}
