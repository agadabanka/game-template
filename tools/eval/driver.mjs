// ── GAME DRIVER: an AI player that plays the level, watches every action's
// effect, verifies semantic reachability, and records reproducible walkthroughs.
//
// Architecture: the goal-seeking policy runs INSIDE the game loop (see
// src/game/debug.js `autopilot`), perfectly synced to real physics. From Node
// we just: enter Play, flip autopilot on, poll a cheap status a few times/sec
// until win / death-loop / timeout, then pull the full result + screenshots.
//
// Output: tools/eval/driver/walkthrough.json + annotated PNGs.
//   PORT=3000 node tools/eval/driver.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'driver');
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 3000;
const LEVEL = process.env.LEVEL || '1';
const URL = `http://127.0.0.1:${PORT}/?r=canvas&level=${LEVEL}`;

async function shoot(page, name) {
  try {
    // JPEG is far lighter than PNG → avoids the headless tab OOM-closing.
    const durl = await page.evaluate(() => { const c = window.__PLATFORMER?.canvas; return c ? c.toDataURL('image/jpeg', 0.85) : null; });
    if (durl) fs.writeFileSync(path.join(OUT, name.replace('.png', '.jpg')), Buffer.from(durl.split(',')[1], 'base64'));
  } catch (e) { /* tab busy; skip this shot */ }
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.error('[PAGEERROR]', e.message); });
  page.on('crash', () => console.error('[PAGE CRASH]'));
  page.on('close', () => console.error('[PAGE CLOSE]'));

let ok = false;
for (let i = 0; i < 25; i++) { try { await page.goto(URL, { timeout: 4000 }); ok = true; break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
if (!ok) { console.log('could not load', URL); process.exit(1); }

// Enter Play via a real key event (reaches Phaser's keyboard plugin).
await page.waitForFunction(() => window.__PLATFORMER?.scene.getScenes(true).length > 0, { timeout: 15000 }).catch(() => {});
for (let i = 0; i < 12 && !(await page.evaluate(() => !!window.__game)); i++) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
}
const ready = await page.evaluate(() => !!window.__game); console.error('[dbg] ready=',ready);
if (!ready) { console.log('game never reached Play (no __game)'); await shoot(page, 'no_play.png'); await browser.close(); process.exit(1); }

// Flip autopilot on; the policy now runs ENTIRELY in the game loop and
// self-terminates. Node waits on a single flag — no per-frame round-trips that
// would starve the game loop.
await page.evaluate(() => window.__game.autopilot(true));
// Poll live max-progress (the in-game trace can freeze across scene restarts;
// polling snapshot is the source of truth for reachability).
let liveMaxX = 0, polledStatus = 'timeout';
const t0 = Date.now();
while (Date.now() - t0 < 90000) {
  const st = await page.evaluate(() => {
    const done = window.__PLATFORMER.registry.get('autopilot_done');
    const s = window.__game.snapshot && window.__game.snapshot();
    return { done, x: s ? s.player.x : 0, goalX: s ? s.goalX : 1, won: s ? s.won : false };
  });
  liveMaxX = Math.max(liveMaxX, st.x);
  if (st.done) { polledStatus = st.done; break; }
  if (st.won || st.x >= st.goalX - 12) { polledStatus = 'win'; break; }
  await page.waitForTimeout(400);
}
const status = polledStatus;
const result = await page.evaluate(() => window.__game.result());
result._liveMaxX = liveMaxX;
await shoot(page, 'final.png');

const ev = result.events || [];
const cnt = (t) => ev.filter((e) => e.type === t).length;
const sem = result.semantics || {};
const snap = result.snapshot || {};
const maxX = Math.max(result._liveMaxX || 0, (result.trace || []).reduce((m, t) => Math.max(m, t.x), 0));

const report = {
  url: URL, status, frames: result.frame, deaths: result.deaths,
  progress: snap.goalX ? +(maxX / snap.goalX).toFixed(2) : 0,
  pageErrors,
  eventCounts: ev.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {}),
  anomalies: result.anomalies || [],
  reachability: {
    flag_reached: status === 'win',
    classReachable: {
      ground_run: maxX > ((sem.start?.c || 0) * 64 + 128),
      coin: cnt('coin') > 0,
      qblock: cnt('qblock') > 0,
      enemy_stomp: cnt('stomp') > 0,
      flag: status === 'win',
    },
    totals: { coins: sem.coins, qblocks: sem.qblocks, enemies: sem.enemies },
    collected: { coins: snap.coins, score: snap.score },
  },
};
fs.writeFileSync(path.join(OUT, 'walkthrough.json'), JSON.stringify({ ...report, trace: result.trace }, null, 2));
await browser.close();

console.log('=== GAME DRIVER REPORT ===');
console.log('status:', report.status, '| progress:', report.progress, '| frames:', report.frames, '| deaths:', report.deaths);
console.log('pageErrors:', pageErrors.length, pageErrors.slice(0, 2).join(' | '));
console.log('events:', JSON.stringify(report.eventCounts));
console.log('reachability:', JSON.stringify(report.reachability.classReachable));
console.log('totals:', JSON.stringify(report.reachability.totals), '-> collected:', JSON.stringify(report.reachability.collected));
if (report.anomalies.length) {
  console.log(`\n!! ${report.anomalies.length} ANOMALIES (sample):`);
  report.anomalies.slice(0, 8).forEach((a) => console.log('  ', JSON.stringify(a)));
} else console.log('anomalies: none');
console.log('\nwrote', path.join(OUT, 'walkthrough.json'));
