// ── Offline SFX synthesizer ─────────────────────────────────────────────
// The deterministic recorder captures silent frames (no live WebAudio). This
// rebuilds the soundtrack from the autopilot EVENT LOG: it generates the same
// tones audio.js plays (jump/coin/stomp/...) at each event's timestamp, writes
// a 44.1kHz WAV, and (via record.mjs) ffmpeg muxes it into the mp4.
//
// Export: synthWav(events, frameToSec, durationSec, outPath)
//   events: [{ t: frameNumber, type }]   (t maps to time via frameToSec)
import fs from 'node:fs';
import { schedule } from '../../src/game/music-core.js';

const SR = 44100;

// tone generator mirroring src/game/audio.js `tone()`
function addTone(buf, startSec, { type = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.5 }) {
  const start = Math.floor(startSec * SR);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const idx = start + i; if (idx < 0 || idx >= buf.length) continue;
    const tt = i / n;
    const freq = f0 * Math.pow(Math.max(1, f1) / f0, tt);     // exp ramp
    const phase = (2 * Math.PI * freq * i) / SR;
    let w;
    if (type === 'square') w = Math.sign(Math.sin(phase));
    else if (type === 'triangle') w = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (type === 'sawtooth') w = 2 * ((freq * i / SR) % 1) - 1;
    else w = Math.sin(phase);
    // quick attack + exp decay (like the WebAudio gain envelope)
    const env = Math.min(1, tt / 0.06) * Math.pow(0.0001, tt);
    buf[idx] += w * vol * env * 0.5;
  }
}

// the SFX recipes (mirror audio.js SFX)
const SFX = {
  jump: (b, t) => addTone(b, t, { type: 'square', f0: 360, f1: 720, dur: 0.16, vol: 0.4 }),
  coin: (b, t) => { addTone(b, t, { type: 'square', f0: 988, dur: 0.07, vol: 0.4 }); addTone(b, t + 0.07, { type: 'square', f0: 1319, dur: 0.12, vol: 0.4 }); },
  stomp: (b, t) => addTone(b, t, { type: 'triangle', f0: 220, f1: 70, dur: 0.16, vol: 0.6 }),
  qblock: (b, t) => addTone(b, t, { type: 'square', f0: 180, f1: 110, dur: 0.1, vol: 0.45 }),
  bump: (b, t) => addTone(b, t, { type: 'square', f0: 180, f1: 110, dur: 0.1, vol: 0.45 }),
  hit_enemy: (b, t) => addTone(b, t, { type: 'sawtooth', f0: 440, f1: 110, dur: 0.4, vol: 0.5 }),
  hit_piranha: (b, t) => addTone(b, t, { type: 'sawtooth', f0: 440, f1: 110, dur: 0.4, vol: 0.5 }),
  die: (b, t) => addTone(b, t, { type: 'sawtooth', f0: 440, f1: 90, dur: 0.5, vol: 0.55 }),
  powerup: (b, t) => [523, 659, 784, 1047].forEach((f, i) => addTone(b, t + i * 0.08, { type: 'square', f0: f, dur: 0.1, vol: 0.4 })),
  mushroom_spawn: (b, t) => addTone(b, t, { type: 'square', f0: 660, f1: 990, dur: 0.18, vol: 0.35 }),
  win: (b, t) => [523, 659, 784, 1047, 1319].forEach((f, i) => addTone(b, t + i * 0.12, { type: 'square', f0: f, dur: 0.16, vol: 0.45 })),
};

// per-biome bed from the SHARED composer (music-core.js) → identical to the live
// game. Rendered quiet so it sits well under the SFX.
function addMusicBed(buf, durationSec, theme = 'day') {
  for (const n of schedule(theme, 0, durationSec)) {
    addTone(buf, n.t, { type: n.type, f0: n.freq, dur: n.dur, vol: n.vol });
  }
}

export function synthWav(events, frameToSec, durationSec, outPath, { music = true, theme = 'day', startDelay = 0 } = {}) {
  const total = Math.ceil((durationSec + 1) * SR);
  const buf = new Float32Array(total);
  if (music) addMusicBed(buf, durationSec, theme);
  for (const e of events || []) {
    const fn = SFX[e.type]; if (!fn) continue;
    const sec = startDelay + (typeof e.sec === 'number' ? e.sec : frameToSec(e.t));
    if (sec >= 0 && sec < durationSec) fn(buf, sec);
  }
  // float → 16-bit PCM WAV
  const pcm = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) {
    let v = Math.max(-1, Math.min(1, buf[i]));
    pcm.writeInt16LE((v * 32767) | 0, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(outPath, Buffer.concat([header, pcm]));
  return outPath;
}
