import { chromium } from 'playwright';
const LEVEL = process.env.LEVEL || '102'; const PORT = process.env.PORT || 3079;
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/?r=canvas&level=${LEVEL}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__PLATFORMER && window.__rec, { timeout: 15000 }).catch(()=>{});
await page.evaluate(() => window.__rec.begin());
for (let i=0;i<120 && !(await page.evaluate(()=>!!window.__game)); i++) await page.evaluate(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true})); window.__rec.step();});
const out = await page.evaluate(async () => {
  window.__game.autopilot(true); const spots=[]; let lastDead=false; let maxt=0;
  for (let i=0;i<16000;i++){ window.__rec.step(); const s=window.__game.snapshot(); const t=s.player.x/64; if(t>maxt)maxt=t;
    if(s.dead&&!lastDead) spots.push({t:+t.toFixed(1), y:+(s.player.y/64).toFixed(1)}); lastDead=s.dead;
    if(s.won)return{won:true,spots,maxt:+maxt.toFixed(1)}; }
  return {won:false,spots,maxt:+maxt.toFixed(1)};
});
console.log(`L${LEVEL}: won=${out.won} maxTile=${out.maxt} deaths@=${JSON.stringify(out.spots)}`);
await browser.close();
