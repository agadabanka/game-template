// Diagnostic: run the autopilot under deterministic stepping and trace the
// player's progress + probe + inputs so we can see exactly where it stalls.
import { chromium } from 'playwright';
const BASE = process.env.BASE || `http://127.0.0.1:${process.env.PORT || 3000}`;
const LEVEL = process.env.LEVEL || '1';
const URL = `${BASE}/?r=canvas&level=${LEVEL}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => window.__rec.begin());
// enter Play
for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  await page.evaluate(() => window.__rec.step());
}
await page.evaluate(() => window.__game && window.__game.autopilot(true));
const N = Number(process.env.FRAMES || 1800);
let lastTile = -1, stuckAt = null, stuckCount = 0;
const log = [];
for (let i = 0; i < N; i++) {
  await page.evaluate(() => window.__rec.step());
  if (i % 6 === 0) {
    const s = await page.evaluate(() => {
      const g = window.__game; const sn = g.snapshot();
      return { x: Math.round(sn.player.x), y: Math.round(sn.player.y), vx: Math.round(sn.player.vx), vy: Math.round(sn.player.vy),
        og: sn.player.onGround, wr: sn.player.wallRight, probe: sn.player.probe, won: sn.won, dead: sn.dead,
        inp: { l: g.result ? null : null }, done: window.__PLATFORMER.registry.get('autopilot_done') };
    });
    const tile = Math.round(s.x / 64);
    if (tile === lastTile) { stuckCount++; if (!stuckAt) stuckAt = tile; } else { stuckCount = 0; stuckAt = null; }
    lastTile = tile;
    log.push({ f: i, tile, ...s });
    if (s.won) { console.log('WON at frame', i, 'tile', tile); break; }
    if (stuckCount > 30) { console.log('STUCK at tile', tile, 'for', stuckCount * 6, 'frames'); break; }
    if (process.env.UNTIL && tile >= Number(process.env.UNTIL)) { console.log('REACHED tile', tile, 'at frame', i); break; }
    if (s.dead) { console.log('DEAD at tile', tile, 'frame', i); break; }
  }
}
// print the last 24 samples around where it ended
console.log('=== TRACE LEVEL', LEVEL, '===');
for (const r of log.slice(-24)) {
  console.log(`f${String(r.f).padStart(4)} tile${String(r.tile).padStart(3)} x${String(r.x).padStart(4)} y${String(r.y).padStart(4)} vx${String(r.vx).padStart(5)} vy${String(r.vy).padStart(5)} og${r.og ? 1 : 0} wr${r.wr ? 1 : 0} gap[d${r.probe?.gapDist} w${r.probe?.gapWidth}] wall[d${r.probe?.wallDist} h${r.probe?.wallHeight}] ${r.won ? 'WON' : r.dead ? 'DEAD' : ''}`);
}
console.log('pageErrors:', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
