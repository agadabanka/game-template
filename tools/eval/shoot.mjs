// Eval screenshot harness: drives the running game headlessly and captures
// title + scripted gameplay frames by reading the Phaser canvas directly
// (toDataURL) — avoids Playwright's DOM/font wait, which hangs on emoji.
// Run:  node tools/eval/shoot.mjs   (server up on $PORT, default 3210)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const PORT = process.env.PORT || 3210;
const RENDERER = process.env.RENDERER || 'canvas';
const URL = `http://127.0.0.1:${PORT}/?r=${RENDERER}`;

const logs = [];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const wait = (ms) => page.waitForTimeout(ms);
const shoot = async (n) => {
  try {
    const durl = await page.evaluate(() => {
      const c = window.__PLATFORMER && window.__PLATFORMER.canvas;
      return c ? c.toDataURL('image/png') : null;
    });
    if (!durl) { logs.push(`[shot-fail] ${n}: no canvas`); return; }
    fs.writeFileSync(path.join(OUT, n), Buffer.from(durl.split(',')[1], 'base64'));
  } catch (e) { logs.push(`[shot-fail] ${n}: ${e.message}`); }
};

let stats = null;
try {
  let ok = false;
  for (let i = 0; i < 25; i++) {
    try { await page.goto(URL, { waitUntil: 'load', timeout: 4000 }); ok = true; break; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  if (!ok) logs.push('[fatal] page load failed');

  await page.waitForFunction(
    () => { const g = window.__PLATFORMER; return g && g.scene && g.scene.getScenes(true).length > 0; },
    { timeout: 15000 },
  ).catch(() => logs.push('[warn] game never started'));

  await wait(1500); await shoot('01_title.png');
  await page.keyboard.press('Space'); await wait(1300); await shoot('02_play_start.png');
  await page.keyboard.down('ArrowRight'); await wait(1200); await shoot('03_play_run.png');
  await page.keyboard.down('ArrowUp'); await wait(160); await shoot('04_play_jump.png');
  await page.keyboard.up('ArrowUp'); await wait(1300); await shoot('05_play_mid.png');
  await wait(1400); await shoot('06_play_late.png');
  await page.keyboard.up('ArrowRight');

  stats = await page.evaluate(async () => {
    const g = window.__PLATFORMER;
    if (!g) return null;
    await new Promise((r) => setTimeout(r, 1000));
    return {
      renderer: g.renderer && g.renderer.type === 1 ? 'canvas' : 'webgl',
      fps: Math.round(g.loop.actualFps),
      scenes: g.scene.getScenes(true).map((s) => s.scene.key),
    };
  });
  logs.push('STATS ' + JSON.stringify(stats));
} catch (e) {
  logs.push('[harness-error] ' + (e && e.message));
} finally {
  fs.writeFileSync(path.join(OUT, 'console.txt'), logs.join('\n'));
  await browser.close();
  console.log('stats', JSON.stringify(stats));
  console.log('--- console (last 25) ---\n' + logs.slice(-25).join('\n'));
}
