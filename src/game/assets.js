// Asset map for the Kenney "Pixel Platformer" CC0 pack (18px world tiles,
// 24px characters). Indices verified against labeled montages of the individual
// tile_XXXX.png files. We load individual PNGs (filename index = source of
// truth) — simplest and avoids atlas-frame math.
//
// License: CC0 1.0 (public domain) — Kenney.nl. Safe to ship.

export const SRC = 18;   // native world-tile px
export const CSRC = 24;  // native character px

// world tiles we use, by their tile_XXXX index
export const T = {
  groundTop: 0,     // grass-topped dirt (left/mid variants 0..3)
  groundTop2: 1,
  groundMid: 20,    // dirt fill
  groundMid2: 21,
  dirt: 24,         // plain dirt block
  qblock: 10,       // gold ? block
  qused: 31,        // emptied block
  brick: 12,        // red brick
  brick2: 13,
  bushS: 16,        // small bush
  bushM: 17,
  bushL: 18,
  grassTuft: 124,
  grassTuft2: 125,
  tree: 126,
  treeTall: 127,
  coinA: 151,       // round coin
  coinB: 152,       // slim coin (spin)
  flag: 111,        // flag on pole (red)
  flagPole: 110,    // pole segment
  poleTop: 109,
  pipeBox: 29,      // we tower these as a "pipe" pillar (clean look)
  heartFull: 44,
  heartHalf: 45,
  heartEmpty: 46,
  mushroom: 128,    // goomba-like enemy (also has feet baked in)
};

// digit font tiles 160..169 (white) and 170..179 (dark)
export const DIGIT0 = 160;

// hero character frames (Characters/tile_XXXX.png) — tan guy reads most "Mario"
export const HERO = {
  stand: 9,
  walkA: 9,
  walkB: 10,
  jump: 10,
};
// enemy character (frames 20/21 = angry box; we use world mushroom 128 instead)

export function tileKey(i) { return `t${i}`; }
export function charKey(i) { return `c${i}`; }

// Hero — "Jazz", a cartoon bunny with a bazooka (on-model, generated against the
// locked style sheet). Single-frame transparent PNGs (smooth cartoon, ~128px),
// keyed from magenta. Distinct from the-platformer's pixel frog by design.
export function preloadHero(scene) {
  const h = '/assets/hero';
  // 128x128 cells: jazz_run is a 6-frame run cycle (768x128); idle/jump/fall are 1 frame.
  ['idle', 'run', 'jump', 'fall'].forEach((n) => scene.load.spritesheet(`jazz_${n}`, `${h}/jazz_${n}.png`, { frameWidth: 128, frameHeight: 128 }));
}

// Enemies — the TIN TYRANT's BOT family. Cartoon villain robots generated on the
// locked Jazz model sheet (same bold-outline cartoon linework) but the OTHER side:
// rusty gunmetal chassis, red eyes. 8 distinct chassis (groundbot/rambot/pogobot/
// stackbot/domebot/dronebot/sawbot + the Tin Tyrant boss), 2-frame walk strips,
// chroma-keyed (see tools/eval/_keyenemies.mjs → frame boxes baked below).
// The engine maps these by KIND name (look only — the walker/flyer/boss BEHAVIOUR
// is set by the level builder). Each kind carries a `mech` — a behaviour that
// affects play (all kept 0-death). Several kinds reuse a chassis with a `tint` so
// biomes vary while the bot army stays coherent.
const BOT = {                                         // keyer output (fw/fh per art file)
  groundbot: { fw: 545, fh: 566 }, rambot: { fw: 587, fh: 591 }, pogobot: { fw: 443, fh: 698 },
  stackbot: { fw: 357, fh: 639 }, domebot: { fw: 500, fh: 621 }, dronebot: { fw: 617, fh: 428 },
  sawbot: { fw: 509, fh: 507 }, boss: { fw: 757, fh: 999 },
  shieldbot: { fw: 643, fh: 631 }, spiderbot: { fw: 617, fh: 572 },   // new types (note #11)
};
const E = (file, mech, tint) => ({ file, ...BOT[file], mech, ...(tint != null ? { tint } : {}) });
export const ENEMY_SPRITES = {
  goomba:   E('groundbot', 'plain'),                  // tracked roller — the teacher
  beetle:   E('rambot',    'charger'),                // ram-bot — rushes when aligned
  ghoul:    E('pogobot',   'hopper'),                 // pogo-bot — hops toward you
  snowman:  E('stackbot',  'splitter'),               // stack-bot — splits when stomped
  spider:   E('domebot',   'shell'),                  // dome-bot — stomp leaves a brief shell
  lavaslug: E('rambot',    'charger', 0xff8a5a),      // scorched ram-bot (volcano)
  bat:      E('dronebot',  'swooper'),                // quad-rotor drone
  bird:     E('dronebot',  'swooper', 0x9fc0ff),      // sky-blue drone
  buzzard:  E('sawbot',    'swooper', 0xd8c08a),      // brass saw-drone
  fly:      E('dronebot',  'swooper', 0xc8ff9f),      // green drone
  shard:    E('sawbot',    'swooper', 0x9fe8ff),      // frost saw-drone
  crow:     E('sawbot',    'swooper', 0x8a90b0),      // storm saw-drone
  shieldbot: E('shieldbot', 'shield'),                // SHIELD-bot — front-facing rockets DEFLECT; stomp/dive-slam it
  spiderbot: E('spiderbot', 'charger', 0x9fd0c0),     // SPIDER-bot — a fast scuttling charger
  boss:     E('boss',      'boss'),                   // THE TIN TYRANT — scaled up in-engine
};
export function preloadEnemies(scene) {
  for (const [kind, s] of Object.entries(ENEMY_SPRITES)) {
    scene.load.spritesheet(kind, `/assets/enemies/${s.file}.png`, { frameWidth: s.fw, frameHeight: s.fh });
  }
}

export function preload(scene) {
  const base = '/assets/kenney/pixel';
  preloadHero(scene);
  preloadEnemies(scene);
  const tiles = new Set();
  Object.values(T).forEach((i) => tiles.add(i));
  for (let d = 0; d < 20; d++) tiles.add(DIGIT0 + d); // digits
  // a few extra ground variants
  [2, 3, 22, 23].forEach((i) => tiles.add(i));
  tiles.forEach((i) => scene.load.image(tileKey(i), `${base}/Tiles/tile_${String(i).padStart(4, '0')}.png`));
  Object.values(HERO).forEach((i) => scene.load.image(charKey(i), `${base}/Tiles/Characters/tile_${String(i).padStart(4, '0')}.png`));
  // pixel-art background tiles (cohesion fix): clouds 8-11, hills/trees 12-15
  [8, 9, 10, 11, 12, 13, 14, 15].forEach((i) => scene.load.image(`bg${i}`, `${base}/Tiles/Backgrounds/tile_${String(i).padStart(4, '0')}.png`));
}
