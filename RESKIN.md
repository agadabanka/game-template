# Re-skin checklist — turning the template into your game

The engine + tooling are done. To make this *your* game, replace the placeholders:

1. **Identity** — `src/game/scenes/Title.js` (wordmark `YOUR GAME`, tagline, story
   line), `src/index.html` `<title>`, `server.js` `SYSTEM_PROMPT_BASE`,
   `package.json` name, `GAME_META.json`.
2. **Hero** — `src/assets/hero/jazz_{idle,run,jump,fall}.png` (the placeholder
   mascot). Generate on a GREEN screen, key + fit to 128px (see the engine's
   sprite pipeline). Keep the keys; no code change needed.
3. **Levels** — `src/game/level{,2,3,4,5}.js` are generic four-step examples. Re-theme
   (`themes.js`), re-design, and **gate every change** (`LEVEL=N node tools/eval/wincheck.mjs`
   must win at 0 deaths).
4. **Art** — backdrops (`src/assets/bg/<theme>.jpg`, wired in `Boot.js`), the Title
   key art (`src/assets/jazz-keyart.jpg`), materials (`materials.js`).
5. **Music** — drop `src/assets/music/<theme>.mp3` per theme and add the themes to
   `FILE_THEMES` in `audio.js` (or it falls back to procedural).
6. **Deploy** — own Railway project (see `BOOTSTRAP.md`); register on the hub.
