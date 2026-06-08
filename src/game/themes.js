// Biome table — the single source of truth for every level's look. Each theme is
// a palette + backdrop recipe + (optional) deadly hazard. Adding a new biome is
// ONE entry here: Boot bakes its ground/sky textures from it, Play reads its
// backdrop + hazard from it. That's how Levels 4–13 get 10 distinct looks
// without 10 hand-written code branches (see LEVEL_DESIGN.md §6).
//
// Fields:
//   groundTop / groundDirt : per-pixel recolor target for the floor tiles
//                            (null = use the base day tiles untinted). bakeTinted
//                            desaturates→pushes toward this hue (big hue moves OK).
//   sky   : 5 dithered top→bottom band colors for the baked sky (light→… or dark).
//   sun   : [x,y] to stamp a sun disc into the sky (omit = no sun).
//   back  : backdrop style Play draws — 'day' | 'cave' | 'sky' | 'hills' | 'rock'
//           | 'dunes' | 'storm'. 'cave' also encloses a ceiling.
//   backTint : tint for the parallax silhouette band(s).
//   hazard : fills this biome's pits with a deadly liquid/spikes instead of empty
//            air — 'lava' | 'acid' | 'sand' | 'spike' (null = an airy chasm).

export const BIOMES = {
  // ── existing World-1 biomes (unchanged look; now table-described) ──
  day:  { groundTop: null,     groundDirt: null,     back: 'day' },
  cave: { groundTop: 0x4f86c0, groundDirt: 0x3a5a8a, back: 'cave' },
  sky:  { groundTop: 0xeef3fb, groundDirt: 0xbcd0ee, back: 'sky' },

  // ── new biomes — World-1 finale + World 2 ──
  castle:  { groundTop: 0x9092a0, groundDirt: 0x55555f,
             sky: [0x201830, 0x2a2040, 0x342a4e, 0x40345c, 0x4c3c68],
             back: 'rock', backTint: 0x2a2038, hazard: 'lava' },
  dusk:    { groundTop: 0x9c7a64, groundDirt: 0x5e4038,
             sky: [0x3a1c38, 0x6a2f48, 0xa8484a, 0xe07e4c, 0xf6bd72], sun: [126, 30],
             back: 'hills', backTint: 0x7a3848, hazard: 'lava' },
  snow:    { groundTop: 0xeef4ff, groundDirt: 0xb6c6dc,
             sky: [0x6f8cb6, 0x90accd, 0xb0c8e2, 0xd2e0ee, 0xeef4fb],
             back: 'hills', backTint: 0xcadcec, hazard: null },
  desert:  { groundTop: 0xe6c878, groundDirt: 0xbf9648,
             sky: [0x4f8ec6, 0x7fb2d6, 0xb0d0e4, 0xe2d6a6, 0xf4e8bc], sun: [120, 24],
             back: 'dunes', backTint: 0xd8b86a, hazard: 'sand' },
  jungle:  { groundTop: 0x5f9c46, groundDirt: 0x375c28,
             sky: [0x244e34, 0x386e48, 0x53905c, 0x80b674, 0xb2d89e],
             back: 'hills', backTint: 0x2c5834, hazard: null },
  swamp:   { groundTop: 0x707c46, groundDirt: 0x40402a,
             sky: [0x26302a, 0x3c4a32, 0x586044, 0x747e56, 0x949e6a],
             back: 'hills', backTint: 0x394a30, hazard: 'acid' },
  volcano: { groundTop: 0x50403c, groundDirt: 0x281c1a,
             sky: [0x280f0c, 0x4a1c14, 0x70281a, 0x9c4222, 0xca6630],
             back: 'rock', backTint: 0x3a1813, hazard: 'lava' },
  crystal: { groundTop: 0x9c66d2, groundDirt: 0x543a8a,
             sky: [0x160a28, 0x221036, 0x30184c, 0x422262, 0x56307e],
             back: 'cave', backTint: 0x3a1e5a, hazard: 'spike' },
  storm:   { groundTop: 0x606a7c, groundDirt: 0x3a4150,
             sky: [0x171d2c, 0x232b3e, 0x333c52, 0x475068, 0x606a82],
             back: 'storm', backTint: 0x2a3142, hazard: null },
  bastion: { groundTop: 0x6e5a72, groundDirt: 0x382c3e,
             sky: [0x180c22, 0x261436, 0x381e4c, 0x4c2a62, 0x5e2f6e],
             back: 'rock', backTint: 0x2e1c38, hazard: 'lava' },

  // ── STARSWEEPER space biomes (one entry = one zone's whole look) ──
  // The float feel comes from per-level lowgrav zones (gate-safe); these palettes
  // do the seeing. Deep-space skies (near-black), cold hull metals, hot cores.
  hangar: { groundTop: 0x5a6678, groundDirt: 0x2c3242,   // wrecked docking bay — cold steel
            sky: [0x05060c, 0x0a0c18, 0x101426, 0x171d36, 0x202848],
            back: 'cave', backTint: 0x121a30, hazard: null },           // gaps = open vacuum
  belt:   { groundTop: 0x7a6e60, groundDirt: 0x40382e,   // asteroid field — rock + dust
            sky: [0x03040a, 0x080a16, 0x0e1226, 0x141a34, 0x1c2748],
            back: 'storm', backTint: 0x0e1430, hazard: null },          // the void
  vent:   { groundTop: 0x8a6e52, groundDirt: 0x4a3422,   // venting reactor shaft — hot brass
            sky: [0x140604, 0x270c08, 0x431510, 0x6a2418, 0x933018],
            back: 'cave', backTint: 0x2a120c, hazard: 'lava' },         // plasma vents
  cargo:  { groundTop: 0x4f7088, groundDirt: 0x263a4c,   // packed cargo bay — industrial blue
            sky: [0x04070e, 0x091420, 0x0f2030, 0x163044, 0x1e425c],
            back: 'cave', backTint: 0x102232, hazard: null },
  core:   { groundTop: 0x6a5074, groundDirt: 0x331f3e,   // reactor core — violet + plasma
            sky: [0x0a0410, 0x1a0a22, 0x2c123a, 0x451c58, 0x5a2470],
            back: 'rock', backTint: 0x24102e, hazard: 'lava' },
};

// Deadly pit fills. colors = 2–3 molten/liquid bands (top→down); surf = the bright
// surface line; spikes render as a metal sawtooth row instead of a liquid.
export const HAZARDS = {
  lava: { colors: [0xff8a24, 0xf25410, 0xb4280a], surf: 0xffd271 },
  acid: { colors: [0x9fe23e, 0x5fae28, 0x357a18], surf: 0xe6ff9a },
  sand: { colors: [0xe3c87e, 0xc9a655, 0xa07e38], surf: 0xf2e2a8 },
  spike:{ colors: [0x2a2e36, 0x1c2026],           surf: 0xb8c0cc, teeth: true },
};

export function biomeOf(theme) { return BIOMES[theme] || BIOMES.day; }
