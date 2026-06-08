// ── YouTube uploader (unlisted) ────────────────────────────────────────
// Uploads tools/eval/video/playthrough.mp4 to YouTube as UNLISTED.
//
// IMPORTANT: YouTube uploads require OAUTH USER CONSENT — a service account
// (GEMINI_SA_JSON) CANNOT upload to a personal channel. One-time setup:
//
//   1. Google Cloud Console → enable "YouTube Data API v3".
//   2. Create an OAuth 2.0 Client ID (type: Desktop app). Note client id+secret.
//   3. Get a refresh token for your channel (scope youtube.upload), e.g. via
//      the OAuth Playground (developers.google.com/oauthplayground, gear → use
//      your own client id/secret → authorize YouTube Data API v3 → exchange).
//   Then set in the environment:
//      YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
//
// Usage:
//   node tools/youtube-upload.mjs [path-to-mp4] [--title "..."] [--privacy unlisted]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--')) || path.join(HERE, 'eval', 'video', 'playthrough.mp4');
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const TITLE = opt('title', 'the-platformer — AI playthrough');
const PRIVACY = opt('privacy', 'unlisted');
const DESC = opt('desc', 'An AI agent plays one level of the-platformer (built with Phaser, deployed on Railway). Recorded by the autopilot game-driver. https://github.com/agadabanka/the-platformer');
// --playlist "Name" (or default name); set "" / --no-playlist to skip.
const PLAYLIST = argv.includes('--no-playlist') ? '' : opt('playlist', 'the-platformer — AI playthroughs');
const PLAYLIST_DESC = 'AI-agent playthroughs of the-platformer, a Phaser browser game built with Claude. https://github.com/agadabanka/the-platformer';

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, YT_ACCESS_TOKEN } = process.env;
// Two ways to authenticate:
//  (a) durable: client id + secret + refresh token → auto-mints access tokens
//  (b) quick:   a YT_ACCESS_TOKEN directly (valid ~1h) — no secret needed
const haveRefresh = YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN;
if (!haveRefresh && !YT_ACCESS_TOKEN) {
  console.error('Set either YT_ACCESS_TOKEN (quick, ~1h) OR YT_CLIENT_ID+YT_CLIENT_SECRET+YT_REFRESH_TOKEN (durable).');
  process.exit(2);
}
if (!fs.existsSync(file)) { console.error('video not found:', file); process.exit(1); }

// 1) get an access token — refresh if we have the durable creds, else use the
//    directly-provided short-lived token.
async function accessToken() {
  if (!haveRefresh) return YT_ACCESS_TOKEN;
  const body = new URLSearchParams({
    client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
    refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json();
  if (!j.access_token) throw new Error('token refresh failed: ' + JSON.stringify(j));
  return j.access_token;
}

// 2) resumable upload session
async function start(token, size) {
  const meta = { snippet: { title: TITLE, description: DESC, categoryId: '20' }, status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false } };
  const r = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(meta),
  });
  if (!r.ok) throw new Error('start failed: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const loc = r.headers.get('location');
  if (!loc) throw new Error('no upload URL returned');
  return loc;
}

// 3) PUT the bytes
async function put(url, token, buf) {
  const r = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4', 'Content-Length': String(buf.length) }, body: buf });
  const j = await r.json();
  if (!r.ok) throw new Error('upload failed: ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j;
}

// 4) playlist helpers (need the broader `youtube` scope, not just .upload).
//    Find a playlist by title or create it, then add the video. Best-effort:
//    on a scope error we just print guidance and keep the upload as a success.
async function findOrCreatePlaylist(token, title) {
  let pageToken = '';
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error?.message || 'playlist list failed'), { code: r.status });
    const hit = (j.items || []).find((p) => p.snippet?.title === title);
    if (hit) return hit.id;
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  const cr = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet: { title, description: PLAYLIST_DESC }, status: { privacyStatus: PRIVACY } }),
  });
  const cj = await cr.json();
  if (!cr.ok) throw Object.assign(new Error(cj.error?.message || 'playlist create failed'), { code: cr.status });
  return cj.id;
}
async function addToPlaylist(token, playlistId, videoId) {
  const r = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error?.message || 'add-to-playlist failed'), { code: r.status });
  return j;
}

const buf = fs.readFileSync(file);
console.log(`uploading ${file} (${(buf.length / 1024 / 1024).toFixed(1)} MB) as ${PRIVACY}…`);
const token = await accessToken();
const url = await start(token, buf.length);
const vid = await put(url, token, buf);
console.log('✓ uploaded:', `https://youtu.be/${vid.id}`, `(privacy: ${vid.status?.privacyStatus})`);
console.log('  title:', vid.snippet?.title);

// add to the playlist if requested
if (PLAYLIST) {
  try {
    const pid = process.env.YT_PLAYLIST_ID || await findOrCreatePlaylist(token, PLAYLIST);
    await addToPlaylist(token, pid, vid.id);
    console.log('✓ playlist:', `https://www.youtube.com/playlist?list=${pid}`);
  } catch (e) {
    if (e.code === 403) {
      console.log('! playlist skipped: token lacks the `youtube` scope (you used `youtube.upload`).');
      console.log('  Re-authorize selecting https://www.googleapis.com/auth/youtube to enable playlists.');
    } else {
      console.log('! playlist error:', e.message);
    }
  }
}

