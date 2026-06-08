---
name: merge
description: Consolidate the campaign's N levels into K longer "worlds" with an evaluator-reworked arc, seam checkpoints, and a 0-death-safe build. Use when the user asks to merge/combine levels, reduce the level count, build the consolidated worlds, or refresh them after editing the originals.
---

# /merge — consolidate N levels → K longer worlds

Turns the 13 original levels into 5 longer "worlds" (ids 101–105), generically:
concatenate same-floor levels end-to-end, bridge each seam with a rest valley,
floor the void under interior aerial (cloud) sections, drop a checkpoint at each
seam, and pick the segment ORDER the feel model scores best (a late climax).

## Pieces
- `src/game/merge.js` — `mergeGroup(segments, {rest, floorAerial})` + `shapeArc()`
  (calm opening; strips only opening-band threats/optional rewards, never
  traversal aids). Emits `checkpoints` at the seams.
- `tools/merge-levels.mjs` — balanced contiguous N→K partition, brute-forces
  segment order per group maximizing the **arc component**, writes
  `src/game/merged.js` (runtime builders) + prints the plan (FUN, peak%, arc).
- `src/game/levels.js` — `buildLevelById(101+)` builds a world; Title routes
  `?level=101+` through. Originals (1–13) stay intact.
- `src/game/scenes/Play.js` — respawns at the last seam checkpoint on death.

## How to run
1. Regenerate the worlds (after editing originals or the merge logic):
   ```
   node tools/merge-levels.mjs        # prints the plan, writes merged.js
   ```
2. **Re-gate** (worlds need a bigger step budget — they're ~3× longer):
   ```
   LEVELS="101 102 103 104 105" WCSTEPS=28000 bash tools/gate.sh
   ```
   The strict 0-death bar is hard on long worlds; the coin-maximizer
   (`/playlist` MODE=collect) tolerates deaths via the seam checkpoints +
   risk-budget. Use `tools/eval/collectcheck.mjs` to ask "does it COMPLETE in
   collect mode?" (`LEVEL=103 node tools/eval/collectcheck.mjs`).
3. `node tools/eval/design-pass.mjs` shows the 5 worlds' FUN vs the 13 (≈71 vs 52).

## Gotchas (each cost real debugging)
- A sky/cloud level merged as an **interior** segment fails at full run-in speed
  → `mergeGroup` floors interior aerial spans (≥3 gaps); clouds stay as a coin route.
- The autopilot frame cap must scale with width (`max(9000, W*45)` in debug.js).
- Merged worlds are single-theme (the spawn segment's biome) — visually one biome,
  all mechanics intact. Per-segment biome bands would be a further enhancement.
