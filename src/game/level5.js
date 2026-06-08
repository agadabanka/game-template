// ZONE 5 — "The Warden" (theme: core). The reactor core + the escape pod. The
// FINALE: no new verb — a mastery medley of the float, plasma pits, asteroid
// islands and a blast cache, then a confrontation with WARDEN (the boss) in the
// core, and the run to the escape pod (the goal). Reactor-violet, longer, climactic.
// (Firebars cut for the same lowgrav reason as Zone 3 — the boss is the climax.)
import { levelKit } from './levelkit.js';

export function buildLevel5() {
  const W = 164, H = 15, groundTop = 13;
  const k = levelKit({ H, groundTop });
  const { ground, ledge, stairUp, coinRow, coin, enemy, qblock, boss } = k;
  const start = { c: 3, r: 11 };

  k.lowgrav(0, W - 1, 3, groundTop, 0.6);      // ambient float

  // ── reprise FLOAT + PLASMA (0–64) ──
  ground(0, 30);
  coinRow(7, 5, 11);
  qblock(15, 9, true); coin(15, 7);
  ground(34, 64);                              // plasma pit 31–33
  enemy(50, 12);                               // a lone drone (clustered drones + float = unfair)
  coinRow(36, 5, 11);

  // ── reprise DRIFT + SALVAGE (65–108): an asteroid island + a blast cache ──
  ground(68, 74); coinRow(69, 4, 11);          // asteroid island (plasma pit 65–67)
  ground(78, 108);                             // plasma pit 75–77
  ledge(90, 4, 8, 2); coinRow(90, 4, 6);       // a final sealed cache, off the floor path
  k.blastblock(90, 7); k.blastblock(91, 7);
  enemy(100, 12);

  // ── CLIMAX (109–163): the WARDEN arena, then the escape pod ──
  ground(112, 163);                            // plasma pit 109–111
  enemy(126, 12);
  boss(140, groundTop - 1, 3);                 // WARDEN — the station AI's combat shell
  coinRow(118, 4, 10);
  const goal = { c: 159, baseR: groundTop - 1 }; // the escape pod, on the core floor

  const gaps = [[31, 33], [65, 67], [75, 77], [109, 111]];


  return {
    id: 5, name: 'Finale', theme: 'dusk',
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
