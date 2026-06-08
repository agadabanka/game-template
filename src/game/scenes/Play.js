import { TILE, GAME_W, GAME_H, TUNE, C } from '../consts.js';
import { ENEMY_SPRITES } from '../assets.js';
import { MATERIALS, materialTex } from '../materials.js';
import { buildLevelById, LEVELS, WORLDS } from '../levels.js';
import { biomeOf } from '../themes.js';
import { SFX, resumeAudio, Music } from '../audio.js';
import { uiTransition } from '../uistate.js';
import { Debug } from '../debug.js';
import { PowerUps } from '../powerup.js';

export class PlayScene extends Phaser.Scene {
  constructor() { super('Play'); }

  init(data) {
    // level id from scene data, ?level= param, or default 1
    const param = Number(new URLSearchParams(location.search).get('level'));
    this.levelId = (data && data.levelId) || (param > 0 ? param : 1);
  }

  create() {
    resumeAudio();
    // a co-designed level can be injected (window.__CUSTOM_LEVEL) so the play agent
    // can play what the design agent produced; otherwise build by id.
    this.level = (typeof window !== 'undefined' && window.__CUSTOM_LEVEL) ? window.__CUSTOM_LEVEL : buildLevelById(this.levelId);
    const L = this.level;
    this.theme = L.theme || 'day';
    this.worldW = L.W * TILE;
    this.worldH = L.H * TILE;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH + TILE * 3);

    // lives PERSIST across a checkpoint respawn (registry); reset to 3 on a fresh
    // level entry / next level (Title.startGame, goNext). Score/coins reset per try.
    this.score = 0; this.coinCount = 0; this.lives = this.game.registry.get('lives') ?? 3; this.won = false; this.dead = false;
    this.timeLeft = 300;
    this.botsBlasted = 0; this.botsStomped = 0; this.shotsFired = 0;   // run stats → the win EVAL

    this.dbg = new Debug(this);
    this.buildBackground();
    this.buildSolids();
    this.buildHazards();
    this.buildInteractive();
    this.buildPiranhas();
    this.buildPlayer();
    this.buildBlastblocks();        // shoot-to-clear crates (guard reward caches)
    this.buildGoal();
    this.buildCheckpoints();      // spawn-point markers (note #11)
    this.buildParticles();
    this.buildSprings();
    this.buildOneways();
    this.buildConveyors();
    this.buildMovers();
    this.buildDashpads();
    this.buildStickies();
    this.buildBouncers();
    this.buildZones();
    this.buildPeriodics();
    this.buildFirebars();
    this.buildCrumbles();
    this.setupCamera();
    this.setupInput();
    this.setupColliders();
    this.buildProjectiles();                 // the bazooka (texture only; physics is lazy)
    this.powerups = new PowerUps(this);     // mushroom + small/big/invuln state
    this.sfxPower = () => SFX.power();

    this.scene.launch('UI');
    this.ui = this.scene.get('UI');
    this.time.delayedCall(50, () => this.emitHud());

