// Win check — runs the autopilot and reports the final state + furthest tile.
//
// Drives the game with the DETERMINISTIC fixed-1/60 stepper (window.__rec),
// exactly like trace.mjs and the recorder. This is the project's 0-death
// verification bar, so it must be reproducible: realtime rAF stepping in the
// headless software-GL box produced huge per-frame deltas, and since the
// autopilot makes one control decision per frame while physics integrates the
// whole delta, the frog would advance several tiles on a stale decision and
// dive off ledges / tunnel off-world. Fixed stepping removes that coupling —
// every run is identical regardless of how slow rendering is.
//
// The whole loop runs INSIDE one page.evaluate (no per-frame round-trips), so
// it's fast; only wall-clock (not correctness) depends on render speed.
import { chromium } from 'playwright';
const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const LEVEL = process.env.LEVEL || '1';
const MAX_STEPS = Number(process.env.WCSTEPS || 9000);   // matches autopilot frame cap
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/?r=canvas&level=${LEVEL}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => window.__rec.begin());
// enter Play — dispatch Space + step until __game exists
for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  await page.evaluate(() => window.__rec.step());
}
const t0 = Date.now();
const snap = await page.evaluate(async ({ maxSteps, showcase }) => {
  const g = window.__PLATFORMER;
  window.__game.autopilot(true);
  if (showcase) window.__game.showcase(true);
  let far = 0;
  for (let i = 0; i < maxSteps; i++) {
    window.__rec.step();                       // fixed 1/60 physics + control tick
    const s = window.__game.snapshot();
    const t = Math.round(s.player.x / 64); if (t > far) far = t;
    const done = g.registry.get('autopilot_done');
    if (s.won) return done_state('win', s);
    if (done && done !== false) return done_state(done, s);
    if (i % 400 === 0) await new Promise((r) => setTimeout(r, 0));   // yield to the event loop
    function done_state(d, s) {
      return { d, won: s.won, dead: s.dead, far, x: Math.round(s.player.x),
        goalTile: Math.round(s.goalX / 64), deaths: g.registry.get('autopilot_deaths'), steps: i + 1 };
    }
  }
  const s = window.__game.snapshot();
  return { d: 'timeout', won: s.won, dead: s.dead, far, x: Math.round(s.player.x),
    goalTile: Math.round(s.goalX / 64), deaths: g.registry.get('autopilot_deaths'), steps: maxSteps };
}, { maxSteps: MAX_STEPS, showcase: !!process.env.SHOWCASE });
const result = snap.won ? 'win' : snap.d;
console.log('=== WIN CHECK LEVEL', LEVEL, '===');
console.log('result :', result);
console.log('won    :', snap.won, '| dead:', snap.dead, '| deaths:', snap.deaths);
console.log('furthest tile:', snap.far, '/ goal tile', snap.goalTile, '(current tile', Math.round((snap.x || 0) / 64) + ')');
console.log('steps  :', snap.steps, '| wall', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('pageErrors:', errs.length, errs.slice(0, 2).join(' | '));
await browser.close();
process.exit(result === 'win' && snap.deaths === 0 ? 0 : 1);
