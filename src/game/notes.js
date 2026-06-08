// Notes system — the designer's live feedback channel.
// Press N anytime in-game: the action pauses, a screenshot of the current
// frame is grabbed, and a small overlay lets you type a note pinned to the
// player's exact world x/y + tile column + scene. It POSTs to /api/notes
// (persisted to the Railway volume) so Claude can read and act on it.
//
// This is a DOM overlay (not a Phaser scene) so typing is reliable on mobile.
export function installNotes(game) {
  let open = false;
  const root = document.createElement('div');
  root.id = 'notes-overlay';
  root.style.cssText = `position:fixed;inset:0;z-index:50;display:none;align-items:center;
    justify-content:center;background:rgba(8,12,24,.62);backdrop-filter:blur(3px);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;`;
  root.innerHTML = `
    <div style="width:min(560px,92vw);background:#121826;border:1px solid #2b3a57;
         border-radius:16px;padding:20px 20px 16px;box-shadow:0 30px 80px rgba(0,0,0,.6);color:#e8eefc">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:20px">📝</span>
        <strong style="font-size:18px">Design note</strong>
        <span id="note-where" style="margin-left:auto;font-size:12px;color:#9fb3e0"></span>
      </div>
      <p style="margin:.2em 0 .7em;font-size:13px;color:#9fb3e0">
        Pinned to this exact spot in the level. What do you want changed or added here?</p>
      <textarea id="note-text" rows="4" placeholder="e.g. add a coin arc over this gap; this jump feels too far; enemy here is unfair…"
        style="width:100%;box-sizing:border-box;background:#0c1020;color:#e8eefc;border:1px solid #2b3a57;
        border-radius:10px;padding:10px;font-size:15px;resize:vertical"></textarea>
      <button id="note-video" style="width:100%;margin-top:4px;background:#1c2740;color:#cfe0ff;border:1px solid #2b3a57;border-radius:10px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;text-align:left">
        🎬 Request an AI playthrough video <span style="color:#9fb3e0;font-weight:400">— watch the AI play this level, then I review it</span>
      </button>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button id="note-cancel" style="background:#222a3d;color:#cfe;border:0;border-radius:9px;padding:9px 16px;font-size:14px;cursor:pointer">Cancel (Esc)</button>
        <button id="note-save" style="background:#ffd34d;color:#20242e;border:0;border-radius:9px;padding:9px 18px;font-weight:800;font-size:14px;cursor:pointer">Save note ⏎</button>
      </div>
      <div id="note-status" style="font-size:12px;color:#7fd88f;margin-top:8px;min-height:16px"></div>
    </div>`;
  document.body.appendChild(root);
  const ta = root.querySelector('#note-text');
  const where = root.querySelector('#note-where');
  const status = root.querySelector('#note-status');

  function activeScene() {
    const scenes = game.scene.getScenes(true);
    return scenes.find((s) => s.scene.key === 'Play') || scenes[scenes.length - 1];
  }

  function show() {
    if (open) return;
    open = true;
    const sc = activeScene();
    let info = { x: null, y: null, tileC: null, scene: sc ? sc.scene.key : null };
    if (sc && sc.player) {
      info = { x: Math.round(sc.player.x), y: Math.round(sc.player.y), tileC: Math.round(sc.player.x / 64), scene: 'Play' };
      if (sc.scene.isActive()) sc.scene.pause();
    }
    root._info = info;
    root._shot = game.canvas ? game.canvas.toDataURL('image/jpeg', 0.5) : null; // small
    where.textContent = info.scene === 'Play' ? `x=${info.x} (tile ${info.tileC})` : (info.scene || '');
    root.style.display = 'flex';
    ta.value = ''; status.textContent = '';
    setTimeout(() => ta.focus(), 30);
  }

  function hide() {
    open = false;
    root.style.display = 'none';
    const sc = activeScene();
    if (sc && sc.scene.isPaused()) sc.scene.resume();
  }

  async function post(payload, okMsg) {
    status.style.color = '#9fb3e0'; status.textContent = 'saving…';
    try {
      const r = await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      status.style.color = '#7fd88f';
      status.textContent = `${okMsg} (note #${j.count})`;
      setTimeout(hide, 900);
    } catch (e) {
      status.style.color = '#ff8b8b';
      status.textContent = 'save failed: ' + e.message;
    }
  }

  function save() {
    const text = ta.value.trim();
    if (!text) { hide(); return; }
    post({ text, ...root._info, shot: root._shot }, 'saved ✓');
  }

  // Default option: ask for an AI playthrough video. Saved as a typed note so
  // Claude knows to record tools/eval/record.mjs and show the result.
  function requestVideo() {
    const extra = ta.value.trim();
    post({
      text: '🎬 AI PLAYTHROUGH VIDEO REQUEST' + (extra ? ` — ${extra}` : ''),
      kind: 'video_request', ...root._info, shot: root._shot,
    }, 'requested ✓ — Claude will record & show the video');
  }

  root.querySelector('#note-save').onclick = save;
  root.querySelector('#note-video').onclick = requestVideo;
  root.querySelector('#note-cancel').onclick = hide;
  window.addEventListener('keydown', (e) => {
    if (!open && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); show(); }
    else if (open && e.key === 'Escape') hide();
    else if (open && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
    else if (open && e.key === 'Enter' && document.activeElement === ta && !e.shiftKey) { e.preventDefault(); save(); }
  });

  // small persistent hint on the title/HUD
  const hint = document.createElement('div');
  hint.textContent = 'Press N to leave a note';
  hint.style.cssText = `position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:40;
    font:600 12px system-ui;color:#cdd9f5;background:rgba(12,16,32,.5);padding:5px 12px;border-radius:20px;pointer-events:none`;
  document.body.appendChild(hint);
}
