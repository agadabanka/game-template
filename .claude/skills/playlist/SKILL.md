---
name: playlist
description: Record AI playthrough videos of game levels and upload them to a YouTube playlist. Use when the user asks to record/show videos of levels, make or update a playlist, or capture maximizer/showcase runs. Replaces the old record-upload-*.sh scripts with one parameterized run.
---

# /playlist — record levels → upload → YouTube playlist

Wraps `tools/playlist.sh`, which records each level with the deterministic
recorder (`tools/eval/record.mjs`) and uploads via `tools/youtube-upload.mjs`
(creates the playlist if its title is new).

## How to run
1. Parse the request into: **levels**, **mode**, **playlist name**.
   - levels → `LEVELS` (space list; expand ranges like "1-13" yourself).
   - mode → `MODE`: `collect` (coin maximizer, deaths OK — the default the user
     usually wants), `showcase` (intended-experience 0-death beats), or `plain`.
   - playlist → `PLAYLIST` (a clear, distinct title; for a "new"/"latest"
     playlist use a name not already used, e.g. add "(latest)" or a date).
2. Launch in the **background** (a full 13-level run is 30–50 min):
   ```
   LEVELS="1 2 3 4 5 6 7 8 9 10 11 12 13" MODE=collect \
     PLAYLIST="the-platformer — Levels 1–13 · Coin Maximizer (latest)" \
     bash tools/playlist.sh
   ```
3. **Verify one level first** if the pipeline/quota is uncertain:
   `LEVELS="1" ... bash tools/playlist.sh` — confirm a `youtu.be/...` link and
   no `exceeded` (quota) before launching the rest.
4. Monitor the run with the Monitor tool (grep for `youtu.be|exceeded|error|DONE`).

## Notes
- `NO_UPLOAD=1` records only (no YouTube) — good for a quick local check.
- YouTube quota is ~10k units/day; each upload ≈ 1600. If you hit `exceeded`,
  report which levels uploaded and resume the rest next day (re-run with the
  remaining `LEVELS` and the same `PLAYLIST` title).
- Other knobs: `REQUIRE_WIN` (default 1 = full die-learn-win journey),
  `RECSECONDS`, `PRIVACY`, `PREFIX`, `PORT`, `FAST`.
- Needs `.env.youtube` (YT_CLIENT_ID/SECRET/REFRESH_TOKEN) — already present.

## Recording the merged worlds (101–105) — hard-won operational reality
- **The merged worlds ARE selectable as levels 101–105** (after `/merge`); record
  them just like any level (`LEVELS="101 102 103 104 105"`).
- **Capture is ~100ms/frame** (headless render-bound; the node process mostly
  *waits*). `FAST=1` (JPEG frames) helps a little; the bigger win is the every-6-
  frames state poll already in `record.mjs`. Budget accordingly:
  capture + encode must fit the time limit → **a foreground run caps near ~4200
  frames (RECSECONDS≈70)**. Size `RECSECONDS` so capture *finishes* (else you get
  no mp4 at all — it dies mid-encode).
- **Background jobs die on container pause/resume here.** Record **one world at a
  time, foreground**, and upload immediately (durable) before the next.
- **Long worlds may not WIN inside a foreground budget** even though they're
  winnable (the win frame can exceed ~4200). With `REQUIRE_WIN=1` that yields no
  mp4; either accept a journey or use a per-world budget that captures the win.
- **Hard worlds death-loop → the re-arm + rapid scene-restart HANGS the recorder.**
  Use `REQUIRE_WIN=0` (stops at first death → a short but real clip) or `SHOWCASE=1`
  (fewer deaths) as a fallback for those.
- **Always verify what loaded**: `?level=101` must build the world, not clamp to a
  base level — confirm distinct coin counts/biomes (a stale checkout silently
  falls back to level 13). After deleting wrong uploads, also remove the leftover
  "Deleted video" **playlist items** (they show as placeholders) and reorder 1→K.
- **Commit + push before any long recording** — an unpushed checkout can be lost on
  resume.
