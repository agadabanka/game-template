// Tiny procedural WebAudio SFX — no asset files. Created lazily on first use.
import { schedule } from './music-core.js';
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export function resumeAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.22;
}
export function isMuted() { return muted; }

function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.5, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const SFX = {
  jump() { tone({ type: 'square', f0: 360, f1: 720, dur: 0.16, vol: 0.4 }); },
  coin() {
    tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.4 });
    tone({ type: 'square', f0: 1319, dur: 0.12, vol: 0.4, delay: 0.07 });
  },
  stomp() { tone({ type: 'triangle', f0: 220, f1: 70, dur: 0.16, vol: 0.6 }); },
  bump() { tone({ type: 'square', f0: 180, f1: 110, dur: 0.1, vol: 0.45 }); },
  hurt() {
    tone({ type: 'sawtooth', f0: 440, f1: 110, dur: 0.4, vol: 0.5 });
  },
  power() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.4, delay: i * 0.08 }));
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.16, vol: 0.45, delay: i * 0.12 }));
  },
  start() { tone({ type: 'square', f0: 660, f1: 990, dur: 0.18, vol: 0.4 }); },
};

// ── Background music ─────────────────────────────────────────────────────
// Two sources, one API. The campaign worlds use REAL tracks composed by Google
// Lyria (/assets/music/<theme>.mp3), looped and routed through the WebAudio
// master (so the mute toggle silences them). Any theme WITHOUT a track (base
// levels) falls back to the shared procedural composer (music-core.js) — the
// same notes the recorder renders. File first, synth as the safety net.
const FILE_THEMES = new Set(['hangar', 'belt', 'vent', 'cargo', 'core', 'title']);
let mGain = null, mTimer = null, mState = null;       // procedural state
let mediaEl = null, mediaSrc = null, curTheme = null; // file-track state
function mNote(n) {
  if (!ctx) return;
  const osc = ctx.createOscillator(), g = ctx.createGain(), t = n.t;
  osc.type = n.type; osc.frequency.setValueAtTime(n.freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.vol), t + 0.03);   // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur + 0.06);            // gentle release
  osc.connect(g).connect(mGain); osc.start(t); osc.stop(t + n.dur + 0.1);
}
function startProc(theme) {
  const c = ensure(); if (!c) return;
  if (!mGain) { mGain = c.createGain(); mGain.gain.value = 0.6; mGain.connect(master); }
  mState = { theme, t0: c.currentTime + 0.15, until: c.currentTime + 0.15 };
  const tick = () => {
    if (!mState) return;
    const horizon = c.currentTime + 0.35;            // ~350ms lookahead
    for (const n of schedule(theme, mState.until - mState.t0, horizon - mState.t0)) {
      mNote({ ...n, t: mState.t0 + n.t });
    }
    mState.until = horizon;
  };
  tick(); mTimer = setInterval(tick, 60);
}
function startFile(theme) {
  const c = ensure(); if (!c) return false;
  try {
    mediaEl = new Audio(`/assets/music/${theme}.mp3`);
    mediaEl.loop = true; mediaEl.crossOrigin = 'anonymous';
    if (!mGain) { mGain = c.createGain(); mGain.gain.value = 0.6; mGain.connect(master); }
    mediaSrc = c.createMediaElementSource(mediaEl);
    mediaSrc.connect(mGain);
    // if the file can't load, fall back to the procedural composer
    mediaEl.addEventListener('error', () => { if (curTheme === theme) { stopFile(); startProc(theme); } }, { once: true });
    const p = mediaEl.play();
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch (e) { return false; }
}
function stopFile() {
  if (mediaEl) { try { mediaEl.pause(); } catch (e) {} }
  if (mediaSrc) { try { mediaSrc.disconnect(); } catch (e) {} }
  mediaEl = null; mediaSrc = null;
}
export const Music = {
  start(theme) {
    const c = ensure(); if (!c) return;
    if (curTheme === theme && (mediaEl || mState)) return;   // already on this biome
    this.stop();
    curTheme = theme;
    if (FILE_THEMES.has(theme)) { if (startFile(theme)) return; }
    startProc(theme);                                  // base levels / fallback
  },
  stop() {
    if (mTimer) { clearInterval(mTimer); mTimer = null; } mState = null;
    stopFile(); curTheme = null;
  },
};
