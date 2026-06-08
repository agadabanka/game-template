// ── SMOOTH AI PLAYTHROUGH VIDEO (deterministic offline render) ──────────
// The headless box renders slowly, so a realtime screen-record is choppy.
// Instead we PAUSE the realtime loop and advance the game by a FIXED 1/60s
// step (window.__rec), capturing every frame. ffmpeg then encodes the frames
// at exactly 60fps → perfectly smooth, machine-speed-independent.
//
//   PORT=3000 node tools/eval/record.mjs
//   BASE=https://<domain> RENDERER=webgl node tools/eval/record.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'video');
const FRAMES = path.join(OUT, 'frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const BASE = process.env.BASE || `http://127.0.0.1:${process.env.PORT || 3000}`;
const RENDERER = process.env.RENDERER || 'canvas';
const LEVEL = process.env.LEVEL || '1';
const URL = `${BASE}/?r=${RENDERER}&inputs=1&level=${LEVEL}`;   // input overlay + level select
const FPS = 60;
const MAX_SECONDS = Number(process.env.RECSECONDS || 45);   // longer for mechanic-throughline levels (many timed-hazard standoffs)
const MAX_FRAMES = FPS * MAX_SECONDS;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});

// capture one frame: advance fixed step in-page, then read the canvas.
// FAST=1 → JPEG frames (the browser's PNG encode is the per-frame bottleneck;
// JPEG is ~3-5× faster), which lets long (merged-world) playthroughs finish
// capture inside tight time limits. Visually fine at q=0.9 for a playthrough.
const FAST = process.env.FAST === '1';
const EXT = FAST ? 'jpg' : 'png';
async function frame() {
  const durl = await page.evaluate((fast) => {
    window.__rec.step();
    const c = window.__PLATFORMER.canvas;
    return c ? (fast ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png')) : null;
  }, FAST);
  return durl ? Buffer.from(durl.split(',')[1], 'base64') : null;
}

let n = 0;
const writeFrame = (buf) => { if (buf) fs.writeFileSync(path.join(FRAMES, `f${String(n++).padStart(5, '0')}.${EXT}`), buf); };

// begin deterministic mode
await page.evaluate(() => window.__rec.begin());

// CURVE=1 → overlay the eval's felt-interest curve on the video (reads the latest
// feel_L<level> score). Injected before Play launches the UI, so the overlay is
// drawn into the captured canvas. Makes the recording and the eval one artifact.
if (process.env.CURVE) {
  try {
    const dir = path.join(HERE, 'scores');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(`feel_L${LEVEL}_`) && f.endsWith('.json')).sort();
    if (files.length) {
      const rep = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'));
      await page.evaluate((d) => { window.__CURVE = d; }, { curve: rep.curve, name: rep.name });
      console.log(`curve overlay : ${files[files.length - 1]} (${rep.curve.length} windows, fun ${rep.fun_score_0_100})`);
    } else { console.log(`CURVE set but no feel_L${LEVEL} score found — run feel.mjs first`); }
  } catch (e) { console.log('curve overlay skipped:', e.message); }
}

// inject a co-designed level so the play agent plays what the design agent made
if (process.env.CUSTOM_LEVEL) {
  const mm = String(process.env.CUSTOM_LEVEL).match(/codesign:(\d+)/);
  if (mm) {
    const lvl = await page.evaluate(async (n) => await (await fetch('/api/codesign-level?level=' + n)).json(), mm[1]);
    await page.evaluate((L) => { window.__CUSTOM_LEVEL = L; }, lvl);
    console.log(`custom level injected: codesign L${mm[1]} (${(lvl.coins || []).length} coins)`);
  }
}

// 1) linger on the Title (~1.2s)
for (let i = 0; i < FPS * 1.2; i++) writeFrame(await frame());

// 2) enter Play — dispatch a Space keydown the Title listens for, stepping until __game exists
for (let i = 0; i < FPS * 2 && !(await page.evaluate(() => !!window.__game)); i++) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  writeFrame(await frame());
}
// fallback: real key press if still on title
if (!(await page.evaluate(() => !!window.__game))) {
  await page.keyboard.press('Space');
  for (let i = 0; i < FPS; i++) writeFrame(await frame());
}

