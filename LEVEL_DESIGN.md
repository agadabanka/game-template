# Level Design Cookbook — Jazz (forked from the-platformer)

Everything you need to author a new, polished, **AI-completable** level — distilled
from building the levels and the eval-driven loop.

> North star: *every level is a story* — introduce → develop → twist → conclude —
> and **the AI autopilot must complete it at 0 deaths** before it ships.

## Jazz design pillars (the rework from the frog game)
Jazz is a **two-verb** game; build every beat around one or both:
1. **JUMP — precision traversal.** A springier, floatier jump (`TUNE.jumpVel`,
   lower `gravityApex` for an apex-hang, generous `coyoteMs`/`bufferMs`) so you can
   hang and aim. **Verticality** is first-class: stacked one-way *carrot towers*
   (`verticalize` in `merge.js`), placed **lower & reachable** (3 & 6 tiles). Keep
   the *ground* path 0-death-solvable; towers are optional climbs.
2. **SHOOT — combat & reward.** The **bazooka** (`F`) blasts bots, pops piranhas,
   chips the boss. **Blast-crates** (`blastblock(c,r)` / `blastwall(c,r,n)` in the
   DSL) guard reward caches atop towers — the signature **shoot-then-jump** beat.
   Crates/caches sit on OPTIONAL aerial platforms (out of the autopilot's solid
   set) so the no-fire gate still completes; a human shoots + climbs for the payoff.

**Controls the level must assume (joystick is the DEFAULT):**
- An on-screen **analog joystick** on the left (drag): **left/right = run**, **up =
  jump** (hold = higher), **down = DIVE** (fast-fall to drop onto a platform).
  **FIRE** is a button on the right. Keyboard mirrors it (A/D, ↑/Space/W, ↓/S, F).
  Switchable to a classic D-pad in the pause menu (`UI.switchController`).
- Design with the **dive** in mind: a player can jump up a tower then dive straight
  onto a target/platform. The grounded autopilot never dives, so dive is player-only
  (gate-safe). Joystick state lives in `registry.touch` (left/right/jump/down/fire).

**Jazz rules of thumb (learned the hard way):**
- A *shoot* obstacle on the CRITICAL path needs the autopilot to fire — until that
  skill exists, keep shooting optional (rewards), never a traversal gate.
