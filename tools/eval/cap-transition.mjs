// Capture the W1→W2 progression (gameplay → WORLD CLEAR → fade → next intro card)
// as JPEG frames for a short showcase clip. node tools/eval/cap-transition.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const PORT = process.env.PORT || 3097;
const OUT = 'tools/eval/video/tframes';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/?r=canvas&level=101`, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => window.__rec.begin());
let n = 0;
const grab = async () => { const d = await p.evaluate(() => { window.__rec.step(); return window.__PLATFORMER.canvas.toDataURL('image/jpeg', 0.9); }); fs.writeFileSync(path.join(OUT, `f${String(n++).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')); };
// enter Play
for (let i = 0; i < 120 && !(await p.evaluate(() => !!window.__game)); i++) { await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true }))); await grab(); }
// 1) the W1 intro card + a short clean run (plain autopilot — fewer cave deaths)
await p.evaluate(() => { window.__game.autopilot(true); });
for (let i = 0; i < 170; i++) await grab();           // ~2.8s: intro card + running
// 2) teleport to the flag → WIN (the 'WORLD 1 CLEAR!' celebration)
await p.evaluate(() => { const s = window.__PLATFORMER.scene.scenes.find(x => x.player); s.player.x = s.goalX + 4; });
for (let i = 0; i < 110; i++) await grab();            // ~1.8s celebration
// 3) advance to World 2 (manual goNext — the autopilot gate skips auto-advance)
await p.evaluate(() => { const s = window.__PLATFORMER.scene.scenes.find(x => x.player && x.goNext); if (s) s.goNext(); });
for (let i = 0; i < 200; i++) await grab();            // fade → WORLD 2 intro card → gameplay
console.log('frames:', n, '| errs:', errs.slice(0, 2).join('||') || 'none');
await b.close();
