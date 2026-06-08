# the-platformer — quality rubric (the score we hill-climb)

The bar: a polished, Super Mario-grade vertical slice — **one** great level. We do
not chase breadth; we raise this score until the single level is excellent.

## A. Visual quality (vision-model judge + human eye, anchored to goldens)
Each scored 0–10. Goldens: real Super Mario World / SMB3 / NSMB / acclaimed
platformer screenshots in `tools/eval/goldens/` (reference only, not shipped).

1. **Art cohesion** — one consistent style across sky, tiles, props, characters.
2. **Color & vibrancy** — saturated, high value-contrast, readable palette.
3. **Character appeal & readability** — strong silhouette, clear pose per state.
4. **Background depth** — convincing multi-layer parallax, atmosphere.
5. **Environment craft** — ground/tiles/blocks/pipes feel hand-made, not flat.
6. **HUD & framing** — clean, legible UI; well-composed shots.
7. **Mario-ness** — instantly reads as a great platformer of this lineage.
8. **Juice (motion shots)** — particles, squash, shake visible & tasteful.
9. **Overall polish** — the gestalt "this is not sloppy."

**Visual score = mean(1..9) × 10  → 0–100.** Target ≥ 80 before shipping.

## B. Playability (automated bot + checks)
- **Completable**: bot reaches the flag (pass/fail; must pass).
- **FPS**: sustained ≥ 58 on the eval machine.
- **Deaths/cheap-failures** by a reasonable policy: minimize.
- **Reachability**: every gap/jump clearable with the tuned jump arc (static check).
- **Input feel proxies**: jump height/length match the tuned spec.

## Process
1. `node tools/eval/shoot.mjs` → frames in `tools/eval/out/` + FPS/console.
2. `node tools/eval/judge.mjs` → Gemini-vision scores each frame on A1–A9 → JSON.
3. Human review of the same frames against goldens.
4. Record scores in `tools/eval/scores/`, pick the lowest 2–3 dimensions, fix,
   re-run. Hill-climb until Visual ≥ 80 and Playability passes.
