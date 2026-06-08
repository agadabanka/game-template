// ── Watch & Annotate mode ───────────────────────────────────────────────
// A review mode: the AI plays the level while YOU watch; pause anytime, REWIND
// (scrub the timeline back), and drop a note pinned to that exact moment +
// level position. Notes POST to /api/notes (same channel Claude reads).
//
// Activated when the game is in annotate mode (Title passes ?mode=annotate or
// scene data). A bottom control bar + a note box are DOM overlays so input is
// reliable. Rewind re-positions the camera/player to a buffered moment.
export function installAnnotate(game) {
  // only attach once Play is active and the debug API exists
  let bar, scrub, noteBox, ta, started = false, playing = true;

  function api() { return window.__game; }
  function playScene() { return game.scene.getScenes(true).find((s) => s.scene.key === 'Play'); }

  function build() {
    if (bar) return;
    bar = document.createElement('div');
    bar.style.cssText = `position:fixed;left:0;right:0;bottom:0;z-index:55;display:flex;gap:10px;
      align-items:center;padding:12px 16px;background:linear-gradient(transparent,rgba(8,12,24,.9));
      font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e8eefc`;
    bar.innerHTML = `
      <button id="an-play" title="Pause / Play" style="${btn()}">⏸ Pause</button>
      <button id="an-back" title="Rewind 2s" style="${btn()}">⏪ 2s</button>
      <input id="an-scrub" type="range" min="0" max="1000" value="1000"
        style="flex:1;accent-color:#ffd34d;height:6px">
      <span id="an-time" style="font:600 12px system-ui;color:#9fb3e0;min-width:64px;text-align:right">live</span>
      <button id="an-note" style="${btn('#ffd34d', '#20242e')}">📝 Note here</button>
      <button id="an-restart" title="Replay" style="${btn()}">↻ Replay</button>`;
    document.body.appendChild(bar);
    scrub = bar.querySelector('#an-scrub');

    bar.querySelector('#an-play').onclick = togglePlay;
    bar.querySelector('#an-back').onclick = () => seekBy(-120);
    bar.querySelector('#an-note').onclick = openNote;
    bar.querySelector('#an-restart').onclick = () => { const p = playScene(); if (p) { p.scene.restart({ levelId: p.levelId, annotate: true }); started = false; } };
    scrub.oninput = () => { pause(); seekToScrub(); };

    // note box (reuse a minimal version)
    noteBox = document.createElement('div');
    noteBox.style.cssText = `position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;
      background:rgba(8,12,24,.65);backdrop-filter:blur(3px)`;
    noteBox.innerHTML = `<div style="width:min(560px,92vw);background:#121826;border:1px solid #2b3a57;border-radius:16px;padding:20px;color:#e8eefc">
      <strong style="font-size:18px">📝 Note at this moment</strong>
      <div id="an-where" style="font:12px system-ui;color:#9fb3e0;margin:4px 0 10px"></div>
      <textarea id="an-text" rows="4" placeholder="What's wrong / what do you want here?"
        style="width:100%;box-sizing:border-box;background:#0c1020;color:#e8eefc;border:1px solid #2b3a57;border-radius:10px;padding:10px;font-size:15px"></textarea>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button id="an-cancel" style="${btn('#222a3d', '#cfe')}">Cancel</button>
        <button id="an-save" style="${btn('#ffd34d', '#20242e')}">Save note</button>
      </div>
      <div id="an-status" style="font:12px system-ui;color:#7fd88f;margin-top:8px;min-height:16px"></div></div>`;
    document.body.appendChild(noteBox);
    ta = noteBox.querySelector('#an-text');
    noteBox.querySelector('#an-cancel').onclick = () => { noteBox.style.display = 'none'; };
    noteBox.querySelector('#an-save').onclick = saveNote;
  }

  function btn(bg = '#1c2740', fg = '#cfe0ff') {
    return `background:${bg};color:${fg};border:0;border-radius:9px;padding:9px 14px;font:700 13px system-ui;cursor:pointer`;
  }

  function tl() { return api() ? api().timeline() : []; }

  function togglePlay() { playing ? pause() : resume(); }
  function pause() { if (!playing) return; playing = false; api().pauseGame(); bar.querySelector('#an-play').textContent = '▶ Play'; }
  function resume() {
    playing = true; api().resumeGame(); bar.querySelector('#an-play').textContent = '⏸ Pause';
    bar.querySelector('#an-time').textContent = 'live'; scrub.value = 1000;
    const p = playScene(); if (p) p.cameras.main.startFollow(p.player, true, 0.12, 0.12);
  }
  function seekToScrub() {
    const t = tl(); if (!t.length) return;
    const idx = Math.floor((scrub.value / 1000) * (t.length - 1));
    const f = t[idx];
    api().seek(f.f);
    bar.querySelector('#an-time').textContent = `f${f.f} · tile ${Math.round(f.x / 64)}`;
    const p = playScene(); if (p) p.cameras.main.stopFollow();
  }
  function seekBy(frames) {
    pause(); const t = tl(); if (!t.length) return;
    const cur = Math.floor((scrub.value / 1000) * (t.length - 1));
    const idx = Math.max(0, Math.min(t.length - 1, cur + Math.floor(frames / 2)));
    scrub.value = (idx / (t.length - 1)) * 1000; seekToScrub();
  }

  function openNote() {
    pause();
    const t = tl(); const idx = Math.floor((scrub.value / 1000) * (t.length - 1));
    const f = t[idx] || { f: 0, x: 0 };
    noteBox._moment = f;
    noteBox.querySelector('#an-where').textContent = `Level frame ${f.f} · tile ${Math.round(f.x / 64)} · x=${f.x}`;
    noteBox.querySelector('#an-status').textContent = '';
    ta.value = ''; noteBox.style.display = 'flex'; setTimeout(() => ta.focus(), 30);
  }
  async function saveNote() {
    const text = ta.value.trim(); if (!text) { noteBox.style.display = 'none'; return; }
    const f = noteBox._moment; const p = playScene();
    const shot = game.canvas ? game.canvas.toDataURL('image/jpeg', 0.5) : null;
    noteBox.querySelector('#an-status').textContent = 'saving…';
    try {
      const r = await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, kind: 'annotation', scene: 'Play',
          x: f.x, tileC: Math.round(f.x / 64), frame: f.f,
          level: p ? p.levelId : null, shot }),
      });
      const j = await r.json();
      noteBox.querySelector('#an-status').textContent = `saved ✓ (note #${j.count})`;
      setTimeout(() => { noteBox.style.display = 'none'; }, 700);
    } catch (e) { noteBox.querySelector('#an-status').textContent = 'failed: ' + e.message; }
  }

  // poll for Play+autopilot; start the AI once (only in annotate mode)
  const iv = setInterval(() => {
    if (!window.__annotateMode) return;       // play mode → annotate stays dormant
    const p = playScene();
    if (p && api() && !started) {
      build();
      // kick the autopilot so the AI plays while you watch
      try { api().autopilot(true); } catch (e) {}
      started = true;
    }
    // keep the live time readout fresh while playing
    if (started && playing && bar) {
      const t = tl(); if (t.length) bar.querySelector('#an-time').textContent = 'live · tile ' + Math.round(t[t.length - 1].x / 64);
    }
  }, 250);

  // keyboard niceties: space=pause/play, ,/. step
  window.addEventListener('keydown', (e) => {
    if (!started) return;
    if (e.key === 'p' || e.key === 'P') togglePlay();
    else if (e.key === 'ArrowLeft') seekBy(-30);
    else if (e.key === 'ArrowRight') seekBy(30);
  });
}
