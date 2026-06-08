# jazz — Project Context

> **What this is.** Jazz is a **Saturday‑morning‑cartoon run‑and‑gun platformer**:
> *Jazz, a bunny with a bazooka*. It is **AI‑built and AI‑evaluated** on the exact
> methodology proven in `agadabanka/the-platformer` (a frog jump‑'n'‑collect
> platformer). This repo was **seeded from the‑platformer's engine** (the reusable
> scaffold); the job now is to transform it into Jazz: a deliberately different
> look + a new core verb (**stomp → shoot**). See **`BUILD_JAZZ.md`** for the plan.

## Lineage (the three repos — all required)
- **`agadabanka/the-rig`** — the deployable Node/Express + Railway skeleton (chat
  brain, volume store, `lib/gemini.js`, `BOOTSTRAP.md` deploy recipe, `.claude`
  session hook). Jazz inherits this base via the-platformer.
- **`agadabanka/the-harness`** — the *methodology/guide* (the `new-project` flow,
  the playbook PDFs, the generators). The "how to build + evaluate a game with AI".
- **`agadabanka/the-platformer`** — the reference game this repo is seeded from: the
  Phaser scaffold + the **AI‑eval harness** (gate + feel + autopilot + recorder),
  the **level DSL**, the **reward model**, **merge/checkpoints**, the showcase
  pipeline, and the player playbook (`BUILDING_GAME_AI.md`).

## Architecture (inherited; to be reskinned + extended)
A no‑build Phaser 3 game served by a tiny Express app on Railway (push `main` →
auto‑deploy):
- `server.js` — Express: static game + `/api/*` (chat, Gemini image/vision,
  knowledge brain) + `/health`.
- `src/game/` — Phaser scenes (`Boot`/`Title`/`Play`/`UI`), the **level DSL**
  (`levelkit.js`), level builders, the generic **reward model** (`reward.js`), the
  **autopilot** (`debug.js`), merge/checkpoints, feel model.
- `tools/eval/` — the harness: `wincheck.mjs` (0‑death/completion **gate**),
  `feel.mjs`/`feelmodel.js` (**felt‑fun** eval), `record.mjs` (deterministic
  **recorder**), screenshots, design‑pass.
- `lib/` — `store.js` (volume KV), `gemini.js` (image/vision/text).
- `.claude/skills/` — `/gate /design-pass /merge /playlist /shot /book /showcase`.

## The transform (what makes Jazz *Jazz*) — see BUILD_JAZZ.md
1. **Look**: Saturday‑morning cartoon — bright primaries, bold outlines, zany. New
   art pack (bunny + sci‑fi tiles), palette/fonts/UI, upbeat music. *Nothing* should
   read like the pixel‑storybook frog.
2. **Core verb**: a **bazooka** — 8‑direction aim, splash damage, **rocket‑jump**,
   destructible terrain, turrets + boss. Enemies are **shot**, not stomped.
3. **Reward model**: `enemy → {value, method:'shoot'}`, `destructible → blow-up`.
4. **The AI player**: a new motor skill — **aim + lead + fire** (the bottleneck per
   `BUILDING_GAME_AI.md`; build it first as a thin vertical slice).
5. **Everything else reused**: gate + feel, deterministic stepper, the planner,
   co‑design, merge, checkpoints, campaign flow (menu thumbnails, intro cards,
   transitions), the showcase/recording pipeline.

## Key env vars
- `ANTHROPIC_API_KEY` (required) — chat/agents.
- `GEMINI_SA_JSON` / `GOOGLE_APPLICATION_CREDENTIALS` / `GEMINI_API_KEY` — image/vision.
- `MODEL`, `ADMIN_TOKEN`, `DATA_DIR`/`RAILWAY_VOLUME_MOUNT_PATH`, `PORT` — as in the-rig.

## Local dev
```bash
npm install
ANTHROPIC_API_KEY=... npm run dev   # http://localhost:3000
```

## Deploy
Jazz has its **own Railway project** (own service + volume + domain). Push to `main`
→ auto‑deploy. Full recipe in `BOOTSTRAP.md`.
