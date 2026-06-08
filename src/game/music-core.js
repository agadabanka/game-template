// ── Shared music composer (pure, no browser/node deps) ───────────────────
// One source of truth for the soundtrack, used by BOTH the live game
// (src/game/audio.js → Web Audio) and the offline recorder
// (tools/eval/synth-audio.mjs). Returns a list of notes whose START falls in
// [fromSec, toSec): { t, freq, dur, vol, type }.
//
// JAZZ score — recomposed for the bunny‑with‑a‑bazooka caper. Distinct from
// the‑platformer's gentle triangle pads: this is a CARTOON CAPER —
//   • a bright SQUARE‑wave "toon" lead (chiptune punch, not a soft pad),
//   • a bouncing WALKING bass (root → 3rd → 5th → 6th boogie),
//   • an off‑beat staccato COMP stab (the Saturday‑morning "ba‑doop" bounce),
//   • light SWING on the off‑beats,
//   • and a recurring HERO MOTIF so every world shares one signature tune.
// (Backport idea for the‑platformer: a single recurring motif gives a score an
//  identity; the frog's per‑mood phrases had no through‑line.)

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];   // bluesy major — the caper's home colour

// per biome: key root (Hz), scale, tempo, lead timbre, chord progression
// (scale-degree roots), the 2-bar melodic phrase, and a swing amount (0..0.4).
export const THEMES = {
  // base-level biomes (kept cartoon-bright for coherence with the campaign)
  day:     { root: 261.6, scale: MIXO,   bpm: 142, lead: 'square', prog: [0, 3, 4, 0], phrase: 'hero',   swing: 0.22 },
  sky:     { root: 329.6, scale: MAJOR,  bpm: 150, lead: 'square', prog: [0, 4, 5, 3], phrase: 'hero',   swing: 0.16 },
  castle:  { root: 196.0, scale: MINOR,  bpm: 132, lead: 'square', prog: [0, 4, 5, 4], phrase: 'villain',swing: 0.18 },
  snow:    { root: 293.7, scale: MAJOR,  bpm: 126, lead: 'square', prog: [0, 5, 3, 4], phrase: 'cruise', swing: 0.26 },
  jungle:  { root: 261.6, scale: MIXO,   bpm: 140, lead: 'square', prog: [0, 3, 4, 5], phrase: 'hero',   swing: 0.22 },
  swamp:   { root: 164.8, scale: DORIAN, bpm: 122, lead: 'square', prog: [0, 3, 5, 4], phrase: 'cruise', swing: 0.28 },
  crystal: { root: 277.2, scale: LYDIAN, bpm: 138, lead: 'square', prog: [0, 4, 1, 4], phrase: 'hero',   swing: 0.16 },
  bastion: { root: 146.8, scale: MINOR,  bpm: 140, lead: 'square', prog: [0, 5, 3, 4], phrase: 'finale', swing: 0.14 },
  // ── the 5 CAMPAIGN worlds (101–105) — each its own caper mood ─────────────
  cave:    { root: 196.0, scale: DORIAN, bpm: 138, lead: 'square', prog: [0, 5, 3, 4], phrase: 'hero',    swing: 0.24 }, // Carrot Caverns — sneaky-bright
  dusk:    { root: 220.0, scale: MIXO,   bpm: 122, lead: 'square', prog: [0, 3, 4, 5], phrase: 'cruise',  swing: 0.32 }, // Sunset Strip — laid-back swing
  desert:  { root: 233.1, scale: DORIAN, bpm: 132, lead: 'square', prog: [0, 6, 3, 4], phrase: 'western', swing: 0.26 }, // Dustbowl Dunes — twangy bounce
  volcano: { root: 207.6, scale: MINOR,  bpm: 152, lead: 'square', prog: [0, 5, 4, 5], phrase: 'villain', swing: 0.14 }, // Lava Lagoon — driving villain
  storm:   { root: 185.0, scale: MINOR,  bpm: 158, lead: 'square', prog: [0, 6, 5, 4], phrase: 'finale',  swing: 0.12 }, // Thunder Dome — heroic finale
};

