// Debug bridge — turns the game into something an external "AI player" / driver
// can observe and control. Exposed on window.__game (only meant for the eval
// harness; harmless in production). Provides:
//   - snapshot(): full semantic game state every frame (player, entities, flags)
//   - setInput(): programmatic control (left/right/jump) the Play scene reads
//   - events: ring buffer of semantic events (coin, stomp, bump, die, win, jump…)
//   - anomalies: auto-detected problems (NaN pos, invisible sprite, stuck, OOB)
//   - level semantics: every reachable thing, so reachability can be verified
//
// The driver reads snapshot()/events/anomalies and writes setInput(), so every
// action's effect is observable and walkthroughs are reproducible.
import { TUNE } from './consts.js';
import { rewardMap } from './reward.js';

export class Debug {
  constructor(scene) {
    this.scene = scene;
    this.input = { left: false, right: false, jump: false };
    this.events = [];        // ring buffer of {t, type, ...}
    this.anomalies = [];     // {t, type, detail}
    this.trace = [];         // per-frame walkthrough trace (autopilot)
    this.timeline = [];      // lightweight per-frame states for annotate scrub
    this.maxLog = 4000;
    this.frame = 0;
    // autopilot: a goal-seeking policy that runs IN the game loop (synced to
    // real physics). The driver flips this on and reads results — no rAF races.
    // autopilot survives scene.restart() via the registry
    this.autopilot = scene.registry.get('autopilot') || false;
    // SHOWCASE: when on, the driver doesn't just rush the flag — it plays the FUN
    // beats (rides springs for their coin arcs, bumps powerups, hops nearby coins)
    // so a recording shows the *intended* experience the felt-eval scores, not the
    // minimal win path. Purely additive + safety-gated → the 0-death core is intact.
    this.showcase = scene.registry.get('autopilot_showcase') || false;
    this.collect = scene.registry.get('autopilot_collect') || false;   // 100%-run: grab coins, stomp walkers
    if (this.collect) this.showcase = true;                            // collector is a superset of showcase
    // death-MEMORY (collector): tiles where a coin lured us to our death. Persists
    // across scene.restart() via the registry → on the replay we GIVE UP those coins
    // and move along (and report them as unreachable to the design agent).
    this.deadspots = scene.registry.get('collect_deadspots') || [];
    this.deathBuckets = scene.registry.get('collect_deathbuckets') || {};   // ~5-tile bucket → death count (risk budget)
    this.deathCap = this.collect ? 16 : 6;                             // collect: deaths are fuel for learning
    this.deaths = scene.registry.get('autopilot_deaths') || 0;
    this.mem = { lastX: null, stuck: 0, jumpHold: 0, sinceJump: 0 };
    this._deathHandled = false;
    this._installApi();
  }

  _installApi() {
    const self = this;
    window.__game = {
      ready: true,
      // live snapshot of everything semantically meaningful
      snapshot: () => self.scene.debugSnapshot(),
      // semantic catalog of the level (what must be reachable)
      semantics: () => self.scene.debugSemantics(),
      events: () => self.events.slice(),
      anomalies: () => self.anomalies.slice(),
      clearEvents: () => { self.events.length = 0; self.anomalies.length = 0; },
      // ballistic-trajectory simulator (Phase-A primitive #2): predict where a
      // launch of upward speed `vy` lands, against the live solid set. Used by
      // the spring/launch driver logic and exposed here for harness validation.
      ballistic: (vy, jumpHeld) => {
        const s = self.scene, p = s.player;
        const solidAt = (c, r) => !!(s._solidSet && s._solidSet.has(`${c},${r}`));
        return self._simulateLaunch(p.x, p.y, p.body.velocity.x, vy == null ? TUNE.jumpVel : vy, solidAt, jumpHeld !== false);
      },
      // programmatic input
      setInput: (i) => { Object.assign(self.input, i); },
      press: (key, ms = 80) => self._press(key, ms),
      restart: () => self.scene.scene.restart(),
      // ── annotate-mode timeline: buffered states for scrub/rewind ──
      timeline: () => self.timeline.slice(),
      pauseGame: () => { self.scene.physics.world.isPaused = true; self.scene.anims.pauseAll(); self._paused = true; },
      resumeGame: () => { self.scene.physics.world.isPaused = false; self.scene.anims.resumeAll(); self._paused = false; },
      // move the camera + player marker to a buffered moment (visual scrub)
      seek: (frame) => {
        const tl = self.timeline; if (!tl.length) return;
        const f = tl.reduce((a, b) => (Math.abs(b.f - frame) < Math.abs(a.f - frame) ? b : a), tl[0]);
        const s = self.scene, p = s.player;
        p.x = f.x; p.y = f.y; p.setVelocity(0, 0);
        s.cameras.main.centerOn(f.x, f.y);
        return f;
      },
      // teleport the player to a clean flat spot (for deterministic control
      // tests). Uses the spawn column (guaranteed flat/clear), a little airborne
      // so it settles onto the ground; clears all motion + jump state.
      resetPlayer: () => {
        const s = self.scene, p = s.player;
        p.setVelocity(0, 0); p.setAcceleration(0, 0); p.setAngle(0);
        p.x = (s.level.start.c) * 64 + 32;
        p.y = (s.groundTopRow ? s.groundTopRow : (s.level.groundTop)) * 64 - 4;
        s.coyote = 0; s.jumpBuffer = 0; s.jumpHeld = false;
        if (s.powerups) { s.powerups.invulnUntil = 0; }
      },
      // autopilot control (the AI driver): start/stop + read the live result
      autopilot: (on) => {
        self.autopilot = on !== false;
        self.scene.registry.set('autopilot', self.autopilot);
        if (self.autopilot) {
          self.deaths = 0;
          self.scene.registry.set('autopilot_deaths', 0);
          self.scene.registry.set('autopilot_frames', 0);
          self.scene.registry.set('autopilot_done', false);
          self.scene.registry.set('autopilot_trace', []);
          self.scene.registry.set('autopilot_events', []);
          self.scene.registry.set('autopilot_anomalies', []);
        }
      },
      // showcase toggle (survives restart via registry): play the fun beats, not
      // just the win path. Pair with autopilot(true) for an "ideal experience" run.
      showcase: (on) => { self.showcase = on !== false; self.scene.registry.set('autopilot_showcase', self.showcase); },
      // collector toggle (survives restart): a 100%-style run — sweep up coins and
      // stomp every reachable walker before finishing. Implies showcase.
      collect: (on) => { self.collect = on !== false; self.scene.registry.set('autopilot_collect', self.collect);
        if (self.collect) { self.showcase = true; self.scene.registry.set('autopilot_showcase', true); } },
      result: () => ({
        autopilot: self.autopilot, frame: self.frame, deaths: self.deaths,
        trace: (self.scene.registry.get('autopilot_trace') || []).slice(),
        events: (self.scene.registry.get('autopilot_events') || []).slice(),
        anomalies: (self.scene.registry.get('autopilot_anomalies') || []).slice(),
        snapshot: self.scene.debugSnapshot ? self.scene.debugSnapshot() : null,
        semantics: self.scene.debugSemantics ? self.scene.debugSemantics() : null,
      }),
    };
  }

