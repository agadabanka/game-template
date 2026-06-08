// ─────────────────────────────────────────────────────────────────────────
// DESIGN LENS — the editable design intent for all 13 levels, viewable at
// /design.html. This is the bridge between game-design THEORY and the level
// data: it records each level's MDA (Mechanics → Dynamics → Aesthetics), the
// Jesse Schell LENSES we designed it through, its INTEREST CURVE, and the new
// ELEMENTS / ADVERSARIES it introduces. Edit this (or via /design) to steer the
// redesign; the level builders are then implemented to match.
//
// Grounded in: Hunicke/LeBlanc/Zubek, "MDA: A Formal Approach to Game Design"
// (2004); Jesse Schell, "The Art of Game Design: A Book of Lenses" (2nd ed.).
// ─────────────────────────────────────────────────────────────────────────

// The 8 kinds of fun (MDA "Aesthetics") — the feelings a level should evoke.
export const FUN = {
  Sensation: 'Game as sense-pleasure — juicy jumps, coins, particles, sound.',
  Fantasy:   'Game as make-believe — you ARE the frog questing across kingdoms.',
  Narrative: 'Game as unfolding drama — the campaign’s rising journey.',
  Challenge: 'Game as obstacle course — the heart of a platformer.',
  Fellowship:'Game as social framework — the shared playlist / annotations.',
  Discovery: 'Game as uncharted territory — new biomes, secrets, mechanics.',
  Expression:'Game as self-expression — your route, speed-vs-greed style.',
  Submission:'Game as pastime — the easy pick-up-and-play flow / rhythm.',
};

// Schell's lenses we actually design with (number + the question it asks).
// (numbering follows Schell's 2nd-edition 100-lens Table of Lenses)
export const LENSES = {
  essence:   { n: 1,  name: 'Essential Experience', q: 'What experience must this level deliver, and is it present in every beat — not just the mechanics, but the feeling?' },
  surprise:  { n: 2,  name: 'Surprise',             q: 'What will genuinely surprise the player here? Do the rules let players surprise themselves?' },
  fun:       { n: 3,  name: 'Fun',                  q: 'Which parts are fun, and how could each part be MORE fun without adding clutter?' },
  curiosity: { n: 4,  name: 'Curiosity',            q: 'What question does this level plant in the player’s mind that pulls them forward?' },
  endogenous:{ n: 5,  name: 'Endogenous Value',     q: 'Do the coins / power-ups / goal feel valuable *because of this world’s* stakes — enough to justify the risk?' },
  problem:   { n: 6,  name: 'Problem Solving',      q: 'What problems does this level ask the player to solve? Is there more than one solution?' },
  tetrad:    { n: 7,  name: 'Elemental Tetrad',     q: 'Are Mechanics, Story, Aesthetics & Technology all pulling toward one theme?' },
  unify:     { n: 16, name: 'Unification',          q: 'Does every element of the level serve one clear theme?' },
  flow:      { n: 18, name: 'Flow',                 q: 'Clear goal? Direct feedback? A steady stream of not-too-easy, not-too-hard challenges as skill grows?' },
  emergence: { n: 23, name: 'Emergence',            q: 'How many verbs × how many objects each acts on? Do simple rules combine into richer situations?' },
  goals:     { n: 25, name: 'Goals',                q: 'Is the goal clear, concrete, achievable and rewarding? Good mix of short- and long-term goals?' },
  skill:     { n: 27, name: 'Skill',                q: 'What real skills does this level exercise (timing, precision, reading-ahead)? Can the player improve?' },
  challenge: { n: 31, name: 'Challenge',            q: 'Right difficulty? Enough VARIETY of challenge? Does it ramp as the player succeeds and peak before the flag?' },
  choices:   { n: 32, name: 'Meaningful Choices',   q: 'Real choices (not an obvious-best or arbitrary)? Is the number of choices right?' },
  triangle:  { n: 33, name: 'Triangularity',        q: 'Is there a safe-low-reward vs risky-high-reward fork, with rewards commensurate to the risk?' },
  reward:    { n: 40, name: 'Reward',               q: 'What does the level reward? Are rewards exciting, understood, and building over time (not too predictable)?' },
  punish:    { n: 41, name: 'Punishment',           q: 'Is failure fair, legible, and a quick retry — never cheap? Are punishments balanced by rewards?' },
  puzzle:    { n: 52, name: 'The Puzzle',           q: 'What is the level’s core puzzle? Does solving it give a satisfying “aha”?' },
  juice:     { n: 58, name: 'Juiciness',            q: 'Is the level bursting with feedback — does every jump, bounce and hit get a satisfying response?' },
  interest:  { n: 61, name: 'Interest Curve',       q: 'Does interest hook early (B), rise with peaks/valleys (C–F), and climax just before the end (G)?' },
  inherent:  { n: 62, name: 'Inherent Interest',    q: 'Which moments are inherently gripping (risk, spectacle, novelty) vs filler?' },
  beauty:    { n: 63, name: 'Beauty',               q: 'Is the biome beautiful and cohesive enough to be its own reward?' },
};

