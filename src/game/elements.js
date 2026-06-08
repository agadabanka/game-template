// ─────────────────────────────────────────────────────────────────────────
// ELEMENT LIBRARY — the selectable, FEELING-mapped catalog of level elements.
//
// "Pick the feeling, get the elements." Every IMPLEMENTED element is mapped to:
//   feeling   — the MDA aesthetic it evokes (a key of FUN in design.js)
//   aesthetic — the felt experience in one phrase
//   interest  — its pull on the felt-interest curve (0-10), CALIBRATED from the
//               eval (FEEL_PLAYBOOK.md): structural/vertical verbs and threats
//               score high; loose coins barely move the needle. This is the bridge
//               from "what I place" to "how it will feel / score".
//   builder   — the levelkit() helper that lays it down
//   ai        — how the SHOWCASE autopilot interacts with it (debug.js)
//   note      — placement guidance / the law it must respect
//
// Authors (and future auto-tools) select by feeling — byFeeling('Challenge') — and
// the eval (feel.mjs) then verifies the realized curve. Aspirational elements not
// yet in the engine are listed with implemented:false so the gap is explicit.
// ─────────────────────────────────────────────────────────────────────────
import { FUN } from './design.js';

export const ELEMENT_LIBRARY = {
  // ── structure (the canvas; low intrinsic interest, high enabling value) ──
  ground:   { implemented: true, builder: 'ground',   feeling: 'Submission', aesthetic: 'solid footing / flow',            interest: 1, ai: 'walk',            note: 'The safety net. Continuous ground under springs/coins keeps detours 0-death.' },
  ledge:    { implemented: true, builder: 'ledge',     feeling: 'Expression', aesthetic: 'a perch to aim for',              interest: 4, ai: 'land-on',         note: 'Floating platform over air; adds relief. Keep open sky above for clean bounces.' },
  stairUp:  { implemented: true, builder: 'stairUp',   feeling: 'Challenge',  aesthetic: 'the ascent → triumph',           interest: 5, ai: 'hop-steps',       note: 'Rising steps = vertical relief. A tall ascent to the flag makes a strong LATE peak.' },
  stairDown:{ implemented: true, builder: 'stairDown', feeling: 'Sensation',  aesthetic: 'the rush downhill',              interest: 4, ai: 'hop-steps',       note: 'Descent; pairs with stairUp to form a mound/dune.' },

  // ── traversal verbs (the rhythm-changers; place where the arc is weak) ──
  gap:      { implemented: true, builder: 'gaps[]',    feeling: 'Challenge',  aesthetic: 'commitment / risk',              interest: 5, ai: 'leap',            note: 'The base verb. ≤3-4 wide; segregate from guards (LEVEL_DESIGN §4).' },
  spring:   { implemented: true, builder: 'spring',    feeling: 'Sensation',  aesthetic: 'exhilaration — flung skyward',   interest: 8, ai: 'ride+collect',    note: 'A VERTICAL verb in a horizontal level. On continuous ground, coins above = a verified-safe reward arc.' },
  oneway:   { implemented: true, builder: 'oneway',    feeling: 'Expression', aesthetic: 'choose your layer / route',       interest: 6, ai: 'land-on',         note: 'Land from above, jump up through from below — enables stacked routes (Triangularity).' },
  ice:      { implemented: true, builder: 'ice',       feeling: 'Challenge',  aesthetic: 'loss of control — momentum',     interest: 6, ai: 'walk-careful',    note: 'Low friction; place over CONTINUOUS ground (no pit right after) so a slide cannot overshoot into a fall.' },
  pipe:     { implemented: true, builder: 'pipe',      feeling: 'Challenge',  aesthetic: 'a wall to surmount',             interest: 5, ai: 'launch-clear',    note: 'Tall obstacle; needs a running launch. Give a flat runway before it.' },

  // ── rewards (greed; individually low interest — clusters > singles) ──
  coin:     { implemented: true, builder: 'coin',      feeling: 'Sensation',  aesthetic: 'greed / a lure',                 interest: 2, ai: 'grab',            note: 'Single coins are near-noise alone; arrange in ARCS/columns over springs so collecting them is an act.' },
  coinRow:  { implemented: true, builder: 'coinRow',   feeling: 'Sensation',  aesthetic: 'a trail to follow',              interest: 2, ai: 'grab',            note: 'Leads the eye rightward; the showcase AI hops safe ones. Filler if used as the only content.' },
  qblock:   { implemented: true, builder: 'qblock',    feeling: 'Reward',     aesthetic: 'mystery → payoff (mushroom)',    interest: 5, ai: 'bump',            note: 'power:true = the empowerment beat; reserve ONE and place it at a peak (e.g., atop a spring arc).' },
  brick:    { implemented: true, builder: 'brick',     feeling: 'Discovery',  aesthetic: 'a hidden route when big',        interest: 4, ai: 'none',            note: 'Smash-through route for the big frog; pairs with a power qblock.' },

  // ── timed / dynamic verbs (BATCH 1 — newly built; reuse the AI primitives) ──
  conveyor: { implemented: true, builder: 'conveyor', feeling: 'Expression', aesthetic: 'fight or ride the current',     interest: 6, ai: 'auto (push < accel)', note: 'Belt surface (dir ±1). Push < runAccel so the AI always wins. Over continuous ground only.' },
  spout:    { implemented: true, builder: 'spout',    feeling: 'Challenge',  aesthetic: 'time the burst',                interest: 8, ai: 'observe+dash',     note: 'Periodic floor flame. Needs a LONG GROUNDED runway before it (no gap/enemy leap landing on it) — the AI stands off, learns the cycle, dashes a dormant window.' },
  dropper:  { implemented: true, builder: 'dropper',  feeling: 'Challenge',  aesthetic: 'pass between the drops',        interest: 8, ai: 'observe+dash',     note: 'Periodic ceiling rockfall. Same grounded-runway rule + AI standoff as the spout.' },
  crumble:  { implemented: true, builder: 'crumble',  feeling: 'Challenge',  aesthetic: 'the floor betrays you',         interest: 7, ai: 'leap/cross-fast',  note: 'Collapses ~0.6s after touch (decay primitive). Over a leapable gap (AI leaps; a lingering player drops) or over ground (safe).' },

  // ── adversaries (one distinct kind per level + a boss; see FEEL_PLAYBOOK) ──
  walker:   { implemented: true, builder: "enemy(c,r,'kind')", feeling: 'Challenge', aesthetic: 'threat → mastery (stomp)', interest: 6, ai: 'stomp/clear', note: 'Stompable ground patroller. Kinds: goomba/beetle/spider(fast)/ghoul/snowman/lavaslug(slow). Keep off pit edges.' },
  flyer:    { implemented: true, builder: "flyer(c0,c1,'kind',r)", feeling: 'Challenge', aesthetic: 'an overhead threat you duck under', interest: 6, ai: 'passes under', note: 'Deadly high patroller (bat/bird/buzzard/fly/shard/crow). Place at row ≤7 (above max jump) and off spring columns → AI-safe over anything.' },
  boss:     { implemented: true, builder: 'boss(c)',  feeling: 'Challenge',  aesthetic: 'the climactic duel',            interest: 9, ai: 'multi-stomp', note: 'L13 finale: big multi-HP brute that gates the exit behind a wall it drops on death. Reels (harmless) between hits. Flat enemy-free arena.' },
  piranha:  { implemented: true, builder: 'pipe(.,.,true)', feeling: 'Challenge', aesthetic: 'patience — timing the gap',  interest: 7, ai: 'time-the-gap',    note: 'Pipe plant on a cycle; ONE per stretch with a long runway (never L2 back-to-back).' },

  // ── physics fields & pads (BATCH 2 — newly built; all AI-TRANSPARENT helpers) ──
  // LAW for every field below: it changes the frog's traversal SPEED/ARC, which
  // shifts the phase of any DOWNSTREAM periodic hazard (piranha/spout/dropper). So
  // place fields over SAFE ground with NO timed hazard between them and the goal —
  // or in a timed-hazard-free level. (Learned from L9: a buoyancy pool upstream of a
  // piranha desynced its cycle.) None of them trap, so the autopilot reads through.
  dashpad:  { implemented: true, builder: 'dashpad(c0,c1,dir)', feeling: 'Sensation',  aesthetic: 'turbo launch — speed!',      interest: 8, ai: 'auto (runs faster)',  note: 'Floor strip → one-shot burst to ~1.45× run speed (capped, lands safe). Over CONTINUOUS flat ground only (a launch must not carry into a pit).' },
  wind:     { implemented: true, builder: 'wind(c0,c1,r0,r1,dir)', feeling: 'Expression', aesthetic: 'lean into the current',   interest: 6, ai: 'auto (push < accel)', note: 'A horizontal air current (region). Push < runAccel so the frog wins. Place WITH travel (dir +1) over safe ground.' },
  updraft:  { implemented: true, builder: 'updraft(c0,c1,r0,r1)', feeling: 'Sensation', aesthetic: 'caught on a thermal',       interest: 7, ai: 'auto (gentle lift)',  note: 'An upward FAN column (counter-gravity, capped). Place over a climb/flat you make anyway; never over a gap the AI must precisely clear.' },
  lowgrav:  { implemented: true, builder: 'lowgrav(c0,c1,r0,r1)', feeling: 'Sensation', aesthetic: 'moon-jump float',           interest: 7, ai: 'auto (floaty jumps)', note: 'A bubble that scales gravity down. Over flat solid ground (the float carries jumps higher — keep pit edges clear).' },
  water:    { implemented: true, builder: 'water(c0,c1,r0,r1)', feeling: 'Discovery',  aesthetic: 'sink slow, swim up',         interest: 7, ai: 'auto (buoyant)',      note: 'A buoyant pool: capped sink + repeatable swim-strokes. Over solid ground, fenced from chasm edges so the slow sink always lands safe.' },
  sticky:   { implemented: true, builder: 'sticky(c0,c1,r)', feeling: 'Challenge',  aesthetic: 'trudge through the mud',     interest: 6, ai: 'auto (slower)',       note: 'A mud surface (inverse of ice): capped top speed + heavy drag. Over continuous ground; do NOT place right before a gap that needs run-up speed.' },

  // ── BATCH 3 — kinematics & a rotating hazard (newly built) ──────────────
  bounceTile:   { implemented: true, builder: 'bouncer(c0,c1,r)', feeling: 'Sensation', aesthetic: 'auto-bounce floor', interest: 6, ai: 'auto (rides arcs)', note: 'A trampoline floor — landing auto-flings you (a low permanent spring). Surface tag; over a continuous flat safety net. The AI handles spring-style arcs.' },
  fireBar:      { implemented: true, builder: 'firebar(c,len,up)', feeling: 'Challenge', aesthetic: 'don’t leap into the wheel of fire', interest: 8, ai: 'passes under (overhead)', note: 'A rotating bar of fireballs. A floor-reaching bar is a WIDE hazard the narrow standoff can’t cross — so mount it OVERHEAD (up=5+, lowest sweep ≥2 tiles up): the grounded AI strolls under (flyer-rule, §8), a JUMPING player must dodge. Keep coins/gaps/enemies from under it (they bait an AI jump into it).' },
  movPlatformH: { implemented: true, builder: 'mover(c0,r0,{dir:\'h\',to,w,speed})', feeling: 'Challenge', aesthetic: 'ride the moving island', interest: 8, ai: 'riderAI (board/ride/hop-off)', note: 'A horizontal kinematic ferry that CARRIES the frog (deterministic on the frame counter). Can now GATE a level: over a too-wide (≥5) gap with banks flush to the deck and a dwell at each extreme, the autopilot waits, boards, rides idle, and steps off (L1). Dwell≥40 frames gives a safe boarding window.' },
  movPlatformV: { implemented: true, builder: 'mover(c0,r0,{dir:\'v\',to,w,speed})', feeling: 'Discovery', aesthetic: 'the lift into the unknown', interest: 7, ai: 'riderAI (same branch)', note: 'A vertical lift carrying the frog up/down — same riderAI branch (board on an unjumpable wall, ride, step off when the exit ledge arrives). Currently placed as overhead coin enrichment in L1; a required lift-shaft uses the identical code.' },
  riderAI:      { implemented: true, feeling: 'Challenge', aesthetic: 'the autopilot rides the ferry', interest: 8, note: 'The autopilot board→ride→hop-off branch (debug.js, gated on movers.length so the other 12 levels are untouched). Board only when the deck is FLUSH with the brink; ride IDLE (let carry hold you — chasing the deck centre with run momentum slingshots you off); hop off when static ground is ≤2 tiles ahead at foot level.' },
};

// Selection by feeling — "I want this stretch to feel X, what can I place?"
export const FEELINGS = Object.keys(FUN);
export function byFeeling(feeling) {
  return Object.entries(ELEMENT_LIBRARY)
    .filter(([, e]) => e.implemented && e.feeling === feeling)
    .sort((a, b) => b[1].interest - a[1].interest)
    .map(([k, e]) => ({ key: k, ...e }));
}
// The verbs worth reaching for when a stretch is flat (highest interest, implemented).
export function highInterestVerbs() {
  return Object.entries(ELEMENT_LIBRARY)
    .filter(([, e]) => e.implemented && e.interest >= 6)
    .sort((a, b) => b[1].interest - a[1].interest)
    .map(([k, e]) => ({ key: k, feeling: e.feeling, interest: e.interest, aesthetic: e.aesthetic }));
}
