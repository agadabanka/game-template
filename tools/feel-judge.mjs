// ── VISION FEEL-JUDGE ────────────────────────────────────────────────────────
// game-diff.mjs measures feel from SOURCE (physics constants, shared tools). That
// catches the MECHANICAL feel but is blind to the part a player actually feels
// with their eyes: aesthetics, mood, energy, character. This tool lets GEMINI be
// the judge — the same vision-as-critic move as tools/eval/judge.mjs — but A-vs-B:
// it captures live frames of BOTH games, shows them to Gemini side by side, and
// scores how SIMILAR each AESTHETIC/EMOTIONAL trait feels (10 = feels identical,
// 0 = feels like a different universe). The result is merged into gamediff.json
// (feelJudge), rendered by /diff.html.
//
//   GOOGLE_APPLICATION_CREDENTIALS=sa.json node tools/feel-judge.mjs
//   FROG_DIR=/path/to/the-platformer JAZZ_DIR=/path/to/jazz node tools/feel-judge.mjs
import { analyzeImages } from '../lib/gemini.js';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FROG_DIR = process.env.FROG_DIR || '/home/user/the-platformer';
const JAZZ_DIR = process.env.JAZZ_DIR || path.resolve(HERE, '..');
const OUT_JSON = process.env.OUT || path.resolve(HERE, '../src/assets/gamediff.json');
const SHOT_DIR = path.resolve(HERE, '../src/assets/feel-frames');
const SAMPLES = Number(process.env.JUDGE_SAMPLES || 3);   // vision judge is noisy → median

// ── tiny utils ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

async function waitHttp(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/health`); if (r.ok) return true; } catch {}
    await sleep(250);
  }
  return false;
}

// ── boot a game's static server on a fresh port ──────────────────────────────
async function startGame(dir) {
  const port = await freePort();
  const proc = spawn('node', ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const ok = await waitHttp(port);
  if (!ok) { proc.kill('SIGKILL'); throw new Error(`server in ${dir} never came up on :${port}`); }
  return { port, proc };
}

// ── capture a TITLE frame and an in-ACTION frame from a running game ──────────
async function capture(browser, port, label) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const shots = {};
  const grab = async (name) => {
    const el = await page.$('canvas');
    const buf = await (el || page).screenshot({ type: 'jpeg', quality: 86 });
    fs.writeFileSync(path.join(SHOT_DIR, `${label}_${name}.jpg`), buf);
    return buf.toString('base64');
  };
  // TITLE
  await page.goto(`http://127.0.0.1:${port}/?r=canvas`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
  await sleep(900);                       // let the title art/anims settle
  shots.title = await grab('title');
  // ACTION: start level 1, let autopilot run it into the thick of play
  await page.goto(`http://127.0.0.1:${port}/?r=canvas&level=1`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.__rec.begin());
  for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
    await page.evaluate(() => window.__rec.step());
  }
  await page.evaluate(() => { try { window.__game.autopilot(true); } catch {} });
  await page.evaluate(() => { for (let i = 0; i < 360; i++) window.__rec.step(); });   // run ~6s into the level
  await sleep(200);
  shots.play = await grab('play');
  await page.close();
  return shots;
}

// ── the AESTHETIC / EMOTIONAL feel rubric (vision-judged, A vs B) ─────────────
const TRAITS = [
  ['mood', 'overall emotional mood (cheerful ↔ tense, cozy ↔ epic) — does it evoke the same feeling?'],
  ['energy', 'energy / intensity — calm-and-strolling vs frantic-and-explosive'],
  ['palette', 'colour temperature & palette mood (warm/cool, pastel/saturated, the "vibe" of the colour)'],
  ['character', 'the hero\'s personality & appeal — what kind of person/creature do they read as'],
  ['whimsy', 'whimsy / playfulness / humour vs seriousness'],
  ['density', 'visual busyness & detail density — sparse-and-clean vs packed-and-layered'],
  ['lineage', 'genre lineage signal — do they read as the same KIND of game (Mario-lineage run-and-jump)'],
  ['craft', 'production-polish vibe — do they feel like they came from the same studio / toolchain'],
];
const RUBRIC = `You are a game art-director comparing the FEEL of two in-development browser platformers.
- IMAGE 1 & 2 are GAME A "the-platformer" — a pixel FROG (title, then in-play).
- IMAGE 3 & 4 are GAME B "Jazz" — a cartoon BUNNY with a bazooka (title, then in-play).
Ignore raw quality differences; judge how the two games FEEL — their aesthetics and the EMOTION they evoke.
For each trait, give ONE similarity score 0-10: 10 = the two games feel essentially the SAME on this trait, 0 = they feel like totally different universes. Be specific and honest; siblings can still feel distinct.
Traits:
${TRAITS.map(([k, d], i) => `${i + 1}. ${k}: ${d}`).join('\n')}
Then: one sentence on how A FEELS, one on how B FEELS, and a one-sentence verdict on the emotional DIFFERENCE.
Return ONLY strict JSON, no markdown:
{"similarity":{${TRAITS.map(([k]) => `"${k}":N`).join(',')}},"feelsA":"...","feelsB":"...","difference":"..."}`;

