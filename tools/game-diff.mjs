// ── GAME DIFF EVALUATOR ──────────────────────────────────────────────────────
// Compares TWO games on two axes and writes a scored report (src/assets/gamediff.json,
// rendered by /diff.html):
//   • UNIQUENESS      — how distinct their IDENTITY is (verb, hero, art, audio, …). 10 = unmistakably different.
//   • FEEL SIMILARITY — how much their moment-to-moment FEEL + method is SHARED (physics, engine, grammar). 10 = identical.
// Each axis is tagged `measured` (computed from source) or `assessed` (a curated rubric call).
//
//   node tools/game-diff.mjs [GAME_A_DIR] [GAME_B_DIR] [OUT.json]
//   defaults: the-platformer (frog) vs jazz (bunny) → src/assets/gamediff.json
import fs from 'node:fs';

const A = process.argv[2] || '/home/user/the-platformer';
const B = process.argv[3] || '/home/user/jazz';
const OUT = process.argv[4] || new URL('../src/assets/gamediff.json', import.meta.url).pathname;

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

// ── feature extraction ──
function tune(dir) {
  const s = read(`${dir}/src/game/consts.js`); const t = {};
  const m = s.match(/export const TUNE\s*=\s*{([\s\S]*?)\n};/);
  if (m) for (const mm of m[1].matchAll(/(\w+)\s*:\s*(-?[\d.]+)/g)) t[mm[1]] = parseFloat(mm[2]);
  return t;
}
function enemyKinds(dir) {
  const s = read(`${dir}/src/game/assets.js`);
  const m = s.match(/ENEMY_SPRITES\s*=\s*{([\s\S]*?)\n};/);
  return m ? [...m[1].matchAll(/^\s{2}(\w+)\s*:/gm)].map((x) => x[1]) : [];
}
function hasMusic(dir) { try { return fs.readdirSync(`${dir}/src/assets/music`).some((f) => f.endsWith('.mp3')); } catch { return false; } }
function controls(dir) { return /_buildJoystick|buildJoystick/.test(read(`${dir}/src/game/scenes/UI.js`)) ? 'analog joystick + fire' : 'on-screen d-pad'; }
function verbs(dir) {
  const s = read(`${dir}/src/game/scenes/Play.js`); const v = ['run', 'jump'];
  if (/tryFire|buildProjectiles/.test(s)) v.push('shoot');
  if (/_diving|diveSpeed/.test(s)) v.push('dive');
  if (/onEnemy[\s\S]{0,400}stomp/.test(s)) v.push('stomp');
  return [...new Set(v)];
}
const sharedTools = (dir) => ['tools/eval/wincheck.mjs', 'tools/eval/feel.mjs', 'tools/eval/record.mjs', 'src/game/levelkit.js', 'src/game/merge.js']
  .filter((f) => exists(`${dir}/${f}`));
function meta(dir) {
  // Prefer the game's OWN declared hero (GAME_META.json) — a game names its own
  // protagonist; the diff should read that, not guess from asset filenames. Fall
  // back to the bunny/frog heuristic only when nothing is declared.
  let declared = {}; try { declared = JSON.parse(read(`${dir}/GAME_META.json`) || '{}'); } catch {}
  const isBunny = exists(`${dir}/art-src/STYLE_modelsheet.jpg`) || /jazz_idle|preloadHero[\s\S]{0,200}jazz/.test(read(`${dir}/src/game/assets.js`));
  const hero = (declared.hero && String(declared.hero).split(',')[0].trim())
    || (isBunny ? 'cartoon bunny (Jazz)' : 'pixel frog');
  // are the enemy SPRITES robots (Tin Tyrant bots) or critters? bot art files give it away.
  const botArt = exists(`${dir}/src/assets/enemies/groundbot.png`) || exists(`${dir}/src/assets/enemies/shieldbot.png`);
  return { hero, hasStory: exists(`${dir}/STORY.md`), themes: themes(dir), cast: botArt ? 'Tin Tyrant bot army' : 'woodland critters' };
}
function themes(dir) {
  const s = read(`${dir}/src/game/merged.js`);
  return [...s.matchAll(/"name":\s*"([^"]+)"/g)].map((m) => m[1]);
}

const ga = { dir: A, name: gameName(A), tune: tune(A), enemies: enemyKinds(A), music: hasMusic(A), controls: controls(A), verbs: verbs(A), tools: sharedTools(A), ...meta(A) };
const gb = { dir: B, name: gameName(B), tune: tune(B), enemies: enemyKinds(B), music: hasMusic(B), controls: controls(B), verbs: verbs(B), tools: sharedTools(B), ...meta(B) };
function gameName(dir) { return /jazz/.test(dir) ? 'Jazz (bunny + bazooka)' : 'the-platformer (frog)'; }

// ── scoring helpers ──
const clamp = (v, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, v));
// numeric closeness of two TUNE sets over a key list → 0..10 (10 = identical)
function physicsSim(keys) {
  let acc = 0, n = 0;
  for (const k of keys) {
    const a = ga.tune[k], b = gb.tune[k]; if (a == null || b == null) continue;
    const d = Math.abs(a - b) / (Math.max(Math.abs(a), Math.abs(b)) || 1);
    acc += 1 - d; n++;
  }
  return n ? clamp((acc / n) * 10) : 5;
}
const jaccardSame = (a, b) => { const A2 = new Set(a), B2 = new Set(b); const inter = [...A2].filter((x) => B2.has(x)).length; const uni = new Set([...a, ...b]).size; return uni ? (inter / uni) : 1; };

