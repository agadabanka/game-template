---
name: design-pass
description: Score the game's levels with the felt-experience evaluator — a FUN leaderboard with engagement/dynamics/arc/flow breakdown, peak placement, and dead-air flags. Use when the user asks for a design pass, fun/feel analysis, how levels rate, or which levels are weak/strong.
---

# /design-pass — evaluate level fun

Two evaluators, same component math (`feelmodel.js` / `feel.mjs`):
- **Deterministic** (fast, no LLM, no server) — the default. Run:
  ```
  node tools/eval/design-pass.mjs
  ```
  Prints per-level FUN, components (engagement·dynamics·arc·flow), peak position
  (climax should land ~84%), interest sparkline, campaign avg, weakest/strongest,
  dead-air flags. FUN = 100·(0.35·eng + 0.15·dyn + 0.25·arc + 0.25·flow).
- **LLM persona sim** (slower, needs Gemini creds + server) — for a human-like
  read of one level: `PORT=3000 LEVEL=3 SIMS=3 node tools/eval/feel.mjs`.

## How to run
1. Start the deterministic pass (covers all 13 in seconds).
2. Report: the FUN leaderboard, the 2–3 weakest levels and *why* (low arc =
   peak too early; low flow = dead-air valleys), and any dead-air flags.
3. If the user wants a single level scrutinized like a human plays it, run
   `feel.mjs` for that level (start the server first).

## Reading the numbers
- **arc** low → climax not near the end (peak@ far from ~84%). Fix by moving the
  biggest set-piece late.
- **flow** low → dull/empty stretches. Fix by filling dead-air windows with beats.
- **dynamics** maxes easily; **engagement** is mean interest / 8.
