// Does a level COMPLETE in coin-maximizer (collect) mode — the playlist mode,
// where deaths are OK and the risk-budget falls back to safe traversal?
//   PORT=3079 LEVEL=102 node tools/eval/collectcheck.mjs
import { chromium } from 'playwright';
const LEVEL = process.env.LEVEL || '102';
const PORT = process.env.PORT || 3079;
const MAX = Number(process.env.MAX || 45000);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/?r=canvas&level=${LEVEL}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => window.__rec.begin());
for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })); window.__rec.step(); });
const ATTEMPTS = Number(process.env.ATTEMPTS || 6);
const out = await page.evaluate(async ({ MAX, ATTEMPTS }) => {
  const g = window.__PLATFORMER; window.__game.autopilot(true); window.__game.collect(true);
  let maxt = 0, lastDead = false, deaths = 0, rearms = 0, goalT = 0;
  for (let i = 0; i < MAX; i++) {
    window.__rec.step(); const s = window.__game.snapshot(); const t = s.player.x / 64; if (t > maxt) maxt = t;
    goalT = Math.round((s.goalX || 0) / 64);
    if (s.dead && !lastDead) deaths++; lastDead = s.dead;
    const done = g.registry.get('autopilot_done');
    if (s.won) return { result: 'win', deaths, maxt: +maxt.toFixed(1), goalT, rearms };
    if (done && done !== 'win') {
      if (++rearms > ATTEMPTS) return { result: done, deaths, maxt: +maxt.toFixed(1), goalT, rearms };
      g.registry.set('autopilot_done', false); g.registry.set('autopilot_frames', 0);
      window.__game.autopilot(true); window.__game.collect(true);
    }
  }
  return { result: 'timeout', deaths, maxt: +maxt.toFixed(1), goalT, rearms };
}, { MAX, ATTEMPTS });
console.log(`L${LEVEL} COLLECT: ${JSON.stringify(out)}`);
await browser.close();
