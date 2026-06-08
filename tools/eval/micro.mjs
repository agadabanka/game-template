// Micro-trace: step until the player passes START_X, then sample every frame,
// printing player + nearest enemy + flags to see what kills/stalls it.
import { chromium } from 'playwright';
const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const LEVEL = process.env.LEVEL || '1';
const START_X = Number(process.env.START_X || 1500);
const N = Number(process.env.N || 80);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}/?r=canvas&level=${LEVEL}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => window.__rec.begin());
for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__game)); i++) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true })));
  await page.evaluate(() => window.__rec.step());
}
await page.evaluate(() => window.__game && window.__game.autopilot(true));
for (let i = 0; i < 2000; i++) {
  await page.evaluate(() => window.__rec.step());
  const x = await page.evaluate(() => window.__game.snapshot().player.x);
  if (x > START_X) break;
}
const rows = [];
for (let i = 0; i < N; i++) {
  await page.evaluate(() => window.__rec.step());
  const r = await page.evaluate(() => {
    const sc = window.__PLATFORMER.scene.getScene('Play');
    const p = sc.player; const inp = sc.dbg ? sc.dbg.input : {}; const sn = window.__game.snapshot();
    const en = (sn.enemiesList || []).filter((e) => e.alive).map((e) => `${Math.round(e.x)}/${Math.round(e.y)}`);
    return { x: Math.round(p.x), y: Math.round(p.y), vy: Math.round(p.body.velocity.y), vx: Math.round(p.body.velocity.x),
      dn: p.body.blocked.down, rt: p.body.blocked.right, inJ: !!inp.jump, jh: sc.dbg ? sc.dbg.mem.jumpHold : -1,
      big: sn.big, dead: sn.dead, won: sn.won, en: en.slice(0, 2).join(' '), wall: sn.player.probe.wallDist, wh: sn.player.probe.wallHeight };
  });
  rows.push(r);
  if (r.dead || r.won) { rows.push({ note: r.dead ? 'DEAD' : 'WON' }); break; }
}
console.log('=== MICRO L', LEVEL, 'from x', START_X, '===');
for (const r of rows) {
  if (r.note) { console.log('>>>', r.note); continue; }
  console.log(`x${String(r.x).padStart(4)} y${String(r.y).padStart(4)} vy${String(r.vy).padStart(6)} vx${String(r.vx).padStart(5)} dn${r.dn?1:0} rt${r.rt?1:0} inJ${r.inJ?1:0} jh${String(r.jh).padStart(3)} big${r.big?1:0} wall[d${r.wall} h${r.wh}] enemies[${r.en}]`);
}
await browser.close();