    this.timerEv = this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        if (this.won || this.dead) return;
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        this.emitHud();
        if (this.timeLeft === 0) this.die();
      },
    });

    uiTransition(this, 'playing');
    // per-biome background music (Lyria-ready; chiptune fallback). Stops on leave.
    Music.start(this.theme);
    this.events.once('shutdown', () => Music.stop());

    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.showLevelIntro();
    this.buildNotePins();          // show any notes already left on this level
  }

  // ── BLAST CRATES: destructible, shoot-only blocks that GUARD reward caches ──
  // Solid to the player (a wall you must blast), popped by a rocket. Deliberately
  // kept OUT of the autopilot's _solidSet: they only ever guard OPTIONAL elevated
  // caches (never the ground path), so the 0-death gate (which never fires) just
  // walks past — the shoot+jump beat is a player reward, not a gate dependency.
  buildBlastblocks() {
    this.blastblocks = this.physics.add.staticGroup();
    (this.level.blastblocks || []).forEach(({ c, r }) => {
      const [x, y] = this.tileXY(c, r);
      const b = this.blastblocks.create(x, y, 'blastblock'); b.refreshBody();
    });
    if (this.player) this.physics.add.collider(this.player, this.blastblocks);
  }

  onRocketBlast(rocket, crate) {
    if (!rocket.active || !crate.active) return;
    this._boom(rocket.x, rocket.y); rocket.destroy();
    this.chunks.emitParticleAt(crate.x, crate.y, 10);
    crate.destroy();
    this.score += 75; this.emitHud();
    if (this.dbg) this.dbg.log('blast_crate', { x: Math.round(crate.x) });
  }

  // ── design notes pinned in the WORLD ─────────────────────────────────────
  // A note is a 📌 marker at a world position (scrolls with the level). Players
  // drop them from the pause menu (UI.beginNote); they persist via /api/notes.
  buildNotePins() {
    this.notePins = this.add.group();
    fetch('/api/notes').then((r) => r.json()).then((j) => {
      (j.notes || []).forEach((n) => {
        if (n.scene === 'Play' && Number(n.level) === Number(this.levelId) && n.x != null) {
          this.addNotePin(n.x, n.y || (this.level.groundTop - 3) * TILE, n.text);
        }
      });
    }).catch(() => {});
  }

  // place a pin at a WORLD position; returns a handle so the caller can update it
  addNotePin(wx, wy, text = '') {
    const c = this.add.container(wx, wy).setDepth(70);
    const stem = this.add.rectangle(0, 8, 3, 16, 0xffd34d);
    const head = this.add.circle(0, -4, 11, 0xff5a5a).setStrokeStyle(2, 0xffffff);
    const dot = this.add.text(0, -4, '!', { fontFamily: 'PressStart2P', fontSize: '11px', color: '#fff' }).setOrigin(0.5);
    c.add([stem, head, dot]);
    c._text = text;
    // tap a pin to read its note
    head.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.ui && this.ui.showMessage) this.ui.showMessage('📝 ' + (c._text || '(empty)'), '#ffd98a');
    });
    if (this.notePins) this.notePins.add(c);
    this.tweens.add({ targets: head, y: -8, duration: 600, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    return c;
  }

  // ── level identity + progression ─────────────────────────────────────
  // generic: worlds (101+) chain within the merged campaign; original levels
  // chain within 1..N. Returns the next id, or null at the end.
  levelMeta() {
    const id = this.levelId;
    if (id >= 101) { const i = (WORLDS || []).findIndex((w) => w.id === id); return { kind: 'WORLD', num: i >= 0 ? i + 1 : id - 100, name: this.level.name }; }
    return { kind: 'LEVEL', num: id, name: this.level.name };
  }

  nextLevelId() {
    const id = this.levelId;
    if (id >= 101) { const ids = (WORLDS || []).map((w) => w.id); const i = ids.indexOf(id); return i >= 0 && i < ids.length - 1 ? ids[i + 1] : null; }
    return id < LEVELS.length ? id + 1 : null;
  }

  // a brief, non-blocking "WORLD 2 · EMBERFALL KEEP" card on entry (fade in/out).
  // Purely cosmetic + screen-fixed, so the autopilot/eval play under it untouched.
  // Shows once per FRESH entry (a new level / from the menu) — NOT on a death-restart
  // of the same level (Title.startGame clears the marker; goNext lands a new id).
  showLevelIntro() {
    if (this.game.registry.get('introFor') === this.levelId) return;
    this.game.registry.set('introFor', this.levelId);
    const m = this.levelMeta();
    // story beat per world (from STORY.md) — the narrative the blaster serves
    const BEATS = { 101: 'Grab the blaster. Light it up.', 102: 'Chase the convoy before dark.', 103: 'Cross the dunes to the depot.', 104: 'Shut the foundry down.', 105: 'Storm the fortress. Free the warren.' };
    const beat = BEATS[this.levelId] || '';
    const c = this.add.container(GAME_W / 2, GAME_H / 2 - 10).setScrollFactor(0).setDepth(95);
    const band = this.add.rectangle(0, 0, GAME_W, 170, 0x0b1020, 0.0);
    const kick = this.add.text(0, -40, `${m.kind} ${m.num}`, { fontFamily: 'PressStart2P', fontSize: '20px', color: '#ffd34d', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    const name = this.add.text(0, 4, String(m.name || '').toUpperCase(), { fontFamily: 'PressStart2P', fontSize: '30px', color: '#ffffff', stroke: '#000', strokeThickness: 7 }).setOrigin(0.5);
    const tag = this.add.text(0, 42, beat, { fontFamily: 'Silkscreen', fontSize: '16px', color: '#9fe8ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    c.add([band, kick, name, tag]); c.setAlpha(0);
    this.tweens.add({ targets: band, fillAlpha: 0.6, duration: 280, yoyo: true, hold: 1000 });
    this.tweens.add({ targets: c, alpha: 1, duration: 280, ease: 'quad.out',
      onComplete: () => this.tweens.add({ targets: c, alpha: 0, delay: 1000, duration: 420, onComplete: () => c.destroy() }) });
  }

  // advance to the next level (or finish) with a clean fade transition
  goNext() {
    if (this._advancing) return; this._advancing = true;
    const next = this.nextLevelId();
    this.cameras.main.fadeOut(380, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const ui = this.scene.get('UI'); if (ui) ui.scene.stop();
      if (next != null) this.scene.start('Play', { levelId: next });
      else this.scene.start('Title');
    });
  }

  // ── world ────────────────────────────────────────────────────────────
  tileXY(c, r) { return [c * TILE + TILE / 2, r * TILE + TILE / 2]; }

  buildBackground() {
    const horizonY = this.level.groundTop * TILE;
    // Jazz: a lush cartoon backdrop per world (a static skybox), replacing the
    // pixel sky + parallax — the big "beautiful" lever, coherent with the hero.
    const bgKey = 'jazzbg_' + this.theme;
    if (this.textures.exists(bgKey)) {
      this.add.image(0, 0, bgKey).setOrigin(0, 0).setScrollFactor(0).setDepth(-100).setDisplaySize(GAME_W, GAME_H);
      return;
    }
    const biome = biomeOf(this.theme);
    const back = biome.back;
    const tint = biome.backTint;
    // 1) the sky image: day bands / dark cave / azure sky, or this biome's baked sky
    const skyKey = this.theme === 'day' ? 'sky_px'
      : this.theme === 'cave' ? 'sky_cave'
      : this.theme === 'sky' ? 'sky_sky' : 'sky_' + this.theme;
    this.add.image(0, 0, this.textures.exists(skyKey) ? skyKey : 'sky_px')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(-100).setDisplaySize(GAME_W, GAME_H);

    // 2) enclosed cave / crystal hollow: a single tinted rock parallax band (the
    //    ceiling is built in buildSolids).
    if (back === 'cave') {
      this.add.tileSprite(0, horizonY + 14, this.worldW, 18 * 4, 'bg_hills_near')
        .setOrigin(0, 1).setScrollFactor(0.4).setDepth(-86).setTint(tint || 0x24405e).setAlpha(0.7);
      return;
    }
    // 3) high-altitude sky: only drifting cloud layers
    if (back === 'sky') {
      this.cloudBand = this.add.tileSprite(0, 90, this.worldW, 256, 'bg_clouds')
        .setOrigin(0, 0).setScrollFactor(0.25).setDepth(-94);
      this.add.tileSprite(0, GAME_H * 0.52, this.worldW, 256, 'bg_clouds')
        .setOrigin(0, 0).setScrollFactor(0.5).setDepth(-88).setAlpha(0.85);
      return;
    }
    // 4) stormy sky: dark, faster cloud layers
    if (back === 'storm') {
      this.cloudBand = this.add.tileSprite(0, 64, this.worldW, 256, 'bg_clouds')
        .setOrigin(0, 0).setScrollFactor(0.25).setDepth(-94).setTint(tint).setAlpha(0.8);
      this.add.tileSprite(0, GAME_H * 0.44, this.worldW, 256, 'bg_clouds')
        .setOrigin(0, 0).setScrollFactor(0.5).setDepth(-88).setTint(0x10141f).setAlpha(0.9);
      return;
    }
    // 5) castle/volcano/bastion: layered jagged dark rock silhouettes
    if (back === 'rock') {
      this.add.tileSprite(0, horizonY + 4, this.worldW, 18 * 5, 'bg_hills_far')
        .setOrigin(0, 1).setScrollFactor(0.2).setDepth(-92).setTint(tint).setAlpha(0.92);
      this.add.tileSprite(0, horizonY + 16, this.worldW, 18 * 4, 'bg_hills_near')
        .setOrigin(0, 1).setScrollFactor(0.42).setDepth(-86).setTint(tint).setAlpha(1);
      return;
    }
    // 6) desert: smooth rolling dunes (hills, sandy)
    if (back === 'dunes') {
      this.add.tileSprite(0, horizonY + 2, this.worldW, 18 * 5, 'bg_hills_far')
        .setOrigin(0, 1).setScrollFactor(0.2).setDepth(-92).setTint(tint).setAlpha(0.8);
      this.add.tileSprite(0, horizonY + 12, this.worldW, 18 * 4, 'bg_hills_near')
        .setOrigin(0, 1).setScrollFactor(0.45).setDepth(-86).setTint(0xcaa24a).setAlpha(0.95);
      return;
    }

    // 7) 'hills' family (day + dusk/snow/jungle/swamp): clouds, far hills, treeline,
    //    near hills — recolored per biome (day stays untinted).
    this.cloudBand = this.add.tileSprite(0, 120, this.worldW, 256, 'bg_clouds')
      .setOrigin(0, 0).setScrollFactor(0.3).setDepth(-95).setAlpha(this.theme === 'day' ? 1 : 0.7);
    const far = this.add.tileSprite(0, horizonY + 2, this.worldW, 18 * 5, 'bg_hills_far')
      .setOrigin(0, 1).setScrollFactor(0.2).setDepth(-92);
    const tree = this.add.tileSprite(0, horizonY + 8, this.worldW, 18 * 4, 'bg_treeline')
      .setOrigin(0, 1).setScrollFactor(0.32).setDepth(-90);
    const near = this.add.tileSprite(0, horizonY + 14, this.worldW, 18 * 4, 'bg_hills_near')
      .setOrigin(0, 1).setScrollFactor(0.45).setDepth(-86);
    if (tint) { far.setTint(tint); tree.setTint(tint); near.setTint(tint); }

    this.level.bushes.forEach(({ c, r }) => {
      this.add.image(c * TILE, (r + 1) * TILE, 'bush').setOrigin(0.5, 1)
        .setScrollFactor(0.85).setDepth(-30).setScale(1);
    });
  }

  buildSolids() {
    this.solids = this.physics.add.staticGroup();
    const topTex = this.theme === 'day' ? 'ground_grass' : 'ground_grass_' + this.theme;
    const fillTex = this.theme === 'day' ? 'ground_dirt' : 'ground_dirt_' + this.theme;
    const solidSet = new Set(this.level.solids.map((s) => `${s.c},${s.r}`));
    // include ceiling tiles in the solid set so groundAhead/collisions see them
    (this.level.ceiling || []).forEach((s) => solidSet.add(`${s.c},${s.r}`));
    this._solidSet = solidSet;   // for groundAhead() gap-sensing
    // icy surface tiles: rendered with the ice texture and recorded so update()
    // can drop friction while the player stands on them (a slide). They're normal
    // solids otherwise (the AI reads them as ground).
    const iceSet = new Set((this.level.ices || []).map((s) => `${s.c},${s.r}`));
    this._iceSet = iceSet;
    // MATERIALS: a solid can carry `mat` to override the biome ground look with a
    // material (materials.js). Its texture + footing (slick→slides, via the same
    // path as ice) travel with the tile; the AI still reads it as plain ground.
    this.level.solids.forEach((s) => {
      const { c, r, mat } = s;
      const top = !solidSet.has(`${c},${r - 1}`);
      const [x, y] = this.tileXY(c, r);
      let tex;
      if (mat && MATERIALS[mat]) {
        tex = materialTex(mat, top ? 'top' : 'fill');
        if (MATERIALS[mat].friction === 'slick') iceSet.add(`${c},${r}`);  // feel: slides like ice
      } else {
        tex = iceSet.has(`${c},${r}`) ? 'ice' : (top ? topTex : fillTex);
      }
      const img = this.solids.create(x, y, tex);
      img.refreshBody();
    });

    // ceiling (cave): enclosed roof, opens to sky near the goal
    (this.level.ceiling || []).forEach(({ c, r }) => {
      if (this.level.ceilingOpenFrom && c >= this.level.ceilingOpenFrom) return;
      const bottom = r === this.level.ceilRow;   // lit face on the underside
      const [x, y] = this.tileXY(c, r);
      this.solids.create(x, y, bottom ? topTex : fillTex).setFlipY(bottom).refreshBody();
    });

    // pipes (2 wide), as solids. Depth 9 so they OCCLUDE a retracted piranha
    // (which sits at depth 7) — the plant hides inside the pipe.
    this.level.pipes.forEach(({ c, r, h }) => {
      for (let i = 0; i < h; i++) {
        const rr = r + i;
        const tl = i === 0 ? 'pipe_tl' : 'pipe_bl';
        const tr = i === 0 ? 'pipe_tr' : 'pipe_br';
        const [x1, y] = this.tileXY(c, rr);
        const [x2] = this.tileXY(c + 1, rr);
        this.solids.create(x1, y, tl).setDepth(9).refreshBody();
        this.solids.create(x2, y, tr).setDepth(9).refreshBody();
        // register pipe tiles so probeAhead/groundAhead SEE them as walls
        solidSet.add(`${c},${rr}`); solidSet.add(`${c + 1},${rr}`);
      }
    });
  }

  // Deadly pit fills — lava / acid / quicksand / spikes flooding this biome's gaps
  // (LEVEL_DESIGN.md §4: a re-skinned death-pit, so the AI already avoids it — no
  // driver work). Each `gaps` range gets a hz_<type> tilesprite running from the
  // floor line down past the world bottom, so a missed jump plunges INTO it.
  buildHazards() {
    const biome = biomeOf(this.theme);
    if (!biome.hazard) return;
    const key = 'hz_' + biome.hazard;
    if (!this.textures.exists(key)) return;
    const top = this.level.groundTop;
    const h = (this.level.H - top + 4) * TILE;     // floor line → below the kill plane
    (this.level.gaps || []).forEach(([a, b]) => {
      const w = (b - a + 1) * TILE;
      const ts = this.add.tileSprite(a * TILE, top * TILE, w, h, key)
        .setOrigin(0, 0).setDepth(-20);
      // molten/liquid flows sideways; spikes stay put
      if (biome.hazard !== 'spike') {
        this.tweens.add({ targets: ts, tilePositionX: TILE, duration: 4200, repeat: -1, ease: 'linear' });
        this.tweens.add({ targets: ts, alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      }
    });
  }

  // Springs / bounce pads (new mechanic). Solid blocks you LAND on to be flung far
  // higher than a normal jump. The AI clears them passively: it walks on, gets
  // launched, and (level permitting) its airborne "steer toward goal" carries it
  // onto the platform the spring is aimed at — so placement, not driver code, is
  // what keeps it 0-death.
  buildSprings() {
    this.springs = this.physics.add.staticGroup();
    (this.level.springs || []).forEach(({ c, r }) => {
      const [x, y] = this.tileXY(c, r);
      const sp = this.springs.create(x, y, 'spring').setDepth(8).refreshBody();
      sp.lastFired = -1;
      // A bounce pad is RUN INTO, not hopped onto: it triggers on OVERLAP, so a
      // frog running along the ground at full speed gets flung without needing a
      // pixel-perfect landing — and it is NOT a solid step the planner jumps over.
    });
    if (!this.player) return;
    this.physics.add.overlap(this.player, this.springs, (player, spring) => {
      // launch only when arriving downward/level (not already rocketing up) and
      // with a short cooldown so one touch = one launch.
      if (player.body.velocity.y < -120) return;
      const f = this.dbg ? this.dbg.frame : (this.time.now / 16.67);
      if (f - spring.lastFired < 12) return;        // one launch per contact
      spring.lastFired = f;
      player.body.y -= 6;                           // unstick from the floor so the launch isn't
      player.body.blocked.down = player.body.touching.down = false;  // damped by ground contact
      player.setVelocityY(-TUNE.springVel);
      this.coyote = 0; this.jumpBuffer = 0; this.jumpHeld = true;   // a clean launch, no re-jump cancel
      this.springLaunch = true;        // exempt this arc from the variable-jump-height clamp
      SFX.jump();
      this.squash(0.8, 1.2);
      if (this.dust) this.dust.emitParticleAt(player.x, player.body.bottom, 8);
      spring.setTexture('spring_hit');
      this.time.delayedCall(130, () => spring.active && spring.setTexture('spring'));
      if (this.dbg) this.dbg.log('spring', { x: Math.round(player.x) });
    });
  }

  // One-way platforms: solid only when LANDING from above; you pass straight up
  // through them from below. Spatial for the autopilot — registered in the probe
  // solid set so it's read (and approached) exactly like a normal elevated ledge.
  buildOneways() {
    this.oneways = this.physics.add.staticGroup();
    (this.level.oneways || []).forEach(({ c, r, aerial, mat }) => {
      const [x, y] = this.tileXY(c, r);
      // a material'd one-way uses that material's surface tile (themed towers)
      const tex = mat && MATERIALS[mat] ? materialTex(mat, 'top') : 'oneway';
      const o = this.oneways.create(x, y, tex).setDepth(6);
      o.body.setSize(TILE, 16).setOffset(0, 0);    // thin plate at the top of the cell
      o.refreshBody();
      // AERIAL one-ways (verticalize's optional reward towers) stay OUT of the AI's
      // solid set — the grounded autopilot must ignore them (treat like overhead
      // coins), or its terrain model thinks there's a floor up there and it stalls.
      if (this._solidSet && !aerial) this._solidSet.add(`${c},${r}`);
    });
    if (!this.player) return;
    // process callback: only collide when falling onto the plank from above (the
    // player's previous bottom was at/above the plank top) — else pass through.
    this.physics.add.collider(this.player, this.oneways, null, (player, plat) => {
      return player.body.velocity.y >= 0 && (player.body.bottom - player.body.deltaY()) <= plat.body.top + 8;
    }, this);
  }

  // CONVEYOR belts (new): a surface that pushes you along (dir ±1). Modelled like
  // ice — a lookup the update loop reads — plus a metallic band + a direction
  // chevron so the motion reads. AI-safe: push < runAccel, so the frog can fight it.
  buildConveyors() {
    this._conveyorSet = new Map();
    (this.level.conveyors || []).forEach(({ c, r, dir }) => {
      this._conveyorSet.set(`${Math.floor(c)},${r}`, dir);
      const [x, y] = this.tileXY(c, r);
      const top = y - TILE / 2;
      this.add.rectangle(x, top + 7, TILE, 14, 0x2b3344).setDepth(4).setStrokeStyle(2, 0x8fd0ff, 0.5);
      this.add.text(x, top + 7, dir > 0 ? '»' : '«', { fontFamily: 'PressStart2P', fontSize: '12px', color: '#8fd0ff' })
        .setOrigin(0.5).setDepth(5);
    });
  }

  // MOVING PLATFORMS (new physics): kinematic ledges that patrol a path and CARRY the
  // frog. Motion is driven off the frame counter (deterministic for wincheck); the
  // rider is moved by the platform's per-frame delta while standing on top. Horizontal
  // ferries and vertical lifts. (Required-to-ride placements still want a driver
  // board/ride branch — see elements.js movPlatform notes; these placements are
  // AI-optional so the 0-death gate holds with the frog's normal run.)
  buildMovers() {
    this._movers = [];
    if (!(this.level.movers || []).length) return;
    this.moverGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    (this.level.movers || []).forEach(({ c0, r0, dir, to, w, speed, phase }) => {
      const wpx = w * TILE, hpx = Math.round(TILE * 0.5);
      const sx = (c0 + (w - 1) / 2) * TILE + TILE / 2, sy = r0 * TILE + hpx / 2;
      const ex = dir === 'h' ? (to + (w - 1) / 2) * TILE + TILE / 2 : sx;
      const ey = dir === 'v' ? to * TILE + hpx / 2 : sy;
      const plat = this.add.rectangle(sx, sy, wpx, hpx, 0x8a5a2c).setStrokeStyle(2, 0xe0b878, 0.95).setDepth(6);
      for (let i = 0; i < w; i++) this.add.rectangle(sx - wpx / 2 + TILE / 2 + i * TILE, sy, TILE - 6, 4, 0xe0b878, 0.5).setDepth(7);
      this.physics.add.existing(plat);
      plat.body.setAllowGravity(false); plat.body.setImmovable(true); plat.body.setSize(wpx, hpx);
      this.moverGroup.add(plat);
      this._movers.push({ plat, sx, sy, ex, ey, dir, speed, phase, dwell: 40, prevX: sx, prevY: sy });
    });
    if (this.player) this.physics.add.collider(this.player, this.moverGroup);
    if (this.enemies) this.physics.add.collider(this.enemies, this.moverGroup);
  }

  // advance every moving platform along its ping-pong path and carry any rider. F is
  // the deterministic frame counter so wincheck reproduces the motion exactly.
  updateMovers(F) {
    if (!this._movers || !this._movers.length) return;
    const p = this.player;
    this._movers.forEach((m) => {
      const D = Math.hypot(m.ex - m.sx, m.ey - m.sy) || 1;
      const oneWay = Math.max(1, Math.round(D / (m.speed / 60)));   // frames for a one-way trip
      const dw = m.dwell || 0;                                       // frames docked at each extreme
      const cyc = 2 * (oneWay + dw);
      const tt = (((F + Math.round(m.phase * cyc)) % cyc) + cyc) % cyc;
      let frac;                                                      // dock → travel → dock → travel back
      if (tt < dw) frac = 0;
      else if (tt < dw + oneWay) frac = (tt - dw) / oneWay;
      else if (tt < 2 * dw + oneWay) frac = 1;
      else frac = 1 - (tt - 2 * dw - oneWay) / oneWay;
      const nx = m.sx + (m.ex - m.sx) * frac, ny = m.sy + (m.ey - m.sy) * frac;
      const dx = nx - m.prevX, dy = ny - m.prevY;
      if (p && !this.dead && !this.won) {
        const b = m.plat.body;
        const onTop = p.body.bottom <= b.top + 9 && p.body.bottom >= b.top - 12
          && p.body.right > b.left + 2 && p.body.left < b.right - 2 && p.body.velocity.y >= -30;
        if (onTop) { p.x += dx; p.y += dy; }                        // ride along
      }
      m.plat.setPosition(nx, ny);
      m.plat.body.x = nx - m.plat.body.halfWidth; m.plat.body.y = ny - m.plat.body.halfHeight;
      m.vx = dx; m.vy = dy; m.prevX = nx; m.prevY = ny;
    });
  }

  // DASH PADS (new physics): a glowing arrow strip on the floor. While standing on
  // it the frog is rocketed to ~1.5× run speed in `dir` — a one-shot turbo burst,
  // capped so it lands safe. Treated as slick (the speed reads/carries). The AI
  // runs right anyway, so a forward pad is transparent; place over continuous flat
  // ground only (a launch must not carry into a pit), per the dash-pad law.
  buildDashpads() {
    this._dashSet = new Map();
    (this.level.dashpads || []).forEach(({ c, r, dir }) => {
      this._dashSet.set(`${Math.floor(c)},${r}`, dir);
      const [x, y] = this.tileXY(c, r);
      const top = y - TILE / 2;
      // a bright launch plate with a chevron pair pointing the launch way
      this.add.rectangle(x, top + 6, TILE, 12, 0x1c2a14).setDepth(4).setStrokeStyle(2, 0x7dff5a, 0.7);
      this.add.text(x, top + 6, dir > 0 ? '▶▶' : '◀◀', { fontFamily: 'PressStart2P', fontSize: '9px', color: '#9dff7a' })
        .setOrigin(0.5).setDepth(5);
    });
  }

  // BOUNCE TILES (new physics): an auto-trampoline floor — landing flings the frog up
  // (a permanent low spring). Surface tag; rendered as a springy ridged pad. One launch
  // per landing (frame cooldown). AI-transparent (it handles spring-style arcs).
  buildBouncers() {
    this._bouncerSet = new Set();
    (this.level.bouncers || []).forEach(({ c, r }) => {
      this._bouncerSet.add(`${Math.floor(c)},${r}`);
      const [x, y] = this.tileXY(c, r);
      const top = y - TILE / 2;
      this.add.rectangle(x, top + 7, TILE, 12, 0x21304a).setDepth(4).setStrokeStyle(2, 0xffd35a, 0.8);
      for (let i = 0; i < 3; i++) this.add.rectangle(x - 16 + i * 16, top + 5, 4, 7, 0xffe08a).setDepth(5);
    });
  }

  // FIRE BARS (new hazard): a bar of fireballs pivoted above the floor, rotating on a
  // cycle. Modeled as a PERIODIC COLUMN hazard (same family as the spout) so the
  // autopilot's observe+dash standoff reads it for free — deadly only while the bar
  // sweeps DOWN into the walkway, dormant most of the revolution.
  buildFirebars() {
    (this.level.firebars || []).forEach(({ c, len, up, phase }) => {
      const [x] = this.tileXY(c, this.level.groundTop);
      const pivotY = (this.level.groundTop - up) * TILE + TILE / 2;
      const n = Math.max(2, Math.round(len * 2));            // fireballs every ~½ tile
      const balls = [];
      this.add.circle(x, pivotY, 6, 0x6b3a1a).setDepth(6);   // the pivot hub
      for (let i = 1; i <= n; i++) {
        const rad = (i / n) * len * TILE;
        const b = this.add.circle(x, pivotY, 8 - (i === n ? 0 : 2), 0xff7a2c).setDepth(7).setStrokeStyle(2, 0xffd27a, 0.9);
        balls.push({ b, rad });
      }
      // The lowest point of the sweep (straight-down). If it clears the grounded
      // frog's head (≥~2 tiles above the floor), this is an OVERHEAD hazard: the
      // autopilot walks under it (flyer-style, BUILDING_GAMES §8) and we keep it out
      // of the periodic-standoff list. A rotating bar that reaches the floor is an
      // inherently WIDE hazard the narrow-column standoff/dash can't cross cleanly.
      const lowestRow = (this.level.groundTop - up) + len;
      const overhead = lowestRow <= this.level.groundTop - 2;
      this._periodics.push({ kind: 'firebar', c, x, pivotY, len, balls, overhead,
        period: 150, phase: phase * 40 });                   // ~2.5s/rev, deterministic on the frame counter
    });
  }

  // STICKY / MUD surfaces (new physics): the inverse of ice — capped top speed and
  // heavy drag, so the frog trudges. A surface tag (like ice/conveyor); rendered as a
  // dark speckled crust. AI-transparent (it just moves slower over it).
  buildStickies() {
    this._stickySet = new Set();
    (this.level.stickies || []).forEach(({ c, r }) => {
      this._stickySet.add(`${Math.floor(c)},${r}`);
      const [x, y] = this.tileXY(c, r);
      const top = y - TILE / 2;
      this.add.rectangle(x, top + 6, TILE, 12, 0x4a3520).setDepth(4).setStrokeStyle(1, 0x2a1d12, 0.8);
      for (let i = 0; i < 3; i++) this.add.circle(x - 18 + i * 18, top + 6 + (i % 2) * 4, 2, 0x6b4d2c).setDepth(5);
    });
  }

  // FIELD ZONES (new physics): wind / updraft / low-gravity / water regions. Each
  // is a pixel rect [px0,px1]×[py0,py1]; update() asks zonesAt(x,y) what fields the
  // frog is in and applies them. Drawn as translucent tinted regions with a hint
  // glyph so they read at a glance. All are AI-transparent helper fields.
  buildZones() {
    this._zones = [];
    const STYLE = {
      wind:    { fill: 0x9fdfff, alpha: 0.10, glyph: '≫',  gc: '#bfeaff' },
      updraft: { fill: 0xaeffc8, alpha: 0.12, glyph: '↑',  gc: '#caffd9' },
      lowgrav: { fill: 0xc9a8ff, alpha: 0.12, glyph: '◌',  gc: '#e0ccff' },
      water:   { fill: 0x49a0ff, alpha: 0.22, glyph: '≈',  gc: '#cfe7ff' },
    };
    (this.level.zones || []).forEach((z) => {
      const s = STYLE[z.type] || STYLE.wind;
      const px0 = z.c0 * TILE, py0 = z.r0 * TILE;
      const w = (z.c1 - z.c0 + 1) * TILE, h = (z.r1 - z.r0 + 1) * TILE;
      this.add.rectangle(px0, py0, w, h, s.fill, s.alpha).setOrigin(0, 0).setDepth(3)
        .setStrokeStyle(2, s.fill, 0.35);
      // a few drifting hint glyphs so the field reads as "alive"
      for (let i = 0; i < Math.max(1, Math.round(w / TILE / 3)); i++) {
        const gx = px0 + 18 + (i + 0.5) * (w / Math.max(1, Math.round(w / TILE / 3)));
        const g = this.add.text(gx, py0 + h / 2, s.glyph, { fontFamily: 'PressStart2P', fontSize: '12px', color: s.gc })
          .setOrigin(0.5).setDepth(3).setAlpha(0.5);
        const dx = z.type === 'wind' ? (z.dir || 1) * 14 : 0;
        const dy = z.type === 'updraft' ? -14 : (z.type === 'water' ? 6 : 8);
        this.tweens.add({ targets: g, x: gx + dx, y: py0 + h / 2 + dy, alpha: 0.15,
          duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      this._zones.push({ ...z, px0, py0, px1: px0 + w, py1: py0 + h });
    });
  }

  // which field(s) is the point inside? (zones can overlap; we fold their effects)
  zonesAt(x, y) {
    if (!this._zones || !this._zones.length) return null;
    let r = null;
    for (const z of this._zones) {
      if (x >= z.px0 && x <= z.px1 && y >= z.py0 && y <= z.py1) (r ||= []).push(z);
    }
    return r;
  }

  // PERIODIC COLUMN HAZARDS (new): fire SPOUTS (erupt up from the floor) and rock
  // DROPPERS (fall from the ceiling). Both are deadly only during a brief ACTIVE
  // window on a generous frame-deterministic cycle, so the AI can read the phase
  // and dash through a dormant window (handled in the driver). Drawn with shapes
  // (no new textures). Deadliness is checked per-frame in update().
  buildPeriodics() {
    this._periodics = [];
    const PERIOD = 108, ACTIVE = 24;                    // ~0.4s deadly per ~1.8s — tight rhythm, generous 1.4s dormant window
    (this.level.spouts || []).forEach(({ c, r, phase }) => {
      const [x] = this.tileXY(c, r);
      const baseY = (this.level.groundTop) * TILE;       // floor line
      const gfx = this.add.rectangle(x, baseY, 22, TILE * 3, 0xff7a3c).setOrigin(0.5, 1).setDepth(7).setVisible(false);
      const cap = this.add.circle(x, baseY, 14, 0xffd27a).setDepth(7).setVisible(false);
      this._periodics.push({ kind: 'spout', c, x, baseY, period: PERIOD, active: ACTIVE, phase: phase * 54,
        topRow: this.level.groundTop - 3, gfx, cap });
    });
    (this.level.droppers || []).forEach(({ c, phase }) => {
      const [x] = this.tileXY(c, this.level.groundTop);
      const topY = 1.5 * TILE, fall = (this.level.groundTop - 2) * TILE;
      const rock = this.add.rectangle(x, topY, 30, 30, 0x6b5142).setDepth(7).setStrokeStyle(2, 0x3a2c24).setVisible(false);
      this.add.rectangle(x, 0.6 * TILE, TILE, 10, 0x33271f).setDepth(4);   // a ceiling nub it drops from
      this._periodics.push({ kind: 'dropper', c, x, topY, fall, period: PERIOD + 30, active: ACTIVE + 18, phase: phase * 60, rock });
    });
  }

  // CRUMBLING platforms (new): solid tiles that collapse ~0.6s after first touch —
  // keep moving. Placed over ground so a late frog just drops a tile (0-death). The
  // AI's decay primitive tags them; the base run never lingers, so it crosses clean.
  buildCrumbles() {
    this.crumbles = this.physics.add.staticGroup();
    (this.level.crumbles || []).forEach(({ c, r }) => {
      const [x, y] = this.tileXY(c, r);
      const b = this.crumbles.create(x, y, 'brick'); b.refreshBody();
      b.setTint(0xb98a5a); b.kind = 'crumble'; b.touchedAt = -1; b.gone = false; b.cKey = `${c},${r}`;
    });
    if (this.player) this.physics.add.collider(this.player, this.crumbles, (player, b) => {
      if (b.touchedAt < 0 && !b.gone) b.touchedAt = this.dbg ? this.dbg.frame : (this._frame || 0);
    }, (player, b) => !b.gone, this);
  }

  buildInteractive() {
    // bricks + question blocks live in a static group too, but we keep refs for hits
    this.blocks = this.physics.add.staticGroup();
    this.brickSet = new Map();
    this.level.bricks.forEach(({ c, r }) => {
      const [x, y] = this.tileXY(c, r);
      const b = this.blocks.create(x, y, 'brick'); b.refreshBody();
      b.kind = 'brick'; this.brickSet.set(`${c},${r}`, b);
    });
    this.level.qblocks.forEach(({ c, r, power }) => {
      const [x, y] = this.tileXY(c, r);
      const b = this.blocks.create(x, y, 'qblock'); b.refreshBody();
      b.kind = 'qblock'; b.used = false; b.homeY = y; b.power = !!power;
      this.tweens.add({ targets: b, y: y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });

    // coins
    this.coins = this.physics.add.group({ allowGravity: false });
    this.level.coins.forEach(({ c, r }) => {
      const [x, y] = this.tileXY(c, r);
      const coin = this.coins.create(x, y, 'coin0').play('coin_spin');
      coin.body.setSize(58, 64).setOffset(-15, -13).setAllowGravity(false);  // generous pickup (note #9)
      this.tweens.add({ targets: coin, y: y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });

    // enemies — one of three archetypes (Play.update + onEnemy branch on .kind):
    //   • WALKER  (stompable ground patroller — goomba/beetle/ghoul/snowman/spider/lavaslug)
    //   • FLYER   (deadly overhead patroller the grounded autopilot passes under)
    //   • BOSS    (big, multi-HP, stompable; gates the exit behind a wall it drops on death)
    this.enemies = this.physics.add.group();
    this.bossGate = null;
    this.level.enemies.forEach((en) => {
      const kind = en.kind || 'goomba';
      const sp = ENEMY_SPRITES[kind] || ENEMY_SPRITES.goomba;
      const [x, y] = this.tileXY(en.c, en.r);
      const e = this.enemies.create(x, y, kind).play(`${kind}_walk`);
      e.kind = kind; e.alive = true; e.mech = en.mechOverride || sp.mech || 'plain'; e.setData('dir', -1);
      e._hopAt = 0;
      e.setBounce(0, 0); e.setCollideWorldBounds(false);
      if (sp.tint) e.setTint(sp.tint);
      // scale the small Pixel-Adventure frames up to ~game size; body covers the
      // sprite's middle so stomps/contacts read true.
      const bodyW = sp.fw * 0.62, bodyH = sp.fh * 0.72;
      e.body.setSize(bodyW, bodyH).setOffset((sp.fw - bodyW) / 2, sp.fh - bodyH);
      if (en.boss) {
        e.boss = true; e.hp = en.hp || 3; e.reel = 0;
        e.setScale(120 / sp.fh);                        // a big brute (~120px tall)
        e.setVelocityX(0); e._home = x; e._spd = TUNE.enemySpeed * 0.7;
        this._buildBossGate(en.c + 6);
        this._bossHpBar(e);
      } else {
        e.setScale(50 / sp.fh);                         // ~50px tall, frog-sized
        if (en.fly) {
          e.fly = true; e.body.setAllowGravity(false);
          e._c0 = en.c0 != null ? en.c0 : en.c - 3; e._c1 = en.c1 != null ? en.c1 : en.c + 3;
          e._baseY = y; e._spd = TUNE.enemySpeed * 1.15; e.setVelocityX(-e._spd);
        } else {
          e._spd = (kind === 'beetle' || kind === 'spider') ? TUNE.enemySpeed * 1.3
            : (kind === 'lavaslug' || kind === 'snowman') ? TUNE.enemySpeed * 0.78 : TUNE.enemySpeed;
          e.setVelocityX(-e._spd);
        }
      }
    });
  }

  // The boss's exit gate: a tall solid wall a few tiles past it. The frog can't jump
  // it, so it must defeat the boss (which drops the gate). Kept OUT of the AI's solid
  // set on purpose — the autopilot just runs into it and keeps stomping the boss.
  _buildBossGate(col) {
    const top = this.level.groundTop;
    this.bossGate = this.physics.add.staticGroup();
    for (let rr = top - 5; rr < top; rr++) {
      const [gx, gy] = this.tileXY(col, rr);
      const b = this.bossGate.create(gx, gy, 'brick'); b.refreshBody(); b.setTint(0x6b3a5a);
    }
    if (this.player) this.physics.add.collider(this.player, this.bossGate);
  }

  _bossHpBar(e) {
    e._hpMax = e.hp;
    e._hpBg = this.add.rectangle(e.x, e.y - 78, 96, 12, 0x0c1020, 0.8).setDepth(40).setStrokeStyle(2, 0xffffff, 0.3);
    e._hpFg = this.add.rectangle(e.x - 46, e.y - 78, 92, 8, 0xff5d6c).setOrigin(0, 0.5).setDepth(41);
  }

  // Piranha plants: rise out of a pipe, hover, then retract — a hazard you TIME
  // and avoid (touching it hurts; it can't be stomped). The new L2 mechanic.
  buildPiranhas() {
    this.piranhas = this.physics.add.group({ allowGravity: false });
    (this.level.piranhas || []).forEach(({ c, topR }, i) => {
      const x = c * TILE;            // c already includes +0.5 (pipe centre)
      const mouthY = topR * TILE;    // y of the pipe's top edge (mouth)
      const pr = this.piranhas.create(x, mouthY, 'piranha');
      pr.setDepth(7);                // BELOW the pipe (depth 9) so it hides inside
      pr.setOrigin(0.5, 1);          // anchor at the plant's base
      pr.body.setAllowGravity(false);
      pr.body.setSize(30, 40).setOffset(7, 12);
      // hidden: base sits ~1 tile below the mouth → fully behind the pipe front
      pr.homeY = mouthY + TILE * 0.9;
      pr.upY = mouthY + 4;           // raised: base at the mouth, head pokes above
      pr.y = pr.homeY;
      pr.body.enable = false;        // no hit while fully hidden
      // Cycle: pop up, hold briefly, retract, then a GENEROUS retracted pause.
      // The retract window is long and frequent enough that a timed approach
      // (read the phase, wait in a safe cell, then dash) always has room — the
      // AI-fairness bar the redesign holds every timed mechanic to. Staggered so
      // back-to-back pipes don't sync.
      this.tweens.add({
        targets: pr, y: pr.upY, duration: 600, ease: 'sine.inOut',
        yoyo: true, hold: 350, repeatDelay: 1100, repeat: -1, delay: 400 + i * 500,
        onUpdate: () => { pr.body.enable = pr.y < pr.homeY - 6; },  // hittable only when out
      });
    });
  }

  buildPlayer() {
    // CHECKPOINT respawn: on a death-restart, spawn at the last seam crossed
    // (persisted in the registry) instead of tile 0. Fresh entries clear it
    // (Title.startGame / win), so a new run always starts at the level's start.
    this.checkpoints = this.level.checkpoints || [];
    const cpCol = this.game.registry.get('checkpointCol');
    const useCp = cpCol != null && this.checkpoints.includes(cpCol);
    const sc = useCp ? cpCol : this.level.start.c;
    const sr = useCp ? this.level.groundTop - 2 : this.level.start.r;
    const [x, y] = this.tileXY(sc, sr);
    // a dark SILHOUETTE just behind the bunny → a bold cartoon outline so it pops
    // against busy backdrops (playtest note: "more visible / highlight"). Synced to
    // the player each frame in update() (_syncHeroOutline).
    this.heroOutline = this.add.image(x, y, 'jazz_idle').setOrigin(0.5, 1).setTint(0x0a0e1a).setDepth(9);
    const p = this.physics.add.sprite(x, y, 'jazz_idle');
    p.setOrigin(0.5, 1);
    this.heroBaseScale = 0.93;             // reduced 25% from the 2x (playtest note #10)
    this.heroScale = this.heroBaseScale;
    p.setScale(this.heroScale);
    // collision body kept at the proven ~28×41px world size (so the 0-death gate is
    // stable), sized in texture space for the current scale.
    p.body.setSize(30, 44);
    p.body.setOffset(49, 80);
    p.setCollideWorldBounds(false);
    p.setMaxVelocity(TUNE.runMax, TUNE.maxFall);
    p.setDepth(10);
    p.play('hero_idle');
    this.player = p;
    this.coyote = 0; this.jumpBuffer = 0; this.facing = 1; this.jumpHeld = false;
    this._anim = 'hero_idle';
  }

  // play an animation only if not already current (avoids restart stutter)
  setHeroAnim(key) {
    if (this._anim === key) return;
    this._anim = key;
    this.player.play(key, true);
  }

  // keep the dark outline silhouette glued to the bunny (same frame/flip/pose),
  // drawn a touch larger behind it so a dark rim shows → the bunny "pops".
  _syncHeroOutline() {
    const o = this.heroOutline, p = this.player;
    if (!o || !p) return;
    if (p.frame) o.setTexture(p.texture.key, p.frame.name);
    o.setPosition(p.x, p.y).setFlipX(p.flipX);
    o.setScale(p.scaleX * 1.08, p.scaleY * 1.08);
    o.setVisible(p.visible).setAlpha(p.alpha >= 1 ? 0.9 : p.alpha * 0.9);
  }

  buildGoal() {
    const { c, baseR } = this.level.goal;
    const x = c * TILE + TILE / 2;
    const topY = baseR * TILE;
    const botY = 13 * TILE;
    this.add.rectangle(x, (topY + botY) / 2, 10, botY - topY, 0xdfe7f5).setDepth(5)
      .setStrokeStyle(2, 0x9fb0c8);
    this.add.circle(x, topY - 8, 12, 0xffd34d).setDepth(6).setStrokeStyle(3, 0xc9971f);
    this.flag = this.add.image(x + 6, topY + 18, 'flag').setOrigin(0, 0.5).setDepth(6);
    this.tweens.add({ targets: this.flag, y: this.flag.y + 6, duration: 1200, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.goalX = x;
  }

  // ── CHECKPOINT / SPAWN-POINT markers (note #11): a glowing carrot totem at each
  //    checkpoint column. Lights up green when you cross it (where you respawn). ──
  buildCheckpoints() {
    this._cpMarkers = {};
    const gy = this.level.groundTop * TILE;
    (this.level.checkpoints || []).forEach((col) => {
      const x = col * TILE + TILE / 2;
      const c = this.add.container(x, gy).setDepth(5);
      const glow = this.add.circle(0, -6, 26, 0x5fd66e, 0.0);                 // lit on cross
      const pole = this.add.rectangle(0, -54, 6, 96, 0x8a6a4a).setOrigin(0.5, 0);
      const knob = this.add.circle(0, -54, 8, 0xffd34d).setStrokeStyle(2, 0xc9971f);
      const flag = this.add.triangle(3, -48, 0, 0, 34, 9, 0, 18, 0x9fb3e0).setOrigin(0, 0.5);  // grey until reached
      const carrot = this.add.text(12, -39, '🥕', { fontSize: '15px' }).setOrigin(0.5).setAlpha(0.85);
      c.add([glow, pole, knob, flag, carrot]);
      this.tweens.add({ targets: knob, scale: 1.18, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      this._cpMarkers[col] = { c, glow, flag, lit: false };
    });
    // light any checkpoint already crossed (e.g. after a respawn) — STATIC only,
    // since create() isn't a safe place to start tweens/particles.
    const cur = this.game.registry.get('checkpointCol');
    if (cur != null) Object.keys(this._cpMarkers).forEach((col) => { if (+col <= cur) this._litCheckpoint(+col, false); });
  }
  _litCheckpoint(col, live = true) {
    const m = this._cpMarkers && this._cpMarkers[col]; if (!m || m.lit) return;
    m.lit = true; m.flag.setFillStyle(0x5fd66e); m.glow.setFillStyle(0x5fd66e, live ? 0.5 : 0.22);
    if (!live) return;                                  // static light (called from create)
    this.tweens.add({ targets: m.glow, alpha: { from: 0.5, to: 0.12 }, scale: 1.4, duration: 700, yoyo: true, repeat: -1 });
    if (this.sparkle) this.sparkle.emitParticleAt(m.c.x, m.c.y - 30, 12);
  }

  buildParticles() {
    this.dust = this.add.particles(0, 0, 'dust', {
      speed: { min: 20, max: 80 }, scale: { start: 0.7, end: 0 }, alpha: { start: 0.6, end: 0 },
      lifespan: 380, quantity: 0, tint: 0xffffff, emitting: false,
    }).setDepth(9);
    this.sparkle = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 160 }, scale: { start: 1, end: 0 }, lifespan: 480, quantity: 0,
      rotate: { min: 0, max: 360 }, emitting: false,
    }).setDepth(20);
    this.chunks = this.add.particles(0, 0, 'chunk', {
      speed: { min: 120, max: 260 }, gravityY: 900, scale: { start: 1, end: 0.4 },
      lifespan: 700, quantity: 0, rotate: { min: -180, max: 180 }, emitting: false,
    }).setDepth(20);
    this.buildAmbient();      // per-biome weather/motes
    this.buildDecor();        // procedural pixel-art ground props
    this.buildFauna();        // friendly critters — makes the world feel inhabited, not lonely
  }

  // ── THE BAZOOKA (Jazz's new basic verb): fire rockets that blast enemies ──
  // Texture only — the physics group + colliders are created LAZILY on the first
  // shot (_ensureRockets). This is deliberate: the deterministic 0-death autopilot
  // never fires, so without a shot the physics world stays byte-identical to a
  // gun-less build (adding an empty group + colliders perturbs Arcade's collision
  // resolution order across a 500-tile world enough to mistime a knife's-edge
  // jump). Human play creates the group the instant they pull the trigger.
  buildProjectiles() {
    if (!this.textures.exists('jazz_rocket')) {
      // Starsweeper: a glowing PLASMA BOLT from Pip's salvage blaster (not a
      // missile) — reads as energy, in line with the space theme.
      const g = this.add.graphics({ add: false });
      g.fillStyle(0x29e0ff, 0.45); g.fillRoundedRect(0, 0, 26, 12, 6);   // soft cyan glow
      g.fillStyle(0x4fd2ff, 1);    g.fillRoundedRect(3, 3, 18, 6, 3);    // bolt body (cyan)
      g.fillStyle(0xffffff, 1);    g.fillRoundedRect(7, 4, 12, 4, 2);    // white-hot core
      g.fillStyle(0xeafdff, 1);    g.fillTriangle(21, 1, 28, 6, 21, 11); // bright energy nose
      g.fillStyle(0x29e0ff, 0.85); g.fillTriangle(3, 3, 3, 9, -5, 6);    // trailing energy streak
      g.generateTexture('jazz_rocket', 28, 12); g.destroy();
    }
    this.rockets = null;                                  // built on first fire
  }

  _ensureRockets() {
    if (this.rockets) return this.rockets;
    this.rockets = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.rockets, this.enemies, this.onRocketEnemy, null, this);
    if (this.piranhas) this.physics.add.overlap(this.rockets, this.piranhas, this.onRocketPiranha, null, this);
    this.physics.add.collider(this.rockets, this.solids, (r) => this.onRocketSolid(r), null, this);
    if (this.blocks) this.physics.add.collider(this.rockets, this.blocks, (r) => this.onRocketSolid(r), null, this);
    if (this.blastblocks) this.physics.add.overlap(this.rockets, this.blastblocks, this.onRocketBlast, null, this);
    return this.rockets;
  }

  // is there a live, ground bot ahead in the facing line a rocket would hit?
  // (used only by SHOWCASE auto-fire — recordings, never the gate run)
  _botAhead() {
    if (!this.enemies || !this.player) return false;
    const dir = this.facing >= 0 ? 1 : -1, px = this.player.x, py = this.player.y;
    let hit = false;
    this.enemies.children.iterate((e) => {
      if (hit || !e || !e.alive || e.fly) return;
      const dx = (e.x - px) * dir;
      if (dx > 30 && dx < TILE * 6 && Math.abs(e.y - py) < 70) hit = true;
    });
    return hit;
  }

  tryFire(time) {
    if (this.dead || this.won) return;
    if (time - this._lastFire < 260) return;             // fire-rate cooldown
    this._ensureRockets();
    this._lastFire = time;
    const dir = this.facing >= 0 ? 1 : -1;
    // spawn at the BAZOOKA muzzle — scales with the bunny so the shot exits at the
    // gun, not the floor or the head (playtest note #10). 128px sprite, gun ≈ 0.42
    // up from the feet, muzzle ≈ 0.34 of the width in front of centre.
    const mx = this.player.x + dir * (128 * this.heroScale * 0.30);
    const my = this.player.y - (128 * this.heroScale * 0.42);
    const r = this.rockets.create(mx, my, 'jazz_rocket').setDepth(11).setScale(1.1);
    r.body.setAllowGravity(false); r.body.setSize(20, 8); r.setVelocityX(dir * 760); r.setFlipX(dir < 0);
    r.bornAt = time; this.shotsFired++;
    this.sparkle.emitParticleAt(mx, my, 3);
    if (SFX.bump) SFX.bump();
    if (this.dbg) this.dbg.log('fire', { x: Math.round(mx), dir });
  }

  _boom(x, y) { this.chunks.emitParticleAt(x, y, 8); this.sparkle.emitParticleAt(x, y, 6); this.shake(0.004, 90); }
  onRocketSolid(rocket) { if (!rocket.active) return; this._boom(rocket.x, rocket.y); rocket.destroy(); }
  onRocketPiranha(rocket, pr) {
    if (!rocket.active || !pr.active) return;
    this._boom(rocket.x, rocket.y); rocket.destroy(); pr.disableBody(true, true);
    this.score += 200; this.emitHud();                   // piranhas can't be stomped — but CAN be blasted
  }
  onRocketEnemy(rocket, enemy) {
    if (!rocket.active || !enemy.alive) return;
    // SHIELD-bot: a rocket hitting its FRONT (the side it faces) is deflected — you
    // must stomp/DIVE-SLAM it, or hit it from behind. (note #11 new enemy type)
    if (enemy.mech === 'shield') {
      const facing = enemy.getData('dir') || -1;
      const fromFront = Math.sign(rocket.x - enemy.x) === facing;
      if (fromFront) { this._boom(rocket.x, rocket.y); rocket.destroy(); enemy.setTint(0xbfd0ff); this.time.delayedCall(120, () => enemy.active && enemy.clearTint()); if (SFX.bump) SFX.bump(); return; }
    }
    this._boom(rocket.x, rocket.y); rocket.destroy();
    if (enemy.boss) {
      enemy.hp = (enemy.hp || 1) - 1; enemy.reel = 30; enemy.setTint(0xff8080);
      this.time.delayedCall(160, () => enemy.active && enemy.clearTint());
      if (enemy.hp > 0) { this.score += 50; this.emitHud(); return; }
    }
    enemy.alive = false; if (enemy.anims) enemy.anims.stop(); enemy.body.checkCollision.none = true; enemy.setVelocity(0, -140);
    this.tweens.add({ targets: enemy, alpha: 0, scaleX: 0.6, angle: 90, duration: 380, onComplete: () => enemy.destroy() });
    this.score += enemy.boss ? 500 : 150; this.botsBlasted++; this.emitHud();
    if (this.dbg) this.dbg.log('blast', { kind: enemy.kind });
  }

  // ── per-biome AMBIENT particles (snow/embers/leaves/rain/bubbles/sparkles…) ──
  // Screen-fixed weather that makes each biome feel alive. Pure decoration: no
  // collision, behind/over gameplay only, zero effect on the 0-death gate.
  buildAmbient() {
    // theme → ambient "weather". `glow` = soft additive motes that GLOW against the
    // painted backdrop (embers on lava, fireflies at dusk, glints in the crystal
    // cave). `tex` picks the grain. Denser + brighter now so it reads (note #8).
    // { tint, dir, spd[min,max], scale[min,max], freq, life, sway, front, glow, tex, peak }
    const A = {
      day:     { tint: [0xffffff, 0xfff3c4], dir: 'up',    spd: [6, 16],  scale: [0.3, 0.7],  freq: 150, life: 5200, sway: 16, peak: 0.5 },
      cave:    { tint: [0x9fe8ff, 0xc9a8ff], dir: 'drift', spd: [5, 14],  scale: [0.3, 0.7],  freq: 130, life: 6200, sway: 11, glow: 1, front: 1, peak: 0.8 },
      sky:     { tint: [0xffffff, 0xd8f3ff], dir: 'side',  spd: [30, 70], scale: [0.3, 0.7],  freq: 150, life: 4200, sway: 6,  peak: 0.7 },
      castle:  { tint: [0xff8a3c, 0xffd27a], dir: 'up',    spd: [18, 46], scale: [0.3, 0.75], freq: 90,  life: 3400, sway: 12, glow: 1, front: 1, peak: 0.85 },
      dusk:    { tint: [0xffd27a, 0xffe6a0], dir: 'drift', spd: [6, 16],  scale: [0.3, 0.7],  freq: 130, life: 4800, sway: 18, glow: 1, front: 1, peak: 0.9 },
      snow:    { tint: [0xffffff, 0xe8f8ff], dir: 'down',  spd: [22, 52], scale: [0.4, 0.9],  freq: 70,  life: 5200, sway: 30, front: 1, peak: 0.85 },
      desert:  { tint: [0xe7c98a, 0xcaa24a], dir: 'side',  spd: [70, 150],scale: [0.18, 0.42],freq: 70,  life: 3200, sway: 8,  front: 1, peak: 0.55 },
      jungle:  { tint: [0x8fe89a, 0x2f8f4a], dir: 'down',  spd: [16, 38], scale: [0.45, 0.85],freq: 150, life: 5200, sway: 34, front: 1, peak: 0.8 },
      swamp:   { tint: [0xcfe79a, 0x9fd66e], dir: 'up',    spd: [10, 24], scale: [0.3, 0.7],  freq: 170, life: 4600, sway: 12, glow: 1, peak: 0.7 },
      volcano: { tint: [0xff6a18, 0xffc24a], dir: 'up',    spd: [34, 86], scale: [0.3, 0.8],  freq: 60,  life: 2800, sway: 14, glow: 1, front: 1, peak: 1 },
      crystal: { tint: [0x9fe8ff, 0xc9a8ff], dir: 'drift', spd: [5, 14],  scale: [0.3, 0.8],  freq: 110, life: 3600, sway: 8,  glow: 1, front: 1, peak: 0.9 },
      storm:   { tint: [0xbcd4ff, 0x8fb0e0], dir: 'rain',  spd: [320, 460], scale: [0.2, 0.5],freq: 18,  life: 1300, sway: 0,  front: 1, peak: 0.5 },
      bastion: { tint: [0xff8a3c, 0xffce8a], dir: 'up',    spd: [16, 40], scale: [0.3, 0.7],  freq: 110, life: 3600, sway: 12, glow: 1, front: 1, peak: 0.85 },
    };
    const a = A[this.theme] || A.day;
    const peak = a.peak || 0.6;
    const cfg = {
      lifespan: a.life, frequency: a.freq, quantity: 1, tint: a.tint,
      scale: { min: a.scale[0], max: a.scale[1] },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * (a.dir === 'rain' ? 0.5 : peak) },
    };
    if (a.glow) cfg.blendMode = 'ADD';                  // glow against the painted backdrop
    if (a.dir === 'up') { cfg.x = { min: 0, max: GAME_W }; cfg.y = { min: 0, max: GAME_H }; cfg.speedY = { min: -a.spd[1], max: -a.spd[0] }; cfg.speedX = { min: -a.sway, max: a.sway }; }
    else if (a.dir === 'down') { cfg.x = { min: 0, max: GAME_W }; cfg.y = { min: -20, max: -8 }; cfg.speedY = { min: a.spd[0], max: a.spd[1] }; cfg.speedX = { min: -a.sway, max: a.sway }; }
    else if (a.dir === 'side') { cfg.x = { min: -20, max: -8 }; cfg.y = { min: 0, max: GAME_H * 0.8 }; cfg.speedX = { min: a.spd[0], max: a.spd[1] }; cfg.speedY = { min: -a.sway, max: a.sway }; }
    else if (a.dir === 'rain') { cfg.x = { min: -40, max: GAME_W }; cfg.y = { min: -20, max: -8 }; cfg.speedY = { min: a.spd[0], max: a.spd[1] }; cfg.speedX = { min: 60, max: 110 }; cfg.scaleX = { min: 0.1, max: 0.16 }; cfg.scaleY = { min: 0.7, max: 1.2 }; delete cfg.scale; cfg.alpha = { start: 0.45, end: 0.45 }; }
    else { cfg.x = { min: 0, max: GAME_W }; cfg.y = { min: 0, max: GAME_H }; cfg.speedX = { min: -a.spd[1], max: a.spd[1] }; cfg.speedY = { min: -a.spd[1], max: a.spd[1] }; }
    // soft round motes (the 'pixel' dot) read as dust/embers/fireflies; rain keeps the streak 'spark'
    const tex = a.dir === 'rain' ? 'spark' : 'pixel';
    this.motes = this.add.particles(0, 0, tex, cfg).setScrollFactor(0).setDepth(a.front ? 28 : -5).setAlpha(a.front ? 0.92 : 1);
    // volcano gets a second, brighter EMBER burst layer that pops against the lava
    if (this.theme === 'volcano') {
      this.motes2 = this.add.particles(0, 0, 'pixel', {
        lifespan: 1800, frequency: 140, quantity: 1, tint: [0xffe08a, 0xff7a2a], blendMode: 'ADD',
        x: { min: 0, max: GAME_W }, y: { min: GAME_H * 0.55, max: GAME_H }, speedY: { min: -150, max: -70 },
        speedX: { min: -20, max: 20 }, scale: { min: 0.4, max: 1.1 },
        alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.95 },
      }).setScrollFactor(0).setDepth(27);
    }
  }

  // ── procedural pixel-art ground props (chunky, palette-matched, non-colliding) ──
  // Strategy: draw at the TILE's pixel grain (8px blocks) in the biome's own
  // accent colours, scatter on solid ground surfaces in the mid/background, so
  // they read as the same pixel art as the tiles. Deterministic placement.
  buildDecor() {
    // theme → { base, accent, kind } for the prop look
    const DECO = {
      day:     { base: 0x49b85e, accent: 0xffe066, kind: 'tuft' },
      cave:    { base: 0x4a5a78, accent: 0x8fd0ff, kind: 'rock' },
      sky:     { base: 0xbfe0ff, accent: 0xffffff, kind: 'tuft' },
      castle:  { base: 0x6b6f7a, accent: 0xff8a3c, kind: 'ember' },
      dusk:    { base: 0x7a5a4a, accent: 0xffb46a, kind: 'rock' },
      snow:    { base: 0x2f7a5a, accent: 0xffffff, kind: 'pine' },
      desert:  { base: 0x4faa5a, accent: 0xffe066, kind: 'cactus' },
      jungle:  { base: 0x2f8f4a, accent: 0xffe066, kind: 'tuft' },
      swamp:   { base: 0x3f7a4a, accent: 0xcfe79a, kind: 'tuft' },
      volcano: { base: 0x5a3a2a, accent: 0xff5a18, kind: 'ember' },
      crystal: { base: 0x9a6fd0, accent: 0xd8c0ff, kind: 'crystal' },
      storm:   { base: 0x44506a, accent: 0xbcd4ff, kind: 'rock' },
      bastion: { base: 0x5a4a5a, accent: 0xff7a3c, kind: 'ember' },
    };
    const d = DECO[this.theme] || DECO.day;
    const base = d.base, accent = d.accent, kind = d.kind;
    const g = this.add.graphics({ add: false });
    const px = (x, y, w, h, c, alpha = 1) => { g.fillStyle(c, alpha); g.fillRect(x, y, w, h); };
    const dark = (c) => Phaser.Display.Color.IntegerToColor(c).darken(28).color;
    // bake 3 prop variants once
    const make = (key, n) => {
      g.clear();
      if (kind === 'tuft') {                          // grass/ferns/reeds — vertical blades
        const blades = 3 + n; for (let i = 0; i < blades; i++) { const bx = 4 + i * 6, bh = 14 + ((i * 7) % 12); px(bx, 32 - bh, 4, bh, base); px(bx, 32 - bh, 4, 4, accent); }
      } else if (kind === 'rock') {                   // rocks/crystals — chunky blocks
        px(6, 14, 20, 18, base); px(10, 8, 12, 8, base); px(10, 8, 12, 4, accent, 0.8); px(8, 26, 24, 6, dark(base));
        if (n) { px(22, 18, 8, 14, base); px(22, 18, 8, 4, accent, 0.7); }
      } else if (kind === 'cactus') {                 // desert cacti
        px(13, 6, 6, 26, base); px(7, 14, 6, 6, base); px(7, 14, 6, 12, base); px(19, 10, 6, 6, base); px(19, 10, 6, 14, base); px(13, 6, 6, 3, accent);
      } else if (kind === 'crystal') {                // crystal shards
        g.fillStyle(base, 0.9); g.fillTriangle(8, 32, 14, 6, 20, 32); g.fillStyle(accent, 0.7); g.fillTriangle(11, 32, 14, 10, 16, 32);
        if (n) { g.fillStyle(base, 0.85); g.fillTriangle(20, 32, 25, 14, 30, 32); }
      } else if (kind === 'pine') {                   // snowy pines
        g.fillStyle(base, 1); g.fillTriangle(4, 22, 16, 4, 28, 22); g.fillTriangle(6, 32, 16, 14, 26, 32); px(14, 30, 4, 4, dark(base)); px(7, 8, 4, 3, accent); px(20, 18, 4, 3, accent);
      } else {                                        // ember vents / lava rocks
        px(6, 20, 20, 12, base); px(10, 16, 12, 6, base); g.fillStyle(accent, 0.85); g.fillRect(12, 12, 3, 8); g.fillRect(18, 14, 3, 6);
      }
      g.generateTexture(key, 36, 36);
    };
    ['p0', 'p1', 'p2'].forEach((k, i) => make('decor_' + this.theme + '_' + k, i));
    g.destroy();
    // scatter on solid ground surfaces (skip gaps), deterministic, behind the player
    const surfTop = this.level.groundTop;
    const solidTop = (c) => this._solidSet && this._solidSet.has(`${c},${surfTop}`);
    let seed = 1337;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let c = 2; c < this.level.W - 2; c += 3 + Math.floor(rnd() * 4)) {
      if (!solidTop(c)) continue;
      const v = Math.floor(rnd() * 3);
      const [x] = this.tileXY(c, surfTop);
      this.add.image(x + (rnd() * 20 - 10), surfTop * TILE - 4, 'decor_' + this.theme + '_p' + v)
        .setOrigin(0.5, 1).setDepth(kind === 'rock' || kind === 'crystal' ? 2 : -2)
        .setScale(0.7 + rnd() * 0.5).setAlpha(0.92).setFlipX(rnd() > 0.5);
    }
  }

  // ── FAUNA — friendly, NON-colliding critters that inhabit the world (birds,
  // butterflies, ground critters, fireflies, fish, and fellow frogs at the flag).
  // Decorative only (no physics, never in _solidSet) → the 0-death gate is untouched.
  // Generic + data-driven: a per-biome table + a few procedurally-baked pixel sprites.
  // The point: a populated world feels SOCIAL and alive, not isolated.
  buildFauna() {
    // bake the little critter sprites once (palette-matched pixel art, like the tiles)
    if (!this.textures.exists('fa_bird')) {
      const g = this.add.graphics({ add: false });
      const px = (x, y, w, h, c, a = 1) => { g.fillStyle(c, a); g.fillRect(x, y, w, h); };
      g.clear(); px(4, 5, 8, 5, 0xffffff); px(10, 4, 3, 3, 0xffffff); px(12, 5, 2, 2, 0xffb43c); px(2, 3, 4, 3, 0xe8e8e8); px(10, 7, 4, 3, 0xe8e8e8); g.generateTexture('fa_bird', 16, 12);
      g.clear(); px(7, 3, 2, 8, 0x3a2a1a); g.fillStyle(0xffffff, 1); g.fillTriangle(7, 6, 1, 1, 1, 10); g.fillTriangle(9, 6, 15, 1, 15, 10); g.fillStyle(0xffd35a, 0.85); g.fillTriangle(7, 6, 3, 3, 3, 8); g.fillTriangle(9, 6, 13, 3, 13, 8); g.generateTexture('fa_bfly', 16, 12);
      g.clear(); px(3, 6, 11, 7, 0xffffff); px(2, 3, 3, 5, 0xffffff); px(5, 2, 3, 4, 0xffffff); px(12, 7, 3, 3, 0xffffff); px(11, 8, 2, 2, 0x222); px(3, 4, 1, 2, 0xffb0b0); g.generateTexture('fa_critter', 16, 14);
      g.clear(); px(2, 3, 9, 5, 0xffffff); g.fillStyle(0xffffff, 1); g.fillTriangle(10, 5, 15, 1, 15, 9); px(3, 4, 2, 2, 0x222); g.generateTexture('fa_fish', 16, 10);
      g.clear(); px(3, 6, 8, 6, 0x6fcf52); px(3, 4, 3, 3, 0x6fcf52); px(8, 4, 3, 3, 0x6fcf52); px(4, 5, 1, 1, 0x0a0a0a); px(9, 5, 1, 1, 0x0a0a0a); px(2, 11, 2, 2, 0x4ea53c); px(10, 11, 2, 2, 0x4ea53c); g.generateTexture('fa_frog', 14, 14);
      g.destroy();
    }
    const T = TILE, W = this.level.W, gt = this.level.groundTop;
    let seed = 90210; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const surfTop = (c) => this._solidSet && this._solidSet.has(`${c},${gt}`);
    // bob/flutter/hop animators
    const flutter = (s) => this.tweens.add({ targets: s, scaleX: { from: s.scaleX, to: s.scaleX * 0.45 }, duration: 130 + rnd() * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const bob = (s, amp) => this.tweens.add({ targets: s, y: s.y - amp, duration: 700 + rnd() * 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const drift = (s, dx) => this.tweens.add({ targets: s, x: s.x + dx, duration: 4000 + rnd() * 4000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const hop = (s) => this.tweens.add({ targets: s, y: s.y - 10, duration: 220, yoyo: true, repeat: -1, repeatDelay: 900 + rnd() * 2200, ease: 'Quad.out' });
    // air critters fly in the upper third. depth -1 keeps them IN FRONT of the
    // parallax hills (so dark silhouettes read on any sky), but behind gameplay.
    const air = (key, n, tint, sc) => { for (let i = 0; i < n; i++) { const x = 40 + rnd() * (W * T - 80), y = 50 + rnd() * (gt * T * 0.55); const s = this.add.image(x, y, key).setDepth(-1).setScale(sc).setAlpha(0.95); if (tint) s.setTint(tint); if (key === 'fa_bfly') flutter(s); else this.tweens.add({ targets: s, scaleY: { from: sc, to: sc * 0.6 }, duration: 180, yoyo: true, repeat: -1 }); drift(s, (rnd() > 0.5 ? 1 : -1) * (50 + rnd() * 120)); bob(s, 8 + rnd() * 14); s.setFlipX(rnd() > 0.5); } };
    const glow = (n, tint) => { for (let i = 0; i < n; i++) { const x = 40 + rnd() * (W * T - 80), y = 60 + rnd() * (gt * T * 0.7); const s = this.add.image(x, y, 'spark').setDepth(-1).setScale(0.45).setTint(tint).setAlpha(0.85); this.tweens.add({ targets: s, alpha: 0.18, duration: 500 + rnd() * 700, yoyo: true, repeat: -1 }); drift(s, (rnd() > 0.5 ? 1 : -1) * (40 + rnd() * 90)); bob(s, 16 + rnd() * 20); } };
    const ground = (key, n, tint) => { let placed = 0, tries = 0; while (placed < n && tries++ < 200) { const c = 3 + Math.floor(rnd() * (W - 6)); if (!surfTop(c)) continue; const [x] = this.tileXY(c, gt); const s = this.add.image(x + rnd() * 16 - 8, gt * T - 4, key).setOrigin(0.5, 1).setDepth(1).setScale(1.7).setAlpha(1); if (tint) s.setTint(tint); s.setFlipX(rnd() > 0.5); (key === 'fa_frog' ? bob(s, 5) : hop(s)); placed++; } };
    const water = (key, n, tint) => { (this.level.zones || []).filter((z) => z.type === 'water').forEach((z) => { for (let i = 0; i < n; i++) { const x = (z.c0 + rnd() * (z.c1 - z.c0)) * T, y = (z.r0 + 1 + rnd() * (z.r1 - z.r0 - 1)) * T; const s = this.add.image(x, y, key).setDepth(3).setScale(1.3).setAlpha(0.9); if (tint) s.setTint(tint); s.setFlipX(rnd() > 0.5); drift(s, (rnd() > 0.5 ? 1 : -1) * 40); bob(s, 6); } }); };
    // a friendly critter standing right by the spawn — the world greets you the
    // instant the level opens, so the "inhabited, not lonely" feel lands at once.
    const greeter = (key, tint) => { const sc0 = this.level.start.c; for (let d = 2; d <= 5; d++) { const c = sc0 + d; if (c > W - 2 || !surfTop(c)) continue; const [x] = this.tileXY(c, gt); const s = this.add.image(x, gt * T - 4, key).setOrigin(0.5, 1).setDepth(1).setScale(1.7).setFlipX(true); if (tint) s.setTint(tint); (key === 'fa_frog' ? bob(s, 5) : hop(s)); return; } };

    // per-biome fauna table (kinds + counts). generic: add a row to populate a world.
    const F = {
      day:     () => { air('fa_bird', 5, 0x2a2a38, 1.3); air('fa_bfly', 4, 0xffd35a, 1.3); ground('fa_critter', 4, 0xf0d4ac); greeter('fa_critter', 0xf0d4ac); },
      cave:    () => { glow(10, 0x9fe8ff); ground('fa_critter', 2, 0x9fb0c0); },
      sky:     () => { air('fa_bird', 7, 0x3a3a4a, 1.4); air('fa_bfly', 2, 0xffffff, 1.2); },
      castle:  () => { glow(5, 0xff9a4a); air('fa_bird', 2, 0x2a2a2a, 1.2); },
      dusk:    () => { air('fa_bird', 5, 0x2a1f2e, 1.3); air('fa_bfly', 2, 0xffc66a, 1.2); glow(3, 0xffb46a); greeter('fa_critter', 0xd9b0c0); },
      snow:    () => { air('fa_bird', 3, 0x3a4656, 1.3); ground('fa_critter', 5, 0xffffff); greeter('fa_critter', 0xffffff); },
      desert:  () => { ground('fa_critter', 4, 0xe0c080); air('fa_bird', 3, 0x5a4a2a, 1.3); greeter('fa_critter', 0xe0c080); },
      jungle:  () => { air('fa_bfly', 6, 0x9fffb4, 1.4); air('fa_bird', 3, 0x223018, 1.3); ground('fa_frog', 4, 0x6fcf52); greeter('fa_frog', 0x6fcf52); },
      swamp:   () => { ground('fa_frog', 5, 0x8fbf5a); glow(4, 0xbfe39a); water('fa_fish', 2, 0x9fc06a); greeter('fa_frog', 0x8fbf5a); },
      volcano: () => { glow(5, 0xff7a3c); ground('fa_critter', 2, 0xd0a090); },
      crystal: () => { glow(11, 0xc9a8ff); ground('fa_critter', 2, 0xc9a8ff); },
      storm:   () => { air('fa_bird', 4, 0x2e3848, 1.3); glow(3, 0x9fd0ff); },
      bastion: () => { glow(4, 0xff7a3c); air('fa_bird', 2, 0x2a1f2e, 1.2); },
    };
    (F[this.theme] || F.day)();
    water('fa_fish', 2, 0x9fc7ff);                                   // fish in any water zone, any biome

    // FELLOW FROGS waiting at the flag — the social payoff: you're not alone at the end.
    if (this.level.goal) {
      const gc = this.level.goal.c;
      [gc - 2, gc + 2].forEach((c, i) => { if (c < 2 || c > W - 2 || !surfTop(c)) return; const [x] = this.tileXY(c, gt); const s = this.add.image(x, gt * T - 4, 'fa_frog').setOrigin(0.5, 1).setDepth(1).setScale(1.8).setFlipX(i === 1); this.tweens.add({ targets: s, y: s.y - 9, duration: 320, yoyo: true, repeat: -1, repeatDelay: 200 + i * 150, ease: 'Quad.out' }); });
    }
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW, this.worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(260, 180);
    cam.setFollowOffset(0, 40);
    this.applyPostFX(cam);
  }

  // Cohesion-preserving post (WebGL only; Canvas skips). Per research: a subtle
  // vignette + a palette-unifying color-grade read as "one artist made this".
  // NO bloom — it blurs pixels and breaks pixel-art cohesion.
  applyPostFX(cam) {
    if (this.renderer.type !== Phaser.WEBGL || !cam.postFX) return;
    try {
      cam.postFX.addVignette(0.5, 0.5, 0.92, 0.32);
      const cm = cam.postFX.addColorMatrix();
      cm.saturate(0.12); cm.brightness(1.03);   // warm, unified daytime grade
    } catch (e) { /* older Phaser */ }
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    // WASD as alternates — Arrow+Space can drop on some keyboards (n-key
    // rollover) and Space/arrows scroll the page unless captured.
    this.keys = this.input.keyboard.addKeys({
      z: 'Z', x: 'X', space: 'SPACE', m: 'M', r: 'R',
      w: 'W', a: 'A', d: 'D', s: 'S', up: 'UP', down: 'DOWN', f: 'F', j: 'J',
    });
    // Capture movement + FIRE keys so the browser doesn't scroll/blur.
    this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,X,F,J');
    this.input.keyboard.on('keydown-M', () => this.ui && this.ui.toggleMute());
    this.input.keyboard.on('keydown-R', () => { if (this.won) this.goNext(); else if (this.dead) this.scene.restart(); });
    // touch state shared from UI scene (joystick: left/right/jump/down + FIRE button)
    this.touch = { left: false, right: false, jump: false, jumpEdge: false, fire: false, down: false };
    this.game.registry.set('touch', this.touch);
    this._lastFire = 0;
  }

  setupColliders() {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.enemies, this.solids);
    this.physics.add.collider(this.enemies, this.blocks);
    this.brickCollider = this.physics.add.collider(this.player, this.blocks, this.onBlock, null, this);
    this.physics.add.overlap(this.player, this.coins, this.onCoin, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemy, null, this);
    if (this.piranhas) this.physics.add.overlap(this.player, this.piranhas, this.onPiranha, null, this);
  }

  // touching a piranha hurts (it cannot be stomped) → power-up state machine
  onPiranha(player, pr) {
    if (this.dead || this.won) return;
    const r = this.powerups ? this.powerups.hit() : 'die';
    if (r === 'invuln') return;
    if (this.dbg) this.dbg.log('hit_piranha', { x: Math.round(pr.x), result: r });
    if (r === 'shrank') { SFX.hurt(); this.shake(0.006, 160); player.setVelocity(this.facing * -180, -260); }
    else this.die();
  }

  // ── interactions ──────────────────────────────────────────────────────
  onBlock(player, block) {
    if (player.body.blocked.up && block.body.touching.down) {
      if (block.kind === 'qblock' && !block.used) {
        block.used = true;
        this.tweens.killTweensOf(block);
        block.setTexture('usedblock');
        this.bumpBlock(block);
        if (block.power) {
          this.powerups.spawn(block);     // mushroom rises out
          SFX.power();
        } else {
          this.spawnCoinFrom(block);
          SFX.bump();
        }
        if (this.dbg) this.dbg.log('qblock', { x: Math.round(block.x), power: !!block.power });
      } else if (block.kind === 'brick') {
        if (block.used) return;
        this.bumpBlock(block);
        SFX.bump();
        // big player SHATTERS bricks (SMB); small player just bumps them
        if (this.powerups && this.powerups.big) {
          this.chunks.emitParticleAt(block.x, block.y, 8);
          block.used = true;
          this.tweens.add({ targets: block, alpha: 0, scaleX: 0.6, duration: 120, onComplete: () => block.destroy() });
          this.shake(0.005, 120);
        }
      }
    }
  }

  bumpBlock(block) {
    const y0 = block.y;
    this.tweens.add({ targets: block, y: y0 - 12, duration: 80, yoyo: true, ease: 'quad.out',
      onUpdate: () => block.body && block.body.updateFromGameObject() });
  }

  spawnCoinFrom(block) {
    const coin = this.add.sprite(block.x, block.y - 10, 'coin0').play('coin_spin').setDepth(20);
    this.tweens.add({ targets: coin, y: block.y - 80, duration: 260, ease: 'quad.out', yoyo: true,
      onComplete: () => { coin.destroy(); this.sparkle.emitParticleAt(block.x, block.y - 20, 8); } });
    this.collectCoin(1, 200);
  }

  onCoin(player, coin) {
    this.tweens.killTweensOf(coin);
    this.sparkle.emitParticleAt(coin.x, coin.y, 8);
    coin.destroy();
    this.collectCoin(1, 100);
  }

  collectCoin(n, pts) {
    this.coinCount += n; this.score += pts;
    SFX.coin();
    if (this.dbg) this.dbg.log('coin', { total: this.coinCount, score: this.score });
    this.emitHud();
  }

  onEnemy(player, enemy) {
    if (!enemy.alive || this.dead || this.won) return;
    if (enemy._grace) return;                          // freshly-spawned split: harmless for a beat
    if (enemy.boss && enemy.reel > 0) return;          // boss is reeling → no contact either way
    const falling = player.body.velocity.y > 60;
    const above = player.body.bottom <= enemy.body.center.y + (enemy.boss ? 30 : 12);
    if (falling && above) {
      player.setVelocityY(-TUNE.stompBounce); this.coyote = 0;
      this.dust.emitParticleAt(enemy.x, enemy.body.bottom, 8);
      this.shake(0.006, 140); SFX.stomp();
      if (enemy.boss) {
        // BOSS: chip a hit, knock it back, and make it REEL (harmless) so the frog
        // has a clean window to land and re-approach. Dead at hp 0 → drop the gate.
        enemy.hp -= 1; enemy.reel = 1100;
        enemy.setVelocityX((player.x < enemy.x ? 1 : -1) * 150);
        this.score += 500; this.emitHud();
        if (this.dbg) this.dbg.log('boss_hit', { hp: enemy.hp });
        if (enemy.hp <= 0) this._bossDefeated(enemy);
        return;
      }
      // DIVE-SLAM (note #11 mechanic): a committed dive obliterates ANY walker —
      // even chargers/shells/splitters — in one hit, with a bigger reward + pop.
      if (this._diving) {
        this.botsBlasted++; this.score += 250; this.emitHud();
        player.setVelocityY(-TUNE.stompBounce * 1.25); this.shake(0.012, 200);
        this.dust.emitParticleAt(enemy.x, enemy.body.bottom, 16); this.chunks.emitParticleAt(enemy.x, enemy.y, 8);
        enemy.alive = false; if (enemy.anims) enemy.anims.stop(); enemy.body.checkCollision.none = true; enemy.setVelocity(0, 0);
        this.tweens.add({ targets: enemy, scaleY: 0.2, alpha: 0, angle: 30, duration: 220, onComplete: () => enemy.destroy() });
        if (this.dbg) this.dbg.log('diveslam', { x: Math.round(enemy.x), kind: enemy.kind });
        return;
      }
      this.score += 150; this.emitHud();
      if (this.dbg) this.dbg.log('stomp', { x: Math.round(enemy.x), kind: enemy.kind });
      // SHELL (snail): retract — harmless — then re-emerge behind the frog (which
      // has long since run on), so it's a stubborn nuisance, never a fresh threat.
      if (enemy.mech === 'shell' && !enemy._retracted) {
        enemy._retracted = true; enemy.alive = false; enemy.anims.stop();
        enemy.setVelocity(0, 0); enemy.setScale(enemy.scaleX, enemy.scaleY * 0.55).setTint(0xcfd6e0);
        this.time.delayedCall(2500, () => { if (!enemy.active) return;
          enemy._retracted = false; enemy.alive = true; enemy.clearTint();
          enemy.setScale(enemy.scaleX, enemy.scaleY / 0.55).play(`${enemy.kind}_walk`); });
        return;
      }
      // SPLITTER (bunny): bursts into two small fast walkers (briefly harmless so the
      // landing frog can react), then the original is gone.
      if (enemy.mech === 'splitter' && !enemy._isSplit) {
        for (const s of [-1, 1]) this._spawnSplit(enemy, s);
      }
      // default stomp → flatten + fade
      this.botsStomped++;
      enemy.alive = false; enemy.anims.stop();
      enemy.body.checkCollision.none = true; enemy.body.setAllowGravity(false); enemy.setVelocity(0, 0);
      this.tweens.add({ targets: enemy, scaleY: enemy.scaleY * 0.35, y: enemy.body.bottom - 6, duration: 120 });
      this.tweens.add({ targets: enemy, alpha: 0, duration: 360, delay: 200, onComplete: () => enemy.destroy() });
    } else {
      // route through the power-up state machine: big → shrink + invuln; small → die
      const r = this.powerups ? this.powerups.hit() : 'die';
      if (r === 'invuln') return;                 // currently invulnerable: no-op
      if (this.dbg) this.dbg.log('hit_enemy', { x: Math.round(enemy.x), result: r });
      if (r === 'shrank') {
        SFX.hurt();
        this.shake(0.006, 160);
        // brief knockback so you don't instantly re-collide
        this.player.setVelocity(this.facing * -180, -260);
      } else {
        this.die();
      }
    }
  }

  // a small fast offspring of a SPLITTER, briefly harmless so the landing frog can react
  _spawnSplit(parent, dir) {
    const sp = ENEMY_SPRITES[parent.kind] || ENEMY_SPRITES.goomba;
    const e = this.enemies.create(parent.x + dir * 22, parent.body.center.y - 6, parent.kind).play(`${parent.kind}_walk`);
    e.kind = parent.kind; e.alive = true; e.mech = 'plain'; e._isSplit = true; e.setData('dir', dir);
    if (sp.tint) e.setTint(sp.tint);
    const bodyW = sp.fw * 0.62, bodyH = sp.fh * 0.72;
    e.body.setSize(bodyW, bodyH).setOffset((sp.fw - bodyW) / 2, sp.fh - bodyH);
    e.setScale((50 / sp.fh) * 0.62); e.setBounce(0, 0); e.setCollideWorldBounds(false);
    e._spd = TUNE.enemySpeed * 1.15; e.setVelocityX(dir * e._spd);
    e._grace = true; e.setAlpha(0.55);
    this.time.delayedCall(420, () => { if (e.active) { e._grace = false; e.setAlpha(1); } });
  }

  _bossDefeated(e) {
    e.alive = false; e.body.checkCollision.none = true; e.setVelocityX(0);
    if (e._hpBg) e._hpBg.destroy(); if (e._hpFg) e._hpFg.destroy();
    SFX.power(); this.shake(0.012, 400); this.score += 2000; this.emitHud();
    this.tweens.add({ targets: e, angle: 200, alpha: 0, y: e.y + 20, duration: 900, onComplete: () => e.destroy() });
    // drop the gate → the path opens
    if (this.bossGate) {
      this.bossGate.getChildren().forEach((b, i) => {
        this.tweens.add({ targets: b, y: b.y + 6 * TILE, alpha: 0, delay: i * 70, duration: 600,
          onComplete: () => b.destroy() });
      });
      this.bossGate = null;
    }
    if (this.dbg) this.dbg.log('boss_defeated', { x: Math.round(e.x) });
  }

  die() {
    if (this.dead || this.won) return;
    this.dead = true;
    if (this.dbg) this.dbg.log('die', { x: Math.round(this.player.x), reason: this.player.y > this.worldH ? 'pit' : 'enemy_or_time' });
    SFX.hurt();
    this.shake(0.01, 300);
    const p = this.player;
    p.body.checkCollision.none = true;
    p.setVelocity(0, -700);
    p.setTint(0xff8080);
    this.tweens.add({ targets: p, angle: 180, duration: 600 });
    this.lives -= 1; this.emitHud();          // lose ONE heart (note #11)
    this.cameras.main.stopFollow();
    // flat, single-timer flow (nested timers were unreliable):
    this.time.delayedCall(1000, () => {
      if (!this.ui) return;
      if (this.lives <= 0) {
        this.ui.showGameOver({ score: this.score, carrots: this.coinCount, blasted: this.botsBlasted,
          stomped: this.botsStomped, shots: this.shotsFired, hearts: 0, time: 300 - this.timeLeft, meta: this.levelMeta() });
      } else if (this.game.registry.get('autopilot')) {
        this.ui.showMessage('Ouch!  Press R to retry', '#ff6b6b');   // autopilot self-restarts (debug.js)
      } else {
        this._respawnAtCheckpoint();                                  // human: auto-respawn at the checkpoint
      }
    });
  }

  // soft respawn at the latest checkpoint (note #11): reset the bunny in place.
  _respawnAtCheckpoint() {
    const cpCol = this.game.registry.get('checkpointCol');
    const useCp = cpCol != null && this.checkpoints && this.checkpoints.includes(cpCol);
    const sc = useCp ? cpCol : this.level.start.c;
    const sr = useCp ? this.level.groundTop - 2 : this.level.start.r;
    const [x, y] = this.tileXY(sc, sr);
    const p = this.player;
    p.setPosition(x, y); p.setVelocity(0, 0); p.clearTint(); p.setAngle(0); p.setAlpha(1);
    p.body.checkCollision.none = false; p.body.setAllowGravity(true);
    this.dead = false; this.facing = 1; this.coyote = 0; this.jumpHeld = false;
    this.setHeroAnim('hero_idle');
    this.cameras.main.startFollow(p, true, 0.12, 0.12);
    this.cameras.main.flash(220, 255, 255, 255);
    if (this.powerups) this.powerups.invulnUntil = this.time.now + 1600;   // brief grace
    if (this.ui && this.ui.msg) { this.ui.msg.destroy(); this.ui.msg = null; }
    if (useCp) this._litCheckpoint(cpCol);
  }

  win() {
    if (this.won || this.dead) return;
    this.won = true;
    this.game.registry.set('checkpointCol', null);   // a completed run resets checkpoints
    this.game.registry.set('lives', null);           // next level starts with a fresh 3 hearts
    uiTransition(this, 'won');
    if (this.dbg) this.dbg.log('win', { score: this.score, coins: this.coinCount });
    SFX.win();
    this.player.setVelocity(0, 0);
    this.setHeroAnim('hero_idle');
    this.tweens.add({ targets: this.flag, y: this.level.goal.baseR * TILE - 6, duration: 700, ease: 'quad.out' });
    for (let i = 0; i < 24; i++) {
      this.time.delayedCall(i * 60, () => this.sparkle.emitParticleAt(
        this.goalX + Phaser.Math.Between(-60, 60), 200 + Phaser.Math.Between(-40, 120), 4));
    }
    const meta = this.levelMeta();
    const hasNext = this.nextLevelId() != null;
    meta.stats = { score: this.score, carrots: this.coinCount, blasted: this.botsBlasted,
      stomped: this.botsStomped, shots: this.shotsFired, hearts: this.lives, time: 300 - this.timeLeft };
    this.ui.showWin(meta, hasNext);
    // auto-advance to the next level after a short celebration (manual NEXT also
    // works). Skipped under the autopilot so the eval/gate tools read a stable
    // win state instead of chaining into the next level.
    if (hasNext && !this.game.registry.get('autopilot')) {
      this.time.delayedCall(2600, () => { if (this.won && !this._advancing) this.goNext(); });
    }
  }

  shake(intensity, dur) { this.cameras.main.shake(dur, intensity); }

  // ── debug/driver introspection ─────────────────────────────────────────
  // Full semantic state, read by the AI driver every frame.
  // is there solid ground within `tilesAhead` columns in front of the player,
  // at/just-below foot level? Lets the AI player SEE gaps before falling in.
  groundAhead(tilesAhead = 2) {
    const p = this.player;                       // origin is bottom-center: p.y = feet
    const dir = this.facing >= 0 ? 1 : -1;
    const footRow = Math.round(p.y / TILE);      // row the feet rest on
    for (let d = 1; d <= tilesAhead; d++) {
      const c = Math.floor(p.x / TILE) + dir * d;
      let found = false;
      // look DOWN up to 6 tiles: a survivable drop-off (a ledge/stair with ground
      // a few rows below) is walkable, not a pit — only a true VOID (no ground in
      // range, e.g. a death gap) reads as a pit. Fixes the autopilot stalling at
      // the top of a tall stair-then-drop after the bigger jump.
      for (let r = footRow; r <= footRow + 6; r++) {
        if (this._solidSet && this._solidSet.has(`${c},${r}`)) { found = true; break; }
      }
      if (!found) return false;                  // a pit within reach
    }
    return true;
  }

  // Rich forward scan (for the AI planner): walks the solid-set ahead and
  // reports the distance to the next pit edge + its width, and the next wall's
  // height (a step/pipe). All in TILES from the player's current column.
  probeAhead(range = 8) {
    const set = this._solidSet; if (!set) return {};
    const c0 = Math.floor(this.player.x / TILE);
    const footRow = Math.round(this.player.y / TILE);
    const solidCol = (c) => { for (let r = footRow; r <= footRow + 3; r++) if (set.has(`${c},${r}`)) return true; return false; };
    // wall height at column c, measured up from foot level
    const wallH = (c) => { let h = 0; for (let r = footRow - 1; r >= footRow - 4; r--) { if (set.has(`${c},${r}`)) h++; else break; } return h; };
    let gapDist = -1, gapWidth = 0, wallDist = -1, wallHeight = 0;
    for (let d = 1; d <= range; d++) {
      const c = c0 + d;
      if (!solidCol(c) && gapDist < 0) {            // first missing ground = pit edge
        gapDist = d;
        let w = 0; while (d + w <= range + 4 && !solidCol(c0 + d + w)) w++;
        gapWidth = w;
      }
      const h = wallH(c);
      if (h >= 1 && wallDist < 0) { wallDist = d; wallHeight = h; }  // a step/pipe ahead (incl. 1-tall stairs)
    }
    return { gapDist, gapWidth, wallDist, wallHeight };
  }

  debugSnapshot() {
    const p = this.player;
    const coins = []; this.coins.children.iterate((c) => { if (c && c.active) coins.push({ x: Math.round(c.x), y: Math.round(c.y) }); });
    const enemies = []; this.enemies.children.iterate((e) => { if (e && e.active) enemies.push({ x: Math.round(e.x), y: Math.round(e.y), alive: !!e.alive, kind: e.kind, fly: !!e.fly, boss: !!e.boss, hp: e.hp, reel: e.reel > 0 }); });
    const blocks = []; this.blocks.children.iterate((b) => { if (b && b.active) blocks.push({ x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, used: !!b.used, power: !!b.power }); });
    const piranhas = []; if (this.piranhas) this.piranhas.children.iterate((pr) => { if (pr && pr.active) piranhas.push({ x: Math.round(pr.x), y: Math.round(pr.y), up: pr.y < pr.homeY - 8 }); });
    const springs = []; if (this.springs) this.springs.children.iterate((sp) => { if (sp && sp.active) springs.push({ x: Math.round(sp.x), y: Math.round(sp.y) }); });
    // moving platforms: live bounds + per-frame velocity, and which one we ride (if any)
    const movers = (this._movers || []).map((mm) => {
      const b = mm.plat.body;
      return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top),
        cx: Math.round((b.left + b.right) / 2), dir: mm.dir, vx: Math.round((mm.vx || 0) * 60), vy: Math.round((mm.vy || 0) * 60) };
    });
    const pb = p.body;
    const onMover = movers.find((mm) => pb.bottom <= mm.top + 10 && pb.bottom >= mm.top - 12
      && pb.right > mm.left + 2 && pb.left < mm.right - 2) || null;
    return {
      frame: this.dbg ? this.dbg.frame : 0,
      player: {
        x: Math.round(p.x), y: Math.round(p.y),
        vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y),
        onGround: p.body.blocked.down, facing: this.facing,
        wallRight: p.body.blocked.right || p.body.touching.right,
        wallLeft: p.body.blocked.left || p.body.touching.left,
        visible: p.visible, alpha: +p.alpha.toFixed(2), texture: p.texture.key,
        scaleX: +p.scaleX.toFixed(2), scaleY: +p.scaleY.toFixed(2),
        groundAhead2: this.groundAhead(2), groundAhead3: this.groundAhead(3),
        probe: this.probeAhead(9),
      },
      score: this.score, coins: this.coinCount, lives: this.lives,
      time: this.timeLeft, won: this.won, dead: this.dead,
      big: this.powerups ? this.powerups.big : false,
      invuln: this.powerups ? this.powerups.invulnerable : false,
      mushrooms: this.powerups ? this.powerups.mushrooms.countActive() : 0,
      input: this.dbg ? { ...this.dbg.input } : {}, jumpHold: this.dbg ? this.dbg.mem.jumpHold : 0,
      goalX: Math.round(this.goalX), worldW: this.worldW, worldH: this.worldH,
      remaining: { coins: coins.length, enemiesAlive: enemies.filter((e) => e.alive).length },
      coinsList: coins, enemiesList: enemies, blocksList: blocks, piranhasList: piranhas, springsList: springs,
      hazardsList: (this._periodics || []).filter((h) => !h.overhead).map((h) => ({ x: Math.round(h.x), active: !!h.activeNow, kind: h.kind })),
      moversList: movers, onMover,
    };
  }

  // The catalog of everything that must be reachable/interactive (for the
  // semantic reachability check). Built from the authored level.
  debugSemantics() {
    const L = this.level;
    return {
      start: L.start, goal: L.goal, worldTiles: { W: L.W, H: L.H },
      coins: L.coins.length, qblocks: L.qblocks.length, bricks: L.bricks.length,
      enemies: L.enemies.length, pipes: L.pipes.length, gaps: L.gaps || null,
      tile: TILE,
    };
  }

  emitHud() {
    this.ui && this.ui.setHud({ score: this.score, coins: this.coinCount, lives: this.lives, time: this.timeLeft });
  }

  // ── loop ──────────────────────────────────────────────────────────────
  update(time, delta) {
    // parallax cloud drift
    if (this.cloudBand) this.cloudBand.tilePositionX += 0.15; // slow pixel cloud drift
    if (this.powerups) this.powerups.update();   // mushrooms walk; invuln flashing

    if (this.won) return;
    const p = this.player;
    const t = this.game.registry.get('touch') || {};
    const dt = delta / 1000;

    // record the furthest seam-checkpoint the frog has reached (on the ground),
    // so a death respawns there rather than at tile 0.
    if (this.checkpoints && this.checkpoints.length && !this.dead) {
      const col = p.x / TILE;
      for (let i = this.checkpoints.length - 1; i >= 0; i--) {
        if (col >= this.checkpoints[i]) {
          const cur = this.game.registry.get('checkpointCol');
          if (cur == null || this.checkpoints[i] > cur) {
            this.game.registry.set('checkpointCol', this.checkpoints[i]);
            this._litCheckpoint(this.checkpoints[i]);                    // light the spawn marker
            if (this.ui && this.ui.showMessage && !this._cpFlashed) { this._cpFlashed = true; this.ui.showMessage('✓ Checkpoint', '#5fd66e'); this.time.delayedCall(800, () => { if (this.ui && this.ui.msg) { this.ui.msg.destroy(); this.ui.msg = null; } this._cpFlashed = false; }); }
          }
          break;
        }
      }
    }
    // advance moving platforms first (deterministic on the frame counter) so the
    // rider-carry and any collision happen before we read the player's footing.
    this.updateMovers(this.dbg ? this.dbg.frame : Math.round(time / 16.67));
    const onGround = p.body.blocked.down || p.body.touching.down;

    // retire spent rockets (off-world or older than ~1.5s) so they don't pile up
    if (this.rockets) this.rockets.children.iterate((r) => {
      if (!r || !r.active) return;
      if (time - (r.bornAt || 0) > 1500 || r.x < -40 || r.x > this.worldW + 40) r.destroy();
    });

    if (this.dead) {
      if ((this.keys.r.isDown) && this.lives <= 0) {} // handled by key event
      // Still tick the debug bridge while dead: the autopilot's death handler
      // (count the death, schedule the retry, terminate on a death-loop) lives
      // there. Skipping it on death frames left a dead frog drifting off-world
      // with collision disabled — the "blew off-world" symptom — and starved the
      // verifier of a death count / restart. _drive() is gated on !dead, so the
      // corpse isn't steered.
      if (this.dbg) this.dbg.tick(p);
      return;
    }

    const d = this.dbg ? this.dbg.input : {};
    const k = this.keys;
    const left = this.cursors.left.isDown || k.a.isDown || t.left || d.left;
    const right = this.cursors.right.isDown || k.d.isDown || t.right || d.right;
    const jumpDown = this.cursors.up.isDown || k.up.isDown || k.w.isDown
      || k.z.isDown || k.space.isDown || t.jump || d.jump;
    // FIRE — the bazooka (the new basic verb). Held-fire with a cooldown.
    // SHOWCASE auto-fire: when an autopilot SHOWCASE run (recordings) sees a bot
    // ahead in its facing line, it blasts it — so the gun reads on video. This is
    // OFF during the 0-death gate (showcase=false there), so that run never spawns
    // a rocket and its physics stays byte-identical/deterministic.
    const autoFire = this.game.registry.get('autopilot_showcase') && this._botAhead();
    const fireDown = k.f.isDown || k.j.isDown || t.fire || (d && d.fire) || autoFire;
    if (fireDown) this.tryFire(time);
    // DOWN = DIVE: pull the bunny down fast mid-air (joystick-down / S / ↓). A quick
    // way to drop onto a platform or stomp. Grounded → no-op. The autopilot never
    // presses down, so the 0-death gate is unaffected.
    const downDown = k.s.isDown || k.down.isDown || t.down;
    this._diving = downDown && !onGround && p.body.velocity.y > 60;   // a committed dive (note #11 mechanic)
    if (downDown && !onGround && p.body.velocity.y > -120) {
      p.setVelocityY(Math.max(p.body.velocity.y, TUNE.diveSpeed || 1500));
    }
    // DIVE-SLAM landing: hit the ground from a fast dive → a dust shockwave (juice)
    if (onGround && this._wasDiving && p.body.velocity.y >= 0) {
      this.dust.emitParticleAt(p.x, p.body.bottom, 14); this.shake(0.007, 130); SFX.stomp && SFX.stomp();
    }
    this._wasDiving = this._diving;

    // mirror inputs to the on-screen key display (for recordings)
    if (this.ui && this.ui.setInputViz) this.ui.setInputViz({ left, right, jump: jumpDown, fire: fireDown, down: downDown });
    this._syncHeroOutline();
    // advance the felt-interest playhead (only present when a recording injected it)
    if (this.ui && this.ui.setPlayhead) this.ui.setPlayhead(p.x, this.worldW);

    // horizontal accel + friction. On an icy surface, grip drops sharply: weaker
    // acceleration and ~10× less braking friction, so the frog glides.
    const tileKey = `${Math.floor(p.x / TILE)},${Math.round(p.y / TILE)}`;
    const onIce = onGround && this._iceSet && this._iceSet.has(tileKey);
    const onSticky = onGround && this._stickySet && this._stickySet.has(tileKey);
    const convDir = onGround && this._conveyorSet ? (this._conveyorSet.get(tileKey) || 0) : 0;
    const dashDir = onGround && this._dashSet ? (this._dashSet.get(tileKey) || 0) : 0;
    const slick = onIce || convDir !== 0 || dashDir !== 0;   // belts/pads run low-friction so the push reads
    const accel = onGround ? (onIce ? TUNE.iceAccel : onSticky ? TUNE.stickyAccel : TUNE.runAccel) : TUNE.airAccel;
    if (left && !right) { p.setAccelerationX(-accel); this.facing = -1; }
    else if (right && !left) { p.setAccelerationX(accel); this.facing = 1; }
    else {
      p.setAccelerationX(0);
      const f = (slick ? TUNE.iceFriction : onSticky ? TUNE.stickyFriction : TUNE.groundFriction) * dt;
      if (Math.abs(p.body.velocity.x) <= f) p.setVelocityX(0);
      else p.setVelocityX(p.body.velocity.x - Math.sign(p.body.velocity.x) * f);
    }
    // MUD caps your top speed — clamp the run while trudging through it
    if (onSticky && Math.abs(p.body.velocity.x) > TUNE.stickyMax) p.setVelocityX(Math.sign(p.body.velocity.x) * TUNE.stickyMax);
    if (convDir) p.setVelocityX(Phaser.Math.Clamp(p.body.velocity.x + convDir * TUNE.conveyorPush * dt, -TUNE.runMax, TUNE.runMax));
    // DASH PAD: rocket toward dir up to the turbo cap (one-shot — only accelerates
    // while the frog is below the cap, so it bursts you to speed then lets go).
    if (dashDir) {
      const target = dashDir * TUNE.dashSpeed;
      if (Math.abs(p.body.velocity.x) < TUNE.dashSpeed || Math.sign(p.body.velocity.x) !== dashDir) {
        p.setVelocityX(Phaser.Math.Clamp(p.body.velocity.x + dashDir * TUNE.dashPush * dt, -TUNE.dashSpeed, TUNE.dashSpeed));
      }
      if (this.dust && Math.random() < 0.4) this.dust.emitParticleAt(p.x, p.body.bottom, 2);
    }
    // BOUNCE TILE: landing on it auto-flings the frog (a low permanent spring). One
    // launch per landing (frame cooldown), exempt from the variable-jump clamp.
    if (onGround && this._bouncerSet && this._bouncerSet.has(tileKey) && p.body.velocity.y >= -40) {
      const F = this.dbg ? this.dbg.frame : (time / 16.67);
      if (F - (this._lastBounce || -99) > 10) {
        this._lastBounce = F;
        p.body.y -= 6; p.body.blocked.down = p.body.touching.down = false;
        p.setVelocityY(-TUNE.bounceVel);
        this.coyote = 0; this.jumpBuffer = 0; this.jumpHeld = true; this.springLaunch = true;
        SFX.jump(); this.squash(0.85, 1.15);
        if (this.dust) this.dust.emitParticleAt(p.x, p.body.bottom, 5);
      }
    }

    // ── FIELD ZONES: fold every zone the frog is inside into one set of effects ──
    let gravScale = 1, inWater = false;
    const fields = this.zonesAt ? this.zonesAt(p.x, p.y) : null;
    if (fields) for (const z of fields) {
      if (z.type === 'wind') {
        const ax = (z.dir || 1) * TUNE.windAccel * (z.strength || 1) * dt;
        p.setVelocityX(Phaser.Math.Clamp(p.body.velocity.x + ax, -TUNE.windMax, TUNE.windMax));
      } else if (z.type === 'updraft') {
        // counter-gravity lift while inside the fan, capped so it eases, not flings
        p.setVelocityY(p.body.velocity.y - TUNE.updraftAccel * (z.strength || 1) * dt);
        if (p.body.velocity.y < -TUNE.updraftRiseCap) p.setVelocityY(-TUNE.updraftRiseCap);
      } else if (z.type === 'lowgrav') {
        gravScale = Math.min(gravScale, z.scale || 0.5);
      } else if (z.type === 'water') {
        inWater = true; gravScale = Math.min(gravScale, 0.42);
      }
    }
    if (inWater) {
      if (p.body.velocity.y > TUNE.waterMaxFall) p.setVelocityY(TUNE.waterMaxFall);   // buoyant sink
      const now = time;
      if (jumpDown && (now - (this._lastStroke || 0)) > TUNE.waterStrokeMs) {         // repeatable swim stroke
        p.setVelocityY(-TUNE.waterStroke); this._lastStroke = now;
        if (this.dust) this.dust.emitParticleAt(p.x, p.body.bottom, 2);
      }
    }
    this._gravScale = gravScale;   // consumed by the gravity block below
    p.setFlipX(this.facing < 0);

    // coyote + jump buffer
    if (onGround) this.coyote = TUNE.coyoteMs; else this.coyote -= delta;
    const jumpPressed = jumpDown && !this.jumpHeld;
    if (jumpPressed) this.jumpBuffer = TUNE.bufferMs; else this.jumpBuffer -= delta;
    this.jumpHeld = jumpDown;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      p.setVelocityY(-TUNE.jumpVel);
      this.jumpBuffer = 0; this.coyote = 0;
      this.dust.emitParticleAt(p.x, p.body.bottom, 6);
      SFX.jump();
      this.squash(0.82, 1.18);
      if (this.dbg) this.dbg.log('jump', { x: Math.round(p.x), y: Math.round(p.y) });
    }
    // variable jump height: releasing early clamps upward velocity to a floor
    // (keeps momentum; no NaN). Pairs with asymmetric gravity below. A SPRING
    // launch is fixed-height, not player-modulated, so it's exempt — otherwise
    // not-holding-jump would instantly cut the bounce down to a tiny hop.
    if (this.springLaunch) { if (onGround && p.body.velocity.y >= 0) this.springLaunch = false; }
    else if (!jumpDown && p.body.velocity.y < -TUNE.jumpMinVel) p.setVelocityY(-TUNE.jumpMinVel);

    // asymmetric gravity — float up (held), hang at apex, fall heavy. A low-grav or
    // water field scales the whole pull down (moon jump / buoyant float).
    let gNow = TUNE.gravity;
    if (!onGround) {
      if (p.body.velocity.y < 0 && jumpDown) gNow = TUNE.gravityRise;
      if (Math.abs(p.body.velocity.y) < TUNE.apexThreshold) gNow = TUNE.gravityApex;
    }
    gNow *= (this._gravScale || 1);
    p.body.setGravityY(gNow - TUNE.gravity);

    // animation state (real frog animations)
    if (!onGround) {
      this.setHeroAnim(p.body.velocity.y < 0 ? 'hero_jump' : 'hero_fall');
    } else if (Math.abs(p.body.velocity.x) > 30) {
      const reversing = (right && p.body.velocity.x < -20) || (left && p.body.velocity.x > 20);
      this.setHeroAnim('hero_run');
      if (reversing) this.dust.emitParticleAt(p.x, p.body.bottom, 1);
    } else {
      this.setHeroAnim('hero_idle');
    }

    // land squash
    if (onGround && this.wasFalling && p.body.velocity.y >= 0) {
      this.squash(1.18, 0.82);
      this.dust.emitParticleAt(p.x, p.body.bottom, 5);
    }
    this.wasFalling = p.body.velocity.y > 200;

    // run dust
    if (onGround && Math.abs(p.body.velocity.x) > 200 && time % 6 < 1) this.dust.emitParticleAt(p.x, p.body.bottom, 1);

    // per-kind enemy movement
    this.enemies.children.iterate((e) => {
      if (!e || !e.alive) return;
      const spd = e._spd || TUNE.enemySpeed;
      if (e.fly) {
        // FLYER: patrol between its column bounds. SWOOPER dives toward the player's
        // x and dips low — but y is CLAMPED above the running frog's head (row ~9.5),
        // so it only menaces a JUMPING player; the grounded autopilot passes under.
        const dir = e.getData('dir');
        if (e.x <= e._c0 * TILE && dir < 0) e.setData('dir', 1);
        else if (e.x >= e._c1 * TILE && dir > 0) e.setData('dir', -1);
        e.setVelocityX(e.getData('dir') * spd);
        const f = this._frame || 0;
        if (e.mech === 'swooper') {
          const near = Math.abs(this.player.x - e.x) < TILE * 3;
          const dip = near ? (Math.sin(f * 0.12) * 0.5 + 0.5) * TILE * 2.2 : Math.sin(f * 0.06) * 10;
          e.y = Math.min(e._baseY + dip, (this.level.groundTop - 3.5) * TILE);   // clamp above the frog
        } else { e.y = e._baseY + Math.sin(f * 0.06) * 10; }
        e.setFlipX(e.getData('dir') > 0);
      } else if (e.boss) {
        // BOSS: reel after a hit (knocked back, harmless); otherwise pace slowly
        // toward the frog within its arena, so the AI gets clean stomp approaches.
        if (e.reel > 0) { e.reel -= delta; }
        else {
          const toward = this.player.x < e.x ? -1 : 1;
          e.setVelocityX(toward * spd); e.setFlipX(toward > 0);
        }
        if (e._hpFg) { e._hpBg.setPosition(e.x, e.y - 78); e._hpFg.setPosition(e.x - 46, e.y - 78).width = 92 * Math.max(0, e.hp) / e._hpMax; }
        e.setTint(e.reel > 0 ? 0xffffff : 0xffd0d0);
      } else if (e.shell) {
        // a stomped SHELL just sits (harmless) until it despawns
        e.setVelocityX(0);
      } else {
        // WALKER: turn at walls (and stay on its platform if it has nowhere to go)
        let dir = e.getData('dir');
        if (e.body.blocked.left && dir < 0) { e.setData('dir', 1); dir = 1; }
        else if (e.body.blocked.right && dir > 0) { e.setData('dir', -1); dir = -1; }
        // CHARGER: when the player is at its level within ~5 tiles, it TURNS to face
        // them and rushes (1.6×). The autopilot still leaps on detection (~2 tiles),
        // so it clears overhead — but a human feels the aggression.
        let v = dir * spd;
        if (e.mech === 'charger' && Math.abs(this.player.y - e.y) < TILE * 1.6 && Math.abs(this.player.x - e.x) < TILE * 5) {
          const tox = this.player.x < e.x ? -1 : 1;
          e.setData('dir', tox); v = tox * spd * 1.6;
        }
        e.setVelocityX(v);
        // HOPPER: small periodic hops while grounded (still stompable when it lands).
        if (e.mech === 'hopper' && (e.body.blocked.down || e.body.touching.down) && (this._frame || 0) > e._hopAt) {
          e.setVelocityY(-360); e._hopAt = (this._frame || 0) + 48;
        }
        e.setFlipX(e.getData('dir') > 0);
      }
    });

    // ── new mechanics: periodic hazards (deadly windows) + crumbling tiles ──
    const F = this.dbg ? this.dbg.frame : (this._frame = (this._frame || 0) + 1);
    (this._periodics || []).forEach((hz) => {
      const ph = (((F + hz.phase) % hz.period) + hz.period) % hz.period;
      hz.activeNow = ph < hz.active;
      if (hz.kind === 'spout') {
        hz.gfx.setVisible(hz.activeNow); hz.cap.setVisible(hz.activeNow);
        if (hz.activeNow) { const g = Math.min(1, ph / 8); hz.gfx.setScale(1, g); hz.cap.y = hz.baseY - TILE * 3 * g; }
        if (hz.activeNow && !this.dead && Math.abs(p.x - hz.x) < TILE * 0.55 && p.y > hz.topRow * TILE) this.die();
      } else if (hz.kind === 'firebar') {
        // rotate the bar: angle sweeps a full revolution per period. y grows downward,
        // so sin(angle) is "downness" — the bar reaches the walkway near straight-down.
        const ang = (ph / hz.period) * Math.PI * 2;
        const cs = Math.cos(ang), sn = Math.sin(ang);
        hz.balls.forEach(({ b, rad }) => { b.x = hz.x + cs * rad; b.y = hz.pivotY + sn * rad; });
        // AI window: flag ACTIVE generously around straight-down (a superset of the true
        // kill arc) so the standoff never crosses while a ball can reach the frog.
        hz.activeNow = sn > 0.3;
        if (!this.dead) {
          for (const { b } of hz.balls) {
            if (Math.abs(p.x - b.x) < TILE * 0.5 && Math.abs(p.y - b.y) < TILE * 0.5) { this.die(); break; }
          }
        }
      } else {  // dropper
        if (hz.activeNow) { hz.rock.setVisible(true); hz.rock.y = hz.topY + (ph / hz.active) * hz.fall; }
        else hz.rock.setVisible(false);
        if (hz.activeNow && !this.dead && Math.abs(p.x - hz.x) < TILE * 0.55 && Math.abs(p.y - hz.rock.y) < TILE * 0.8) this.die();
      }
    });
    if (this.crumbles) this.crumbles.getChildren().forEach((b) => {
      if (b.gone || b.touchedAt < 0) return;
      if (F - b.touchedAt >= 36) {                 // ~0.6s after first touch → collapse
        b.gone = true; b.body.enable = false;
        this.tweens.add({ targets: b, y: b.y + TILE * 5, alpha: 0, angle: 50, duration: 600 });
      }
    });

    // goal
    if (!this.won && p.x >= this.goalX - 10) this.win();

    // fell in a pit
    if (p.y > this.worldH + TILE * 1.5) this.die();

    // driver telemetry + anomaly detection (runs last, after physics)
    if (this.dbg) this.dbg.tick(p);
  }

  squash(sx, sy) {
    const p = this.player;
    const base = this.heroScale || 1.7;     // squash relative to the base scale
    this.tweens.killTweensOf(p);
    p.setScale(base * sx, base * sy);
    this.tweens.add({ targets: p, scaleX: base, scaleY: base, duration: 180, ease: 'back.out' });
  }
}
