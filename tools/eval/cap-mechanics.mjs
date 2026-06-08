// Capture short labeled clips of distinct mechanics for a showcase reel.
// Each clip: enter Play, showcase-autopilot, grab N JPEG frames. The boss clip
// teleports next to the boss so a short clip catches the fight.
//   PORT=3097 node tools/eval/cap-mechanics.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const PORT = process.env.PORT || 3097;
const ROOT = 'tools/eval/video/mframes';
fs.rmSync(ROOT, { recursive: true, force: true });
// [level, clipdir, frames, teleportTile|null]
const CLIPS = [
  [1, 'c1_dash', 540, null],
  [4, 'c2_spout', 600, null],
  [11, 'c3_conveyor', 540, null],
  [13, 'c4_boss', 600, 176],
];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const [lvl, dir, frames, tp] of CLIPS) {
  const OUT = path.join(ROOT, dir); fs.mkdirSync(OUT, { recursive: true });
  const p = await b.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/?r=canvas&level=${lvl}`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => window.__rec.begin());
  for (let i = 0; i < 120 && !(await p.evaluate(() => !!window.__game)); i++) await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })); window.__rec.step(); });
  if (tp != null) await p.evaluate((t) => { const s = window.__PLATFORMER.scene.scenes.find(x => x.player); s.player.x = t * 64 + 32; }, tp);
  await p.evaluate(() => { window.__game.autopilot(true); window.__game.showcase(true); });
  let n = 0;
  for (let i = 0; i < frames; i++) { const d = await p.evaluate(() => { window.__rec.step(); return window.__PLATFORMER.canvas.toDataURL('image/jpeg', 0.9); }); fs.writeFileSync(path.join(OUT, `f${String(n++).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')); }
  console.log(`${dir}: ${n} frames (L${lvl})  errs=${errs.length}`);
  await p.close();
}
await b.close();
console.log('MECHANICS FRAMES DONE');