// ── ELEMENT / MECHANIC catalog. ai: how the AI autopilot copes —
//   'spatial'  = AI already handles it (a re-skinned gap/wall/enemy): no driver work.
//   'timed'    = a moving/cyclic element the autopilot must be TAUGHT to read & time.
//   'stateful' = needs new world state (keys/switches) + AI planning.
export const ELEMENTS = {
  // ── JAZZ identity: the two verbs are JUMP + SHOOT ──────────────────────────
  bazooka:    { name: 'Bazooka (FIRE)',     ai: 'stateful', note: "Jazz's 2nd verb — fire rockets to blast Tin-Tyrant bots, pop piranhas, chip the boss, and clear blast-crates." },
  blastCrate: { name: 'Blast crate',        ai: 'stateful', note: 'A shoot-ONLY crate guarding a reward cache atop a platform — blast it, then jump in. The signature shoot+jump beat.' },
  precJump:   { name: 'Precision jump',     ai: 'spatial', note: 'Springier + floatier jump (apex-hang + coyote/buffer) — tuned to line up a mid-air shot and reach the vertical towers.' },
  vertTower:  { name: 'Vertical tower',     ai: 'spatial', note: 'Stacked one-way carrot platforms (lower + reachable) — climb for the cache; the AI strolls under.' },
  material:   { name: 'Material platforms', ai: 'spatial', note: 'Grass/stone/metal/lava/wood/sand surfaces — each its own look + footing (metal is slick); the Tyrant builds in metal.' },
  // already in the game
  gap:        { name: 'Gap / pit',          ai: 'spatial', note: 'Jump it. The base verb.' },
  pipe:       { name: 'Pipe / wall',        ai: 'spatial', note: 'Clear with a running launch.' },
  hazardPit:  { name: 'Lava/acid/spike pit',ai: 'spatial', note: 'A re-skinned deadly pit.' },
  ledge:      { name: 'Floating ledge',     ai: 'spatial', note: 'Land on a wide platform over air.' },
  stair:      { name: 'Staircase',          ai: 'spatial', note: 'Chain of 1-tile steps.' },
  qblock:     { name: '? block / mushroom', ai: 'spatial', note: 'Hit-buffer power-up.' },
  brick:      { name: 'Breakable brick',    ai: 'spatial', note: 'Smash route when big.' },
  // NEW — timed (need driver work, high variety)
  movPlatformH:{ name: 'Moving platform (H)', ai: 'timed', note: 'Rideable horizontal lift across a chasm — match its phase, ride, hop off.' },
  movPlatformV:{ name: 'Moving platform (V)', ai: 'timed', note: 'Vertical lift up/down a shaft — board at the bottom, ride up.' },
  crumbling:  { name: 'Crumbling platform', ai: 'timed', note: 'Collapses ~0.4s after you land — keep moving, never linger.' },
  spring:     { name: 'Spring / bounce pad',ai: 'timed', note: 'Launches you far higher than a jump — use to reach a high shelf.' },
  fireBar:    { name: 'Fire bar (rotating)',ai: 'timed', note: 'Rotating flame; wait for the gap, then dash through (piranha-style standoff).' },
  risingHazard:{name: 'Rising lava/water',  ai: 'timed', note: 'A floor of death rises — the level becomes a race upward.' },
  conveyor:   { name: 'Conveyor / current', ai: 'timed', note: 'Belt pushes you along; fight or ride it.' },
  fallingRock:{ name: 'Falling rock',       ai: 'timed', note: 'Drops from the ceiling on a cycle; pass under between drops.' },
  wind:       { name: 'Wind gust',          ai: 'timed', note: 'Periodic horizontal push that bends your jump arc.' },
  // NEW — stateful (need world state + planning)
  switchBlock:{ name: 'Switch + toggle blocks', ai: 'stateful', note: 'Hit a switch to turn a wall of blocks on/off, opening a path.' },
  keyDoor:    { name: 'Key + locked gate',  ai: 'stateful', note: 'Fetch a key (off the main line) to open the gate to the flag.' },
  pushBlock:  { name: 'Pushable block',     ai: 'stateful', note: 'Shove a block to build a step / weigh a switch.' },
};

