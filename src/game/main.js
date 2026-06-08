import { GAME_W, GAME_H, TUNE } from './consts.js';
import { BootScene } from './scenes/Boot.js';
import { TitleScene } from './scenes/Title.js';
import { PlayScene } from './scenes/Play.js';
import { UIScene } from './scenes/UI.js';

const params = new URLSearchParams(location.search);
// LIVE-TEST a level authored in /build.html: it stashes the level JSON in
// localStorage and opens /?custom=1; Play reads window.__CUSTOM_LEVEL.
if (params.get('custom')) {
  try { const c = localStorage.getItem('jazz_custom_level'); if (c) window.__CUSTOM_LEVEL = JSON.parse(c); } catch (e) {}
}
const renderer = params.get('r') === 'canvas' ? Phaser.CANVAS
  : params.get('r') === 'webgl' ? Phaser.WEBGL : Phaser.AUTO;

const config = {
  type: renderer,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#8fd0ff',
  pixelArt: true,
  roundPixels: true,
  // keep the WebGL drawing buffer so canvas.toDataURL() can capture the frame —
  // otherwise in-game note screenshots come back black (the buffer is cleared
  // after present). Tiny perf cost; worth it for the playtest-note screenshots.
  render: { preserveDrawingBuffer: true },
  // Clamp the frame delta. The autopilot (and a human) make ONE control
  // decision per rendered frame, but physics integrates the whole delta — so a
  // single huge frame (a backgrounded tab, or slow software-GL in the headless
  // eval) would advance the frog several tiles on one stale decision and fling
  // it off-world. Flooring at 30fps caps any one step to ~33ms: a spike just
  // briefly slows the game instead of teleporting the player. (The deterministic
  // recorder/eval uses __rec.step(), which bypasses this and stays exact.)
  fps: { min: 30, target: 60, smoothStep: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: TUNE.gravity }, debug: false },
  },
  scene: [BootScene, TitleScene, PlayScene, UIScene],
};

window.__PLATFORMER = new Phaser.Game(config);

// Grab keyboard focus (esp. when embedded in an iframe) so movement keys
// register immediately and Space/arrows don't scroll the host page.
try { window.focus(); } catch (e) {}
window.addEventListener('pointerdown', () => { try { window.focus(); } catch (e) {} });
window.addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
}, { passive: false });

// Re-render text once pixel fonts finish loading (avoids first-frame fallback)
// without delaying game creation — keeps boot/test timing unchanged.
(window.__fontsReady || Promise.resolve()).then(() => {
  const g = window.__PLATFORMER;
  if (!g) return;
  g.scene.scenes.forEach((s) => {
    if (s.children) s.children.list.forEach((o) => { if (o.type === 'Text' && o.updateText) o.updateText(); });
  });
});

// Designer notes channel (press N in-game) — see notes.js.
import('./notes.js').then((m) => m.installNotes(window.__PLATFORMER)).catch(() => {});

// Watch & Annotate mode — AI plays, you pause/rewind/note. Activated when the
// global flag is set (Title's mode toggle) or ?mode=annotate. The installer
// itself waits for the flag before showing its UI.
window.__annotateMode = new URLSearchParams(location.search).get('mode') === 'annotate';
import('./annotate.js').then((m) => m.installAnnotate(window.__PLATFORMER)).catch(() => {});

// ── Deterministic recording API ────────────────────────────────────────
// Lets an offline recorder render a perfectly smooth video regardless of how
// slow the (headless software-GL) machine actually is: pause the realtime
// loop, then advance the game by a FIXED 1/60s timestep per captured frame.
// Each captured frame is distinct and evenly spaced → no choppiness.
window.__rec = {
  fps: 60,
  begin() {
    const g = window.__PLATFORMER;
    g.loop.sleep();                 // stop the realtime RAF loop
    this._t = performance.now();    // simulated monotonic clock
    return true;
  },
  // advance exactly one fixed frame and render it (update + render once)
  step() {
    const g = window.__PLATFORMER;
    const ms = 1000 / this.fps;
    this._t += ms;
    g.step(this._t, ms);            // Phaser's full step: scenes update + render
    return true;
  },
  end() { window.__PLATFORMER.loop.wake(); },
};
