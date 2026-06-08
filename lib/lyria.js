// ── Lyria (Vertex AI) music generation ───────────────────────────────────
// Generates instrumental music from a text prompt with Google's Lyria model
// (`lyria-002` on Vertex AI), returning WAV bytes. Auth reuses the same service
// account as Gemini (GEMINI_SA_JSON / GOOGLE_APPLICATION_CREDENTIALS) but mints a
// cloud-platform-scoped token, since Lyria lives on aiplatform.googleapis.com.
//
//   import { generateMusic } from './lib/lyria.js';
//   const { base64 } = await generateMusic('a calm orchestral piece', { seed: 1 });
//
// NOTE: the model must be ENABLED for your GCP project. If Lyria isn't allow-listed
// it resolves but soft-denies every prompt ("This prompt is not supported"); request
// Lyria access for the project, then scripts/gen-music.mjs will produce real tracks.
import { GoogleAuth } from 'google-auth-library';

const REGION = process.env.LYRIA_REGION || 'us-central1';
const MODEL = process.env.LYRIA_MODEL || 'lyria-002';

function saJson() {
  if (process.env.GEMINI_SA_JSON) return JSON.parse(process.env.GEMINI_SA_JSON);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // eslint-disable-next-line global-require
    return JSON.parse(require('node:fs').readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  }
  throw new Error('Set GEMINI_SA_JSON or GOOGLE_APPLICATION_CREDENTIALS (a Vertex-capable service account).');
}

let _client = null;
async function token() {
  if (!_client) {
    _client = await new GoogleAuth({ credentials: saJson(), scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  }
  const { token: t } = await _client.getAccessToken();
  return t;
}

export function lyriaConfigured() { try { saJson(); return true; } catch { return false; } }

export async function generateMusic(prompt, { negativePrompt, seed, sampleCount = 1 } = {}) {
  const project = saJson().project_id;
  const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${project}/locations/${REGION}/publishers/google/models/${MODEL}:predict`;
  const inst = { prompt };
  if (negativePrompt) inst.negative_prompt = negativePrompt;
  if (seed != null) inst.seed = seed;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [inst], parameters: { sample_count: sampleCount } }),
  });
  if (!r.ok) throw new Error(`Lyria ${r.status}: ${(await r.text()).slice(0, 240)}`);
  const j = await r.json();
  const p = j?.predictions?.[0];
  const base64 = p?.bytesBase64Encoded || p?.audioContent;
  if (!base64) throw new Error('No audio in Lyria response: ' + JSON.stringify(j).slice(0, 200));
  return { mimeType: p.mimeType || 'audio/wav', base64 };
}
