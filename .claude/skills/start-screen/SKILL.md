---
name: start-screen
description: Redesign a game's title/start screen so the primary CHARACTER is prominent and the level previews FLOAT in negative space without obscuring it — a fresh Gemini key-art pass (character-accurate) plus the real gameplay thumbnails and a decluttered Phaser layout. Use when the user asks to redesign/relayout/clean up the title screen, start screen, menu, or "make the hero prominent / cards float / less clutter".
---

# /start-screen — relayout the title screen (hero-forward, floating previews)

The principle: **the hero key art owns the frame; the level previews float in the
calm negative space; text is reduced to a wordmark + one prompt + one controls line.**
Accuracy (real thumbnails) + aesthetics (a Gemini-composed backdrop) together.

The title lives in `src/game/scenes/Title.js`; the backdrop is the `jazz_keyart`
texture loaded by `Boot.js` from `/assets/jazz-keyart.jpg`; the level previews are
the `thumb_w{1..N}` textures from `/assets/thumbs/`.

## Steps

1. **Generate a hero-forward key art** with Gemini, *conditioned on the game's own
   character art* (`art-src/<hero>/idle.jpg` / model sheet) so the hero is on-model.
   The composition is the whole trick — bake in the layout:
   - Hero **large and prominent**, off to ONE side (e.g. center-left).
   - The OPPOSITE side + the TOP kept **calm, dark, uncluttered negative space** —
     that's where the UI goes.
   - **No text, no UI, no panels, no thumbnails** in the art (those are real, added
     in code).
   Save over `src/assets/jazz-keyart.jpg`. Prompt skeleton:
   > "A clean AESTHETIC TITLE-SCREEN KEY ART, wide 16:9. HERO large and prominent on
   > the [center-left], match the attached character EXACTLY: <describe>. Behind: a
   > calm [setting] with lots of NEGATIVE SPACE. Keep the TOP band and the [RIGHT
   > third] calm/dark/empty for a title and floating UI panels. Cinematic,
   > painterly-but-crisp. Absolutely NO text, NO words, NO UI, NO panels."

2. **Refresh the thumbnails** so the previews are current + accurate:
   `PORT=<p> node tools/eval/gen-thumbs.mjs` (real gameplay captures).

3. **Relayout `Title.js`** (keep `highlight`/`moveSel`/`startGame` logic; rewrite the
   visual part of `create()`):
   - **Wordmark** in a calm corner opposite the hero (origin-anchored so it never
     overlaps the character).
   - **Floating preview column** of `thumb_w{n}` cards in the negative space (a
     vertical column or gentle arc), each a small card (thumbnail + number badge +
     name on a scrim), with a slow `Sine.inOut` bob tween so they read as drifting
     panels — NOT a rigid row across the character.
   - **Cut the clutter**: drop the story paragraph and the two big mode boxes; make
     watch-mode a tiny corner toggle; reduce controls to ONE line; keep one pulsing
     PLAY prompt.

4. **Verify** by screenshotting `/?level=1` (the title) — the hero should be clearly
   visible and unobscured, the previews legible in the margin, the text minimal.
   Commit the key art + `Title.js` (+ refreshed thumbs).

## Notes
- Reference Starsweeper's `Title.js` for a working implementation of this layout.
- Different games put the hero in different spots — match the key art's open side to
  where the preview column lands (right hero → left column, and vice-versa).
