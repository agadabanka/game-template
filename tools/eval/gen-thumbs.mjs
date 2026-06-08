// Capture a clean gameplay thumbnail for each merged world → src/assets/thumbs/
// (loaded by the Title menu as clickable cards). node tools/eval/gen-thumbs.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const PORT = process.env.PORT || 3091;
const OUT = 'src/assets/thumbs';
fs.mkdirSync(OUT, { recursive: true });
const ffmpeg = (await import('ffmpeg-static')).default;
const WORLDS = [[101, 'world1'], [102, 'world2'], [103, 'world3'], [104, 'world4'], [105, 'world5']];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const [lvl, name] of WORLDS) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${PORT}/?r=canvas&level=${lvl}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.__rec.begin());
  for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })); window.__rec.step(); });
  // autopilot a short beat so the frog is mid-stride with the biome + props in frame
  await page.evaluate(() => { window.__game.autopilot(true); window.__game.collect(true); });
  for (let i = 0; i < 95; i++) await page.evaluate(() => window.__rec.step());
  const durl = await page.evaluate(() => window.__PLATFORMER.canvas.toDataURL('image/png'));
  const full = path.join(OUT, `${name}_full.png`);
  fs.writeFileSync(full, Buffer.from(durl.split(',')[1], 'base64'));
  // downscale to a tidy card texture (keeps the 16:9 frame)
  execFileSync(ffmpeg, ['-y', '-i', full, '-vf', 'scale=512:288', path.join(OUT, `${name}.png`)], { stdio: 'ignore' });
  fs.rmSync(full);
  console.log(`thumb ${name}.png (L${lvl})`);
  await page.close();
}
await browser.close();
console.log('THUMBS DONE');
