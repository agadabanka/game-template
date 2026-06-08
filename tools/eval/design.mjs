// ── DESIGN EVAL: scores the LEVEL'S design, not its looks ───────────────
// "Every level is a story — a journey of problems/solutions." This measures
// that: the introduce->develop->twist->conclude arc, variety of challenge
// types, reward cadence, power-up presence, pacing, and difficulty ramp.
// Combines a structural analysis of the level data with an LLM design critique
// (Gemini) anchored to Super Mario design principles.
//
//   PORT=3000 node tools/eval/design.mjs
import { generateText } from '../../lib/gemini.js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCORES = path.join(HERE, 'scores');
fs.mkdirSync(SCORES, { recursive: true });
const PORT = process.env.PORT || 3000;

// 1) pull the structured level + semantics from the running game
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/?r=canvas`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__PLATFORMER?.scene.getScenes(true).length > 0, { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(800); await page.keyboard.press('Space'); await page.waitForTimeout(900);
const level = await page.evaluate(() => {
  const s = window.__PLATFORMER.scene.getScene('Play');
  const L = s.level;
  return {
    width: L.W, gaps: L.gaps,
    enemies: L.enemies.length,
    qblocks: L.qblocks.length,
    powerBlocks: L.qblocks.filter((q) => q.power).length,
    bricks: L.bricks.length,
    pipes: L.pipes.length,
    coins: L.coins.length,
    // ordered list of challenge "beats" by x for pacing analysis
    beats: [
      ...L.enemies.map((e) => ({ x: e.c, t: 'enemy' })),
      ...L.gaps.map(([a]) => ({ x: a, t: 'gap' })),
      ...L.pipes.map((p) => ({ x: p.c, t: 'pipe' })),
      ...L.qblocks.filter((q) => q.power).map((q) => ({ x: q.c, t: 'powerup' })),
    ].sort((a, b) => a.x - b.x),
  };
});
await browser.close();

// 2) structural metrics (objective)
const beatTypes = new Set(level.beats.map((b) => b.t));
const variety = beatTypes.size;                       // distinct challenge verbs
const hasPowerup = level.powerBlocks > 0;
const segments = 5;                                    // intended arc segments
const perSeg = Array.from({ length: segments }, () => ({}));
level.beats.forEach((b) => { const seg = Math.min(segments - 1, Math.floor(b.x / (level.width / segments))); perSeg[seg][b.t] = (perSeg[seg][b.t] || 0) + 1; });

// 3) LLM design critique anchored to Mario principles
const prompt = `You are a senior game designer reviewing ONE 2D platformer level, in the Super Mario tradition. "Every level is a story: a journey of problems and solutions." Here is the level's structure (tile-x ordered):

width: ${level.width} tiles
challenge beats (in order): ${JSON.stringify(level.beats)}
counts: enemies=${level.enemies}, pipes=${level.pipes}, gaps=${level.gaps.length}, ?-blocks=${level.qblocks} (power-ups=${level.powerBlocks}), bricks=${level.bricks}, coins=${level.coins}
beats per 1/5 segment: ${JSON.stringify(perSeg)}

Score this LEVEL DESIGN 0-10 on each, harshly and specifically, as a great studio would:
- arc: does it follow introduce -> develop -> twist -> conclude (teach, then complicate, then recombine, then finish)?
- variety: enough DISTINCT challenge types, or repetitive?
- pacing: rest/tension rhythm; ramps difficulty without spikes?
- reward_cadence: coins/power-ups placed to lure and reward (risk/reward)?
- powerup_use: is there a power-up arc (a hit-buffer before hazards, brick-break routes)? ${hasPowerup ? 'A power-up exists.' : 'NO power-up present.'}
- story: does the sequence read as an intentional problem/solution journey?
Return ONLY strict JSON:
{"scores":{"arc":N,"variety":N,"pacing":N,"reward_cadence":N,"powerup_use":N,"story":N},"story_summary":"one sentence describing the level's story","top_fixes":["...","...","..."]}`;

let critique = {};
try {
  const txt = await generateText(prompt);
  const m = txt.match(/\{[\s\S]*\}/);
  critique = JSON.parse(m[0]);
} catch (e) { critique = { error: String(e).slice(0, 200) }; }

const dims = ['arc', 'variety', 'pacing', 'reward_cadence', 'powerup_use', 'story'];
const sc = critique.scores || {};
const designScore = +(dims.reduce((s, d) => s + (Number(sc[d]) || 0), 0) / dims.length * 10).toFixed(1);

const report = {
  structural: { variety, hasPowerup, distinctBeatTypes: [...beatTypes], beatsPerSegment: perSeg },
  critique,
  design_score_0_100: designScore,
  ts: new Date().toISOString(),
};
fs.writeFileSync(path.join(SCORES, `design_${Date.now()}.json`), JSON.stringify(report, null, 2));
console.log('=== DESIGN EVAL ===');
console.log('distinct challenge types:', [...beatTypes].join(', '), `(${variety})`);
console.log('power-up present:', hasPowerup);
console.log('per-dimension:', JSON.stringify(sc));
console.log('story:', critique.story_summary || '(n/a)');
console.log('top fixes:', (critique.top_fixes || []).join(' | '));
console.log('=== DESIGN SCORE (0-100):', designScore, '===');
