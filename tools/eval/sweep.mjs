// Robustness sweep: run the autopilot at many PHASE OFFSETS (extra fixed steps
// before the run starts), so timed mechanics start in different parts of their
// cycle. A level that only passes at one offset is phase-luck, not 0-death. This
// is the real bar for any level with timed hazards (piranhas, springs, …).
//   LEVEL=N [N0=0] [N1=30] [STEP=1] node tools/eval/sweep.mjs
import { chromium } from 'playwright';
const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const LEVEL = process.env.LEVEL || '1';
const N0 = Number(process.env.N0 || 0), N1 = Number(process.env.N1 || 30), STEP = Number(process.env.STEP || 1);
let fails = 0, runs = 0;
for (let warm = N0; warm <= N1; warm += STEP) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?r=canvas&level=${LEVEL}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__PLATFORMER && window.__rec);
  await page.evaluate(() => window.__rec.begin());
  for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
    await page.evaluate(() => window.__rec.step());
  }
  const r = await page.evaluate(async (warm) => {
    const g = window.__PLATFORMER;
    for (let i = 0; i < warm; i++) window.__rec.step();
    window.__game.autopilot(true);
    for (let i = 0; i < 9000; i++) {
      window.__rec.step(); const s = window.__game.snapshot();
      if (s.won) break; const d = g.registry.get('autopilot_done'); if (d && d !== false) break;
      if (i % 400 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const s = window.__game.snapshot();
    const die = (g.registry.get('autopilot_events') || []).filter((e) => e.type === 'die').map((e) => ({ x: e.x, r: e.reason }));
    return { won: s.won, deaths: g.registry.get('autopilot_deaths'), die };
  }, warm);
  runs++; const bad = !r.won || r.deaths > 0; if (bad) fails++;
  console.log(`warm${String(warm).padStart(2)}: ${r.won ? 'win' : 'FAIL'} deaths=${r.deaths}${r.die.length ? ' ' + JSON.stringify(r.die) : ''}`);
  await browser.close();
}
console.log(`=== LEVEL ${LEVEL}: ${runs - fails}/${runs} clean (0-death) ===`);
process.exit(fails ? 1 : 0);
