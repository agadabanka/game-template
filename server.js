import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geminiConfigured, generateImage, analyzeImage } from './lib/gemini.js';
import * as store from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.MODEL || 'claude-opus-4-7';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// When '1'/'true', the Gemini image endpoints are open to anyone (with a rate
// limit). Otherwise they require the admin token. Leave off in production
// unless you intend to expose generation publicly — it costs money per call.
const GEMINI_PUBLIC = ['1', 'true'].includes((process.env.GEMINI_PUBLIC || '').toLowerCase());

const client = new Anthropic();
const app = express();
app.use(express.json({ limit: '10mb' })); // headroom for base64 images on /api/image/analyze
app.use(express.static(path.join(__dirname, 'src'), { extensions: ['html'] }));

// ─────────────────────────────────────────────────────────────────────
// CUSTOMIZE ME → this defines the assistant's persona and product
// knowledge. Rewrite it for your product. Anything you save in the brain
// editor at /admin is appended below as authoritative context, so you can
// iterate on facts (pricing, availability, FAQs) without redeploying.
// ─────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_BASE = `You are the assistant for a game built on the game-engine. This is the neutral TEMPLATE; replace this prompt in server.js with your game story and facts. Answer questions honestly and concisely; if you do not know, say so.`;

function buildSystem(knowledge) {
  const brain = (knowledge?.brain || '').trim();
  if (!brain) return SYSTEM_PROMPT_BASE;
  return (
    SYSTEM_PROMPT_BASE +
    `\n\n--- Additional context (treat as authoritative; supersedes anything above on conflict) ---\n` +
    brain
  );
}

// The knowledge "brain" is just the first key in the volume-backed store.
// Anything else you need to keep between sessions (tokens, counters, user
// state) goes through the same store — see lib/store.js.
async function loadKnowledge() {
  const v = await store.get('knowledge', null);
  if (!v) return { brain: '', updated_at: null };
  return { brain: String(v.brain || ''), updated_at: v.updated_at || null };
}

async function saveKnowledge(brain) {
  const payload = { brain, updated_at: new Date().toISOString() };
  await store.set('knowledge', payload);
  return payload;
}

function adminAuthorized(req) {
  if (!ADMIN_TOKEN) return true;
  const provided = req.get('x-admin-token') || req.query.token || req.body?.admin_token;
  return provided === ADMIN_TOKEN;
}

app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL }));

// build identity for the update-shell: the version changes on every Railway
// deploy (commit sha), so clients can offer a "tap to update" reload instead
// of being abruptly restarted mid-game. Boot-time fallback covers non-Railway.
const BUILD = {
  version: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_DEPLOYMENT_ID || 'boot-' + Date.now(),
  booted_at: new Date().toISOString(),
};
app.get('/api/version', (_req, res) => res.json({ ok: true, ...BUILD }));

