// ZONE 4 — "Salvage" (theme: cargo). The packed cargo bay. SIGNATURE: the salvage
// BLASTER. Sealed debris panels (blastblocks) guard coin caches up on shelves —
// shoot them, then float up. A REPULSOR pad (spring) flings you to a high cache.
// All blast/spring beats sit OFF the flat ground path (the gate never shoots and
// strolls the floor), so they're pure player-reward verticality — Jazz's proven
// shoot+jump pattern, recast as salvage.
//   introduce (a lone blast-crate cache) → develop (a repulsor to a shelf) →
//   twist (a blast-wall + drones) → resolve (a guarded hall + ascent).
import { levelKit } from './levelkit.js';

export function buildLevel4() {
  const W = 150, H = 15, groundTop = 13;
  const k = levelKit({ H, groundTop });
  const { ground, ledge, stairUp, coinRow, coin, enemy, qblock, brick } = k;
  const start = { c: 3, r: 11 };

  k.lowgrav(0, W - 1, 3, groundTop, 0.6);      // ambient float

  // ── 1. INTRODUCE (0–34): a lone BLAST-CRATE cache up on a shelf ──
  ground(0, 34);
  coinRow(7, 5, 11);
  qblock(14, 9, true); coin(14, 7);
  ledge(22, 4, 8, 2); coinRow(22, 4, 6);       // a coin shelf…
  k.blastblock(22, 7); k.blastblock(23, 7);    // …sealed behind blast panels (shoot to open)
  enemy(30, 12);

  // ── 2. DEVELOP (35–70): a REPULSOR pad flings you to a high cache ──
  ground(38, 70);                              // gap 35–37 (3)
  k.spring(48, 12);                            // repulsor pad on the floor (optional launch)
  ledge(46, 4, 5, 2); coinRow(46, 4, 3);       // the cache it reaches
  coinRow(40, 4, 11);
  enemy(62, 12);

  // ── 3. TWIST (71–108): a BLAST-WALL cache between two drones ──
  ground(74, 108);                             // gap 71–73 (3)
  enemy(82, 12);
  ledge(90, 5, 8, 2); coinRow(90, 5, 6);
  k.blastwall(92, 7, 2);                       // a 2-high sealed wall guarding the cache
  coinRow(76, 4, 11);
  enemy(100, 12);

  // ── 4. RESOLVE (109–149): a guarded hall + ascent to the core lift ──
  ground(112, 149);                            // gap 109–111 (3)
  enemy(120, 12);
  brick(128, 9); brick(129, 9); coin(128, 7);
  stairUp(138, 5);
  const goal = { c: 147, baseR: 5 };

  const gaps = [[35, 37], [71, 73], [109, 111]];


  return {
    id: 4, name: 'The Keep', theme: 'castle',
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
