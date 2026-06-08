# Feel playbook — how to make a level more fun (reusable)

Hard-won method + lessons from reworking L7 "Dune Sea" (baseline 66.6 → cumulative
**+1.1 interest/window**, 100% sign-agreement). Applies to every level. Pairs with
the correctness bar (`wincheck.mjs` / `sweep.mjs`: the autopilot must clear at 0
deaths) — that bar rewards flat, safe levels, so this is the counter-pressure.

## The toolchain

| tool | what it gives you | when |
|---|---|---|
| `feel.mjs` | absolute FUN SCORE (0-100) + interest curve + persona verdict/fixes | a level's standalone read |
| `feel-ab.mjs` | **mood-cancelled per-window DELTA** of one edit (B−A) + sign-agreement | **measuring any single change** |
| `feel.mjs SNAP=<name> SNAP_ONLY=1` | dumps a level's window fingerprint (no Gemini, fast) | capture before/after for A/B |
| `record.mjs CURVE=1` | overlays the eval's interest curve + a frog-tracking playhead on the video | see the evaluated experience |
| `record.mjs SHOWCASE=1` / `wincheck.mjs SHOWCASE=1` | AI plays the fun beats (rides springs, bumps powerups), not the bare win path | showcase clips |

### ⚠️ The absolute score is too noisy for single edits
`feel.mjs`'s FUN SCORE swings **±5 points on identical bytes** — `SIMS` averaging
removes within-run noise, but each run shares a global persona "mood" that shifts
the whole curve. Proven: the same level scored 59.0 / 68.5 / 64.2. **Never trust a
single before/after FUN SCORE diff.** Use `feel-ab.mjs`: it scores both versions in
ONE prompt so the mood cancels, leaving a stable delta. Its Δ sparkline is
surgically clean — flat everywhere except the windows you edited.

## The loop (per change)
```
SNAP=before SNAP_ONLY=1 LEVEL=N node tools/eval/feel.mjs   # capture A
# … make ONE conceptual change to levelN.js …
LEVEL=N node tools/eval/wincheck.mjs                       # MUST still win, 0 deaths
SNAP=after SNAP_ONLY=1 LEVEL=N node tools/eval/feel.mjs    # capture B
node tools/eval/feel-ab.mjs before after                  # is the delta real?
```
Keep the change if: **NET DELTA > ~0.15 AND sign-agreement ≥ 80% AND wincheck still
wins.** Small unanimous positives (+0.1) are fine to bank; near-zero or split-sign
changes are noise — revert or rethink.

## Design lessons (the durable part)

1. **Decoration ≈ noise (+0.06/window). Structural use of a verb ≈ +0.5–1.0.**
   A spring parked beside flat ground did nothing; the SAME spring used to *rebuild
   a region's rhythm* (flat hop → vertical pocket: hop→launch→drop, with relief +
   a reward gated up high) moved the curve ~8× more. Change the rhythm, not the garnish.
2. **Layer a new mechanic where the ARC is weak — usually the level's own
   under-built set-piece.** L7's signature "dune" was a quiet enemy-free climb that
   read as low-interest; guarding it lifted the whole back half and pushed the peak late.
3. **Hook early, climax late — but don't nerf good content to chase one peak.**
   The ideal curve peaks near ~84%; an early flat stretch tanks `arc`. Give the
   opening a real stake (early goomba) and ensure a strong LATE beat exists (L7's
   finale became a climactic ascent to a guarded high plateau). BUT `arc` assumes a
   single peak: if a beloved mid set-piece keeps the measured peak early, that's the
   metric's bias, not a flaw — fix it by adding a late peak, NOT by flattening the
   mid one (which is usually your biggest engagement win). Two strong peaks > one.
4. **`distinctVerbs` is a tripwire for dead/missing mechanics.** It stayed at 4
   after "adding" springs — because the level's return object never exported
   `springs`, so every spring was a silent no-op. The metric caught a bug the
   persona had masked (it was crediting the adjacent coins).
5. **Beware the deterministic-driver butterfly effect.** A tiny *opening* edit (a
   stomp-bounce off an early enemy, a mound that changes run-up momentum) can
   cascade into a *downstream* death. ALWAYS re-run `wincheck` after every edit;
   bisect the edit if a far-away death appears.