- The crude autopilot is **physics-sensitive**: too-big a jump makes it over-shoot
  legacy geometry and stall (e.g. at a tall stair-then-drop). ~3.9 tiles is the
  current safe sweet spot, and the gap-sensor now tolerates **survivable drops**
  (looks 6 tiles down, so a stair-cliff isn't read as a pit).
- Materials (`mat:'grass|stone|metal|lava|wood|sand'`) theme a platform's look +
  footing in one place — metal is slick; the Tyrant builds in metal.

---

## 1. How to add a level (mechanics)

1. Write `src/game/levelN.js` exporting `buildLevelN()` that returns a **level
   object** (schema below). Steal the skeleton from `level2.js`.
2. Register it in `src/game/levels.js`:
   ```js
   import { buildLevel3 } from './level3.js';
   export const LEVELS = [ …, { id: 3, name: 'Cloudtop Run', theme: 'sky', build: buildLevel3 } ];
   ```
   That's it — the Title level-select, `?level=3`, and every eval (`LEVEL=3 …`)
   read from this registry automatically.
3. New biome? Add its baked textures + a `theme === '<name>'` branch in
   `Boot.js` and `Play.js` (`buildBackground`, `buildSolids`) — see §6.
4. Run the **eval bar** (§7). Only ship when it's green.

**Recommended prep (do once):** the helpers `stairUp / stairDown / coinRow /
piranhaPipe` are currently copy-pasted in `level.js` and `level2.js`. Extract
them into `src/game/levelkit.js` and import — then levels 3–5 are mostly data.

---

## 2. The level object (schema)

A builder returns this. Coordinates are **tile** `{c: column, r: row}`. The grid
is `W` wide × `H=15` tall; ground top is row `groundTop=13` (so rows 13–14 are
the floor, rows 0–12 are playable air, ~11 tiles of headroom).

| field | type | meaning |
|---|---|---|
| `id, name, theme` | num, str, str | registry id; HUD/title name; biome (`'day'`,`'cave'`,…) |
| `W, H, groundTop` | num | width in tiles; height (15); floor top row (13) |
| `solids[]` | `{c,r}` | every solid floor/step/platform tile (collision + AI probe) |
| `pipes[]` | `{c,r,h}` | a pipe: top-left col `c`, top row `r`, height `h`. **2 tiles wide**, occludes a piranha |
| `piranhas[]` | `{c,topR}` | a plant in a pipe (use the `piranhaPipe` helper, don't hand-build) |
| `qblocks[]` | `{c,r,power?}` | `?` block; `power:true` → mushroom, else → coin |
| `bricks[]` | `{c,r}` | breakable brick (only when big); also a platform |
| `coins[]` | `{c,r}` | a coin |
| `enemies[]` | `{c,r}` | a goomba (walks, turns at walls/edges, stompable) |
| `gaps` | `[[a,b],…]` | pit columns **inclusive** — purely for the design eval + your bookkeeping; the actual pit is just *absent* `solids` |
| `bushes, clouds, hills` | `{c,r}`/… | day-biome deco only (cave/sky use `[]`) |
| `ceiling[]`, `ceilRow`, `ceilingOpenFrom` | `{c,r}`,num,num | enclosed-roof tiles + the lit row + the col where it opens to sky |
| `start` | `{c,r}` | spawn |
| `goal` | `{c,baseR}` | flagpole column + base row (tall pole rises from `baseR`) |

A **pit** = simply skipping `solids` for those columns (see `isGap` in the
builders). A **raised platform/ledge** = pushing `solids` at higher rows.

### Authoring helpers (the toolkit)
```js
stairUp(c0, n)        // ascending staircase, n steps, each 1 tile taller
stairDown(c0, n)      // descending staircase
coinRow(c0, n, r)     // n coins in a row at row r
piranhaPipe(c, h)     // a pipe at col c (height h) + a plant that emerges/retracts
```

---

## 3. The reachability envelope (what's physically buildable)

From `consts.js` `TUNE` (runMax 700, jumpVel 1150, gravity 4200/rise 2800):

- **Jump height:** ~**3.5 tiles** at full hold; ~2 tiles on a quick tap.
- **Jump distance:** a full running jump covers ~**8–9 tiles** of air. So:
  - **Gaps:** ≤3 = easy (L1), ≤4 = fair with a runup (L2), 5–6 = the hard ceiling, **never >6**.
  - **Walls/pipes:** ≤2 tall = clean; 3 tall = clearable with an early running launch; **avoid 4+**.
  - **Steps:** ≤2 high anywhere; 1-tile steps chain fine into staircases.
- **Enemies:** goombas walk at 130 px/s and turn at walls/edges — they wander,
  so don't assume one stays put (see §4).

---

## 4. AI-driver compatibility — design so the autopilot finishes ⭐

This is the section that took the most blood. The autopilot (`debug.js`
`_drive`) reads a forward **probe** (distance in tiles to the next gap / wall /
enemy) + the entity lists, and acts *early with momentum*. Design within these
rules or it dies and the level can't ship to the success playlist.

**DO**
- **Give a flat runway (≥3–4 tiles) before every tall pipe/wall.** The AI launches
  ~1.5–2 tiles out *with speed*; no runway → it stalls at the face and jams.
- **The AI's jumps OVERSHOOT ~5–8 tiles** (it holds for height/clearance). So a
  **floating platform must be WIDE (≥12) and the gap before the next SMALL (2)**,
  or it sails clean over a narrow platform into the next pit. Wide cloud
  platforms + 2-wide gaps = reliable; narrow ledges over a void = death.
- **Leave a safe landing zone (flat, enemy-free, ≥6 tiles) after every big jump.**
  The AI can't react mid-air; if it lands onto an enemy it side-hits and dies, and
  a gap within the overshoot distance swallows it.
- **Space piranha-pipes out** with ≥3–4 flat tiles before each. The AI holds a
  *standoff*, waits for the plant to retract, then sprints+launches.
- Keep gaps ≤4, walls ≤3, steps ≤2 (§3).

**DON'T**
- ❌ **Tall pipe/wall immediately after a gap landing** (no room to build speed).
- ❌ **Enemy parked exactly where the AI lands from a pipe/gap jump.**
- ❌ **Back-to-back piranha-pipes, or a piranha-pipe right after a wide gap.**
  *This is exactly Level 2's flaky "mastery test"* (cols 128/133 after the 4-wide
  gap) — the AI sometimes mistimes it and dies. It makes a great DEBUG test case
  but it's why L2 isn't a 100% AI clear. **Don't repeat the pattern** unless you
  also harden the driver.
- ❌ **Enclosed pockets** (wall ahead + low ceiling) — the jump can't clear.

**New timed hazard (fire bar, falling block, moving platform)?** The AI has *no*
handling for it — budget driver work (a new branch in `_drive`, like the piranha
standoff) **or** skip it. A purely *spatial* mechanic (static platforms, lava =
re-skinned pit) needs **zero** new AI code.

**Verify** with the deterministic trace, then the recorder:
```
LEVEL=3 FRAMES=2800 UNTIL=<goalCol-1> node tools/eval/trace.mjs   # finds where it stalls/dies
LEVEL=3 node tools/eval/record.mjs                                # must print result: win, 0 deaths
```

---

## 5. The design grammar (what scores well)

`tools/eval/design.mjs` pulls the structured level and has Gemini grade it 0–100
on six dimensions. To score high, deliberately hit each:

- **arc** — a real 4-act shape over the width: **introduce** (teach one verb
  safely) → **develop** (complicate / add a 2nd verb) → **twist** (recombine the
  taught verbs in a new way — a genuine surprise) → **conclude** (a confident
  finale + the flag).
- **variety** — ≥3 *distinct* challenge types (gap, pipe, enemy, piranha, stair…).
  A level of one repeated verb scores low.
- **pacing** — rest beats between tension; **ramp** difficulty, no spikes.
- **reward_cadence** — coins that *lure* over risk; a power-up arc.
- **powerup_use** — a mushroom as a **hit-buffer placed right before a hazard**,
  and ideally a **brick-break route that rewards being big**.
- **story** — the beats should read as an intentional problem→solution journey.

**Second-level grammar (applies to every new level):** *keep the grammar, change
the vocabulary.* New **biome** (recolor), **one** structural twist, **one** new
mechanic built from existing parts, and **ramp one variable** — don't pile on new
verbs faster than you teach them.

---

## 6. Biomes / themes

`theme` switches textures + backdrop. Two exist:

- **`day`** — `sky_px`, `ground_grass`/`ground_dirt`, drifting clouds, far/near
  hills, treeline, bushes.
- **`cave`** — `sky_cave`, `ground_*_cave` (per-pixel blue-grey recolor),
  enclosed `ceiling` (opens at `ceilingOpenFrom`), a single dark rock parallax band.

**Add a biome** (cheap, high-impact):
1. In `Boot.js`, bake the recolored ground/sky textures (use `bakeTinted` /
   `mix` — multiply-tint can't shift hue, so per-pixel recolor for big hue moves).
2. Add a `theme === '<name>'` branch in `Play.js` `buildBackground` (backdrop +
   parallax) and `buildSolids` (`topTex`/`fillTex`).
3. Reuse the same tile *shapes* — only the palette changes. That's the whole trick.

---

## 7. The eval bar (ship gate — all green before "done")

Server up on :3000, then per level:

| gate | command | pass |
|---|---|---|
| controls | `LEVEL=N node tools/eval/controls.mjs` | 7/7 input checks |
| completion | `LEVEL=N node tools/eval/record.mjs` | `result: win`, 0 deaths, reachability all true |
| design | `PORT=3000 node tools/eval/design.mjs` *(after `?level=N` default)* | high design score, real arc + variety + power-up |
| looks | the screenshot judge (median-of-N) | cohesive, on-theme |

Then record a winning playthrough (with audio, loudnorm) → **success playlist**;
keep any death run with a `[DEBUG]` title → **debug playlist**. Commit, push to
`main` (Railway auto-deploys), **verify live**.

---

## 8. Blueprints — Levels 3, 4, 5

Three levels that continue the World-1 arc (overworld → cave → **sky → castle →
finale**), each within the AI envelope. Columns are approximate; tune against the
trace.

### Level 3 — "Cloudtop Run" · theme `sky` · *athletic / verticality*
- **Biome:** bright high-altitude sky — pale blue gradient, sun, slow cloud
  layers; ground is sparse **stone/cloud platforms** floating over open air.
- **Structural twist:** verticality — you travel across **floating platforms**
  with pits between them, climbing and dropping.
- **New mechanic (spatial → no AI work):** floating ledges/platforms (just
  `solids` at higher rows with pits between). *Signature stretch:* one **moving
  platform** — but that needs engine + driver work (budget it; ship static first).
- **Arc:** introduce (solid start, 2 easy floating ledges, a coin lure) → develop
  (platform-to-platform gaps ≤3 + a goomba on a wide platform) → twist (a
  short **descending then ascending** platform staircase over a big void — the
  athletic core) → conclude (a run across a few platforms to a raised flag).
- **Power-up:** mushroom on an early platform; a brick-break shortcut over a pit.
- **AI checklist:** every platform landing ≥3 tiles wide & enemy-free; pits ≤4;
  no wall right after a landing.

### Level 4 — "The Keep" · theme `castle` · *hazard gauntlet*
- **Biome:** dark stone/brick recolor, a glowing **lava** band as the deadly floor.
- **Structural twist:** a **hazard floor** — lava you must platform over — plus a
  denser enemy gauntlet in tight corridors.
- **New mechanic (re-skin → no AI work):** **lava = an instant-death pit** with a
  hot texture; the AI already treats it as a gap. *Signature stretch:* a **fire
  bar** (rotating hazard) — but that's a timed hazard needing a driver branch
  (like the piranha standoff); ship lava-pits first, add fire bars only with
  driver work.
- **Arc:** introduce (enter the keep, one lava gap) → develop (lava gaps + goombas
  on stone ledges) → twist (a tight alternation of lava + enemy + a short pipe —
  recombination under pressure) → conclude (a final lava run + stair ascent to the
  "throne" flag).
- **Power-up:** a hit-buffer mushroom right before the gauntlet.
- **AI checklist:** lava pits ≤4 wide; safe stone landings between hazards;
  enemies not at landing spots; if fire bars are added, harden `_drive`.

### Level 5 — "World's End" · theme `dusk` (warm castle recolor) · *mastery medley*
- **Biome:** a dusk/ember recolor (reuse castle tiles, warm palette + sunset sky).
- **Structural twist:** **recombination** — the World-1 finale recombines every
  verb taught (gap, pipe, enemy, stair, lava) into a longer, harder-but-fair run.
  No brand-new mechanic; mastery is the point (the SMB world-finale move).
- **Optional light wrinkle:** a faster goomba variant (one tuning value) for a
  fresh feel without new systems.
- **Arc:** introduce (confident warm-up using known verbs) → develop (two verbs at
  once: gap+enemy, pipe+enemy) → twist (the hardest *fair* combination — **spaced,
  single** piranha-pipes with runways, **not** the L2 back-to-back trap) →
  conclude (a grand staircase to a tall finale flag).
- **Power-up:** two mushrooms across the length (it's long); a brick-break victory route.
- **AI checklist:** this is where it's tempting to over-hard it — keep the twist
  inside §4. Single piranhas with ≥4-tile runways, safe landings, gaps ≤4.

---

## 9. Definition of done (per level)
- [ ] Registered in `levels.js`; loads via `?level=N` and the Title select.
- [ ] `controls.mjs` 7/7; `record.mjs` **win at 0 deaths** (reliably).
- [ ] `design.mjs` clears the bar (real arc, ≥3 verbs, a power-up arc).
- [ ] Visual judge: cohesive + on-theme biome.
- [ ] A winning playthrough (with sound) uploaded to the success playlist.
- [ ] Committed, pushed to `main`, **verified live** on Railway.

---

## 10. World 2 — Levels 4–13 (what shipped, and the laws they taught)

Ten levels, ten biomes, built on a **data-driven biome table** (`src/game/themes.js`):
each theme is one entry (ground recolor + sky bands + backdrop style + optional
deadly hazard); `Boot` bakes its textures, `Play` reads its backdrop. Adding a
biome is now data, not a code branch.

| # | name | theme | twist / mechanic |
|---|---|---|---|
| 4 | The Keep | `castle` | LAVA pits (deadly liquid death-pit) |
| 5 | Emberfall | `dusk` | lava + a single piranha — W1 mastery medley |
| 6 | Frostpeak | `snow` | icy verticality over airy chasms |
| 7 | Dune Sea | `desert` | QUICKSAND pits + a giant dune (stair pyramid) |
| 8 | Verdant Ruins | `jungle` | canopy platform-hopping over chasms |
| 9 | Mire of Woe | `swamp` | ACID pools + fair spaced piranha-pipes |
| 10 | Cinder Depths | `volcano` | a 7-pit lava gauntlet (the ramp) |
| 11 | Crystal Hollow | `crystal` | SPIKE pits in an amethyst cavern |
| 12 | Stormspire | `storm` | the longest athletic high-wire run |
| 13 | Final Bastion | `bastion` | grand medley — lava + pipe + piranha finale |

**Deadly hazards are free (spatially).** `lava / acid / sand / spike` are just a
pit `gaps` range with a `hz_<type>` fill drawn into it (`themes.js` `HAZARDS`,
`Play.buildHazards`). The AI already avoids pits, so a re-skinned pit needs **zero
driver work** — the cheapest way to get a new-feeling deadly mechanic.

**Two completability laws (cost real deaths to learn):**
1. **Segregate guards from pits.** Goombas *wander to the edges of their
   platform*, so an enemy on a pit-bordering platform gets nudged into the AI's
   short enemy-hop and both fall in. Put hazard pits on an **enemy-free**
   platforming stretch; put goombas on a **pit-free** solid hall. (This is why L3
   always worked and the first L4 didn't.)
2. **Flat finales.** A `stairUp+stairDown` pyramid makes the AI read a *phantom
   gap* at the elevated peak and wedge there (it times out, no death). Win triggers
   on reaching `goalX` horizontally, so the pyramid bought nothing — end on **flat
   ground with a tall flagpole** (`baseR` is just pole height).

Plus the §4 piranha rule, reaffirmed: **single, spaced piranha-pipes with long
flat runways** clear fine (L5, L9, L13); back-to-back (L2) stays flaky.
