// ── CONTROLS EVAL (the first gate) ─────────────────────────────────────
// Before judging art or playability, PROVE the controls work — especially
// simultaneous move+jump, which a player needs constantly. Tests every
// supported scheme (Arrows+Space/Up, WASD+Space/W) with REAL key events so it
// catches input-path/capture/focus bugs the autopilot (which sets inputs
// directly) would mask.
//
//   PORT=3000 node tools/eval/controls.mjs   → prints PASS/FAIL per check, exits non-zero on fail
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const LEVEL = process.env.LEVEL || '1';
const URL = `http://127.0.0.1:${PORT}/?r=canvas&level=${LEVEL}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__PLATFORMER?.scene.getScenes(true).length > 0, { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.keyboard.press('Space');          // Title → Play
await page.waitForTimeout(900);

const snap = () => page.evaluate(() => { const s = window.__game?.snapshot(); return s ? { x: s.player.x, vx: s.player.vx, vy: s.player.vy, grnd: s.player.onGround } : null; });
// reset to a clean flat spot + release keys before each check (independent checks)
const settle = async () => {
  await page.keyboard.up('ArrowRight').catch(()=>{});
  await page.keyboard.up('ArrowLeft').catch(()=>{});
  await page.keyboard.up('Space').catch(()=>{});
  await page.keyboard.up('KeyD').catch(()=>{});
  await page.evaluate(() => window.__game.resetPlayer());
  // let it fall to the ground and settle
  for (let i = 0; i < 40; i++) { const s = await snap(); if (s && s.grnd && Math.abs(s.vy) < 5) break; await page.waitForTimeout(16); }
};

const checks = [];
const record = (name, pass, detail) => { checks.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

// 1) move right alone
await settle();
let a = await snap(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); let bx = await snap();
record('move right (Arrow)', bx.vx > 200 && bx.x > a.x, `vx=${Math.round(bx.vx)}`);
await page.keyboard.up('ArrowRight');

// 2) move left alone
await settle();
a = await snap(); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); bx = await snap();
record('move left (Arrow)', bx.vx < -150, `vx=${Math.round(bx.vx)}`);
await page.keyboard.up('ArrowLeft');

// 3) jump from standstill (Space)
await settle();
a = await snap(); await page.keyboard.down('Space');
let peak = 0; for (let i = 0; i < 12; i++) { await page.waitForTimeout(16); const s = await snap(); if (s.vy < peak) peak = s.vy; }
await page.keyboard.up('Space');
record('jump standstill (Space)', peak < -400, `peak vy=${Math.round(peak)}`);
await settle();

// 4) THE BIG ONE: move + jump simultaneously, every scheme
async function moveJump(name, moveKey, jumpKey) {
  await settle();
  await page.keyboard.down(moveKey);
  // wait until actually moving AND grounded (else coyote-time expired = false fail)
  for (let i = 0; i < 40; i++) { const s = await snap(); if (s.grnd && Math.abs(s.vx) > 250) break; await page.waitForTimeout(16); }
  await page.keyboard.down(jumpKey);
  let pk = 0, pvx = 0; for (let i = 0; i < 16; i++) { await page.waitForTimeout(16); const s = await snap(); if (s.vy < pk) pk = s.vy; if (Math.abs(s.vx) > Math.abs(pvx)) pvx = s.vx; }
  await page.keyboard.up(jumpKey); await page.keyboard.up(moveKey);
  record(`move+jump (${name})`, pk < -400 && Math.abs(pvx) > 200, `vx=${Math.round(pvx)} peak vy=${Math.round(pk)}`);
}
await moveJump('Arrow + Space', 'ArrowRight', 'Space');
await moveJump('Arrow + Up', 'ArrowRight', 'ArrowUp');
await moveJump('D + Space', 'KeyD', 'Space');
await moveJump('D + W', 'KeyD', 'KeyW');

const passed = checks.filter((c) => c.pass).length;
const report = { passed, total: checks.length, pageErrors: errs.length, checks };
fs.mkdirSync(path.join(HERE, 'out'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'out', 'controls.json'), JSON.stringify(report, null, 2));
console.log(`\nCONTROLS: ${passed}/${checks.length} passed; pageErrors=${errs.length}`);
await browser.close();
process.exit(passed === checks.length && errs.length === 0 ? 0 : 1);
