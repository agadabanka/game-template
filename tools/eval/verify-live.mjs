// Verify the LIVE Railway deploy: (1) annotate mode shows its control bar and
// the AI plays; (2) Level 2's first piranha is hidden in its pipe.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const U = process.env.U || 'https://web-production-a2ee9.up.railway.app';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

// ── 1) ANNOTATE MODE ──
const p1 = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await p1.goto(`${U}/?mode=annotate&level=1`, { waitUntil: 'load', timeout: 30000 });
await p1.waitForFunction(() => !!window.__PLATFORMER, { timeout: 15000 }).catch(() => {});
// start: the Title is in annotate mode; press space to enter Play
for (let i = 0; i < 30 && !(await p1.evaluate(() => !!window.__game)); i++) {
  await p1.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  await new Promise((r) => setTimeout(r, 200));
}
await new Promise((r) => setTimeout(r, 3500));   // let the annotate bar appear + AI move
const annotate = await p1.evaluate(() => ({
  flag: !!window.__annotateMode,
  bar: !!document.querySelector('#an-play'),
  rewind: !!document.querySelector('#an-back'),
  note: !!document.querySelector('#an-note'),
  scrub: !!document.querySelector('#an-scrub'),
  playerX: window.__game ? Math.round(window.__game.snapshot().player.x) : null,
}));
await p1.screenshot({ path: path.join(HERE, 'video', 'live-annotate.png') });

// ── 2) LEVEL 2 PIRANHA HIDDEN ──
const p2 = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await p2.goto(`${U}/?level=2`, { waitUntil: 'load', timeout: 30000 });
await p2.waitForFunction(() => !!window.__PLATFORMER, { timeout: 15000 }).catch(() => {});
for (let i = 0; i < 30 && !(await p2.evaluate(() => !!window.__game)); i++) {
  await p2.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  await new Promise((r) => setTimeout(r, 200));
}
await new Promise((r) => setTimeout(r, 800));
// snap the piranhas: are any "up" (visible above the pipe mouth) at spawn?
const pir = await p2.evaluate(() => {
  const s = window.__game && window.__game.snapshot();
  return s ? (s.piranhasList || []).slice(0, 3).map((q) => ({ x: q.x, y: q.y, up: q.up })) : null;
});
// center camera near the first pipe (col 20) to screenshot it
await p2.evaluate(() => { const sc = window.__PLATFORMER.scene.getScene('Play'); if (sc) sc.cameras.main.centerOn(20 * 64, 11 * 64); });
await new Promise((r) => setTimeout(r, 400));
await p2.screenshot({ path: path.join(HERE, 'video', 'live-l2-piranha.png') });

console.log('=== LIVE VERIFY (', U, ') ===');
console.log('ANNOTATE: flag=%s bar=%s rewind=%s note=%s scrub=%s  playerX=%s',
  annotate.flag, annotate.bar, annotate.rewind, annotate.note, annotate.scrub, annotate.playerX);
console.log('L2 piranhas at spawn (up=visible):', JSON.stringify(pir));
await browser.close();
