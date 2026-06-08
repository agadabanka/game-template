// ZONE 1 — "Cold Start" (theme: hangar). The wrecked docking bay of Hollow-9.
// SIGNATURE: the FLOAT. A gentle ambient low-gravity zone covers the whole bay, so
// every jump hangs — taught the Nintendo four-step way over safe debris gaps:
//   introduce (a lone short gap, wide landings) → develop (a step + one rogue drone)
//   → twist (the widest float jump) → resolve (a guarded hall + an ascent to the
//   escape hatch). No movers/updraft here — Zone 1 only has to make the float feel
//   good and read as "space." Vacuum gaps (no hazard fill) are the threat.
import { levelKit } from './levelkit.js';

export function buildLevel1() {
  const W = 146, H = 15, groundTop = 13, ceilRow = 2;
  const k = levelKit({ H, groundTop });
  const { ground, stairUp, coinRow, coin, enemy, qblock, brick } = k;
  const start = { c: 3, r: 11 };

  // enclosed hangar CEILING (rows 0..ceilRow) — opens to stars near the hatch.
  const ceiling = [];
  for (let c = 0; c < W; c++) for (let r = 0; r <= ceilRow; r++) ceiling.push({ c, r });

  // AMBIENT LOW-GRAVITY across the whole bay → the float. A field zone the
  // autopilot reads through (gate-safe by design); scale 0.62 = a clear moon-hang.
  k.lowgrav(0, W - 1, 3, groundTop, 0.62);

  // ── 1. INTRODUCE (0–22): a flat deck, coins arc the eye, one short debris gap ──
  ground(0, 22);
  coinRow(6, 5, 11);
  qblock(14, 9, true); coin(14, 7);            // a buffer mushroom before anything

  // ── 2. DEVELOP (26–60): a step up + a lone rogue DRONE on a flat runway ──
  ground(26, 60);                              // gap 23–25 (3) — first float jump
  coinRow(28, 4, 10);
  enemy(42, 12);                               // a drone to stomp, clean runway
  brick(48, 9); brick(49, 9); coin(48, 7);     // a low overhang to float beneath

  // ── 3. TWIST (64–96): the WIDEST float jump, wide safe landings either side ──
  ground(64, 96);                              // gap 61–63 (3)
  coinRow(66, 4, 10);
  qblock(72, 9); coin(72, 7);
  coinRow(98, 3, 9);                           // greed coins arc over the big gap

  // ── 4. RESOLVE (101–145): a guarded hall, then a stair ascent to the hatch ──
  ground(101, 145);                            // gap 97–100 (4) — the twist
  enemy(110, 12);
  coinRow(114, 4, 10);
  stairUp(126, 5);                             // ascend out toward the escape hatch
  const goal = { c: 138, baseR: 5 };

  const gaps = [[23, 25], [61, 63], [97, 100]];


  return {
    id: 1, name: 'First Steps', theme: 'day',
    W, H, groundTop, ceilRow,
    solids: k.solids, bricks: k.bricks, qblocks: k.qblocks, coins: k.coins,
    enemies: k.enemies, pipes: k.pipes, piranhas: k.piranhas,
    springs: k.springs, oneways: k.oneways, ices: k.ices, blastblocks: k.blastblocks,
    conveyors: k.conveyors, spouts: k.spouts, droppers: k.droppers, crumbles: k.crumbles,
    movers: k.movers, zones: k.zones, firebars: k.firebars, bouncers: k.bouncers,
    stickies: k.stickies, dashpads: k.dashpads,
    bushes: [], clouds: [], hills: [],
    ceiling, start, goal, gaps,
    ceilingOpenFrom: 122,                        // hull breach opens to stars at the hatch
  };
}