## Placement gotchas (cost real debugging — obey them)
- **Export new element arrays.** A level's `return {}` must include `springs:
  k.springs, oneways: k.oneways, ices: k.ices` or the elements are SILENT no-ops
  (invisible, uncollidable). This bit L7, then L10/L13 — `feel.mjs distinctVerbs`
  and a 0-spring SNAP are the tells. Check it every time you add a verb.
- **Springs need clearance from pits.** The bounce drifts horizontally; on a short
  island or near a moat the descent lands in the gap (death) or the bounce collides
  with the next gap-jump approach (infinite-loop timeout). Place springs on long
  continuous ground with ≥~10 tiles to the next pit. (Broke L7@43, L13@58.)
- **Ice needs continuous ground after it** (no pit within a slide's overshoot) —
  skip it on pit-dense levels.
- **wincheck-green ≠ record-green.** `record.mjs` enters via the title screen,
  which shifts the deterministic seed vs `wincheck.mjs`; a showcase run can hit an
  enemy the wincheck didn't. Keep showcase detours conservative (wide enemy berth).
- **Timed hazards (spout/dropper) need a LONG GROUNDED runway.** The AI stands off,
  observes ≥1 cycle, then dashes a dormant window (driver branch 3b, periodic
  primitive #1) — but only while GROUNDED. If a gap/enemy leap lands the frog ON
  the hazard column it dies airborne (the standoff never engages). Place these on
  flat walked ground (the intro is ideal), never in a leap-landing zone. The commit
  rule must require a *learned* dormant window (lastSafe), never `since==0` (a blind
  dash into an erupting column). The dormant window must be generous (we use
  ~0.6s active / ~2.2s dormant).
- **Crumble** goes over a *leapable* gap (AI leaps it; a lingering human drops) or
  over solid ground (safe) — forcing the AI to cross a crumble is BATCH 2 work.
- **Conveyor** is AI-free if `push < runAccel` (the frog always overcomes it); keep
  belts on continuous ground so a slide can't carry into a pit.

## Building a mechanic THROUGHLINE (the four-step level — Mark Brown / GMTK)
A signature mechanic is taught across the whole level, escalating:
**introduce** (lone, safe) → **develop** (a phase-offset pair, stakes) → **twist /
contrast** (a separate guard hall — the classic threat) → **resolve** (a 3-instance
gauntlet into a stair ascent). L4 (6 spouts) and L10 (6 droppers) are the templates.

Hard constraints that make a timed-hazard throughline 0-death for the autopilot:
- **Enter every hazard hall ON FOOT.** A lava leap oversails ~7 tiles and dumps the
  frog *onto* the column mid-air (the standoff only works while grounded). Fence
  hazard halls with a **pipe** instead — the AI hops it with a short *measured* arc
  and lands grounded with runway to spare. No spout/dropper directly after a gap.
- **Hazard halls are ENEMY-FREE and fenced.** A wandering goomba strolls into a frog
  parked to time a hazard. Put guards in their OWN hall fenced by lava (one side) +
  a pipe (other). And **never put a guard on a raised battlement** — it walks off the
  edge and roams the floor below (≈40 tiles) into your gauntlet. Crown the summit
  with coins, not a guard (until fenced-platform AI lands in a later batch).
- **Space instances ≥12 tiles**, each with ≥8 tiles of grounded runway.

AI commit rule (driver branch 3b, periodic primitive): stand off ~3.2 tiles, **coast
to a halt** (never press toward an un-cleared column), and commit only when a real
dormant window is witnessed (`transitions≥1 && since≤4`) or learned (`lastSafe`). The
commit is **STICKY** — once dashing, see it through; re-judging mid-cross aborts the
dash and strands the frog. Cycle: ~0.4 s deadly / ~1.4 s dormant (tight but generous).

## Compounding vocabulary (each level reuses earlier mechanics)
Difficulty/interest grows by *layering*: level N revisits verbs introduced in
levels 1..N-1, so the finale recombines the whole vocabulary. Introduction order:
L1 base (enemy/gap/pipe/qblock/brick) → L2 piranha → L3 spring → L4 spout → L6 ice
→ L7 quicksand/dune → L8 crumble/oneway → L9 acid → L10 dropper → L11 spike/conveyor.
L13 "Final Bastion" recombines spout+crumble+conveyor+spring+piranha+oneway+pipe+lava.

**Retrofitting reuse — what's SAFE vs FRAGILE:**
- SAFE to drop almost anywhere: **spring** (just needs solid ground below + runway),
  **conveyor** (continuous ground; rightward = a free tailwind), **crumble** as a
  bridge over a leapable gap/pit (the AI leaps it; a walker drops in), **oneway**.
- FRAGILE to retrofit: **timed hazards (spout/dropper/piranha)**. They need a
  dedicated ENEMY-FREE, pipe-fenced flat hall entered ON FOOT (see the throughline
  section). Do NOT wedge one into a busy existing hall, and NEVER place one right
  before a momentum-dependent climax (a piranha *pipe* before a stair-climb+stomp
  saps the run-up speed and the AI muffs the stomp — L3 taught this the hard way).
  Concentrate timed-hazard reuse in levels that already have fenced halls (the
  signature level) or in a finale built for it. A spout in an INTRO works when the
  next lava pit fences it (L5, L13).
- Standardize every level's `return {}` to export all mechanic arrays (springs,
  oneways, ices, conveyors, spouts, droppers, crumbles) so any verb can be reused.

## Enemies — a distinct kind per level + a boss (0-death-safe archetypes)
Variety comes from THREE archetypes the autopilot can clear; the look is per-level art.
- **WALKER** (`enemy(c,r,'kind')`) — a stompable ground patroller. Kinds: goomba (L1),
  beetle/spider (faster ×1.3), ghoul (normal), snowman/lavaslug (slower ×0.78). The AI
  already leaps to stomp; obey the old law — **guards off pit edges**, fenced from
  hazard halls. Faster walkers still clear (the leap fires ~2 tiles out).
- **FLYER** (`flyer(c0,c1,'kind',r)`) — a deadly overhead patroller the grounded frog
  passes UNDER. The autopilot ignores them (the stomp branch only fires for enemies
  within ±1.3 tiles of the frog's height, and `ne` filters out `fly`). **KEY LAW: put
  flyers at row ≤7 — above the frog's max jump apex (~row 9.5) — and they are safe over
  ANYTHING below** (gap, qblock, coins, walkers). The ONLY exception: keep them off
  SPRING columns (a spring launch reaches ~row 7) by ≥3 tiles. Kinds: bat, bird,
  buzzard, fly, shard, crow.
- **BOSS** (`boss(c)`) — a big multi-HP brute that GATES the exit: a wall auto-builds
  at `c+6` (kept OUT of the AI solid-set) and DROPS when the boss dies, so the frog
  must defeat it to pass. It survives N stomps; each hit makes it **REEL** (knocked
  back + harmless) ~1.1 s — longer than the AI's 50-frame no-progress backoff, so the
  AI naturally backs off to a clean stomp distance between hits. Driver branch 0
  (debug.js) makes this robust: stand off, stomp when active & in range, ease back
  while it reels. Arena must be flat + enemy-free; never gate behind something the AI
  could jump.

Engine seams: `levelkit` (enemy kind / flyer / boss builders) → Boot.js `creature()`
procedural art + `<kind>_walk` anims → Play.js `buildEnemies` (per-archetype body/
gravity/patrol) + per-kind `update` movement + `onEnemy` (walker/flyer stomp, boss
hp+reel+gate) → snapshot exposes `kind/fly/boss/reel` → debug.js boss branch + flyer
filter. Re-run the full 13 gate after touching any of it.

## Art & verticality
- **Enemy/hero art is real CC0 sprites**, not procedural: Pixel Frog "Pixel Adventure"
  (`src/assets/hero` + `src/assets/enemies`, one strip per anim). To add/replace a
  creature: drop the strip in, add it to `ENEMY_SPRITES` (file + frame `fw/fh` + opt
  `tint`) in assets.js — Boot builds the anim from the strip, Play scales/bodies by
  `fh`. Don't hand-draw sprites in code; match the pack.
- **Verticality = optional overhead platforms.** A floating `ledge(c,n,8)` + coins on
  row 7, over CLEAR flat ground (no enemy/hazard/spring/flyer/gap within ±3, and clear
  of any jump-trigger so a leap can't bonk it), adds y-axis layering & reward. The
  BASE autopilot runs underneath and ignores them (so wincheck stays 0-death); the
  showcase may hop them. Keep them ≥4 tiles above the floor (row ≤9) so they're never
  read as a wall/ceiling at body height.

## New-mechanic checklist (engine)
levelkit builder + array → Play.js `build*()` + update() physics/lethality →
`debugSnapshot` exposure → debug.js driver branch (if timed) → `feel.mjs` tiles +
feat → `elements.js` library entry → level `return {}` export → wincheck ×4.

## Deploy
`wincheck` ALL 13 (0-death) → merge the branch to `main` → `git push origin main`
(Railway auto-deploys; verify `/health` returns `{"ok":true}`).

## FUN SCORE anatomy (`feel.mjs`)
`0.35·engagement + 0.15·dynamics + 0.25·arc + 0.25·flow`
- `engagement` mean interest — are moments interesting? (fix = mechanic variety, not coins)
- `dynamics` mean window-to-window movement — tension/rest rhythm (raw spread saturates; don't use it)
- `arc` Pearson vs Schell ideal + late-peak bonus + rising trend
- `flow` penalty for dead-air windows + the longest flat run