  _finishAuto(status) {
    if (this.scene.registry.get('autopilot_done')) return;
    this.autopilot = false;
    this.scene.registry.set('autopilot', false);
    this.scene.registry.set('autopilot_done', status);
    this.input = { left: false, right: false, jump: false };
  }

  // Goal-seeking policy — chosen each frame from the live snapshot.
  // Handles: run to goal, jump gaps/walls/enemies, variable-height holds, and
  // recovery when wedged against a wall (back up + re-jump) so it can't softlock.
  // ── LOOKAHEAD PLANNER ──────────────────────────────────────────────────
  // Reads the full game state (probe of upcoming gaps/walls + entity lists) and
  // chooses inputs deliberately, with timed jumps and hazard avoidance, rather
  // than reacting blindly. The frog "understands" what's ahead.
  _drive(s) {
    const TILE = 64, m = this.mem;
    const p = s.player;
    const pr = p.probe || {};
    const goalRight = p.x < s.goalX - 20;
    const onG = p.onGround;
    if (onG && Math.abs(p.vy) < 60) this.mem.pursueX = null;  // safely grounded → not mid-coin-chase
    // RISK BUDGET (a): a stretch that has killed us ≥2 times → hand control back to the
    // SAFE-TRAVERSAL policy here (behave as if collect=false). Deferring only the reward
    // planner isn't enough — the collect-widened coin hops still die there; this turns
    // ALL the collect aggression off across the deadly stretch so we cross it 0-death.
    const _bk = Math.round(p.x / 320);
    const safeHere = this.collect && ((this.deathBuckets[_bk] || 0) + (this.deathBuckets[_bk - 1] || 0) + (this.deathBuckets[_bk + 1] || 0)) >= 2;
    const collectActive = this.collect && !safeHere;
    const solidSet0 = this.scene._solidSet;                  // hoisted for the collector branch
    const solidAt0 = (c, r) => !!(solidSet0 && solidSet0.has(`${c},${r}`));
    const colX = ((p.x % TILE) + TILE) % TILE;
    // distance (px) from the player CENTER to the near face of each feature
    const gapPx = pr.gapDist > 0 ? pr.gapDist * TILE - colX : Infinity;
    const wallPx = pr.wallDist > 0 ? pr.wallDist * TILE - colX : Infinity;
    const wallH = pr.wallHeight || 0;
    // walker enemies only — FLYERS patrol high and the grounded frog passes under
    // them (never leap at one), and the BOSS has its own branch below.
    const ne = (s.enemiesList || []).filter((e) => e.alive && !e.fly && !e.boss && e.x > p.x - 8).sort((a, b) => a.x - b.x)[0];
    const enemyPx = ne ? ne.x - p.x : Infinity;
    const boss = (s.enemiesList || []).find((e) => e.alive && e.boss);
    const np = (s.piranhasList || []).filter((q) => q.x > p.x - 8).sort((a, b) => a.x - b.x)[0];
    const pirPx = np ? np.x - p.x : Infinity;
    const inp = { left: false, right: goalRight, jump: false };

    // ── progress watchdog: detects a true jam (works whether on ground or mid-
    //    air, so in-place hopping against a wall can't fool it). Tracks furthest
    //    x reached; if it stops climbing for a while we retreat for a runway.
    if (p.x > (m.maxX == null ? -1e9 : m.maxX) + 2) { m.maxX = p.x; m.noProg = 0; }
    else m.noProg = (m.noProg || 0) + 1;

    // ── BACKOFF: retreat left to win a running start, then re-approach. After it
    //    ends we reset the watchdog baseline so the next approach gets a fair go.
    if (m.backoff > 0) {
      m.backoff--; this.input = { left: true, right: false, jump: false };
      if (m.backoff === 0) { m.maxX = p.x; m.noProg = 0; }
      return;
    }
    if (m.noProg > 50 && goalRight) {
      m.backoff = 22; this.input = { left: true, right: false, jump: false }; return;
    }

    // ── mid-air: keep holding the current jump for its planned duration, else
    //    just steer toward the goal. All launch decisions happen on the ground.
    if (!onG) {
      // A spring launch (upward speed well beyond a normal jump) → HOLD jump so the
      // lighter rise-gravity applies and the bounce floats to its full height,
      // instead of being dragged down by fall-gravity.
      if (p.vy < -(TUNE.jumpVel + 80)) inp.jump = true;
      else if (m.jumpHold > 0) { m.jumpHold--; inp.jump = true; }
      this.input = inp; return;
    }

    // ===== GROUNDED: pick exactly one action this frame =====

    // 0) BOSS fight: the boss gates the exit, so we must land N stomps on it. Keep a
    //    safe stand-off; when it's REELING (knocked back, harmless) ease back to give
    //    a clean run-up; when it's active and in range, sprint then leap to stomp.
    if (boss && boss.x > p.x - TILE) {
      const bpx = boss.x - p.x;
      if (bpx < TILE * 5.5) {
        m.noProg = 0;                                   // the gate isn't a jam to back off from
        if (boss.reel) {                                // harmless → reset to a clean stomp distance
          this.input = bpx < TILE * 2.6 ? { left: true, right: false, jump: false }
                                        : { left: false, right: false, jump: false };
          return;
        }
        if (bpx > TILE * 2.3) { this.input = { left: false, right: true, jump: false }; return; }  // close in
        if (bpx > 12) { inp.jump = true; m.jumpHold = 13; this.input = inp; return; }               // leap → stomp
      }
    }

    // 0.5) RIDER — board / ride / hop off a REQUIRED moving platform. Movers aren't in
    //    the static solid-set, so the probe reads a too-wide gap (or a lift shaft) as a
    //    pit; here we consult the LIVE platforms (s.moversList / s.onMover). Runs before
    //    the gap/wall branches so it overrides a doomed leap. GATED on movers.length, so
    //    levels without movers are untouched. AI-OPTIONAL movers never enter it: a
    //    leapable gap (width < 5) is handled by the leap below, and an overhead lift is
    //    out of foot range so we never board it.
    const movers = s.moversList || [];
    if (movers.length) {
      const solidSet = this.scene._solidSet;
      const solidAt = (c, r) => !!(solidSet && solidSet.has(`${c},${r}`));
      const footRow = Math.round(p.y / TILE), cHere = Math.floor(p.x / TILE);
      const solidAheadAt = (dc) => solidAt(cHere + dc, footRow) || solidAt(cHere + dc, footRow + 1);
      const onM = s.onMover;
      if (onM) {
        m.noProg = 0;                                   // riding isn't a jam
        // step OFF the moment real STATIC ground sits within ~2 tiles ahead at our
        // level (the far bank / the lift's exit ledge has arrived).
        if (solidAheadAt(1) || solidAheadAt(2)) { this.input = { left: false, right: true, jump: false }; return; }
        // else RIDE: go idle and let the carry physics hold us on the deck (chasing the
        // centre with run momentum just slingshots us off — the v1 bug). Only nudge
        // back if we're drifting off the leading edge into the void.
        const nearFront = onM.right - p.x < TILE * 0.7;
        this.input = nearFront ? { left: true, right: false, jump: false }
          : { left: false, right: false, jump: false };
        return;
      }
      // NOT aboard — do we NEED to board? a too-wide gap or too-tall wall just ahead,
      // with a platform docked FLUSH at our edge (deck left edge ≤ the brink, so the
      // walk on crosses no void). Otherwise hold a standoff ~1 tile back and wait for
      // the platform to dock — never slide into the pit.
      const unleapableGap = pr.gapDist > 0 && gapPx < TILE * 1.8 && (pr.gapWidth || 0) >= 5;
      const unjumpableWall = pr.wallDist > 0 && wallPx < TILE * 1.8 && wallH >= 4;
      if (onG && (unleapableGap || unjumpableWall)) {
        m.noProg = 0;
        const brink = (cHere + 1) * TILE;                 // x of the first gap column's edge
        const docked = movers.find((mm) => Math.abs(mm.top - p.y) < TILE * 0.9
          && mm.left <= brink + TILE * 0.3 && mm.right > brink + TILE * 0.3);
        if (docked) { this.input = { left: false, right: true, jump: false }; return; }   // flush → walk aboard
        this.input = gapPx < TILE * 1.0 ? { left: true, right: false, jump: false }       // too close → ease back
          : { left: false, right: false, jump: false };                                    // hold & wait for the dock
        return;
      }
    }

    // 1) GAP ahead → leap. Launch ~0.95 tile before the edge; hold scales w/ width.
    if (pr.gapDist > 0 && gapPx <= TILE * 0.95 && gapPx > -8) {
      inp.jump = true; m.jumpHold = Math.min(22, 12 + (pr.gapWidth || 1) * 3);
      this.input = inp; return;
    }

    // 2) WALL / PIPE / STEP ahead.
    if (pr.wallDist > 0 && goalRight) {
      if (wallH >= 2) {
        // Tall pipe/wall, possibly guarded by a piranha that times in/out (L2).
        // Use the periodic-object model (primitive #1): rather than coast in and
        // brake a tile from the face — which burns the runway and desyncs from the
        // plant's cycle — HOVER at a fixed wait cell that keeps a full runway, and
        // commit the sprint+leap only on a FRESH retract so the whole arc fits in
        // one verified-safe window. A stale (long-open) window is refused; we wait
        // for the next clean drop.
        // Capture range must EXCEED the wait distance, or the frog backs off past
        // it, drops out of this branch, and charges the pipe again — an infinite
        // approach/retreat that never settles to watch the plant's cycle.
        const guard = np && pirPx < TILE * 7;         // a piranha belonging to this pipe
        if (guard) {
          // While we wait out a plant we sit still — so an enemy can close from
          // EITHER side (typically a goomba creeping up from behind). Stomp-hop it
          // the moment it's adjacent so it can't end the wait for us.
          const nb = (s.enemiesList || []).filter((e) => e.alive)
            .map((e) => ({ e, dx: e.x - p.x })).sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx))[0];
          if (onG && nb && Math.abs(nb.dx) < TILE * 1.6 && Math.abs(nb.e.y - p.y) < TILE * 1.3) {
            m.jumpHold = 12; this.input = { left: false, right: false, jump: true }; return;
          }
          const ph = this._periodic('pir' + Math.round(np.x), !!np.up);
          const WAIT = TILE * 3.4;                     // park here: enough runway to sprint+clear
          const NEED = 40;                             // frames to sprint in + clear the mouth
          const settle = () => { this.input = wallPx < WAIT - TILE * 0.3
            ? { left: true, right: false, jump: false }            // too close → ease back
            : (wallPx > WAIT + TILE * 0.5
              ? { left: false, right: true, jump: false }          // too far → creep to the cell
              : { left: false, right: false, jump: false }); };    // in the band → hold
          if (np.up) { ph.committed = false; settle(); return; }   // dangerous → wait it out
          if (!ph.committed) {
            // Retracted (safe). Commit only when a FULL window is ahead, so the
            // sprint+arc finish before the plant re-emerges: either it JUST dropped
            // (fresh), or — once we've learned the safe-phase length by watching one
            // cycle — enough of it remains. A stale drop is refused; wait for the
            // next clean one. This is the periodic model doing its job.
            const fresh = ph.since <= 6;
            const enoughLeft = ph.lastSafe > 0 && (ph.lastSafe - ph.since) >= NEED;
            if (!(fresh || enoughLeft)) { settle(); return; }
            ph.committed = true;
          }
          // committed → fall through to the launch logic below (sprint then leap)
        }
        // launch window: fire with real momentum (vx>400) so we clear in one arc.
        // L1's full-runway approach hits this at ~2 tiles with vx≈700; a piranha
        // standoff sprint hits it a touch later once speed has built.
        if (wallPx <= TILE * 2.0 && wallPx >= TILE * 0.85 && Math.abs(p.vx) > 400) {
          // hold just long enough to clear the top + a margin, NOT a full max jump
          // — a max-height leap sails 8 tiles and can land onto an enemy beyond the
          //   pipe; a measured arc drops back into the safe ground right after it.
          inp.jump = true; m.jumpHold = Math.min(20, 11 + wallH * 4); this.input = inp; return;
        }
        if (wallPx < TILE * 0.85 && Math.abs(p.vx) < 400) {
          // too close & too slow to clear → retreat for a running start
          m.backoff = 20; this.input = { left: true, right: false, jump: false }; return;
        }
        // else: keep accelerating to enter the launch window with speed
      } else if (wallPx <= TILE * 1.2 && wallPx > -8) {
        // short 1-tile step (stairs) → a simple hop always clears it
        inp.jump = true; m.jumpHold = 16; this.input = inp; return;
      }
    }

    // 3) PIRANHA on flat ground (not on a pipe) & up → wait it out
    if (np && np.up && pirPx > 14 && pirPx < TILE * 1.3 && (!pr.wallDist || pr.wallDist < 0)) {
      this.input = { left: false, right: false, jump: false }; return;
    }

    // 3b) PERIODIC COLUMN HAZARD (fire spout / falling rock) ahead → read its phase
    //     and only cross on a FRESH dormant window (full gap ahead), else hold at a
    //     safe cell. Generous dormancy makes this reliably 0-death (primitive #1).
    const hz = (s.hazardsList || []).filter((h) => h.x > p.x - 8).sort((a, b) => a.x - b.x)[0];
    if (hz) {
      const hzPx = hz.x - p.x;
      if (hzPx > -8 && hzPx < TILE * 4.5) {
        const ph = this._periodic('hz' + hz.x, hz.active);   // dangerous = active
        m.noProg = 0;                                        // parking here isn't a jam
        const CELL = TILE * 3.2;                             // park here — beyond the ~1.7-tile brake slide
        const NEED = 30;                                     // frames to sprint in + clear the column
        // Hazard ERUPTING → abandon any commit and wait it out (safety net: if a
        // window closed before we crossed, we re-queue instead of dashing blind).
        if (hz.active) ph.committed = false;
        if (!ph.committed) {
          // Commit the moment we WITNESS the eruption end (since≈0 right after a real
          // transition ⇒ a guaranteed-full dormant window ahead), or once we've learned
          // the window length and enough of it remains. transitions≥1 guards against a
          // blind first-sight dash (since=0 before any edge has actually been seen).
          const fresh = !hz.active && ph.transitions >= 1 && ph.since <= 4;
          const enoughLeft = !hz.active && ph.lastSafe >= NEED && (ph.lastSafe - ph.since) >= NEED;
          if (!(fresh || enoughLeft)) {
            // Ease to a HALT at a safe standoff and wait — never press toward an
            // un-cleared column. Coasting from full sprint brakes in ~1.5 tiles, so
            // detecting at 4.5 tiles leaves ~3 tiles of clearance even when we arrive
            // fast (right after dashing the previous spout).
            this.input = hzPx < CELL - TILE * 0.3 ? { left: true, right: false, jump: false }   // too close → back off
              : { left: false, right: false, jump: false };                                      // coast & wait
            return;
          }
          ph.committed = true;     // STICKY — see it through the whole dash, don't re-judge mid-cross
        }
        this.input = { left: false, right: true, jump: false }; return;   // committed → dash across
      }
    }

    // 4) ENEMY ahead on the ground → leap to clear OVER it. Triggered ~2 tiles
    //    out (not 1) because a goomba walking TOWARD us closes fast; jumping late
    //    means meeting it side-on while still rising = a fatal side hit. Launching
    //    early puts us above it by the time we meet — stomp or clear, never clip.
    if (ne && enemyPx > 14 && enemyPx < TILE * 2.0 && Math.abs(ne.y - p.y) < TILE * 1.3) {
      inp.jump = true; m.jumpHold = 14; this.input = inp; return;
    }

    // 4.5) COLLECTOR ROUTE-PLANNER: actively go after coins reachable by a jump or a
    //    spring from the path — position precisely under the coin (braking the run so
    //    the rising arc threads it), or route onto the spring. Coins it keeps missing
    //    or that kill it get learned (deadspot) and skipped — "learn from death and
    //    move along". Returns null when nothing's worth a detour → forward sweep.
    if (collectActive && onG) {
      const nav = this._planReward(s, p, onG);
      if (nav) { this.input = nav; return; }
    }

    // 5) SHOWCASE cruise: nothing urgent ahead (all hazard branches above returned),
    //    so spend the calm stretch PLAYING THE FUN — the same competent AI, now
    //    valuing the beats the felt-eval rewards. Every action is verified-safe;
    //    if a detour can't be confirmed we fall through to the plain goal run, so
    //    the 0-death guarantee is untouched. Reusable across every level.
    if (this.showcase && onG && goalRight) {
      const solidSet = this.scene._solidSet;
      const solidAt = (c, r) => !!(solidSet && solidSet.has(`${c},${r}`));
      const farFromGap = (!(pr.gapDist > 0) || gapPx > TILE * 3.5) && p.groundAhead3;  // solid runway, no edge
      const enemyClear = !ne || enemyPx > TILE * 2.5;                    // base planner owns close enemies
      const pirClear = !np || pirPx > TILE * 4;                          // give piranha-pipes a wide berth
      const wallClear = !(pr.wallDist > 0) || wallPx > TILE * 2;
      if (farFromGap && enemyClear && pirClear && wallClear) {
        // a) POWERUP — bump an unused power block directly overhead and REACHABLE
        //    by a normal jump (≤~3.5 tiles up). A vertical hop lands where it left,
        //    so this is inherently safe; unreachable blocks (spring-height) are left
        //    to the spring ride below.
        const pw = (s.blocksList || []).find((b) => !b.used && b.power
          && Math.abs(b.x - p.x) < TILE * 1.1 && b.y < p.y - TILE * 0.5 && b.y > p.y - TILE * 3.4);
        if (!s.big && pw) { inp.jump = true; m.jumpHold = 16; this.input = inp; return; }
        // b) SPRING — a pad just ahead with a coin reward above. Only stride onto it
        //    if the launch arc (springVel, jump held) is SIMULATED to land back on
        //    solid ground — so riding a pad can never fling the player into a pit.
        const sp = (s.springsList || []).filter((x) => x.x > p.x - 8 && x.x - p.x < TILE * 1.4).sort((a, b) => a.x - b.x)[0];
        if (sp && (s.coinsList || []).some((c) => Math.abs(c.x - sp.x) < TILE * 2 && c.y < p.y - TILE * 0.5)) {
          const land = this._simulateLaunch(sp.x, p.y, Math.min(Math.abs(p.vx), 280), TUNE.springVel, solidAt, true);
          if (land.safe) { this.input = { left: false, right: true, jump: false }; return; }   // stride the pad
        }
        // c) COIN — hop to grab a reachable coin ahead-and-above, but ONLY if the
        //    SIMULATED arc (real vx, jump held) reaches the coin's height AND lands
        //    back on solid ground. A short cooldown stops re-hopping a missed coin.
        // collector reaches farther/higher and re-hops sooner to sweep up clusters
        const reachX = collectActive ? TILE * 3.4 : TILE * 2.4;
        const reachUp = collectActive ? TILE * 3.6 : TILE * 3.2;
        const coolDn = collectActive ? 10 : 16;
        const coin = (s.coinsList || [])
          .filter((c) => c.x > p.x + 8 && c.x - p.x < reachX && c.y < p.y - TILE * 0.6 && c.y > p.y - reachUp && !(collectActive && this._nearDead(c.x)))
          .sort((a, b) => (a.x - p.x) - (b.x - p.x))[0];
        if (coin && (!ne || enemyPx > TILE * 4) && (this.frame - (m.lastCoinHop || -999)) > coolDn) {
          const land = this._simulateLaunch(p.x, p.y, Math.max(Math.abs(p.vx), 240), TUNE.jumpVel, solidAt, true);
          if (land.safe && land.apexY <= coin.y) {
            const hTiles = (p.y - coin.y) / TILE;
            m.pursueX = coin.x;
            inp.jump = true; m.jumpHold = Math.max(8, Math.min(22, Math.round(6 + hTiles * 5)));
            m.lastCoinHop = this.frame; this.input = inp; return;
          }
        }
      }
    }

    // COLLECTOR sweep: when nothing is pressing ahead, go BACK for a coin we passed
    // (coins only — never reverse into a walker, which would be a fatal side-hit).
    // Per-frame left-solidity check keeps us from sliding off the back edge; coins
    // sit over solid ground so this terminates (a grabbed coin vanishes, no loop).
    if (collectActive && onG) {
      const fr = Math.round(p.y / TILE), cc = Math.floor(p.x / TILE);
      const coins = s.coinsList || [];
      const aheadStuff = [...coins, ...(s.enemiesList || []).filter((e) => e.alive && !e.fly && !e.boss)]
        .some((t) => t.x > p.x + 8 && t.x - p.x < TILE * 5 && Math.abs(t.y - p.y) < TILE * 4);
      if (!aheadStuff) {
        const behind = coins.filter((c) => c.x < p.x - 10 && p.x - c.x < TILE * 7 && Math.abs(c.y - p.y) < TILE * 1.2 && !this._nearDead(c.x))
          .sort((a, b) => (p.x - a.x) - (p.x - b.x))[0];
        const walkerLeft = (s.enemiesList || []).some((e) => e.alive && !e.fly && !e.boss && e.x < p.x && e.x > (behind ? behind.x : p.x) - TILE);
        const safeLeft = solidAt0(cc - 1, fr) || solidAt0(cc - 1, fr + 1);
        if (behind && safeLeft && !walkerLeft && !p.wallLeft) {
          m.noProg = 0; this.input = { left: true, right: false, jump: false }; return;   // step back for the coin
        }
      }
    }

    // otherwise: just run toward the goal
    this.input = inp;
  }

  // a coin near a spot that already killed us → we LEARNED it's not worth it; skip it.
  _nearDead(x) { const t = Math.round(x / 64); return (this.deadspots || []).some((d) => Math.abs(d - t) <= 2); }

  // PRECISE JUMP: integrate the Play scene's asymmetric-gravity arc forward from the
  // frog's current state with a given jump-hold, and report whether the arc passes
  // THROUGH the coin (within ~½ tile) before landing. Lets the navigator fire only when
  // a jump will actually thread the coin — the timing the "jump when aligned" heuristic
  // kept missing. vx is held ~constant (the navigator isn't steering mid-hop).
  _arcHitsCoin(p, vx, hold, cx, cy, solid) {
    const T = 64, dt = 1 / 60; let x = p.x, y = p.y, vy = -TUNE.jumpVel, held = true, clamped = false;
    for (let f = 1; f <= 110; f++) {
      if (f > hold) held = false;
      if (!held && !clamped && vy < -TUNE.jumpMinVel) { vy = -TUNE.jumpMinVel; clamped = true; }   // variable-height release
      let g = TUNE.gravity; if (vy < 0 && held) g = TUNE.gravityRise; if (Math.abs(vy) < TUNE.apexThreshold) g = TUNE.gravityApex;
      vy += g * dt; y += vy * dt; x += vx * dt;
      if (Math.abs(x - cx) < 0.45 * T && Math.abs(y - cy) < 0.5 * T) return true;                   // threaded it
      if (vy > 0) { const c = Math.floor(x / T), r = Math.round(y / T); if (solid(c, r + 1)) return false; }  // landed first
    }
    return false;
  }

  // PRECISE STOMP: like _arcHitsCoin, but a stomp only counts when the arc is DESCENDING
  // onto the enemy's head (vy>0, feet near its top). The leap that "jumps when close"
  // sails OVER the enemy — this fires the hold whose downswing actually lands on it.
  _arcStomps(p, vx, hold, ex, ey, solid) {
    const T = 64, dt = 1 / 60; let x = p.x, y = p.y, vy = -TUNE.jumpVel, held = true, clamped = false;
    for (let f = 1; f <= 95; f++) {
      if (f > hold) held = false;
      if (!held && !clamped && vy < -TUNE.jumpMinVel) { vy = -TUNE.jumpMinVel; clamped = true; }
      let g = TUNE.gravity; if (vy < 0 && held) g = TUNE.gravityRise; if (Math.abs(vy) < TUNE.apexThreshold) g = TUNE.gravityApex;
      vy += g * dt; y += vy * dt; x += vx * dt;
      if (vy > 0 && Math.abs(x - ex) < 0.5 * T && Math.abs(y - (ey - 0.25 * T)) < 0.5 * T) return true;   // coming DOWN on its head
      if (vy > 0 && y > ey + 0.6 * T) return false;                                                       // already below it → missed
    }
    return false;
  }

  // GENERIC REWARD PLANNER: read the whole reward map (reward.js) and pursue the beat
  // with the best value-per-cost — coins & ? blocks (reach/bump: precise-jump to thread
  // the point), springs (ride: step on), walkers (stomp: steer in, branch 4 lands it).
  // Goal/boss are owned by their own branches. Death-memory + a give-up watchdog prune
  // beats that aren't worth it. This is the game-AGNOSTIC brain; swap reward.js + the
  // motor skills to retarget another game.
  _planReward(s, p, onG) {
    const T = 64, set = this.scene._solidSet, solid = (c, r) => !!(set && set.has(`${c},${r}`));
    const fr = Math.round(p.y / T), pcx = p.x / T, m = this.mem;
    const surfBelow = (cc, cr) => { for (let dr = 0; dr <= 4; dr++) { const r = Math.round(cr) + dr; for (let c = Math.round(cc) - 1; c <= Math.round(cc) + 1; c++) if (solid(c, r)) return r; } return null; };
    // 1) every reachable reward in a window around us (back-and-forth: look behind too)
    const cand = [];
    for (const rw of rewardMap(s)) {
      if (rw.kind === 'goal' || rw.kind === 'boss') continue;            // owned by their own branches
      const cc = rw.x / T, cr = rw.y / T, dx = cc - pcx;
      if (this._nearDead(rw.x) || dx < -6 || dx > 9) continue;
      let how = null, ax = cc, climb = false;
      if (rw.method === 'ride') { if (dx > -0.5 && Math.abs(cr - p.y / T) <= 2) how = 'ride'; }
      else if (rw.method === 'stomp') { if (dx > -0.6 && Math.abs(cr - p.y / T) <= 1.7) how = 'stomp'; }
      else {                                                              // reach / bump → jump to the point
        const sb = surfBelow(cc, cr);
        if (sb != null && sb - cr >= 0.3 && sb - cr <= 3.4) { if (Math.abs(sb - fr) <= 1) how = 'jump'; else if (sb < fr - 1 && sb >= fr - 3.5) { how = 'jump'; climb = true; } }
        if (!how) for (const sp of (s.springsList || [])) { const sx = sp.x / T, srr = sp.y / T; if (Math.abs(sx - cc) <= 2 && srr > cr && srr - cr <= 6.2 && Math.abs(srr - fr) <= 1) { how = 'springto'; ax = sx; break; } }
      }
      if (!how) continue;
      cand.push({ cc, cr, how, ax, climb, value: rw.value, kind: rw.kind, dx, key: `${rw.kind[0]}${Math.round(cc)}.${Math.round(cr)}` });
    }
    if (!cand.length) { m.tgt = null; return null; }
    // 2) COMMIT to one beat at a time: keep the current target while it's still on the
    //    board (a coin vanishes / an enemy dies when collected); else pick the best —
    //    NEAREST, weighted by value so a walker or ? block beats a stray coin (engage,
    //    not skip). One target, fully pursued, is how it goes back and forth and gets
    //    them all instead of jittering past everything.
    let t = m.tgt ? cand.find((c) => c.key === m.tgt) : null;
    if (t) { if (++m.tgtSince > 150) { this.deadspots.push(Math.round(t.cc)); this.scene.registry.set('collect_deadspots', this.deadspots); m.tgt = null; m.tgtSince = 0; return null; } }
    else { cand.sort((a, b) => (Math.abs(a.dx) - Math.min(a.value, 6) * 0.8) - (Math.abs(b.dx) - Math.min(b.value, 6) * 0.8)); t = cand[0]; m.tgt = t.key; m.tgtSince = 0; }
    m.pursueX = t.cc * T;
    // 3) dispatch the MOTOR SKILL for this reward's method
    const gap = t.ax - pcx, pc = Math.floor(p.x / T);
    const step = (dir) => (solid(pc + dir, fr) || solid(pc + dir, fr + 1)) ? { left: dir < 0, right: dir > 0, jump: false } : { left: false, right: false, jump: false };
    if (t.how === 'stomp') {                                            // approach GROUNDED → the enemy-stomp branch lands it
      if (gap > 0.3) return step(1); if (gap < -0.3) return step(-1); return { left: false, right: true, jump: false };
    }
    if (t.how === 'ride' || t.how === 'springto') {                    // step onto the pad
      if (gap > 0.4) return step(1); if (gap < -0.4) return step(-1); return { left: false, right: true, jump: false };
    }
    if (t.climb) {                                                      // jump forward+up onto a higher ledge holding the reward
      if (gap > 1.4) return step(1); if (gap < -1.4) return step(-1);
      if (onG) { m.jumpHold = Math.max(13, Math.min(24, Math.round(11 + (fr - t.cr) * 4))); return { left: false, right: true, jump: true }; }
      return { left: false, right: gap > -0.2, jump: false };
    }
    if (gap > 1.1) return step(1); if (gap < -1.1) return step(-1);     // reach/bump → precise arc threads the point
    if (onG) {
      const cx = t.cc * T, cy = t.cr * T;
      for (const h of [8, 10, 12, 14, 16, 18, 20, 22]) if (this._arcHitsCoin(p, p.vx, h, cx, cy, solid)) { m.jumpHold = h; return { left: false, right: false, jump: true }; }
      if (Math.abs(p.vx) > 230) return { left: p.vx > 0, right: p.vx < 0, jump: false };
      return { left: gap < -0.15, right: gap > 0.15, jump: false };
    }
    return { left: false, right: false, jump: false };
  }

  // ROUTE-PLANNER (collector): pick the nearest coin reachable from the path by a JUMP
  // (a platform ≤~3.2 tiles below it, roughly at our walking level) or a SPRING, then
  // drive to it — brake to align under it, then jump the right height; or step onto the
  // spring. Gives up (records a deadspot) on a coin we've chased too long. Returns an
  // input, or null to fall through to the plain forward sweep. Edge-checked both ways.
  _navCoins(s, p, onG) {
    const T = 64, set = this.scene._solidSet, solid = (c, r) => !!(set && set.has(`${c},${r}`));
    const fr = Math.round(p.y / T), pcx = p.x / T, m = this.mem;
    const surfBelow = (cc, cr) => { for (let dr = 0; dr <= 4; dr++) { const r = Math.round(cr) + dr; for (let c = Math.round(cc) - 1; c <= Math.round(cc) + 1; c++) if (solid(c, r)) return r; } return null; };
    let best = null;
    for (const c of (s.coinsList || [])) {
      const cc = c.x / T, cr = c.y / T; if (this._nearDead(c.x)) continue;
      const dx = cc - pcx; if (Math.abs(dx) > 6) continue;
      const sb = surfBelow(cc, cr);
      let how = null, ax = cc, climb = false;
      if (sb != null && sb - cr >= 0.4 && sb - cr <= 3.2) {
        if (Math.abs(sb - fr) <= 1) how = 'jump';                                                       // floats over ground we walk
        else if (sb < fr - 1 && sb >= fr - 3.5) { how = 'jump'; climb = true; }                         // on a ledge up to ~3 tiles ABOVE → climb onto it
      }
      if (!how) for (const sp of (s.springsList || [])) { const sx = sp.x / T, srr = sp.y / T; if (Math.abs(sx - cc) <= 2 && srr > cr && srr - cr <= 6.2 && Math.abs(srr - fr) <= 1) { how = 'spring'; ax = sx; break; } }
      if (!how) continue;
      const cost = Math.abs(dx) + (dx < -0.5 ? 1.5 : 0) + (climb ? 2 : 0);                              // slight forward / no-climb preference
      if (!best || cost < best.cost) best = { cc, cr, how, ax, cost, climb, sb };
    }
    if (!best) { m.navTarget = null; return null; }
    // give-up watchdog: chasing the same coin too long → learn it and move on
    const key = Math.round(best.cc);
    if (m.navTarget === key) { if (++m.navStuck > 90) { this.deadspots.push(key); this.scene.registry.set('collect_deadspots', this.deadspots); m.navTarget = null; m.navStuck = 0; return null; } }
    else { m.navTarget = key; m.navStuck = 0; }
    m.pursueX = best.cc * T;
    const gap = best.ax - pcx, pc = Math.floor(p.x / T);
    const step = (dir) => (solid(pc + dir, fr) || solid(pc + dir, fr + 1)) ? { left: dir < 0, right: dir > 0, jump: false } : { left: false, right: false, jump: false };
    if (best.how === 'spring') {
      if (gap > 0.4) return step(1); if (gap < -0.4) return step(-1);
      return { left: false, right: true, jump: false };                                                // step onto the pad
    }
    if (best.climb) {
      // CLIMB onto a higher ledge: stand ~1 tile before the ledge edge, then jump
      // FORWARD+up to land on top (then the coin is at our new level → grabbed).
      if (gap > 1.4) return step(1); if (gap < -1.4) return step(-1);
      if (onG) { m.jumpHold = Math.max(13, Math.min(24, Math.round(9 + (fr - best.sb) * 5))); m.navStuck += 4; return { left: false, right: true, jump: true }; }
      return { left: false, right: gap > -0.2, jump: false };                                           // steer onto the ledge mid-air
    }
    if (gap > 1.1) return step(1); if (gap < -1.1) return step(-1);
    if (onG) {
      // PRECISE: fire only when some jump-hold's simulated arc actually threads the coin
      const cx = best.cc * T, cy = best.cr * T;
      for (const h of [8, 10, 12, 14, 16, 18, 20, 22]) if (this._arcHitsCoin(p, p.vx, h, cx, cy, solid)) { m.jumpHold = h; m.navStuck += 3; return { left: false, right: false, jump: true }; }
      if (Math.abs(p.vx) > 230) return { left: p.vx > 0, right: p.vx < 0, jump: false };               // too fast to thread → brake under it
      return { left: gap < -0.15, right: gap > 0.15, jump: false };                                    // creep into a threadable spot
    }
    return { left: false, right: false, jump: false };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Phase-A reusable AI primitives. Each lets the planner gate an action on a
  // *verified* safe window/landing so the 0-death guarantee survives timed and
  // launch mechanics. They read only the live snapshot + their own observation
  // memory — no privileged access to tweens/timers.
  // ════════════════════════════════════════════════════════════════════════

  // #1 PERIODIC-OBJECT MODEL — for anything that cycles between a "dangerous"
  // and a "safe" state on a fixed period (piranhas now; fire bars, gusts,
  // moving platforms later). We can't see the engine's tween, but we see the
  // object every frame, so we OBSERVE its transitions and learn the phase:
  //   since      — frames the object has held its current state
  //   lastSafe   — duration (frames) of the last completed SAFE phase
  //   lastDanger — duration (frames) of the last completed DANGER phase
  // The planner waits in a safe cell and commits only when a *fresh* safe window
  // opens (max time before it flips back), so the whole action fits inside it.
  _periodic(key, dangerous) {
    const t = this.frame;
    const m = (this._phases || (this._phases = {}));
    let e = m[key];
    if (!e) { e = m[key] = { dangerous, t, since: 0, lastSafe: 0, lastDanger: 0, committed: false, transitions: 0 }; }
    if (dangerous !== e.dangerous) {                 // a state transition this frame
      if (e.dangerous) e.lastDanger = t - e.t; else e.lastSafe = t - e.t;
      e.dangerous = dangerous; e.t = t; e.transitions++;   // ≥1 ⇒ since reflects a REAL edge, not first-sight
    }
    e.since = t - e.t;
    return e;
  }

  // #2 BALLISTIC-TRAJECTORY SIMULATOR — for launches (springs/bounce pads now;
  // dash pads, cannons later). Integrates the SAME asymmetric-gravity model the
  // Play scene uses, forward from a launch state, and reports where the arc next
  // crosses a solid top — so the planner can confirm a safe landing BEFORE
  // committing to step onto the pad. Pure function of the snapshot's solid set.
  // launchVy is the upward speed (positive number); jumpHeld = arc with jump
  // held (lighter rise gravity). Returns { landX, landY, apexY, frames, safe }.
  _simulateLaunch(x, y, vx, launchVy, solidAt, jumpHeld = true) {
    const T = 64, dt = 1 / 60;
    let px = x, py = y, vy = -Math.abs(launchVy), apexY = y;
    for (let f = 1; f <= 240; f++) {
      // asymmetric gravity (mirrors Play.update): rise-light while held, hang at
      // the apex, fall-heavy — so the predicted arc matches the real one.
      let g = TUNE.gravity;
      if (vy < 0 && jumpHeld) g = TUNE.gravityRise;
      if (Math.abs(vy) < TUNE.apexThreshold) g = TUNE.gravityApex;
      vy = Math.min(vy + g * dt, TUNE.maxFall);
      px += vx * dt; py += vy * dt;
      if (py < apexY) apexY = py;                      // highest point of the arc
      // landing test only while descending: the foot row entered a solid cell
      if (vy > 0) {
        const c = Math.floor(px / T), r = Math.round(py / T);
        if (solidAt(c, r)) return { landX: px, landY: r * T, apexY, frames: f, safe: true };
      }
    }
    return { landX: px, landY: py, apexY, frames: 240, safe: false };   // no landing in range
  }

  // #3 DECAY / TIMER TAGGING — for tiles/hazards that change state once TOUCHED
  // and then count down (crumbling platforms; rising lava altitude). The planner
  // tags an entity the instant it's triggered and must respect the countdown —
  // never re-stand a tile whose timer has started. Tags live on the instance and
  // reset with the scene (each life re-observes fresh). Returns the live tag.
  _decay(key, ttlFrames) {
    const m = (this._decays || (this._decays = {}));
    if (!m[key]) m[key] = { triggeredAt: this.frame, ttl: ttlFrames };
    const e = m[key];
    e.remaining = Math.max(0, e.triggeredAt + e.ttl - this.frame);
    e.expired = e.remaining === 0;
    return e;
  }
  _decayActive(key) { return !!(this._decays && this._decays[key]); }

  _press(key, ms) {
    const map = { left: 'left', right: 'right', jump: 'jump' };
    const k = map[key]; if (!k) return;
    this.input[k] = true;
    this.scene.time.delayedCall(ms, () => { this.input[k] = false; });
  }

  // events/anomalies accumulate in the registry so they survive scene.restart()
  _acc(key, entry) {
    const arr = this.scene.registry.get(key) || [];
    arr.push(entry);
    if (arr.length > this.maxLog) arr.shift();
    this.scene.registry.set(key, arr);
    return arr;
  }

  log(type, data = {}) {
    this.events = this._acc('autopilot_events', { t: this.frame, type, ...data });
  }

  anomaly(type, detail = {}) {
    this.anomalies = this._acc('autopilot_anomalies', { t: this.frame, type, ...detail });
  }

  // called each frame by the scene AFTER physics/update
  tick(p) {
    this.frame++;

    // annotate timeline: buffer a light state every 2 frames (cap ~3600 = 2min)
    if (p && this.frame % 2 === 0) {
      this.timeline.push({ f: this.frame, x: Math.round(p.x), y: Math.round(p.y) });
      if (this.timeline.length > 3600) this.timeline.shift();
    }

    // autopilot: choose inputs + record the walkthrough trace, synced to physics.
    // Self-terminating: sets registry 'autopilot_done' on win / death-loop /
    // frame-cap so the driver waits on ONE flag instead of polling (which would
    // starve the game loop with evaluate round-trips).
    if (this.autopilot && this.scene.debugSnapshot) {
      const s = this.scene.debugSnapshot();
      const apFrames = (this.scene.registry.get('autopilot_frames') || 0) + 1;
      this.scene.registry.set('autopilot_frames', apFrames);
      if (s.won) this._finishAuto('win');
      else if (this.deaths > this.deathCap) this._finishAuto('death_loop');
      // frame budget scales with level width (long merged worlds need more time,
      // incl. headroom for death-restarts that re-run from the spawn)
      else if (apFrames > Math.max(9000, (this.scene.level && this.scene.level.W ? this.scene.level.W : 200) * 45)) this._finishAuto('timeout');
      if (!s.dead && !s.won) this._drive(s);
      if (this.frame % 8 === 0) {
        const tr = this.scene.registry.get('autopilot_trace') || [];
        if (tr.length < 1500) { tr.push({ f: this.frame, x: Math.round(s.player.x), y: Math.round(s.player.y), vx: s.player.vx, vy: s.player.vy, onGround: s.player.onGround, tex: s.player.texture, vis: s.player.visible, coins: s.coins, score: s.score }); this.scene.registry.set('autopilot_trace', tr); }
      }
      if (s.dead && !this._deathHandled) {
        this._deathHandled = true;
        this.deaths++;
        this.input = { left: false, right: false, jump: false };
        this.scene.registry.set('autopilot_deaths', this.deaths);
        // LEARN: record the coin we chased (give it up) AND tally the death in its
        // ~5-tile bucket. ≥2 in a bucket → that stretch goes full-safe (risk budget a).
        if (this.collect) {
          const spot = Math.round((this.mem.pursueX != null ? this.mem.pursueX : s.player.x) / 64);
          if (!this.deadspots.includes(spot)) this.deadspots.push(spot);
          this.scene.registry.set('collect_deadspots', this.deadspots);
          const bk = Math.round(s.player.x / 320);
          this.deathBuckets[bk] = (this.deathBuckets[bk] || 0) + 1;
          this.scene.registry.set('collect_deathbuckets', this.deathBuckets);
        }
        if (this.deaths <= this.deathCap) {
          this.mem.lastX = null; this.mem.stuck = 0;
          // defer restart out of the update loop (restarting mid-update crashes Phaser)
          this.scene.time.delayedCall(700, () => { this.scene.scene.restart(); });
        }
      }
    }
    // ── anomaly detection (the driver's safety net) ───────────────────
    if (p) {
      const bad = (v) => v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v);
      if (bad(p.x) || bad(p.y) || bad(p.body.velocity.x) || bad(p.body.velocity.y)) {
        this.anomaly('nan_state', { x: p.x, y: p.y, vx: p.body.velocity.x, vy: p.body.velocity.y });
      }
      if (!p.visible || p.alpha < 0.05) this.anomaly('player_invisible', { visible: p.visible, alpha: p.alpha });
      // way off the world (lost the player)
      const w = this.scene.worldW, h = this.scene.worldH;
      if (p.x < -200 || p.x > w + 200 || p.y < -2000 || p.y > h + 2000) {
        this.anomaly('player_out_of_bounds', { x: Math.round(p.x), y: Math.round(p.y) });
      }
    }
  }
}
