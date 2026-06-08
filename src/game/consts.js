// Shared constants + tuning for the-platformer.
export const TILE = 64;            // on-screen tile size (px)
export const GAME_W = 1280;
export const GAME_H = 720;

// Movement / physics feel (Mario-ish: snappy, with coyote time + variable jump).
export const TUNE = {
  gravity: 4200,        // base = FALL gravity (heavier than rise)
  gravityRise: 2800,    // while ascending with jump held
  gravityApex: 1400,    // near the top of the arc → "hang"
  apexThreshold: 250,   // |vy| under which apex-hang applies
  runMax: 770,          // a bit faster (playtest note #10)
  runAccel: 3200,
  groundFriction: 2600,
  iceFriction: 260,     // on ice: ~10× more slippery (you glide when not pushing)
  iceAccel: 1000,       // on ice: sluggish grip, so you build/shed speed slowly
  skidDecel: 5200,      // turnaround decel (~2× accel, SMB skid)
  airAccel: 1950,
  jumpVel: 1150,        // ~3.5 tiles — proven; the crude autopilot over-shoots stairs
                        // at anything bigger, so BIG-jump precision lives in /build.html
                        // levels (live-tested via __CUSTOM_LEVEL, off the legacy gate).
  springVel: 1820,      // bounce-pad launch (~6 tiles) — well above a normal jump
  jumpMinVel: 430,      // velocity floor on early release (variable jump)
  coyoteMs: 120,        // grace after leaving a ledge (a touch more forgiving — gate-safe)
  bufferMs: 140,        // jump pressed just before landing still fires (gate-safe)
  enemySpeed: 130,
  conveyorPush: 2000,   // belt acceleration (< runAccel, so the frog can always fight it)
  dashSpeed: 1020,      // dash-pad turbo cap (~1.45× runMax) — fast, but lands safe
  dashPush: 6000,       // dash-pad burst accel (snappy launch to the cap)
  // field zones (wind / updraft / low-grav / water)
  windAccel: 1400,      // wind-zone horizontal push (< runAccel, so the frog wins)
  windMax: 880,         // wind can't shove you past this (≈1.25× runMax)
  updraftAccel: 5400,   // fan lift force (> fall gravity, so the column actually lifts)
  updraftRiseCap: 540,  // updraft can't fling you faster than this upward (gentle float)
  waterMaxFall: 360,    // buoyant sink speed (you settle gently, never plummet)
  waterStroke: 560,     // swim-stroke impulse (repeatable while submerged)
  waterStrokeMs: 220,   // min gap between strokes (so it's a paddle, not a rocket)
  stickyMax: 360,       // mud/sticky surface top speed (you trudge — inverse of ice)
  stickyAccel: 1500,    // mud grip: slow to build speed
  stickyFriction: 5200, // mud drag: stops you fast when you let go
  bounceVel: 820,       // auto-bounce-tile launch (~2.5 tiles — a low permanent spring)
  stompBounce: 720,
  diveSpeed: 1500,      // DOWN / joystick-down → fast-fall dive to drop onto a platform
  maxFall: 1550,
  // power-up (SMB-faithful mushroom)
  mushroomSpeed: 150,   // travels at ~walk speed
  mushroomRise: 900,    // emerge speed out of the block
  bigScale: 2.6,        // big-frog scale (small frog = heroScale 1.9)
  invulnMs: 2200,       // post-hit invulnerability (~2s, SMB ~2.5s), flashing
  powerupPts: 1000,     // SMB mushroom points
};

// Cohesive, vibrant palette (original, Mario-adjacent).
export const C = {
  skyTop: 0x4ea3ff,
  skyMid: 0x8fd0ff,
  skyLow: 0xd8f3ff,
  sun: 0xfff3c4,
  hillFar: 0x6fce7a,
  hillNear: 0x49b85e,
  hillShade: 0x33a04a,
  cloud: 0xffffff,
  cloudShade: 0xe6f0ff,
  bush: 0x49b85e,
  bushDark: 0x2f9a46,
  grass: 0x5fd66e,
  grassDark: 0x39b24f,
  dirt: 0xb5703a,
  dirtDark: 0x8a4f25,
  dirtEdge: 0x6f3d1c,
  brick: 0xd06a3a,
  brickDark: 0x9c4a23,
  brickLine: 0x7a3a1a,
  qBlock: 0xffc23d,
  qBlockDark: 0xe39a1f,
  qBlockRivet: 0xffe79a,
  used: 0xa9794f,
  usedDark: 0x7d5635,
  pipe: 0x3fce6a,
  pipeDark: 0x1f9c47,
  pipeLight: 0x86f0a0,
  coin: 0xffd34d,
  coinEdge: 0xc9971f,
  coinShine: 0xfff6d0,
  heroCap: 0xe23b3b,
  heroCapDark: 0xb22323,
  heroSkin: 0xffce9e,
  heroShirt: 0xf25c2a,
  heroOveralls: 0x2f6fe0,
  heroOverallsDark: 0x1f4fb0,
  heroShoe: 0x6b3b1f,
  heroGlove: 0xffffff,
  goomba: 0xa9622f,
  goombaDark: 0x7c4520,
  goombaFoot: 0x5a3016,
  flagPole: 0xdfe7f5,
  flagCloth: 0x39d06b,
  ink: 0x20242e,
  white: 0xffffff,
};
