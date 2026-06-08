import { GAME_W, GAME_H, C } from '../consts.js';
import { SFX, resumeAudio, Music } from '../audio.js';
import { LEVELS, WORLDS } from '../levels.js';
import { uiTransition } from '../uistate.js';

// one-line feature showcase per ZONE (keyed by world id 101+)
const WORLD_TAGS = {
  101: 'The float · debris gaps · a wrecked hangar',
  102: 'Asteroid-hopping over open vacuum · a patrol drone',
  103: 'Plasma pits · a venting updraft · reactor shafts',
  104: 'The salvage blaster · sealed caches · a repulsor pad',
  105: 'Everything at once · WARDEN · the escape pod',
};

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this._starting = false;                 // reset the start-guard so level-select works after EXIT TO MENU
    uiTransition(this, 'menu');
    // Starsweeper key art (textless space splash of Pip). Fills the screen.
    this.add.image(GAME_W / 2, GAME_H / 2, 'jazz_keyart').setDisplaySize(GAME_W, GAME_H);
    // a soft scrim at the bottom so menu text stays legible over the art
    this.add.rectangle(GAME_W / 2, GAME_H - 70, GAME_W, 140, 0x06101e, 0.55);

    const cx = GAME_W / 2;

    // ── title logo (the art is textless, so draw the wordmark here) ──
    this.add.rectangle(cx, 72, GAME_W, 150, 0x05060c, 0.34);
    this.add.text(cx, 58, 'YOUR GAME', {
      fontFamily: 'PressStart2P', fontSize: '46px', color: '#ffd34d',
      stroke: '#0a0f1e', strokeThickness: 9,
    }).setOrigin(0.5).setShadow(0, 4, '#000', 10, true, true);
    this.add.text(cx, 104, "your tagline here", {
      fontFamily: 'Silkscreen', fontSize: '15px', color: '#9fd6ff', stroke: '#0a0f1e', strokeThickness: 4,
    }).setOrigin(0.5);

    // ── MODE select (top-level: Play vs Watch & Annotate) ──────────────
    this.mode = new URLSearchParams(location.search).get('mode') === 'annotate' ? 'annotate' : 'play';
    this.modeChips = [];
    const modes = [['play', '▶  PLAY'], ['annotate', '👁  WATCH & ANNOTATE']];
    const mgap = 330, mx0 = cx - (modes.length - 1) * mgap / 2;
    modes.forEach(([id, text], i) => {
      const x = mx0 + i * mgap, y = 300;
      const box = this.add.rectangle(x, y, 300, 42, 0x12182b, 0.6).setStrokeStyle(3, 0x5fd66e, 0.0).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, text, { fontFamily: 'PressStart2P', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
      this.modeChips.push({ box, label, id });
      box.on('pointerover', () => this.setMode(id));
      box.on('pointerdown', () => { this.setMode(id); });
    });

    // ── WORLD select — clickable thumbnail cards (the 5 merged worlds) ─────
    this.worlds = (WORLDS || []).map((w, i) => ({ id: w.id, num: i + 1, name: w.name, tag: WORLD_TAGS[w.id] || '' }));
    // ?level= accepts a world id (101+) → selects that card; an original level id
    // (1..13) → starts that level directly (for the eval/record tools, no card
    // highlighted); anything else → default to World 1.
    const wantLv = Number(new URLSearchParams(location.search).get('level')) || 0;
    const isWorld = this.worlds.some((w) => w.id === wantLv);
    const isLevel = wantLv >= 1 && wantLv <= LEVELS.length;
    this.selected = isWorld || isLevel ? wantLv : (this.worlds[0] ? this.worlds[0].id : 1);

    this.add.text(cx, 352, 'SELECT A ZONE', { fontFamily: 'PressStart2P', fontSize: '14px', color: '#cdd9f5' }).setOrigin(0.5);

    this.chips = [];
    const cw = 200, ch = 113, step = cw + 22, cy = 462;
    const x0 = cx - (this.worlds.length - 1) * step / 2;
    this.worlds.forEach((w, i) => {
      const x = x0 + i * step;
      const card = this.add.container(x, cy);
      const border = this.add.rectangle(0, 0, cw + 8, ch + 8, 0x0b1020, 0.9).setStrokeStyle(3, 0xffd34d, 0);
      const thumb = this.textures.exists(`thumb_w${w.num}`)
        ? this.add.image(0, 0, `thumb_w${w.num}`).setDisplaySize(cw, ch)
        : this.add.rectangle(0, 0, cw, ch, 0x1b2440, 1);
      const badge = this.add.text(-cw / 2 + 6, -ch / 2 + 4, String(w.num), { fontFamily: 'PressStart2P', fontSize: '16px', color: '#ffd34d', stroke: '#000', strokeThickness: 4 }).setOrigin(0, 0);
      const name = this.add.text(0, ch / 2 + 16, w.name, { fontFamily: 'Silkscreen', fontSize: '15px', color: '#e7edff' }).setOrigin(0.5);
      card.add([border, thumb, badge, name]);
      // A Zone is the hit target — invisible, unscaled, so it stays reliable even
      // when the selected card scales up (a scaled container's hit area drifts).
      const zone = this.add.zone(x, cy + 8, cw + 14, ch + 50).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.highlight(w.id));
      zone.on('pointerdown', () => { this.highlight(w.id); this.startGame(); });
      const chip = { card, border, label: name, id: w.id, num: w.num, name: w.name, tag: w.tag };
      this.chips.push(chip);
    });

    // the selected world's feature tagline — the "showcase" line
    this.levelName = this.add.text(cx, cy + ch / 2 + 46, '', { fontFamily: 'PressStart2P', fontSize: '12px', color: '#ffd98a' }).setOrigin(0.5);
    this.highlight(this.selected);

    // prompt
    const prompt = this.add.text(cx, GAME_H - 74, 'CLICK A WORLD  —  OR PRESS SPACE TO PLAY', {
      fontFamily: 'PressStart2P', fontSize: '15px', color: '#ffffff', stroke: '#1c2740', strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    this.add.text(cx, GAME_H - 96, 'A placeholder story line — replace this in Title.js for your game.', {
      fontFamily: 'Silkscreen', fontSize: '14px', color: '#ffe08a', stroke: '#1c2740', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(cx, GAME_H - 44, '◀ 1–5 ▶ PICK ZONE   ·   JOYSTICK / A·D   FLOAT-JUMP: ↑/SPACE   DIVE: ↓   BLAST: F', {
      fontFamily: 'Silkscreen', fontSize: '13px', color: '#9fb3e0',
    }).setOrigin(0.5);

    // top-right links: the build diary + the level builder (the design-lens and
    // game-diff dev/meta pages were removed in the cleanup pass).
    const diary = this.add.text(GAME_W - 16, 16, '📖 build diary & notes →', {
      fontFamily: 'Silkscreen', fontSize: '14px', color: '#ffd98a',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    diary.on('pointerdown', () => { window.location.href = '/diary.html'; });
    const builder = this.add.text(GAME_W - 16, 40, '🧱 level builder →', {
      fontFamily: 'Silkscreen', fontSize: '14px', color: '#9fd6ff',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    builder.on('pointerdown', () => { window.location.href = '/build.html'; });

    // keys: 1-5 pick a world; ←/→ move the selection; space/up start it
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((name, i) => {
      this.input.keyboard.on('keydown-' + name, () => { if (this.worlds[i]) this.highlight(this.worlds[i].id); });
    });
    this.input.keyboard.on('keydown-RIGHT', () => this.moveSel(1));
    this.input.keyboard.on('keydown-LEFT', () => this.moveSel(-1));
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard.once('keydown-UP', () => this.startGame());
    this.input.keyboard.once('keydown-Z', () => this.startGame());
    this.setMode(this.mode);
    this.cameras.main.fadeIn(280, 0, 0, 0);

    // title theme — start on the first user gesture (browser autoplay policy
    // blocks audio until then). Hovering a world card or any key kicks it off.
    const kickMusic = () => { resumeAudio(); Music.start('title'); };
    this.input.once('pointermove', kickMusic);
    this.input.once('pointerdown', kickMusic);
    this.input.keyboard.once('keydown', kickMusic);
    this.events.once('shutdown', () => Music.stop());
  }

  setMode(id) {
    this.mode = id;
    (this.modeChips || []).forEach((c) => {
      const on = c.id === id;
      c.box.setStrokeStyle(3, 0x5fd66e, on ? 1 : 0.0);
      c.box.setFillStyle(0x12182b, on ? 0.95 : 0.5);
      c.label.setColor(on ? '#5fd66e' : '#ffffff');
      c.box.setScale(on ? 1.04 : 1);
    });
  }

  // step the selection along the world row (keyboard ←/→)
  moveSel(d) {
    const idx = this.chips.findIndex((c) => c.id === this.selected);
    const n = this.chips.length; if (!n) return;
    const next = this.chips[(idx + d + n) % n];
    if (next) this.highlight(next.id);
  }

  highlight(id) {
    this.selected = id;
    let sel = null;
    this.chips.forEach((c) => {
      const on = c.id === id;
      if (on) sel = c;
      c.border.setStrokeStyle(4, 0xffd34d, on ? 1 : 0.0);
      c.card.setScale(on ? 1.08 : 1);
      c.card.setDepth(on ? 5 : 0);
      c.label.setColor(on ? '#ffd34d' : '#e7edff');
    });
    if (this.levelName && sel) this.levelName.setText(sel.tag.toUpperCase());
  }

  startGame() {
    if (this._starting) return; this._starting = true;
    this.game.registry.set('checkpointCol', null);        // a fresh run starts at the level's start
    this.game.registry.set('introFor', null);             // re-show the level intro card on a fresh entry
    this.game.registry.set('lives', null);                // fresh 3 hearts
    window.__annotateMode = (this.mode === 'annotate');   // tell annotate.js to activate
    resumeAudio(); SFX.start();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => this.scene.start('Play', { levelId: this.selected, annotate: this.mode === 'annotate' }));
  }

  update() {
    if (this.cloudBand) this.cloudBand.tilePositionX += 0.12;
  }
}