// ── ADVERSARY catalog.
export const ADVERSARIES = {
  goomba:   { name: 'Goomba (walker)',   ai: 'spatial', note: 'Patrols, turns at edges; stomp it.' },
  piranha:  { name: 'Piranha-pipe',      ai: 'timed',   note: 'Emerges from a pipe on a cycle; time the gap.' },
  flyer:    { name: 'Flyer (hover/sine)',ai: 'timed',   note: 'Floats on a sine path; stomp from above or pass under the arc.' },
  charger:  { name: 'Charger',           ai: 'timed',   note: 'Rushes when you share its lane; bait it, then leap.' },
  jumper:   { name: 'Jumper (hopper)',   ai: 'timed',   note: 'Hops toward you; cross when it’s grounded.' },
  shooter:  { name: 'Shooter / turret',  ai: 'timed',   note: 'Fires projectiles on a cycle; advance between shots.' },
  shielded: { name: 'Shielded golem',    ai: 'timed',   note: 'Armored front — only a stomp (or behind) hurts it.' },
  spawner:  { name: 'Spawner (nest)',    ai: 'stateful',note: 'Emits small enemies until passed; rush past, don’t farm.' },
  boss:     { name: 'Boss (pattern)',    ai: 'stateful',note: 'A telegraphed multi-phase pattern; learn it, hit the tells.' },
};