// scale-degree → frequency (d can exceed the octave; negative goes down)
const mod7 = (d) => ((d % 7) + 7) % 7;
const deg = (cfg, d) => cfg.root * Math.pow(2, cfg.scale[mod7(d)] / 12) * Math.pow(2, Math.floor(d / 7));

// melodic phrases over 2 bars (each bar = 8 eighth-notes). Each step is
// [chord-tone-idx, durationInEighths]; TONE maps idx→scale-degree offset, or
// null = REST. Built to land on chord tones → always consonant.
const TONE = [0, 2, 4, 7, 9, 11];
const PHRASES = {
  // HERO — the Jazz signature: a bouncy, syncopated, leaps-then-lands hop. Recurs
  // across most worlds (transposed by key) so the whole score has one identity.
  hero:    [[[0, 1], [2, 1], [3, 2], [2, 1], [4, 1], [3, 2]], [[2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [0, 2]]],
  // CRUISE — laid-back, lots of space + a lazy turn (swing carries it).
  cruise:  [[[2, 2], [3, 1], [2, 1], [1, 2], [null, 2]],      [[1, 2], [2, 1], [3, 1], [0, 3], [null, 1]]],
  // WESTERN — a twangy, stepwise bounce (spaghetti-desert caper).
  western: [[[0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [3, 2]], [[2, 1], [1, 1], [0, 1], [1, 1], [2, 2], [0, 2]]],
  // VILLAIN — driving, restless, prowling 8ths (the Tin Tyrant's worlds).
  villain: [[[0, 1], [0, 1], [2, 1], [0, 1], [3, 1], [2, 1], [0, 2]], [[2, 1], [3, 1], [2, 1], [4, 1], [3, 1], [2, 1], [0, 2]]],
  // FINALE — triumphant, rising fanfare (the fortress assault).
  finale:  [[[0, 1], [2, 1], [4, 2], [3, 1], [4, 1], [5, 2]],  [[4, 1], [5, 1], [4, 2], [3, 1], [2, 1], [0, 2]]],
};

// notes whose START is in [fromSec, toSec)
export function schedule(theme, fromSec, toSec) {
  const cfg = THEMES[theme] || THEMES.day;
  const swing = cfg.swing || 0;
  const eighth = 30 / cfg.bpm, beat = eighth * 2, barLen = eighth * 8;
  const phr = PHRASES[cfg.phrase] || PHRASES.hero;
  const lead = cfg.lead || 'square';
  const out = [];
  const push = (t, freq, dur, vol, type) => { if (t >= fromSec && t < toSec) out.push({ t, freq, dur, vol, type }); };
  // swing the OFF-beat 8ths: an odd 8th-position starts a touch late + shortens.
  const swung = (e) => (e % 2 === 1 ? e * eighth + swing * eighth : e * eighth);
  const b0 = Math.max(0, Math.floor(fromSec / barLen) - 1), b1 = Math.ceil(toSec / barLen) + 1;
  for (let bar = b0; bar <= b1; bar++) {
    const t = bar * barLen, chord = cfg.prog[bar % cfg.prog.length];
    // WALKING / BOOGIE bass — root, 3rd, 5th, 6th across the four beats (the bounce)
    const walk = [0, 2, 4, 5];
    for (let bt = 0; bt < 4; bt++) push(t + bt * beat, deg(cfg, chord + walk[bt]) / 2, beat * 0.5, 0.11, 'triangle');
    // OFF-BEAT COMP STAB — a short square triad on the "and" of 2 and 4 (toon bounce)
    for (const off of [beat * 1.5, beat * 3.5]) {
      for (const o of [0, 2, 4]) push(t + off, deg(cfg, chord + o), eighth * 0.5, 0.045, 'square');
    }
    // a soft sustained pad under it all (keeps the harmony warm in the live mix)
    for (const o of [0, 2, 4]) push(t, deg(cfg, chord + o), barLen * 0.9, 0.022, 'triangle');
    // the SINGING LEAD (octave up), swung, with rests — the hero motif
    let e = 0;
    for (const [tone, dur] of phr[bar % 2]) {
      if (tone != null) push(t + swung(e), deg(cfg, chord + TONE[tone] + 7), dur * eighth * 0.88, 0.09, lead);
      e += dur;
    }
  }
  return out;
}