// 3) autopilot plays; we keep stepping + capturing until it finishes. We also
//    tag each game event with the CAPTURED frame index so audio lands in sync.
// REQUIRE_WIN: keep capturing until the run WINS (so the video shows a
//   completion). On a death the autopilot self-restarts; we keep rolling. Set
//   REQUIRE_WIN=0 to accept the first terminal state (debug/death videos).
const REQUIRE_WIN = process.env.REQUIRE_WIN !== '0';
let status = 'timeout';
const audioEvents = [];          // { type, sec }  (sec = capturedFrameIndex / FPS)
let lastEventCount = 0;
if (await page.evaluate(() => !!window.__game)) {
  await page.evaluate(() => window.__game.autopilot(true));
  // SHOWCASE=1 → the AI plays the fun beats (springs, powerups, coins), so the
  // clip shows the intended experience the felt-eval scores, not the rush to flag.
  if (process.env.SHOWCASE) await page.evaluate(() => window.__game.showcase(true));
  // COLLECT=1 → a 100%-style run: sweep up coins and stomp every reachable walker.
  if (process.env.COLLECT) await page.evaluate(() => window.__game.collect(true));
  for (let i = 0; i < MAX_FRAMES; i++) {
    writeFrame(await frame());
    // Poll game state + new events every 6 frames in ONE round-trip (a per-frame
    // round-trip here was the capture bottleneck — halving them ~2× the speed,
    // which long merged worlds need to finish capture inside the time budget).
    if (i % 6 === 0) {
      const st = await page.evaluate(() => {
        const done = window.__PLATFORMER.registry.get('autopilot_done');
        const s = window.__game.snapshot && window.__game.snapshot();
        return { done, won: s ? s.won : false, dead: s ? s.dead : false, events: (window.__game.result().events || []) };
      });
      if (st.events.length > lastEventCount) {
        for (let k = lastEventCount; k < st.events.length; k++) audioEvents.push({ type: st.events[k].type, sec: n / FPS });
        lastEventCount = st.events.length;
      }
      if (st.won) { status = 'win'; break; }
      // DEBUG video (REQUIRE_WIN=0): stop right after the FIRST death so the clip
      // shows a single attempt ending where the AI failed (a clean test case).
      if (!REQUIRE_WIN && st.dead) {
        for (let k = 0; k < 36; k++) writeFrame(await frame());   // hold the death beat
        status = 'death'; break;
      }
      // WIN-required: re-arm the autopilot on any non-win terminal state and keep
      // capturing a fresh attempt until a completion is recorded.
      if (REQUIRE_WIN && st.done && st.done !== 'win') {
        await page.evaluate(() => { window.__PLATFORMER.registry.set('autopilot_done', false); window.__game.autopilot(true); });
      }
    }
  }
}

// 4) hold the final frame ~2s
for (let i = 0; i < FPS * 2; i++) writeFrame(await frame());

const result = await page.evaluate(() => {
  const r = (window.__game ? window.__game.result() : {}) || {};
  const sc = window.__PLATFORMER.scene.scenes.find((s) => s.player);
  r._theme = sc ? sc.theme : 'day';
  return r;
}).catch(() => ({}));
await page.evaluate(() => window.__rec.end());
await browser.close();

const durationSec = n / FPS;
// a start jingle + the terminal win/die cue
audioEvents.unshift({ type: 'mushroom_spawn', sec: 0.3 });
if (status === 'win') audioEvents.push({ type: 'win', sec: Math.max(0, durationSec - 1.8) });

// ── synth the soundtrack from events, then mux into the video ──
// If the world has a REAL Lyria track (src/assets/music/<theme>.mp3), use it as
// the music bed (looped, under the SFX); otherwise synth the procedural bed.
const theme = result._theme || 'day';
const HERE2 = path.dirname(fileURLToPath(import.meta.url));
const musicFile = path.resolve(HERE2, '..', '..', 'src', 'assets', 'music', `${theme}.mp3`);
const hasTrack = fs.existsSync(musicFile);
const { synthWav } = await import('./synth-audio.mjs');
const wav = path.join(OUT, 'audio.wav');           // SFX (+ procedural bed only if no real track)
synthWav(audioEvents, (t) => t / FPS, durationSec, wav, { music: !hasTrack, theme });

// ── encode frames + audio → mp4 (H.264 + AAC) + webm ──
const ffmpeg = (await import('ffmpeg-static')).default;
const mp4 = path.join(OUT, 'playthrough.mp4');
const webm = path.join(OUT, 'playthrough.webm');
// loudnorm to a comfortable level (well under YouTube's -14 LUFS reference). When a
// real track exists, loop it under the SFX with amix; else just use the SFX wav.
const audioIn = hasTrack
  ? ['-i', wav, '-stream_loop', '-1', '-i', musicFile,
     '-filter_complex', '[2:a]volume=0.42[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-19:TP=-2:LRA=11[a]',
     '-map', '0:v', '-map', '[a]']
  : ['-i', wav, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-19:TP=-2:LRA=11'];
const encAV = (out, vargs) => execFileSync(ffmpeg, [
  '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, `f%05d.${EXT}`),
  ...audioIn, ...vargs, '-c:a', 'aac', '-b:a', '160k', '-shortest', out,
], { stdio: 'ignore' });
encAV(mp4, ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-crf', '18']);
try { execFileSync(ffmpeg, ['-y', '-framerate', String(FPS), '-i', path.join(FRAMES, `f%05d.${EXT}`), ...audioIn, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-c:a', 'libopus', '-shortest', webm], { stdio: 'ignore' }); } catch { /* webm optional */ }

const ev = result.events || [];
console.log('=== SMOOTH AI PLAYTHROUGH (with audio) ===');
console.log('frames :', n, `@ ${FPS}fps  (~${durationSec.toFixed(1)}s)`);
console.log('audio  :', audioEvents.length, 'sfx events synthesized');
console.log('mp4    :', mp4, fs.existsSync(mp4) ? `(${(fs.statSync(mp4).size / 1024).toFixed(0)} KB)` : '(MISSING)');
console.log('result :', status, '| deaths:', result.deaths, '| events:', JSON.stringify(ev.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {})));
console.log('pageErrors:', errs.length, errs.slice(0, 2).join(' | '));
// expose status for callers (win → success playlist, else → debug playlist)
fs.writeFileSync(path.join(OUT, 'last-status.json'), JSON.stringify({ status, deaths: result.deaths, level: LEVEL, durationSec }));