// ── PER-LEVEL DESIGN INTENT (the redesign target). ───────────────────────
// Each gives every level ONE signature new element + ONE adversary + a unique
// puzzle, so no two play alike. Interest = [{t:%, v:1-10, label}].
export const DESIGN = [
  { id: 1, name: 'First Steps', theme: 'day',
    essence: 'Teach the body of the game — run, jump, stomp, collect — and make moving feel joyful.',
    fun: ['Sensation', 'Challenge', 'Submission'],
    mechanics: ['Run + variable jump', 'Stomp enemies', 'Coins & ? blocks', 'A flag goal'],
    dynamics: ['Player learns timing on safe, forgiving gaps', 'Coins lead the eye rightward'],
    aesthetics: ['Bright, safe, “I’ve got this”', 'Pure kinetic joy of the first jump'],
    elements: ['gap', 'qblock', 'brick', 'stair'], adversaries: ['goomba'],
    lenses: ['essence', 'flow', 'fun', 'goals'],
    interest: [{ t: 0, v: 3, label: 'first step' }, { t: 25, v: 5, label: 'first gap' }, { t: 55, v: 5 }, { t: 80, v: 7, label: 'goomba + ?' }, { t: 100, v: 6, label: 'flag' }],
    puzzle: 'No puzzle — a clean tutorial. Every verb taught once on flat, forgiving ground (Lens of Flow).',
    twist: 'none — the safety IS the point; the rest of the game escalates from here.' },

  { id: 2, name: 'Into the Caverns', theme: 'cave',
    essence: 'The world closes in: an enclosed cave where a NEW threat (the piranha) teaches patience.',
    fun: ['Challenge', 'Discovery', 'Fantasy'],
    mechanics: ['Piranha-pipe timing', 'Low ceiling navigation', 'A descending shaft'],
    dynamics: ['Player learns the wait-then-go rhythm', 'Verticality via a lift instead of a drop'],
    aesthetics: ['Claustrophobia + tension', 'Relief on reaching the lit exit'],
    elements: ['pipe', 'movPlatformV', 'brick', 'qblock'], adversaries: ['piranha', 'goomba'],
    lenses: ['curiosity', 'challenge', 'unify', 'punish'],
    interest: [{ t: 0, v: 5, label: 'enter dark' }, { t: 30, v: 6, label: 'first piranha' }, { t: 60, v: 5 }, { t: 80, v: 8, label: 'lift down the shaft' }, { t: 100, v: 7, label: 'climb to light' }],
    puzzle: 'Time the piranhas; ride a vertical LIFT down the shaft instead of a blind drop (new element).',
    twist: 'the floor gives way to a shaft — descent, not the usual rightward run.' },

  { id: 3, name: 'Cloudtop Run', theme: 'sky',
    essence: 'Exhilaration of height — bounding across the sky with big, committed air.',
    fun: ['Sensation', 'Challenge', 'Expression'],
    mechanics: ['Wide floating platforms', 'SPRINGS for huge air', 'Greed coins up high'],
    dynamics: ['Springs convert a tap into a skyward arc', 'Risk/reward of the high coin road'],
    aesthetics: ['Vertigo + freedom', 'Lightness'],
    elements: ['ledge', 'spring', 'qblock'], adversaries: ['flyer'],
    lenses: ['inherent', 'triangle', 'beauty', 'flow'],
    interest: [{ t: 0, v: 5 }, { t: 25, v: 7, label: 'first spring' }, { t: 50, v: 6 }, { t: 75, v: 9, label: 'high coin road + flyer' }, { t: 100, v: 7, label: 'flag' }],
    puzzle: 'A SPRING launches you to a high coin road guarded by a flyer — take the safe low line, or the greedy high one (Triangularity).',
    twist: 'the spring — suddenly you’re flung far above the normal jump ceiling.' },

  { id: 4, name: 'The Keep', theme: 'castle',
    essence: 'Enter the enemy’s house: stone, lava, and the castle’s signature whirling FIRE BARS.',
    fun: ['Challenge', 'Fantasy', 'Discovery'],
    mechanics: ['Lava pits', 'Rotating fire bars', 'A fire-spitting statue'],
    dynamics: ['Read a rotating hazard’s phase, dash through the gap', 'Standoff vs a ranged foe'],
    aesthetics: ['Dread of the fortress', 'Mastery when you thread a spinning bar'],
    elements: ['hazardPit', 'fireBar', 'pipe'], adversaries: ['shooter'],
    lenses: ['challenge', 'surprise', 'punish', 'juice'],
    interest: [{ t: 0, v: 6, label: 'gates' }, { t: 30, v: 7, label: 'first fire bar' }, { t: 60, v: 7, label: 'statue' }, { t: 85, v: 9, label: 'bar + lava combo' }, { t: 100, v: 7, label: 'flag' }],
    puzzle: 'Thread rotating FIRE BARS over lava while a statue spits fire — timing under spatial pressure.',
    twist: 'the fire bar — the first hazard that owns SPACE on a clock, not a fixed spot.' },

  { id: 5, name: 'Emberfall', theme: 'dusk',
    essence: 'The keep collapses into fire — a desperate RACE upward as lava rises beneath you.',
    fun: ['Challenge', 'Sensation', 'Narrative'],
    mechanics: ['Rising lava', 'Ascending platforms', 'A charging foe'],
    dynamics: ['Constant upward pressure removes the option to wait', 'Panic vs precision'],
    aesthetics: ['Adrenaline', 'The set-piece spectacle'],
    elements: ['risingHazard', 'ledge', 'spring'], adversaries: ['charger'],
    lenses: ['inherent', 'challenge', 'juice', 'flow'],
    interest: [{ t: 0, v: 6 }, { t: 20, v: 8, label: 'lava starts rising' }, { t: 55, v: 8 }, { t: 80, v: 10, label: 'final scramble' }, { t: 100, v: 8, label: 'escape' }],
    puzzle: 'RISING LAVA turns the level into a vertical race — no standing still; pick the fast line up.',
    twist: 'the ground itself becomes the threat — the World-1 climax.' },

  { id: 6, name: 'Frostpeak', theme: 'snow',
    essence: 'A slick, swingy mountain — momentum you don’t fully control on ice and moving lifts.',
    fun: ['Challenge', 'Discovery', 'Expression'],
    mechanics: ['Low-friction ICE', 'Horizontal moving platforms', 'A hopping foe'],
    dynamics: ['Sliding overshoot forces you to plan stops', 'Board a lift mid-traverse'],
    aesthetics: ['Slippery comedy + tension', 'Crisp, cold clarity'],
    elements: ['movPlatformH', 'ledge'], adversaries: ['jumper'],
    lenses: ['skill', 'challenge', 'emergence', 'flow'],
    interest: [{ t: 0, v: 5 }, { t: 30, v: 7, label: 'ice slide' }, { t: 55, v: 8, label: 'ride the lift' }, { t: 80, v: 8 }, { t: 100, v: 7, label: 'flag' }],
    puzzle: 'ICE makes you overshoot; cross chasms on HORIZONTAL lifts whose timing you must read.',
    twist: 'losing grip — the first time the floor doesn’t do exactly what you say.' },

  { id: 7, name: 'Dune Sea', theme: 'desert',
    essence: 'A shifting desert of currents and old machinery — push and be pushed.',
    fun: ['Discovery', 'Challenge', 'Expression'],
    mechanics: ['Quicksand pits', 'Sand CONVEYORS', 'Pushable stone blocks'],
    dynamics: ['Conveyors add/subtract from your speed', 'Push a block to bridge a gap'],
    aesthetics: ['Heat-haze exotic', 'Cleverness of the block solution'],
    elements: ['hazardPit', 'conveyor', 'pushBlock'], adversaries: ['goomba'],
    lenses: ['problem', 'choices', 'emergence', 'curiosity'],
    interest: [{ t: 0, v: 5 }, { t: 30, v: 7, label: 'conveyor' }, { t: 60, v: 8, label: 'push-block bridge' }, { t: 85, v: 8 }, { t: 100, v: 7, label: 'flag' }],
    puzzle: 'CONVEYORS speed/slow your run over quicksand; PUSH a block to bridge an un-jumpable gap (first real spatial puzzle).',
    twist: 'the level pushes back — and asks you to manipulate it, not just survive it.' },

  { id: 8, name: 'Verdant Ruins', theme: 'jungle',
    essence: 'Overgrown ruins you read like a 3D space — over, under, and through the canopy.',
    fun: ['Discovery', 'Expression', 'Challenge'],
    mechanics: ['One-way (jump-through) platforms', 'A toggle SWITCH that opens a wall', 'Hovering foes + a nest'],
    dynamics: ['Layered routes (high/low)', 'Hit a switch to open the path ahead'],
    aesthetics: ['Lush exploration', 'Aha of finding the upper route'],
    elements: ['ledge', 'switchBlock'], adversaries: ['flyer', 'spawner'],
    lenses: ['problem', 'choices', 'curiosity', 'discovery'],
    interest: [{ t: 0, v: 5 }, { t: 30, v: 7, label: 'split routes' }, { t: 55, v: 8, label: 'switch wall' }, { t: 80, v: 8, label: 'nest rush' }, { t: 100, v: 7, label: 'flag' }],
    puzzle: 'A SWITCH opens a block wall to the flag; one-way platforms create a high/low route choice past a spawner nest.',
    twist: 'the level has a hidden upper storey — verticality you choose to use.' },

  { id: 9, name: 'Mire of Woe', theme: 'swamp',
    essence: 'A rotting bog where the very platforms betray you and spores fill the air.',
    fun: ['Challenge', 'Discovery', 'Narrative'],
    mechanics: ['Acid pools', 'CRUMBLING lilypads', 'Spore SHOOTERS', 'Piranhas'],
    dynamics: ['Never linger — platforms collapse', 'Advance between volleys'],
    aesthetics: ['Decay + unease', 'Twitchy momentum'],
    elements: ['hazardPit', 'crumbling'], adversaries: ['shooter', 'piranha'],
    lenses: ['punish', 'challenge', 'inherent', 'flow'],
    interest: [{ t: 0, v: 5 }, { t: 30, v: 7, label: 'first crumble' }, { t: 55, v: 8, label: 'shooter gauntlet' }, { t: 85, v: 9 }, { t: 100, v: 7, label: 'flag' }],
    puzzle: 'CRUMBLING platforms over acid force constant forward motion while shooters and piranhas punish hesitation.',
    twist: 'safety itself dissolves — the ground you trust falls away.' },

  { id: 10, name: 'Cinder Depths', theme: 'volcano',
    essence: 'The planet’s hot heart — falling rocks, cannon-fire, and a second rising-lava finale.',
    fun: ['Challenge', 'Sensation', 'Narrative'],
    mechanics: ['Lava + FALLING ROCKS', 'A cannon hazard', 'Rising-lava finish'],
    dynamics: ['Pass under rocks between drops', 'Race the lava once more, now harder'],
    aesthetics: ['Overwhelming heat + spectacle', 'Earned survival'],
    elements: ['hazardPit', 'fallingRock', 'risingHazard'], adversaries: ['charger', 'flyer'],
    lenses: ['challenge', 'inherent', 'juice', 'punish'],
    interest: [{ t: 0, v: 6 }, { t: 30, v: 8, label: 'rock fall' }, { t: 60, v: 8, label: 'cannons' }, { t: 85, v: 10, label: 'lava race II' }, { t: 100, v: 8, label: 'escape' }],
    puzzle: 'Time passages under FALLING ROCKS, then a harder RISING-LAVA scramble — the mid-game peak.',
    twist: 'recall of Emberfall’s lava-race, now compounded with overhead danger.' },

  { id: 11, name: 'Crystal Hollow', theme: 'crystal',
    essence: 'A glittering vault that is, secretly, a lock — find the key, mind the spikes.',
    fun: ['Discovery', 'Challenge', 'Expression'],
    mechanics: ['Spike pits', 'A KEY + locked gate', 'Vertical lifts past the spikes'],
    dynamics: ['Detour off the main line to fetch the key', 'Lifts gate the spike crossings'],
    aesthetics: ['Wonder + greed', 'Satisfaction of unlocking'],
    elements: ['hazardPit', 'keyDoor', 'movPlatformV'], adversaries: ['shielded'],
    lenses: ['problem', 'curiosity', 'choices', 'beauty'],
    interest: [{ t: 0, v: 6 }, { t: 30, v: 7, label: 'see the locked gate' }, { t: 55, v: 8, label: 'fetch the key' }, { t: 85, v: 8, label: 'golem' }, { t: 100, v: 7, label: 'unlock + flag' }],
    puzzle: 'The flag is behind a LOCKED GATE — you must spot it, detour for the KEY past a shielded golem, and return.',
    twist: 'the goal is visible but sealed — the level becomes a fetch-and-return loop.' },

  { id: 12, name: 'Stormspire', theme: 'storm',
    essence: 'A high-wire in a gale — the wind is a character that bends every jump.',
    fun: ['Challenge', 'Sensation', 'Expression'],
    mechanics: ['Wide gaps over the void', 'Periodic WIND gusts', 'Fast moving platforms'],
    dynamics: ['Time jumps to the wind cycle', 'Wind both helps and betrays your arc'],
    aesthetics: ['Awe + peril', 'The thrill of a wind-aided long jump'],
    elements: ['ledge', 'wind', 'movPlatformH'], adversaries: ['flyer'],
    lenses: ['skill', 'challenge', 'inherent', 'flow'],
    interest: [{ t: 0, v: 6 }, { t: 30, v: 8, label: 'first gust' }, { t: 55, v: 8 }, { t: 80, v: 9, label: 'wind-aided leap' }, { t: 100, v: 8, label: 'spire top' }],
    puzzle: 'WIND gusts on a cycle lengthen or shorten your jumps across the void — read the gust, commit with it.',
    twist: 'the air itself is the mechanic — you ride it or it throws you.' },

  { id: 13, name: 'Final Bastion', theme: 'bastion',
    essence: 'Everything you learned, then a true BOSS — the campaign’s climax and resolution.',
    fun: ['Challenge', 'Fantasy', 'Narrative', 'Sensation'],
    mechanics: ['Medley: lava, fire bars, lifts, springs', 'A multi-phase BOSS fight'],
    dynamics: ['Recombination of every taught verb', 'Learn the boss’s tells, strike the openings'],
    aesthetics: ['Triumph', 'Catharsis / closure'],
    elements: ['hazardPit', 'fireBar', 'movPlatformH', 'spring'], adversaries: ['boss'],
    lenses: ['interest', 'challenge', 'juice', 'essence'],
    interest: [{ t: 0, v: 7, label: 'the gauntlet' }, { t: 40, v: 8 }, { t: 65, v: 9, label: 'boss arena' }, { t: 90, v: 10, label: 'final blow' }, { t: 100, v: 8, label: 'victory' }],
    puzzle: 'A medley gauntlet of every mechanic, then a pattern-based BOSS — the only enemy that fights back in phases.',
    twist: 'the BOSS — the game’s first real antagonist with a will of its own.' },
];
