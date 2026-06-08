// Render mechanic labels as transparent PNGs in the game's pixel font
// (ffmpeg-static has no drawtext). Loads the game page so 'PressStart2P' is
// already available, then draws onto a fresh canvas. → tools/eval/video/labels/
import { chromium } from 'playwright';
import fs from 'node:fs';
const PORT = process.env.PORT || 3097;
const OUT = 'tools/eval/video/labels'; fs.mkdirSync(OUT, { recursive: true });
const LABELS = [['DASH PADS & LIFTS', 'seg1'], ['FIRE SPOUTS', 'seg2'], ['CONVEYOR BELTS', 'seg3'], ['BOSS FIGHT', 'seg4']];
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`http://127.0.0.1:${PORT}/?r=canvas`, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => document.fonts && document.fonts.check('40px "PressStart2P"'), { timeout: 15000 }).catch(() => {});
for (const [text, file] of LABELS) {
  const durl = await p.evaluate((t) => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 140;
    const x = c.getContext('2d');
    x.font = '40px "PressStart2P"'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(t).width, bx = (c.width - w) / 2 - 26, bw = w + 52;
    x.fillStyle = 'rgba(8,12,28,0.55)'; x.fillRect(bx, 28, bw, 84);
    x.lineWidth = 8; x.strokeStyle = '#000'; x.strokeText(t, c.width / 2, 72);
    x.fillStyle = '#ffd34d'; x.fillText(t, c.width / 2, 72);
    return c.toDataURL('image/png');
  }, text);
  fs.writeFileSync(`${OUT}/${file}.png`, Buffer.from(durl.split(',')[1], 'base64'));
  console.log('label', file, text);
}
await b.close();