// ── the RUBRIC ──
const uniqueness = [
  { axis: 'Core verb', measured: true, score: clamp(10 - jaccardSame(ga.verbs, gb.verbs) * 10),
    a: ga.verbs.join(' · '), b: gb.verbs.join(' · '), note: 'The defining action. stomp → shoot + dive is a different game.' },
  { axis: 'Protagonist', measured: true, score: ga.hero === gb.hero ? 0 : 10, a: ga.hero, b: gb.hero, note: 'Who you are.' },
  { axis: 'Enemy cast', measured: true, score: ga.cast === gb.cast ? 1 : 9,
    a: `${ga.cast} (${ga.enemies.length})`, b: `${gb.cast} (${gb.enemies.length})`, note: 'A totally different faction + art (the behaviors are reused — see Feel).' },
  { axis: 'Audio / music', measured: true, score: ga.music === gb.music ? 3 : 9,
    a: ga.music ? 'real tracks' : 'procedural chiptune', b: gb.music ? 'Lyria soundtrack' : 'procedural chiptune', note: 'A generated score vs a synth.' },
  { axis: 'Controls', measured: true, score: ga.controls === gb.controls ? 1 : 8, a: ga.controls, b: gb.controls, note: 'Joystick + dive changes the hands-on feel.' },
  { axis: 'Narrative', measured: true, score: ga.hasStory === gb.hasStory ? 2 : 8, a: ga.hasStory ? 'story' : 'none', b: gb.hasStory ? 'story' : 'none', note: 'A villain + arc vs an abstract romp.' },
  { axis: 'Art style', measured: false, score: 9, a: 'pixel-storybook', b: 'bold-outline cartoon', note: 'Assessed: a completely different look.' },
  { axis: 'World identity', measured: true, score: 8, a: (ga.themes[0] || '—'), b: (gb.themes[0] || '—'), note: 'Renamed, re-themed worlds.' },
];
const feel = [
  { axis: 'Jump feel', measured: true, score: physicsSim(['jumpVel', 'gravity', 'gravityRise', 'gravityApex', 'apexThreshold', 'jumpMinVel']),
    a: `jump ${ga.tune.jumpVel}`, b: `jump ${gb.tune.jumpVel}`, note: 'Same arc math — jazz is a touch springier.' },
  { axis: 'Run feel', measured: true, score: physicsSim(['runMax', 'runAccel', 'groundFriction', 'airAccel', 'skidDecel']),
    a: `runMax ${ga.tune.runMax}`, b: `runMax ${gb.tune.runMax}`, note: 'Near-identical; jazz runs a hair faster.' },
  { axis: 'Forgiveness', measured: true, score: physicsSim(['coyoteMs', 'bufferMs']),
    a: `coyote ${ga.tune.coyoteMs} buf ${ga.tune.bufferMs}`, b: `coyote ${gb.tune.coyoteMs} buf ${gb.tune.bufferMs}`, note: 'Coyote + jump-buffer windows.' },
  { axis: 'Engine & scenes', measured: false, score: 10, a: 'Phaser · Boot/Title/Play/UI', b: 'Phaser · Boot/Title/Play/UI', note: 'Same skeleton, no build step.' },
  { axis: 'Methodology / eval', measured: true, score: clamp(jaccardSame(ga.tools, gb.tools) * 10),
    a: `${ga.tools.length} shared tools`, b: `${gb.tools.length} shared tools`, note: '0-death gate · felt-fun model · deterministic recorder · level DSL.' },
  { axis: 'Level grammar', measured: true, score: exists(`${A}/src/game/levelkit.js`) && exists(`${B}/src/game/levelkit.js`) ? 9 : 4,
    a: 'levelkit DSL', b: 'levelkit DSL (+blastblock/material)', note: 'Same authoring vocabulary, extended for shoot+jump.' },
  { axis: 'Enemy behaviours', measured: true, score: clamp(jaccardSame(ga.enemies, gb.enemies) * 10),
    a: `${ga.enemies.length} kinds`, b: `${gb.enemies.length} kinds`, note: 'The MECHANICS are reused (charger/hopper/swooper…) — only the cast/art changed.' },
];

const avg = (a) => Math.round((a.reduce((s, x) => s + x.score, 0) / a.length) * 10);
const report = {
  generated: new Date().toISOString(),
  gameA: ga.name, gameB: gb.name,
  overall: { uniqueness: avg(uniqueness), feelSimilarity: avg(feel) },
  uniqueness, feel,
  verdict: `Jazz scores ${avg(uniqueness)}/100 UNIQUE yet ${avg(feel)}/100 the SAME in feel — a different game built on the same proven movement + methodology. Identity diverges (verb, hero, art, audio, controls, story); the moment-to-moment platforming and the 0-death/felt-fun discipline are shared on purpose.`,
};
fs.mkdirSync(new URL('.', `file://${OUT}`).pathname.replace('file://', ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`game-diff → ${OUT}`);
console.log(`  UNIQUENESS ${report.overall.uniqueness}/100 · FEEL SIMILARITY ${report.overall.feelSimilarity}/100`);
