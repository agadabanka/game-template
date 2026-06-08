import { GAME_W, GAME_H } from '../consts.js';
import { setMuted, isMuted, resumeAudio } from '../audio.js';
import { uiTransition } from '../uistate.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    const pill = (x, w) => this.add.rectangle(x, 44, w, 56, 0x12182b, 0.55).setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.12).setScrollFactor(0);
    const label = (x, txt, color = '#ffffff') => this.add.text(x, 44, txt, {
      fontFamily: 'PressStart2P', fontSize: '17px', color, stroke: '#0c1020', strokeThickness: 5,
    }).setOrigin(0, 0.5).setScrollFactor(0);

    pill(24, 220);
    this.add.sprite(54, 44, 'coin0').setScale(0.8).setScrollFactor(0).play('coin_spin');
    this.coinText = label(82, '× 0', '#ffe79a');

    pill(260, 230);
    this.add.text(280, 44, 'SCORE', { fontFamily: 'PressStart2P', fontSize: '11px', color: '#9fb3e0' }).setOrigin(0, 0.5).setScrollFactor(0);
    this.scoreText = label(360, '0');

    pill(GAME_W - 250, 226);
    this.add.text(GAME_W - 230, 44, 'TIME', { fontFamily: 'PressStart2P', fontSize: '11px', color: '#9fb3e0' }).setOrigin(0, 0.5).setScrollFactor(0);
    this.timeText = label(GAME_W - 150, '300');

    // lives (hearts)
    this.hearts = [];
    for (let i = 0; i < 3; i++) {
      const h = this.add.text(GAME_W - 470 + i * 40, 44, '♥', {
        fontFamily: 'PressStart2P', fontSize: '22px', color: '#ff5d6c', stroke: '#0c1020', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0);
      this.hearts.push(h);
    }

    this.muteBtn = this.add.text(GAME_W - 44, GAME_H - 40, isMuted() ? '🔇' : '🔊', { fontSize: '30px' })
      .setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => this.toggleMute());

    this.buildControls();
    this.msg = null;
    this._prevLives = null;
    this._paused = false;

    // ── PAUSE button (top-right, below the HUD pills) → pause + Resume / Exit to
    //    menu. Also bound to P / ESC. The autopilot never taps it, so recordings
    //    and the eval are unaffected. ──
    const pb = this.add.circle(GAME_W - 44, 112, 30, 0x12182b, 0.6).setScrollFactor(0).setDepth(60)
      .setStrokeStyle(3, 0xffffff, 0.32).setInteractive({ useHandCursor: true });
    this.add.rectangle(GAME_W - 51, 112, 7, 24, 0xffffff).setScrollFactor(0).setDepth(61);
    this.add.rectangle(GAME_W - 37, 112, 7, 24, 0xffffff).setScrollFactor(0).setDepth(61);
    pb.on('pointerdown', () => this.pauseGame());
    this.input.keyboard.on('keydown-P', () => (this._paused ? this.resumeGame() : this.pauseGame()));
    this.input.keyboard.on('keydown-ESC', () => (this._paused ? this.resumeGame() : this.pauseGame()));

    // FELT-INTEREST OVERLAY: if a recording injected window.__CURVE (the eval's
    // per-window interest curve for this level), draw it on the canvas with a
    // playhead that tracks the frog — so the video and the felt-eval are the SAME
    // artifact, closing the gap between "what we measured" and "what you see".
    if (typeof window !== 'undefined' && window.__CURVE) this.setupCurveOverlay(window.__CURVE);
  }

  // draw the static curve once; the playhead is moved each frame by setPlayhead.
  setupCurveOverlay(data) {
    const curve = (data.curve || []).map(Number);
    if (!curve.length) return;
    const n = curve.length;
    const X0 = 26, X1 = GAME_W - 26, Y0 = 84, Y1 = 168;
    const idealAt = (t) => 4 + 4 * t + 2.2 * Math.exp(-(((t - 0.84) / 0.11) ** 2));
    const sx = (i) => X0 + (n > 1 ? i / (n - 1) : 0) * (X1 - X0);
    const sy = (v) => Y1 - (Math.max(0, Math.min(10, v)) / 10) * (Y1 - Y0);
    this.add.rectangle(X0 - 8, Y0 - 22, (X1 - X0) + 16, (Y1 - Y0) + 38, 0x0c1020, 0.74)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(70).setStrokeStyle(2, 0xffffff, 0.14);
    this.add.text(X0, Y0 - 18, `FELT INTEREST  ·  ${data.name || ''}`,
      { fontFamily: 'PressStart2P', fontSize: '10px', color: '#9fb3e0' }).setScrollFactor(0).setDepth(72);
    // ideal curve (faint reference line: hook → rising peaks → late climax)
    const gi = this.add.graphics().setScrollFactor(0).setDepth(71);
    gi.lineStyle(2, 0x5a6a92, 0.55);
    for (let i = 0; i < n; i++) { const x = sx(i), y = sy(idealAt(n > 1 ? i / (n - 1) : 0)); i ? gi.lineTo(x, y) : (gi.beginPath(), gi.moveTo(x, y)); }
    gi.strokePath();
    // measured curve: filled area + bright line
    const g = this.add.graphics().setScrollFactor(0).setDepth(71);
    g.fillStyle(0x47b6ff, 0.18); g.beginPath(); g.moveTo(sx(0), Y1);
    for (let i = 0; i < n; i++) g.lineTo(sx(i), sy(curve[i]));
    g.lineTo(sx(n - 1), Y1); g.closePath(); g.fillPath();
    g.lineStyle(3, 0x47b6ff, 0.95); g.beginPath();
    for (let i = 0; i < n; i++) { const x = sx(i), y = sy(curve[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokePath();
    this.playhead = this.add.graphics().setScrollFactor(0).setDepth(73);
    this.playDot = this.add.circle(sx(0), sy(curve[0]), 6, 0xffd34d).setScrollFactor(0).setDepth(74).setStrokeStyle(2, 0x20242e, 1);
    this._curve = { curve, n, X0, X1, Y0, Y1, sy };
  }

  // called each frame from Play with the frog's world-x → slide the playhead.
  setPlayhead(px, worldW) {
    const c = this._curve; if (!c || !worldW) return;
    const t = Math.max(0, Math.min(1, px / worldW));
    const fi = t * (c.n - 1), i0 = Math.floor(fi), i1 = Math.min(c.n - 1, i0 + 1);
    const val = c.curve[i0] + (c.curve[i1] - c.curve[i0]) * (fi - i0);
    const x = c.X0 + t * (c.X1 - c.X0);
    this.playhead.clear(); this.playhead.lineStyle(2, 0xffd34d, 0.85);
    this.playhead.beginPath(); this.playhead.moveTo(x, c.Y0 - 6); this.playhead.lineTo(x, c.Y1); this.playhead.strokePath();
    this.playDot.setPosition(x, c.sy(val));
  }

  // ONE on-screen control overlay, used both live and in recordings, so the
  // inputs you see in a video EXACTLY match the buttons you play with. Left/right
  // sit bottom-left, jump bottom-right (the mobile convention). The buttons light
  // up as inputs fire (human keyboard, touch, or the AI driver) via setInputViz;
  // on a touch device they're also interactive and drive the shared touch state.
  buildControls() {
    const touch = this.game.registry.get('touch') || {};
    this.game.registry.set('touch', touch);
    this.touchState = touch;
    const isTouch = this.sys.game.device.input.touch || ('ontouchstart' in window);
    // CRITICAL for touch: Phaser starts with ONE pointer, so a second finger
    // steals it from the first. Add pointers so the JOYSTICK (left) + FIRE (right)
    // can be held together.
    if (isTouch) this.input.addPointer(3);
    this.controllerType = (typeof localStorage !== 'undefined' && localStorage.getItem('jazz_controller')) || 'joystick';
    this.ctrlObjs = [];                                 // everything to tear down on a switch
    // ── FIRE (always on the right) — the bazooka ─────────────────────────────
    const y = GAME_H - 80;
    const fx = GAME_W - 116;
    const fbox = this.add.circle(fx, y, 60, 0x3a1420, 0.55).setScrollFactor(0).setDepth(60).setStrokeStyle(3, 0xff5d6c, 0.7);
    const ftext = this.add.text(fx, y, 'F', { fontFamily: 'PressStart2P', fontSize: '24px', color: '#ff8088' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    const flbl = this.add.text(fx, GAME_H - 26, 'FIRE', { fontFamily: 'PressStart2P', fontSize: '9px', color: '#ff8088' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    fbox.setInteractive();
    fbox.on('pointerdown', () => { touch.fire = true; resumeAudio(); });
    fbox.on('pointerup', () => { touch.fire = false; });
    fbox.on('pointerout', () => { touch.fire = false; });
    this.ctrlObjs.push(fbox, ftext, flbl);
    this.keyViz = { fire: { box: fbox, t: ftext } };
    if (this.controllerType === 'dpad') this._buildDpad(touch, isTouch);
    else this._buildJoystick(touch, isTouch);
  }

  // ── analog JOYSTICK (default): left/right = run, up = jump (hold = higher),
  //    down = DIVE. Drag the thumb (touch or mouse). One pointer is claimed for
  //    the stick so FIRE on the other thumb still works. ──
  _buildJoystick(touch, isTouch) {
    const bx = 140, by = GAME_H - 90, R = 74;
    const base = this.add.circle(bx, by, R, 0x0f1528, 0.42).setScrollFactor(0).setDepth(60).setStrokeStyle(3, 0xffffff, 0.28);
    const ring = this.add.circle(bx, by, R, 0x000000, 0).setScrollFactor(0).setDepth(60).setStrokeStyle(2, 0x5fd66e, 0.18);
    const hint = (gx, gy, g) => this.add.text(gx, gy, g, { fontFamily: 'PressStart2P', fontSize: '14px', color: '#9fb3e0' }).setOrigin(0.5).setScrollFactor(0).setDepth(61).setAlpha(0.5);
    const up = hint(bx, by - R + 16, '▲'), dn = hint(bx, by + R - 16, '▼');
    hint(bx - R + 16, by, '◀'); hint(bx + R - 16, by, '▶');
    const thumb = this.add.circle(bx, by, 34, 0x2a3556, 0.95).setScrollFactor(0).setDepth(62).setStrokeStyle(3, 0xffd34d, 0.8);
    this.ctrlObjs.push(base, ring, up, dn, thumb);
    this.joy = { bx, by, R, thumb, base, up, dn, pid: null };
    const setFromPointer = (px, py) => {
      let dx = px - bx, dy = py - by;
      const m = Math.hypot(dx, dy) || 1; if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      thumb.setPosition(bx + dx, by + dy);
      const nx = dx / R, ny = dy / R;
      touch.left = nx < -0.35; touch.right = nx > 0.35;
      touch.jump = ny < -0.45; touch.down = ny > 0.45;
    };
    const release = () => { this.joy.pid = null; thumb.setPosition(bx, by); touch.left = touch.right = touch.jump = touch.down = false; };
    this._joyDown = (pointer) => {
      if (this._paused || this._noteMode) return;
      if (this.joy.pid != null) return;                 // already dragging with another finger
      if (pointer.x > GAME_W * 0.5) return;             // right half is FIRE's territory
      this.joy.pid = pointer.id; resumeAudio(); setFromPointer(pointer.x, pointer.y);
    };
    this._joyMove = (pointer) => { if (pointer.id === this.joy.pid) setFromPointer(pointer.x, pointer.y); };
    this._joyUp = (pointer) => { if (pointer.id === this.joy.pid) release(); };
    this.input.on('pointerdown', this._joyDown);
    this.input.on('pointermove', this._joyMove);
    this.input.on('pointerup', this._joyUp);
  }

  // ── classic D-PAD (alternative) — left/right + jump buttons ──
  _buildDpad(touch, isTouch) {
    const y = GAME_H - 80;
    const mk = (x, glyph, key, r = 52) => {
      const box = this.add.circle(x, y, r, 0x12182b, 0.5).setScrollFactor(0).setDepth(60).setStrokeStyle(3, 0xffffff, 0.32);
      const t = this.add.text(x, y, glyph, { fontFamily: 'PressStart2P', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
      box.setInteractive();
      box.on('pointerdown', () => { touch[key] = true; resumeAudio(); });
      box.on('pointerup', () => { touch[key] = false; });
      box.on('pointerout', () => { touch[key] = false; });
      this.ctrlObjs.push(box, t);
      return { box, t };
    };
    this.keyViz.left = mk(96, '◀', 'left');
    this.keyViz.right = mk(214, '▶', 'right');
    this.keyViz.jump = mk(330, '▲', 'jump', 58);
    this.keyViz.down = mk(440, '▼', 'down', 46);
  }

  // toggle joystick ⇄ d-pad (from the pause menu); persists + rebuilds live
  switchController() {
    this.controllerType = this.controllerType === 'joystick' ? 'dpad' : 'joystick';
    try { localStorage.setItem('jazz_controller', this.controllerType); } catch (e) {}
    if (this._joyDown) { this.input.off('pointerdown', this._joyDown); this.input.off('pointermove', this._joyMove); this.input.off('pointerup', this._joyUp); this._joyDown = null; }
    const t = this.touchState || {}; t.left = t.right = t.jump = t.down = false;
    (this.ctrlObjs || []).forEach((o) => o.destroy());
    this.joy = null; this.keyViz = null;
    this.buildControls();
    return this.controllerType;
  }

  setInputViz(state) {
    if (this.keyViz && this.keyViz.fire) {
      const f = this.keyViz.fire, on = state.fire;
      f.box.setFillStyle(on ? 0xffd34d : 0x3a1420, on ? 0.95 : 0.55);
      f.t.setColor(on ? '#20242e' : '#ff8088'); f.box.setScale(on ? 1.12 : 1);
    }
    if (this.joy && this.joy.pid == null) {
      // reflect the driver's intent on the stick so recordings show it move
      const R = this.joy.R, dx = (state.right ? 1 : state.left ? -1 : 0) * R * 0.6, dy = (state.down ? 1 : state.jump ? -1 : 0) * R * 0.6;
      this.joy.thumb.setPosition(this.joy.bx + dx, this.joy.by + dy);
      this.joy.up.setAlpha(state.jump ? 1 : 0.5); this.joy.dn.setAlpha(state.down ? 1 : 0.5);
    } else if (this.keyViz && this.keyViz.left) {
      const lit = (o, active) => { if (!o) return; o.box.setFillStyle(active ? 0xffd34d : 0x12182b, active ? 0.95 : 0.5); o.t.setColor(active ? '#20242e' : '#ffffff'); o.box.setScale(active ? 1.12 : 1); };
      lit(this.keyViz.left, state.left); lit(this.keyViz.right, state.right); lit(this.keyViz.jump, state.jump); lit(this.keyViz.down, state.down);
    }
  }

  setHud({ score, coins, lives, time }) {
    if (this.scoreText) this.scoreText.setText(String(score).padStart(5, '0'));
    if (this.coinText) this.coinText.setText('× ' + coins);
    if (this.timeText) this.timeText.setText(String(time));
    if (this.hearts) {
      if (this._prevLives == null) this._prevLives = lives;
      this.hearts.forEach((h, i) => {
        if (i >= lives && i < this._prevLives) {
          // this heart was just LOST → a pop-and-fade "count down" beat
          this.tweens.killTweensOf(h);
          h.setAlpha(1).setColor('#ff5d6c').setScale(1);
          this.tweens.add({
            targets: h, scaleX: 2, scaleY: 2, angle: 18, duration: 160, yoyo: true, ease: 'quad.out',
            onComplete: () => h.setAlpha(0.18).setScale(1).setAngle(0),
          });
        } else if (i >= this._prevLives || i >= lives) {
          h.setAlpha(0.18);
        } else {
          h.setAlpha(1);
        }
      });
      this._prevLives = lives;
    }
  }

  // ── pause / exit / game-over overlays ──────────────────────────────────
  pauseGame() {
    const play = this.scene.get('Play');
    if (!play || play.won || play.dead || this._paused) return;
    this._paused = true;
    uiTransition(this, 'paused');
    play.scene.pause();
    this._showPause();
  }

  // the pause menu (shared by first-open and the note flow's return)
  _pauseButtons() {
    const ctrl = this.controllerType === 'dpad' ? 'D-pad' : 'Joystick';
    return [
      ['RESUME', () => this.resumeGame()],
      [`🎮 CONTROLLER: ${ctrl}`, () => { this.switchController(); if (this.overlay) { this.overlay.destroy(); this.overlay = null; } this._showPause(); }],
      ['📝 LEAVE A NOTE', () => this.beginNote()],
      ['📖 DIARY & NOTES', () => window.open('/diary.html', '_blank')],
      ['EXIT TO MENU', () => this.exitToMenu()],
    ];
  }
  _showPause() { this.overlay = this.makeOverlay('PAUSED', this._pauseButtons()); }

  // ── in-play NOTE-TAKING ──────────────────────────────────────────────────
  // From the pause menu: dismiss the menu (game stays paused), let the designer
  // CLICK a spot in the level, then type the issue. The note is pinned at that
  // world position and POSTed to /api/notes (the channel Claude reads). Generic:
  // works in normal play, not just the watch-&-annotate review mode.
  beginNote() {
    if (this._noteMode) return;                 // guard: never arm twice (no double notes)
    this._noteMode = true;
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    const play = this.scene.get('Play');
    const hint = this.add.container(GAME_W / 2, 70).setScrollFactor(0).setDepth(90);
    const hb = this.add.rectangle(0, 0, 620, 50, 0x0c1020, 0.9).setStrokeStyle(2, 0xffd34d, 0.7);
    const ht = this.add.text(0, 0, '📝  CLICK THE SPOT YOU WANT TO NOTE   ·   ESC to cancel', {
      fontFamily: 'Silkscreen', fontSize: '16px', color: '#ffe08a',
    }).setOrigin(0.5);
    hint.add([hb, ht]);
    const disarm = () => { this.input.off('pointerdown', onClick); window.removeEventListener('keydown', escOnce); if (hint.active) hint.destroy(); };
    const cancel = () => { disarm(); this._noteMode = false; this._showPauseAgain(); };
    const escOnce = (e) => { if (e.code === 'Escape') cancel(); };
    window.addEventListener('keydown', escOnce);
    const onClick = (pointer) => {
      disarm();
      const wp = play ? play.cameras.main.getWorldPoint(pointer.x, pointer.y) : { x: pointer.x, y: pointer.y };
      const pin = play && play.addNotePin ? play.addNotePin(wp.x, wp.y, '…') : null;
      this._openNoteBox(wp, pin, play);         // resets _noteMode on close
    };
    // arm on the NEXT frame so the pause-button click that opened this doesn't
    // immediately count as the placement click (that caused the "double note").
    this.time.delayedCall(60, () => { if (this._noteMode) this.input.on('pointerdown', onClick); });
  }

  _showPauseAgain() { this._showPause(); }

  // a DOM note box (reliable text input) → POST to /api/notes
  _openNoteBox(wp, pin, play) {
    const tileC = Math.round(wp.x / 64);
    const shot = this.game.canvas ? this.game.canvas.toDataURL('image/jpeg', 0.5) : null;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(8,12,24,.6)';
    box.innerHTML = `<div style="width:min(560px,92vw);background:#121826;border:1px solid #2b3a57;border-radius:16px;padding:20px;color:#e8eefc;font-family:system-ui,Segoe UI,Roboto,sans-serif">
      <strong style="font-size:18px">📝 Note at tile ${tileC}</strong>
      <div style="font:12px system-ui;color:#9fb3e0;margin:4px 0 10px">${play ? (play.level.name || '') : ''} · x=${Math.round(wp.x)} · the issue / idea you have here</div>
      <textarea id="pn-text" rows="4" placeholder="What's wrong, or what do you want here?" style="width:100%;box-sizing:border-box;background:#0c1020;color:#e8eefc;border:1px solid #2b3a57;border-radius:10px;padding:10px;font-size:15px"></textarea>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button id="pn-cancel" style="background:#222a3d;color:#cfe;border:0;border-radius:9px;padding:9px 14px;font:700 13px system-ui;cursor:pointer">Cancel</button>
        <button id="pn-save" style="background:#ffd34d;color:#20242e;border:0;border-radius:9px;padding:9px 14px;font:700 13px system-ui;cursor:pointer">Save note</button>
      </div>
      <div id="pn-status" style="font:12px system-ui;color:#7fd88f;margin-top:8px;min-height:16px"></div></div>`;
    document.body.appendChild(box);
    const ta = box.querySelector('#pn-text');
    // CRITICAL FIX for "can't type space": the game captures SPACE/W/A/S/D/Z/X/F/J
    // on the WINDOW and preventDefaults them. Stop the textarea's key events from
    // bubbling to the window so the game never sees them — every key types, incl.
    // space. (Belt + suspenders: also disable the game keyboard while open.)
    ['keydown', 'keyup', 'keypress'].forEach((ev) => ta.addEventListener(ev, (e) => e.stopPropagation()));
    const kb = this.game.input && this.game.input.keyboard;
    const wasEnabled = kb ? kb.enabled : true;
    if (kb) kb.enabled = false;
    setTimeout(() => ta.focus(), 30);
    let closed = false;
    const close = () => { if (closed) return; closed = true; if (kb) kb.enabled = wasEnabled; box.remove(); this._noteMode = false; this._showPauseAgain(); };
    box.querySelector('#pn-cancel').onclick = () => { if (pin) pin.destroy(); close(); };
    box.querySelector('#pn-save').onclick = async () => {
      const text = ta.value.trim();
      if (!text) { if (pin) pin.destroy(); close(); return; }
      if (pin) pin._text = text;
      box.querySelector('#pn-status').textContent = 'saving…';
      try {
        const r = await fetch('/api/notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, kind: 'playnote', scene: 'Play',
            x: Math.round(wp.x), y: Math.round(wp.y), tileC, level: play ? (play.levelId ?? (play.level && play.level.id) ?? null) : null, shot }),
        });
        const j = await r.json();
        box.querySelector('#pn-status').textContent = `saved ✓ (note #${j.count}) — view all in the Diary`;
        setTimeout(close, 800);
      } catch (e) { box.querySelector('#pn-status').textContent = 'failed: ' + e.message; }
    };
  }

  resumeGame() {
    if (!this._paused) return;
    this._paused = false;
    uiTransition(this, 'playing');
    const play = this.scene.get('Play');
    if (play) play.scene.resume();
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
  }

  exitToMenu() {
    this._paused = false;
    uiTransition(this, 'menu');
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    const play = this.scene.get('Play');
    if (play) play.scene.stop();
    this.scene.start('Title');          // starting Title from here also shuts down this UI scene
  }

  // shown by Play on a win — celebrates, then Play auto-advances to the next level.
  // Manual NEXT / MENU are offered too. On the final level it's a completion screen.
  showWin(meta, hasNext) {
    uiTransition(this, 'won');
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    if (this.msg) { this.msg.destroy(); this.msg = null; }
    const play = this.scene.get('Play');
    const stats = this.evalLines(meta.stats, true);
    if (hasNext) {
      this.overlay = this.makeOverlay(`${meta.kind} ${meta.num} CLEAR!`, [
        ['NEXT ▶', () => play && play.goNext()],
        ['EXIT TO MENU', () => this.exitToMenu()],
      ], '#ffd34d', stats);
    } else {
      this.overlay = this.makeOverlay('★ CAMPAIGN COMPLETE ★', [
        ['BACK TO MENU', () => this.exitToMenu()],
      ], '#ffd34d', stats);
    }
  }

  // shown by Play when the last heart is spent — a real "game eval" of the run
  showGameOver(stats) {
    uiTransition(this, 'gameover');
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    this.overlay = this.makeOverlay('GAME  OVER', [
      ['RETRY', () => { this.game.registry.set('lives', null); this.game.registry.set('checkpointCol', null); const p = this.scene.get('Play'); if (p) p.scene.restart(); this.scene.restart(); }],
      ['EXIT TO MENU', () => this.exitToMenu()],
    ], '#ff6b6b', this.evalLines(stats, false));
  }

  // turn the run stats into a graded EVAL: a few stat lines + a letter rank.
  // The rank rewards the new verb (bots BLASTED) + carrots + survival, so the
  // results screen reflects how you played, not just whether you finished.
  evalLines(s, won) {
    if (!s) return null;
    const mm = Math.floor((s.time || 0) / 60), ss = String((s.time || 0) % 60).padStart(2, '0');
    const lines = [
      ['SCORE', String(s.score ?? 0)],
      ['CARROTS', String(s.carrots ?? 0)],
      ['BOTS BLASTED', String(s.blasted ?? 0)],
      ['BOTS STOMPED', String(s.stomped ?? 0)],
      ['HEARTS LEFT', '❤'.repeat(Math.max(0, s.hearts ?? 0)) || '—'],
      ['TIME', `${mm}:${ss}`],
    ];
    // grade: blasting + carrots + clean survival → higher rank (S/A/B/C)
    const pts = (s.blasted || 0) * 3 + (s.stomped || 0) + (s.carrots || 0) * 0.5 + (won ? (s.hearts || 0) * 4 : 0);
    const rank = !won ? 'D' : pts >= 40 ? 'S' : pts >= 24 ? 'A' : pts >= 12 ? 'B' : 'C';
    return { lines, rank };
  }

  makeOverlay(title, buttons, color = '#ffd34d', evalData = null) {
    const sLines = evalData ? evalData.lines : [];
    const statsH = sLines.length ? sLines.length * 30 + 52 : 0;
    const c = this.add.container(GAME_W / 2, GAME_H / 2).setScrollFactor(0).setDepth(80);
    const h = 110 + statsH + buttons.length * 72;
    const bg = this.add.rectangle(0, 0, 660, h, 0x0c1020, 0.94).setStrokeStyle(3, 0xffffff, 0.2);
    const t = this.add.text(0, -h / 2 + 42, title, {
      fontFamily: 'PressStart2P', fontSize: '28px', color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([bg, t]);
    let y = -h / 2 + 96;
    if (evalData) {
      // RANK badge
      const rc = { S: '#ffd34d', A: '#5fd66e', B: '#9fd6ff', C: '#cdd9f5', D: '#ff8a8a' }[evalData.rank] || '#fff';
      const rk = this.add.text(0, y, `RANK  ${evalData.rank}`, { fontFamily: 'PressStart2P', fontSize: '20px', color: rc, stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
      c.add(rk); y += 40;
      sLines.forEach(([label, val]) => {
        const ll = this.add.text(-250, y, label, { fontFamily: 'Silkscreen', fontSize: '17px', color: '#9fb3e0' }).setOrigin(0, 0.5);
        const vv = this.add.text(250, y, val, { fontFamily: 'Silkscreen', fontSize: '17px', color: '#ffffff' }).setOrigin(1, 0.5);
        c.add([ll, vv]); y += 30;
      });
      y += 14;
    }
    buttons.forEach(([label, fn], i) => {
      const by = y + i * 72;
      const box = this.add.rectangle(0, by, 400, 54, 0x1b2440, 0.95).setStrokeStyle(3, 0x5fd66e, 0.55).setInteractive({ useHandCursor: true });
      const lt = this.add.text(0, by, label, { fontFamily: 'PressStart2P', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerover', () => { box.setStrokeStyle(3, 0x5fd66e, 1).setScale(1.04); });
      box.on('pointerout', () => { box.setStrokeStyle(3, 0x5fd66e, 0.55).setScale(1); });
      box.on('pointerdown', fn);
      c.add([box, lt]);
    });
    c.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 250, ease: 'back.out' });
    return c;
  }

  toggleMute() { setMuted(!isMuted()); resumeAudio(); this.muteBtn.setText(isMuted() ? '🔇' : '🔊'); }

  showMessage(text, color) {
    if (this.msg) this.msg.destroy();
    const box = this.add.container(GAME_W / 2, GAME_H / 2).setScrollFactor(0).setDepth(50);
    const bg = this.add.rectangle(0, 0, 760, 160, 0x0c1020, 0.82).setStrokeStyle(3, 0xffffff, 0.18);
    const t = this.add.text(0, 0, text, {
      fontFamily: 'PressStart2P', fontSize: '22px', color, align: 'center', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);
    box.add([bg, t]); box.setScale(0.6); box.setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 300, ease: 'back.out' });
    this.msg = box;

    const restart = () => { const play = this.scene.get('Play'); if (play) play.scene.restart(); this.scene.restart(); };
    this.input.keyboard.once('keydown-R', restart);
    this.input.once('pointerdown', () => this.time.delayedCall(50, restart));
  }
}
