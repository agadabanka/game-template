# Felt-experience baseline (fun-score)

Reproducible "is it fun?" score from `tools/eval/feel.mjs`, complementing the
correctness bar (`wincheck.mjs` / `sweep.mjs` — autopilot clears at 0 deaths).
The 0-death bar pushes levels toward wide ledges + safety nets = flat; this is
the counter-pressure.

**FUN SCORE (0-100)** = a weighted blend, each shown in the breakdown:
- `engagement` (0.35) — mean simulated interest (are the moments interesting?)
- `dynamics` (0.15) — mean window-to-window movement (tension/rest rhythm, not a flat line)
- `arc` (0.25) — shape vs the ideal curve (Pearson) + late-peak bonus + rising trend
- `flow` (0.25) — penalty for dead-air windows + the longest flat run

The persona sim is averaged over `SIMS` runs (default 3) to cut LLM noise
(reported as `sim-noise`; ~±0.2 after averaging). The ideal curve is Schell's:
hook early → rising peaks with rest valleys → **climax near ~84% through**.

Run: `GOOGLE_APPLICATION_CREDENTIALS=sa.json LEVEL=N SIMS=3 node tools/eval/feel.mjs`

## Baseline — 2026-06-01 (all 13, SIMS=3). Mean ≈ 57.9

| rank | level | fun | engagement | dynamics | arc | flow | weakness |
|---|---|---|---|---|---|---|---|
| 1 | L7 Dune Sea \*\* | 66.6 | 0.69 | 0.64 | 0.58 | 0.74 | — (strongest) |
| 2 | L3 Cloudtop Run \* | 65.8 | 0.63 | 0.68 | 0.48 | 0.87 | mid-level filler |
| 3 | L13 Final Bastion | 64.4 | 0.56 | 0.88 | 0.54 | 0.73 | — |
| 4 | L5 Emberfall | 60.6 | 0.60 | 0.75 | 0.46 | 0.67 | arc |
| 5 | L2 Into the Caverns | 60.5 | 0.58 | 0.89 | 0.36 | 0.71 | arc (early peak) |
| 6 | L6 Frostpeak | 60.4 | 0.57 | 0.76 | 0.56 | 0.60 | flow |
| 7 | L11 Crystal Hollow | 58.8 | 0.40 | 0.88 | 0.61 | 0.65 | engagement |
| 8 | L8 Verdant Ruins | 57.4 | 0.44 | 0.86 | 0.47 | 0.69 | engagement |
| 9 | L12 Stormspire | 56.0 | 0.48 | 0.76 | 0.57 | 0.53 | flow |
| 10 | L10 Cinder Depths | 55.2 | 0.43 | 0.57 | 0.51 | 0.75 | engagement |
| 11 | L1 First Steps | 53.7 | 0.51 | 0.81 | 0.32 | 0.63 | arc (peaks at 20%) |
| 12 | L9 Mire of Woe | 48.1 | 0.47 | 0.76 | 0.21 | 0.61 | **arc** (no climax) |
| 13 | L4 The Keep | 44.9 | 0.41 | 0.58 | 0.51 | 0.37 | **flow** (dead air) |

\* L3 redesigned this session (eval-driven) — was flat, now 2nd.
\*\* L7 reworked (spring pocket + functional springs + guarded dune + climax + early
hook). Measured by paired A/B (mood-cancelled), not the noisy absolute score:
**+1.1 interest/window cumulative vs the original, 100% sign-agreement, 0
regressions, still 0-death.** See `FEEL_PLAYBOOK.md` for the method + lessons.

## Full-game survey — 2026-06-01 (improved eval, `feel-all.sh`, self-diagnosis)

Re-surveyed all 13 with the hardened eval + auto-diagnosis (SIMS=2, so ±noisy on
the absolute number — the **diagnosis** is the durable output). This is the
"overall picture" used to check the learnings generalize rather than overfit to L7.

| diagnosis (the one highest-leverage fix) | levels | share |
|---|---|---|
| **ARC** — peak too early / not rising | L2, L3, L5, L7, L8, L9, L10 | 7/13 |
| **FLOW** — dead air | L4, L12 | 2/13 |
| **ENGAGEMENT** — needs a structural verb | L11, L13 | 2/13 |
| **BALANCED** | L1, L6 | 2/13 |

**ARC is the systemic weakness of the whole game** — and L7's exact problem (peak
too early) recurs on L2 and L9, so it was never L7-specific.

### Generalization test (not overfitting)
Applied the L7 remedy — *turn the flat finale into a guarded climactic ascent* — to
the two worst levels, measured by paired A/B (mood-cancelled):
- **L4 "The Keep"** (FLOW): **+0.63 interest/window**, 100% sign-agreement, 0 regressions.
- **L9 "Mire of Woe"** (ARC, peak was at 11%): **+0.31/window**, 100% agreement, 0 regressions.

The same structural move lifted 3 levels across 2 diagnosis types (L7, L4, L9) →
the method transfers. Remaining ARC/FLOW/ENGAGEMENT levels are the same move
repeated; the fast loop (`feel-all.sh` diagnosis → edit → `wincheck` → `feel-ab`)
makes each ~a few minutes.

### What the original baseline says
- **Systemic low `engagement` (many 0.40–0.51):** moments aren't intrinsically
  interesting → the real fix is **mechanic variety** (moving platforms,
  conveyors, fire bars), not more coins.
- **`arc` is the most common failure:** L9 (0.21), L1 (0.32), L2 (0.36) peak too
  early or never climax. Levels need a built late peak (a signature beat near the end).
- **Priority fixes:** L4 (dead air → `flow` 0.37), L9 (no climax → `arc` 0.21),
  L1 (bad first impression → climax at 20%).
