// ── UI / state-machine correctness eval ──────────────────────────────────
// Drives the REAL UI through every transition (menu → play → pause → resume →
// exit → re-select another level → play → game-over → menu) and asserts the
// deterministic uistate at each step. Catches the "can't select a level after
// EXIT TO MENU" class of bug. Runs in strict mode so any ILLEGAL transition
// throws inside the page. Exit 0 = all good, 1 = a check failed.
//   PORT=3000 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/eval/ui-check.mjs
import { chromium } from 'playwright';

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.addInitScript(() => { window.__uistateStrict = true; });   // illegal transitions throw
await page.goto(`${BASE}/?r=canvas`, { waitUntil: 'load', timeout: 30000 });   // no level → Title
await page.waitForFunction(() => window.__PLATFORMER && window.__PLATFORMER.registry, { timeout: 15000 });

const state = () => page.evaluate(() => window.__PLATFORMER.registry.get('uistate'));
const active = () => page.evaluate(() => window.__PLATFORMER.scene.getScenes(true).map((s) => s.scene.key).sort());
const log = () => page.evaluate(() => window.__PLATFORMER.registry.get('uistate_log') || []);
const ui = (fn) => page.evaluate(`(()=>{const u=window.__PLATFORMER.scene.getScene('UI');return (${fn})(u);})()`);
const play = (fn) => page.evaluate(`(()=>{const p=window.__PLATFORMER.scene.getScene('Play');return (${fn})(p);})()`);
async function waitState(target, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await state()) === target) return true; await page.waitForTimeout(60); }
  return false;
}
async function selectAndStart(n) {                       // real keyboard: pick level n, start
  await page.keyboard.press(String(n)); await page.waitForTimeout(120);
  await page.keyboard.press('Space');                     // Title.startGame → Play (after a ~300ms fade)
}

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); };

await waitState('menu', 3000);
check('boot → menu', (await state()) === 'menu', `state=${await state()}`);

await selectAndStart(1);
check('menu → playing (level 1)', await waitState('playing'), `active=${(await active()).join('+')}`);

await page.keyboard.press('p');
check('playing → paused (P)', await waitState('paused'));
await page.keyboard.press('p');
check('paused → playing (P)', await waitState('playing'));

await page.keyboard.press('p'); await waitState('paused');
await ui('u=>u.exitToMenu()');
check('paused → EXIT → menu', await waitState('menu'), `active=${(await active()).join('+')}`);

// THE regression: after EXIT, selecting another level MUST work
await selectAndStart(2);
check('menu → playing (level 2, post-exit)', await waitState('playing'), `state=${await state()}`);

// forced GAME OVER path → menu
await play('p=>{p.lives=0;}');
await ui('u=>u.showGameOver()');
check('playing → gameover', await waitState('gameover'));
await ui('u=>u.exitToMenu()');
check('gameover → EXIT → menu', await waitState('menu'));

// and we can STILL start again
await selectAndStart(3);
check('menu → playing (level 3, post-gameover)', await waitState('playing'));

// no illegal transitions were recorded, no page errors
const illegal = (await log()).filter((e) => !e.ok);
check('no illegal transitions', illegal.length === 0, illegal.map((e) => `${e.from}->${e.to}`).join(','));
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\nUI-CHECK: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
