// Records the /editor design-EVOLUTION as a smooth mp4. The RECORDER drives the
// timeline (page timers throttle ~7× under headless capture), calling the manual
// render API and screenshotting at a fixed cadence, then ffmpeg-encodes the frames.
// Precompute the sequence first:  LEVEL=1 STEPS=11 node tools/eval/evolve-compute.mjs
//   PORT=3023 LEVEL=1 FPS=12 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/eval/record-evolve.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3023;
const LEVEL = process.env.LEVEL || 1;
const KIND = process.env.KIND || '';                              // '' = evolution, 'codesign' = co-design loop
const FPS = Number(process.env.FPS || 12);
const VIDDIR = path.join(HERE, 'video');
const FRAMES = path.join(VIDDIR, 'evframes');
fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
const W = 1200, H = 1480;

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/editor?manual=1&level=${LEVEL}&kind=${KIND}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__evo && window.__evo.ready, { timeout: 20000 });
const N = await page.evaluate(() => window.__evo.len);

let n = 0;
const clip = { x: 0, y: 0, width: W, height: H };
const shoot = async (k = 1) => { for (let i = 0; i < k; i++) { const b = await page.screenshot({ clip }); fs.writeFileSync(path.join(FRAMES, `f${String(n++).padStart(5, '0')}.png`), b); } };
const sec = (s) => Math.max(1, Math.round(s * FPS));

await page.evaluate(() => window.__evo.seed());
await shoot(sec(3.2));                                            // hold the seed
for (let i = 1; i < N; i++) {
  await page.evaluate((i) => window.__evo.study(i), i);
  await shoot(sec(1.3));                                          // "Gemini critiquing…"
  await page.evaluate((i) => window.__evo.reveal(i), i);          // ghost + log + new layout
  const from = await page.evaluate((i) => window.__evo.funAt(i - 1), i);
  const to = await page.evaluate((i) => window.__evo.funAt(i), i);
  for (let k = 0; k <= 6; k++) { await page.evaluate((v) => window.__evo.fun(v), from + (to - from) * k / 6); await shoot(1); }
  await shoot(sec(0.8));                                          // hold with the NEW pin
  await page.evaluate((i) => window.__evo.settle(i), i);
  await shoot(sec(1.7));                                          // settle
}
await page.evaluate(() => window.__evo.finish());
await shoot(sec(5));                                             // hold the final
await browser.close();

const ffmpeg = (await import('ffmpeg-static')).default;
const mp4 = path.join(VIDDIR, `${KIND === 'codesign' ? 'codesign' : 'design-evolution'}-L${LEVEL}.mp4`);
execFileSync(ffmpeg, ['-y', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-crf', '20', mp4], { stdio: 'ignore' });
console.log(`frames : ${n} @ ${FPS}fps  (~${(n / FPS).toFixed(0)}s)`);
console.log(`mp4    : ${mp4} (${(fs.statSync(mp4).size / 1024 / 1024).toFixed(1)} MB)`);
console.log('errors :', errs.slice(0, 3).join(' | ') || 'none');
