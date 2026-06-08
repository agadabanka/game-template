// quick multi-biome fauna screenshots: load level, enter play, let critters
// spread for a few seconds, capture. node tools/eval/shot-fauna.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = `http://127.0.0.1:${process.env.PORT || 3577}`;
const OUT = 'tools/eval/video';
const LEVELS = (process.env.LEVELS || '1:day,8:jungle,9:swamp,3:sky,6:snow').split(',');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const spec of LEVELS) {
  const [lvl, name] = spec.split(':');
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?r=canvas&level=${lvl}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.__rec.begin());
  // enter play
  for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
    await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })); window.__rec.step(); });
  }
  // let the world breathe (critters drift/hop into view), keep player still
  for (let i = 0; i < 200; i++) await page.evaluate(() => window.__rec.step());
  const durl = await page.evaluate(() => window.__PLATFORMER.canvas.toDataURL('image/png'));
  fs.writeFileSync(`${OUT}/fauna2-${name}.png`, Buffer.from(durl.split(',')[1], 'base64'));
  console.log(`✓ fauna2-${name}.png (L${lvl})`);
  await page.evaluate(() => window.__rec.end());
  await page.close();
}
await browser.close();
