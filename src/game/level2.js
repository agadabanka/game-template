// ZONE 2 — "Drift" (theme: belt). Outside the hull, in the asteroid field.
// SIGNATURE: crossing OPEN VACUUM by hopping a chain of floating asteroid islands
// under the long moon-hang, dodging a patrol drone. (Design note: the autopilot
// lands gap-jumps on FLOOR-LEVEL ground, so every asteroid is a solid island at
// floor height — raised ledges are reserved for optional coin caches over safe
// floor elsewhere. A drifting-mover ferry was prototyped but cut for the gate.)
//   introduce (two close islands) → develop (a big rock + a patrol drone) →
//   twist (a run of three quick islands) → resolve (a shelf + ascent to airlock).
import { levelKit } from './levelkit.js';

export function buildLevel2() {
  const W = 158, H = 15, groundTop = 13;
  const k = levelKit({ H, groundTop });
  const { ground, coinRow, coin, enemy, flyer, qblock } = k;
  const start = { c: 3, r: 11 };

  k.lowgrav(0, W - 1, 3, groundTop, 0.6);      // ambient float — the moon-hang

  // ── 1. INTRODUCE (0–37): launch pad → two close asteroid islands ──
  ground(0, 24);
  coinRow(8, 5, 11);
  qblock(16, 9, true); coin(16, 7);
  ground(28, 34); coinRow(29, 4, 11);          // asteroid A (vacuum 25–27)
  ground(38, 45); coinRow(39, 4, 11);          // asteroid B (vacuum 35–37)

  // ── 2. DEVELOP (46–80): a BIG rock with a patrol drone overhead + a stomp drone ──
  ground(49, 80);                              // vacuum 46–48 (3)
  flyer(54, 72, 'bat', 8);                     // a maintenance drone patrols overhead
  enemy(64, 12);                               // a grounded drone to stomp
  coinRow(51, 5, 11);

  // ── 3. TWIST (81–112): three quick islands across the belt ──
  // (A real drifting mover was prototyped here, but the 0-death autopilot can't
  //  reliably board a moving platform — it stalls at the void edge. Ridable rocks
  //  need a smarter autopilot than the ship gate allows, so the belt stays static.)
  ground(84, 90); coinRow(85, 4, 11);          // vacuum 81–83
  ground(94, 100); coinRow(95, 4, 11);         // vacuum 91–93
  ground(104, 112);                            // vacuum 101–103

  // ── 4. RESOLVE (113–157): a debris shelf, a drone, ascent to the airlock ──
  ground(116, 157);                            // vacuum 113–115 (3)
  enemy(126, 12);
  coinRow(119, 4, 10);
  k.stairUp(146, 5);
  const goal = { c: 154, baseR: 5 };

  const gaps = [[25, 27], [35, 37], [46, 48], [81, 83], [91, 93], [101, 103], [113, 115]];


  return {
    id: 2, name: 'Caverns', theme: 'cave',
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
