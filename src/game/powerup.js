// ── Power-up system: the SMB-faithful mushroom + player size/damage state ──
// State machine (per research / Super Mario Wiki):
//   small --(mushroom)--> big
//   big   --(hit)-------> small + invuln(~2.2s, flashing); hit during invuln = no-op
//   small --(hit)-------> die
// Big can break bricks from below; mushroom = 1000 pts.
import { TILE, TUNE } from './consts.js';

export class PowerUps {
  constructor(scene) {
    this.scene = scene;
    this.big = false;
    this.invulnUntil = 0;
    // group of active mushrooms (physics bodies, ride the world like enemies)
    this.mushrooms = scene.physics.add.group();
    scene.physics.add.collider(this.mushrooms, scene.solids);
    scene.physics.add.collider(this.mushrooms, scene.blocks);
    scene.physics.add.overlap(scene.player, this.mushrooms, (_p, m) => this.collect(m), null, this);
  }

  get invulnerable() { return this.scene.time.now < this.invulnUntil; }

  // spawn a mushroom emerging from a bumped ? block
  spawn(block) {
    const m = this.mushrooms.create(block.x, block.y - TILE * 0.2, 'mushroom').setDepth(8);
    m.setDisplaySize(TILE * 0.8, TILE * 0.75);
    m.body.setSize(40, 38);
    m.setData('emerging', true);
    m.setData('dir', 1);
    m.body.setAllowGravity(false);
    // rise out of the block, then start walking + enable gravity
    this.scene.tweens.add({
      targets: m, y: block.y - TILE, duration: 360, ease: 'quad.out',
      onComplete: () => {
        if (!m.active || !m.body) return;   // collected/destroyed mid-emerge
        m.setData('emerging', false);
        m.body.setAllowGravity(true);
        m.setVelocityX(TUNE.mushroomSpeed);
      },
    });
    if (this.scene.dbg) this.scene.dbg.log('mushroom_spawn', { x: Math.round(block.x) });
  }

  // mushrooms walk and turn at walls/edges (like a Goomba)
  update() {
    this.mushrooms.children.iterate((m) => {
      if (!m || m.getData('emerging')) return;
      const dir = m.getData('dir');
      if (m.body.blocked.left && dir < 0) { m.setData('dir', 1); m.setVelocityX(TUNE.mushroomSpeed); }
      else if (m.body.blocked.right && dir > 0) { m.setData('dir', -1); m.setVelocityX(-TUNE.mushroomSpeed); }
      else if (m.body.velocity.x === 0) m.setVelocityX(dir * TUNE.mushroomSpeed);
    });
    // flashing while invulnerable
    const p = this.scene.player;
    if (this.invulnerable) p.setAlpha(Math.floor(this.scene.time.now / 80) % 2 ? 0.35 : 1);
    else if (!this.scene.dead) p.setAlpha(1);
  }

  collect(m) {
    if (!m.active) return;
    m.destroy();
    this.scene.sparkle.emitParticleAt(m.x, m.y, 12);
    this.scene.collectCoin(0, TUNE.powerupPts);     // award points (no coin count)
    if (this.scene.dbg) this.scene.dbg.log('powerup', { kind: 'mushroom' });
    if (!this.big) this.grow();
  }

  // Jazz's bunny is a 128px sprite scaled by heroBaseScale with a body of 46x66
  // @ offset 44,58. The OLD frog values (scale 1.9, body 16x26 @ 8,6) put the
  // collision box in the frame corner → a giant bunny that fell through and died.
  // Grow/shrink now just nudge the SCALE and keep the bunny's real body.
  grow() {
    this.big = true;
    const p = this.scene.player;
    const base = this.scene.heroBaseScale || 0.93;
    const big = base * 1.3;                       // a bit bigger, not gigantic
    this.scene.heroScale = big;
    this.scene.tweens.add({ targets: p, scaleX: big, scaleY: big, duration: 220, ease: 'back.out' });
    p.body.setSize(30, 44); p.body.setOffset(49, 80);   // keep the (visual-decoupled) bunny body
    this._brief();
    if (this.scene.sfxPower) this.scene.sfxPower();
  }

  // returns 'shrank' (survived a hit) or 'die'
  hit() {
    if (this.invulnerable) return 'invuln';
    if (this.big) {
      this.big = false;
      const p = this.scene.player;
      const base = this.scene.heroBaseScale || 0.93;
      this.scene.heroScale = base;
      this.scene.tweens.add({ targets: p, scaleX: base, scaleY: base, duration: 200, ease: 'quad.out' });
      p.body.setSize(30, 44); p.body.setOffset(49, 80);
      this.invulnUntil = this.scene.time.now + TUNE.invulnMs;
      this._brief();
      return 'shrank';
    }
    return 'die';
  }

  // brief hitstop on grow/shrink (juice)
  _brief() {
    const s = this.scene;
    s.physics.world.isPaused = true; s.anims.pauseAll();
    s.time.delayedCall(90, () => { s.physics.world.isPaused = false; s.anims.resumeAll(); });
  }
}
