# game-template

A clean, **maintained base game** to instantiate new games from — the engine +
the full tooling, with a **neutral placeholder skin**. This is to games what
`the-rig` is to chat apps: you don't start from scratch and you don't inherit
another game's content.

Instantiate a new game with the engine's scaffolder (it clones this template,
not a specific game, so there's no cruft to clean up):

```bash
node scripts/new-game.mjs "My Game" --hero "..." --verb "..."
```

## What's in here (and what's a placeholder)
- **Engine** (`src/game/`): scenes, level DSL (`levelkit.js`), materials, themes,
  merge, controls, audio — the real, reusable game.
- **Tooling** (`tools/`): the 0-death gate (`wincheck`), felt-fun, the deterministic
  recorder, the YouTube uploader, the book builder, and **`notes-to-issues`**
  (auto-targets *this* repo + cross-files upstream).
- **Placeholders to replace** (see `RESKIN.md`): the hero sprite, the 5 example
  levels, the Title wordmark/story, the system prompt, the art + music.

## Maintain the template
When the engine improves (a new mechanic, a tooling fix), land it **here** so every
future game inherits it. Keep the placeholders neutral — never let a specific
game's identity leak back into the template.
