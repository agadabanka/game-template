// ZONE 3 — "Vent" (theme: vent). The reactor venting shafts: hot brass + plasma.
// SIGNATURE: PLASMA pits (the theme fills each gap with deadly plasma instead of
// empty vacuum) crossed under the float, plus an optional UPDRAFT vent that lifts
// you to a high coin cache while the floor below stays a safe walk.
// (Design note: overhead laser BARS were cut here — under low-gravity the float
//  arc rises into a bar that would clear under normal gravity, so a firebar in a
//  lowgrav zone is not gate-safe. Plasma + drones carry the threat instead.)
//   introduce (a lone plasma pit) → develop (a drone gauntlet) → twist (a plasma
//   pit + the updraft high-route) → resolve (a guarded hall + ascent).
import { levelKit } from './levelkit.js';

export function buildLevel3() {
  const W = 152, H = 15, groundTop = 13;
  const k = levelKit({ H, groundTop });
  const { ground, ledge, stairUp, coinRow, coin, enemy, qblock } = k;
  const start = { c: 3, r: 11 };

  k.lowgrav(0, W - 1, 3, groundTop, 0.6);      // ambient float

  // ── 1. INTRODUCE (0–29): a lone PLASMA pit ──
  ground(0, 26);
  coinRow(7, 5, 11);
  qblock(15, 9, true); coin(15, 7);

  // ── 2. DEVELOP (30–60): a drone gauntlet on a flat shaft floor ──
  ground(30, 60);                              // plasma pit 27–29 (3)
  coinRow(32, 5, 11);
  enemy(42, 12); enemy(52, 12);

  // ── 3. TWIST (61–104): a plasma pit, then the UPDRAFT vent high-route ──
  ground(64, 104);                             // plasma pit 61–63 (3)
  // an optional vent column lifts you over a SAFE flat floor to a coin cache.
  k.updraft(84, 90, 4, 12, 1);
  ledge(85, 4, 7, 2); coinRow(85, 4, 5);       // the cache the vent reaches
  enemy(72, 12);
  coinRow(66, 4, 11);

  // ── 4. RESOLVE (105–151): a guarded hall + ascent to the next bulkhead ──
  ground(108, 151);                            // plasma pit 105–107 (3)
  enemy(118, 12); enemy(128, 12);
  coinRow(112, 4, 10);
  stairUp(140, 5);
  const goal = { c: 149, baseR: 5 };

  const gaps = [[27, 29], [61, 63], [105, 107]];


  return {
    id: 3, name: 'Skyway', theme: 'sky',
    W, H, groundTop,
    solids: k.solids, bricks: k.bricks, qblocks: k.qblocks, coins: k.coins,
    enemies: k.enemies, pipes: k.pipes, piranhas: k.piranhas,
    springs: k.springs, oneways: k.oneways, ices: k.ices, blastblocks: k.blastblocks,
    conveyors: k.conveyors, spouts: k.spouts, droppers: k.droppers, crumbles: k.crumbles,
    movers: k.movers, zones: k.zones, firebars: k.firebars, bouncers: k.bouncers,
    stickies: k.stickies, dashpads: k.dashpads,
    bushes: [], clouds: [], hills: [],
    ceiling: [], start, goal, gaps,
  };
}