// Design-lens data: the latest feel snapshot for a level (curve + 4 components +
// diagnosis + fixes), read from the eval's scores dir. Powers /editor.
app.get('/api/feel/:level', (req, res) => {
  try {
    const lv = String(req.params.level).replace(/[^0-9]/g, '');
    const dir = path.join(__dirname, 'tools', 'eval', 'scores');
    if (!lv || !fs.existsSync(dir)) return res.json({ level: lv, missing: true });
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith(`feel_L${lv}_`) && f.endsWith('.json'))
      .sort();                                        // timestamp-suffixed → last is newest
    if (!files.length) return res.json({ level: lv, missing: true });
    res.json(JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8')));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// A precomputed design-evolution sequence (tools/eval/evolve-compute.mjs) for the
// /editor ?play=1 playback + its recording.
app.get('/api/evolution', (req, res) => {
  try {
    const lv = String(req.query.level || '').replace(/[^0-9]/g, '');
    const kind = String(req.query.kind || '').replace(/[^a-z]/g, '');
    const dir = path.join(__dirname, 'tools', 'eval', 'video');
    const prefix = kind === 'codesign' ? 'codesign' : 'evolution';
    const f = lv && fs.existsSync(path.join(dir, `${prefix}_L${lv}.json`)) ? path.join(dir, `${prefix}_L${lv}.json`) : path.join(dir, 'evolution.json');
    if (!fs.existsSync(f)) return res.json({ missing: true });
    res.type('application/json').send(fs.readFileSync(f, 'utf8'));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// The FINAL co-designed level object (last frame of a codesign run) — so the game can
// load it (window.__CUSTOM_LEVEL) and the play agent can play what the designer made.
app.get('/api/codesign-level', (req, res) => {
  try {
    const lv = String(req.query.level || '').replace(/[^0-9]/g, '');
    const f = path.join(__dirname, 'tools', 'eval', 'video', `codesign_L${lv}.json`);
    if (!lv || !fs.existsSync(f)) return res.json({ missing: true });
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    res.json((data.frames[data.frames.length - 1] || {}).level || { missing: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Design critic: Gemini (the player-persona's designer voice) picks the single
// highest-impact edit for the current level state. Powers the /editor "evolve"
// loop — the AI-in-the-loop that drives the design-evolution video.
app.post('/api/design/critique', async (req, res) => {
  try {
    const { generateText, geminiConfigured } = await import('./lib/gemini.js');
    const { name, theme, W, curve, components, deadAir, beats, step } = req.body || {};
    if (!geminiConfigured()) return res.json({ fallback: true, why: 'Gemini not configured' });
    const MECHS = 'spring, spout, dropper, crumble, dashpad, bounce, walker, conveyor, coins, mover, qblock, ice, sticky, wind, updraft, firebar, gap';
    const prompt = `You are a master platformer level designer (Mark Brown / Nintendo "four-step": introduce, develop, twist, resolve), tuning a level for the felt-interest curve (hook early, rising peaks with short rest valleys, CLIMAX near ~84%).
LEVEL "${name}" (${theme}), width ${W} tiles. This is design step ${step}.
Per-window interest curve (0-10, left→right): [${(curve || []).map((v) => v.toFixed(1)).join(', ')}]
Scores: engagement ${components?.engagement}, dynamics ${components?.dynamics}, arc ${components?.arc}, flow ${components?.flow}.
Dead-air tile ranges (interest too low): ${(deadAir || []).join(', ') || 'none'}.
Existing beats (tile:type): ${(beats || []).slice(0, 40).map((b) => `${Math.round(b.x)}:${b.type}`).join(', ')}.
Pick the SINGLE highest-impact edit. Prefer: fill the worst dead-air zone with a fitting verb; if the peak is early, add a STRONG beat (spring/firebar/mover/boss-adjacent) in the last quarter; vary verbs (avoid repeating one already nearby).
Allowed mechanics: ${MECHS}.
Reply with ONLY compact JSON: {"x": <tile int>, "add": "<mechanic>", "why": "<≤12 word rationale>"}`;
    // disable flash's thinking + cap tokens → a snappy reply (the evolve loop calls
    // this once per step, so latency drives the video's pacing).
    const raw = await generateText(prompt, { generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.8, maxOutputTokens: 90 } });
    const m = String(raw).match(/\{[\s\S]*?\}/);
    if (!m) return res.json({ fallback: true, why: 'no JSON', raw: String(raw).slice(0, 120) });
    const move = JSON.parse(m[0]);
    res.json({ x: Math.round(move.x), add: String(move.add || '').toLowerCase().trim(), why: String(move.why || '').slice(0, 90) });
  } catch (e) { res.json({ fallback: true, why: String(e).slice(0, 120) }); }
});

// FEELING → MECHANIC: the designer names a feeling (MDA aesthetic) at a tile; Gemini
// chooses the mechanic that evokes it, guided by the established feeling→element map
// (elements.js byFeeling). The "tell the feeling, AI places the beat" core.
app.post('/api/design/place', async (req, res) => {
  try {
    const { byFeeling } = await import('./src/game/elements.js');
    const { x, feeling, note, suggest, theme, W, beats } = req.body || {};
    const cands = (byFeeling(feeling) || []).map((e) => `${e.key} (${e.aesthetic}, interest ${e.interest})`);
    const top = (byFeeling(feeling) || [])[0];
    const { generateText, geminiConfigured } = await import('./lib/gemini.js');
    if (!geminiConfigured()) return res.json({ fallback: true, add: suggest || (top && top.key) || 'spring', why: `top ${feeling} verb (no Gemini)` });
    const prompt = `You are a platformer designer placing ONE mechanic to make the player FEEL "${feeling}" at tile ${x} of a ${theme} level (width ${W}).
Designer's note: "${note || '(none)'}". They suggested: "${suggest || '(none)'}".
Mechanics that evoke "${feeling}" (key — aesthetic — interest): ${cands.join('; ') || '(any fitting mechanic)'}.
Nearby beats (tile:type): ${(beats || []).join(', ') || 'none'}.
Choose the mechanic that best delivers THAT feeling here. Honor the suggestion if it fits the feeling; otherwise override and say why. Avoid repeating an identical adjacent beat.
Allowed: spring, spout, dropper, crumble, dashpad, bounce, walker, conveyor, coins, mover, qblock, ice, sticky, wind, updraft, firebar, gap, remove.
Reply ONLY compact JSON: {"add":"<mechanic>","why":"<≤14 words tying it to the feeling>"}`;
    const raw = await generateText(prompt, { generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.8, maxOutputTokens: 80 } });
    const m = String(raw).match(/\{[\s\S]*?\}/);
    if (!m) return res.json({ fallback: true, add: suggest || (top && top.key) || 'spring', why: 'no JSON' });
    const j = JSON.parse(m[0]);
    res.json({ add: String(j.add || '').toLowerCase().trim() || 'spring', why: String(j.why || '').slice(0, 100) });
  } catch (e) { res.json({ fallback: true, add: (req.body && req.body.suggest) || 'spring', why: String(e).slice(0, 90) }); }
});

app.get('/api/config', (_req, res) => {
  res.json({
    model: MODEL,
    admin_required: Boolean(ADMIN_TOKEN),
    gemini: geminiConfigured(),
    gemini_public: GEMINI_PUBLIC,
  });
});

// ── Gemini "ability": optional, gated image generation + analysis ──────
// Allowed if GEMINI_PUBLIC is on, otherwise requires the admin token.
function geminiAllowed(req) {
  if (GEMINI_PUBLIC) return true;
  if (!ADMIN_TOKEN) return false;
  const provided = req.get('x-admin-token') || req.query.token || req.body?.admin_token;
  return provided === ADMIN_TOKEN;
}

// Crude in-memory per-IP rate limit, only enforced in public mode, to bound cost.
const _hits = new Map();
function rateOk(ip, max = 8, windowMs = 3600_000) {
  const now = Date.now();
  const arr = (_hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    _hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  _hits.set(ip, arr);
  return true;
}
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

app.post('/api/image/generate', async (req, res) => {
  if (!geminiConfigured()) return res.status(501).json({ error: 'Gemini not configured on this server' });
  if (!geminiAllowed(req)) return res.status(403).json({ error: 'forbidden' });
  if (GEMINI_PUBLIC && !rateOk(clientIp(req))) return res.status(429).json({ error: 'rate limited — try again later' });
  const prompt = String(req.body?.prompt || '').slice(0, 1000).trim();
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  try {
    const { mimeType, base64 } = await generateImage(prompt);
    res.json({ mimeType, data: base64 });
  } catch (err) {
    console.error('image generate failed', err);
    res.status(502).json({ error: err?.message || 'image generation failed' });
  }
});

app.post('/api/image/analyze', async (req, res) => {
  if (!geminiConfigured()) return res.status(501).json({ error: 'Gemini not configured on this server' });
  if (!geminiAllowed(req)) return res.status(403).json({ error: 'forbidden' });
  if (GEMINI_PUBLIC && !rateOk(clientIp(req))) return res.status(429).json({ error: 'rate limited — try again later' });
  const image = typeof req.body?.image === 'string' ? req.body.image : '';
  if (!image) return res.status(400).json({ error: 'image (base64) required' });
  const prompt = String(req.body?.prompt || 'Describe this image in detail.').slice(0, 1000);
  try {
    const text = await analyzeImage({ base64: image, mimeType: req.body?.mime || 'image/png', prompt });
    res.json({ text });
  } catch (err) {
    console.error('image analyze failed', err);
    res.status(502).json({ error: err?.message || 'image analysis failed' });
  }
});

app.get('/api/knowledge', async (_req, res) => {
  try {
    res.json(await loadKnowledge());
  } catch (err) {
    console.error('knowledge load failed', err);
    res.status(500).json({ error: 'failed to load knowledge' });
  }
});

app.post('/api/knowledge', async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const brain = typeof req.body?.brain === 'string' ? req.body.brain : '';
  try {
    res.json(await saveKnowledge(brain));
  } catch (err) {
    console.error('knowledge save failed', err);
    res.status(500).json({ error: 'failed to save knowledge' });
  }
});

// ── Design notes: the live feedback channel ────────────────────────────
// Players (and the designer) drop a note pinned to a level position + frame
// while playing; notes persist to the volume-backed store so Claude can read
// and act on them. GET returns all notes; POST appends one; DELETE clears.
app.get('/api/notes', async (_req, res) => {
  try {
    const notes = await store.get('design_notes', []);
    res.json({ notes });
  } catch (err) {
    console.error('notes load failed', err);
    res.status(500).json({ error: 'failed to load notes' });
  }
});

app.post('/api/notes', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 1000).trim() : '';
  if (!text) return res.status(400).json({ error: 'text required' });
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    kind: typeof req.body?.kind === 'string' ? req.body.kind.slice(0, 30) : 'note',
    x: Number(req.body?.x) || null,
    y: Number(req.body?.y) || null,
    tileC: Number(req.body?.tileC) || null,
    level: req.body?.level != null ? Number(req.body.level) : null,   // world/level id
    scene: typeof req.body?.scene === 'string' ? req.body.scene.slice(0, 40) : null,
    shot: typeof req.body?.shot === 'string' && req.body.shot.length < 400000 ? req.body.shot : null,
    created_at: new Date().toISOString(),
    status: 'open',
  };
  try {
    const notes = await store.get('design_notes', []);
    notes.push(note);
    await store.set('design_notes', notes);
    res.json({ ok: true, id: note.id, count: notes.length });
  } catch (err) {
    console.error('note save failed', err);
    res.status(500).json({ error: 'failed to save note' });
  }
});

app.delete('/api/notes', async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    await store.set('design_notes', []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'failed to clear notes' });
  }
});

// ── Build diary: the level-design log Claude keeps while building (read-only) ──
// Surfaced in /diary.html alongside the live player notes.
app.get('/api/diary', async (_req, res) => {
  try {
    const fs = await import('node:fs/promises');
    const md = await fs.readFile(path.join(__dirname, 'DIARY.md'), 'utf8').catch(() => '# Build diary\n\n_(empty)_');
    res.type('text/markdown').send(md);
  } catch (err) {
    res.status(500).json({ error: 'failed to load diary' });
  }
});

app.post('/api/chat', async (req, res) => {
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const cleaned = incoming
    .slice(-20)
    .filter(
      (m) =>
        (m?.role === 'user' || m?.role === 'assistant') &&
        typeof m?.content === 'string' &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (cleaned.length === 0 || cleaned[0].role !== 'user') {
    return res.status(400).json({ error: 'first message must be a non-empty user message' });
  }

  let knowledge = { brain: '', updated_at: null };
  try {
    knowledge = await loadKnowledge();
  } catch (err) {
    console.error('knowledge load failed during chat (continuing without)', err);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  req.on('close', () => {
    aborted = true;
  });

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      output_config: { effort: 'medium' },
      system: [
        {
          type: 'text',
          text: buildSystem(knowledge),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: cleaned,
    });

    for await (const event of stream) {
      if (aborted) break;
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send('delta', { text: event.delta.text });
      }
    }

    if (!aborted) {
      const final = await stream.finalMessage();
      send('done', { stop_reason: final.stop_reason, usage: final.usage });
    }
  } catch (err) {
    console.error('chat error', err);
    send('error', { message: err?.message || 'chat failed' });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`the-platformer — listening on :${PORT}`);
  console.log(`  model:           ${MODEL}`);
  console.log(`  data dir:        ${store.DATA_DIR}`);
  console.log(`  store file:      ${store.STORE_PATH}`);
  console.log(`  admin gated:     ${ADMIN_TOKEN ? 'yes' : 'no (set ADMIN_TOKEN to enable)'}`);
  console.log(`  gemini:          ${geminiConfigured() ? (GEMINI_PUBLIC ? 'on (public)' : 'on (admin-gated)') : 'off'}`);
});