function parse(t) {
  const sm = t.match(/"similarity"\s*:\s*\{([^}]*)\}/);
  const sim = {};
  if (sm) for (const m of sm[1].matchAll(/"(\w+)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/g)) sim[m[1]] = Number(m[2]);
  const grab = (k) => (t.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)) || [, ''])[1].replace(/\\"/g, '"');
  return { sim, feelsA: grab('feelsA'), feelsB: grab('feelsB'), difference: grab('difference') };
}

// ── main ──────────────────────────────────────────────────────────────────────
fs.mkdirSync(SHOT_DIR, { recursive: true });
console.log('feel-judge: booting both games…');
const frog = await startGame(FROG_DIR);
const jazz = await startGame(JAZZ_DIR);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  console.log('feel-judge: capturing frames…');
  const fa = await capture(browser, frog.port, 'frog');
  const fb = await capture(browser, jazz.port, 'jazz');
  const images = [
    { base64: fa.title, mimeType: 'image/jpeg', label: 'GAME A — the-platformer (frog) TITLE' },
    { base64: fa.play, mimeType: 'image/jpeg', label: 'GAME A — the-platformer (frog) IN-PLAY' },
    { base64: fb.title, mimeType: 'image/jpeg', label: 'GAME B — Jazz (bunny) TITLE' },
    { base64: fb.play, mimeType: 'image/jpeg', label: 'GAME B — Jazz (bunny) IN-PLAY' },
  ];

  console.log(`feel-judge: asking Gemini (median of ${SAMPLES})…`);
  const per = Object.fromEntries(TRAITS.map(([k]) => [k, []]));
  const proseA = [], proseB = [], diffs = [];
  for (let s = 0; s < SAMPLES; s++) {
    try {
      const r = parse(await analyzeImages(images, RUBRIC));
      TRAITS.forEach(([k]) => { const v = Number(r.sim[k]); if (!Number.isNaN(v)) per[k].push(v); });
      if (r.feelsA) proseA.push(r.feelsA); if (r.feelsB) proseB.push(r.feelsB); if (r.difference) diffs.push(r.difference);
    } catch (e) { console.warn('  sample failed:', e.message.slice(0, 120)); }
  }
  const traits = TRAITS.map(([k, d]) => ({ key: k, desc: d.split(' — ')[0].split(' (')[0], score: +med(per[k]).toFixed(1) }));
  if (!traits.some((t) => t.score)) throw new Error('Gemini returned no scores (creds? model?)');
  const overall = Math.round(mean(traits.map((t) => t.score)) * 10);
  const longest = (a) => a.sort((x, y) => y.length - x.length)[0] || '';
  const feelJudge = {
    method: 'gemini-vision', model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash', samples: SAMPLES,
    overallFeelSimilarity: overall, traits,
    feelsFrog: longest(proseA), feelsJazz: longest(proseB), difference: longest(diffs),
    frames: ['frog_title.jpg', 'frog_play.jpg', 'jazz_title.jpg', 'jazz_play.jpg'].map((f) => `/assets/feel-frames/${f}`),
    generated: new Date().toISOString(),
  };

  // merge into the existing gamediff.json (game-diff.mjs writes the rest)
  let report = {};
  try { report = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')); } catch {}
  report.feelJudge = feelJudge;
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  console.log(`\n=== VISION FEEL-JUDGE (A=frog ⇄ B=jazz) — median of ${SAMPLES} ===`);
  traits.forEach((t) => console.log(`  ${t.key.padEnd(10)} ${String(t.score).padStart(4)}/10  ${'█'.repeat(Math.round(t.score))}`));
  console.log(`OVERALL AESTHETIC/EMOTIONAL FEEL SIMILARITY: ${overall}/100`);
  console.log('frog feels :', feelJudge.feelsFrog);
  console.log('jazz feels :', feelJudge.feelsJazz);
  console.log('difference :', feelJudge.difference);
  console.log(`→ merged into ${OUT_JSON}`);
} finally {
  await browser.close();
  frog.proc.kill('SIGKILL'); jazz.proc.kill('SIGKILL');
}
