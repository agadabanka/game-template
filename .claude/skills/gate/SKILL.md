---
name: gate
description: Run the 0-death autopilot win-check across game levels and report a pass/fail table (win + 0 deaths is the bar). Use when the user asks to verify levels are beatable, run the gate, confirm 0-death, or check a change didn't break solvability.
---

# /gate — 0-death solvability check

Runs the deterministic autopilot (`tools/eval/wincheck.mjs`) per level and
reports win/deaths. The project's correctness bar: every level must be winnable
with **0 deaths** by the autopilot.

## How to run
```
LEVELS="1-13" bash tools/gate.sh
```
- `LEVELS` accepts ranges ("1-13") and lists ("1 5 7"); default is 1..13.
- `SHOWCASE=1` runs the intended-experience policy instead of the rush-to-flag.
- Prints a `L | ✓/✗ | result | deaths` table and a pass/fail tally; exits
  non-zero if any level fails.

## When to use
- After editing level files, the level DSL, or the autopilot — confirm nothing
  regressed.
- Before recording a playlist or merging to main.
- Report which levels fail and at what point (the wincheck output includes the
  furthest tile reached).
