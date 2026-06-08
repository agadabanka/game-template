---
name: shot
description: Capture screenshots of game levels/biomes headlessly for quick visual verification. Use when the user asks to see how a level/biome looks, screenshot the game, or check that a visual change (art, fauna, decor, theme) renders.
---

# /shot — level/biome screenshots

Drives the game headlessly and grabs the Phaser canvas (`toDataURL`) — no
DOM/font wait. Output lands in `tools/eval/video/` (or `tools/eval/out/`).

## How to run
- **Multi-biome sweep** (one frame per level after critters/decor settle) —
  best for verifying art/fauna across themes:
  ```
  PORT=3577 LEVELS="1:day,8:jungle,9:swamp,3:sky,6:snow" node tools/eval/shot-fauna.mjs
  ```
  `LEVELS` is `level:label` pairs → `tools/eval/video/fauna2-<label>.png`.
- **Scripted title + gameplay frames** (general capture):
  ```
  PORT=3210 node tools/eval/shoot.mjs   # → tools/eval/out/*.png
  ```
- Start a server on the chosen `PORT` first if one isn't up
  (`PORT=3577 node server.js &`).

## After capturing
Read the PNGs back with the Read tool to inspect them, and report what renders
(or doesn't). Clean up scratch PNGs — `tools/eval/video/` is gitignored.
