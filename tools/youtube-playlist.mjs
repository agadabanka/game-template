// ── YouTube playlist tool ───────────────────────────────────────────────
// Create (or reuse) an unlisted playlist and add one or more existing video
// IDs to it. Needs the broader `youtube` scope (not just youtube.upload).
//
// Auth: durable refresh-token path (auto-mints access tokens):
//   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN   (env)
//
// Usage:
//   node tools/youtube-playlist.mjs <videoId> [<videoId>...] \
//        [--title "..."] [--privacy unlisted]
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const videoIds = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true)
  .filter((a) => !['--title', '--privacy'].includes(a));
// simpler: positional args are video ids (flags consume their own value)
const ids = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { i++; continue; }
  ids.push(argv[i]);
}
const TITLE = opt('title', 'the-platformer — AI playthroughs');
const PRIVACY = opt('privacy', 'unlisted');
const DESC = 'AI-agent playthroughs of the-platformer, a Phaser browser game built with Claude. https://github.com/agadabanka/the-platformer';

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, YT_ACCESS_TOKEN } = process.env;
const haveRefresh = YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN;
if (!haveRefresh && !YT_ACCESS_TOKEN) {
  console.error('Set YT_ACCESS_TOKEN (quick) OR YT_CLIENT_ID+SECRET+REFRESH_TOKEN (durable).'); process.exit(2);
}
if (!ids.length) { console.error('Pass at least one video id.'); process.exit(2); }

async function accessToken() {
  if (!haveRefresh) return YT_ACCESS_TOKEN;
  const body = new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json();
  if (!j.access_token) throw new Error('token refresh failed: ' + JSON.stringify(j));
  return j.access_token;
}
async function findOrCreate(token, title) {
  let pageToken = '';
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error?.message || 'list failed'), { code: r.status });
    const hit = (j.items || []).find((p) => p.snippet?.title === title);
    if (hit) return { id: hit.id, created: false };
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  const cr = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet: { title, description: DESC }, status: { privacyStatus: PRIVACY } }),
  });
  const cj = await cr.json();
  if (!cr.ok) throw Object.assign(new Error(cj.error?.message || 'create failed'), { code: cr.status });
  return { id: cj.id, created: true };
}
async function add(token, playlistId, videoId) {
  const r = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error?.message || 'add failed'), { code: r.status });
  return j;
}

const token = await accessToken();
const { id: playlistId, created } = await findOrCreate(token, TITLE);
console.log(`playlist ${created ? 'created' : 'reused'}: ${TITLE}`);
for (const vid of ids) {
  try { await add(token, playlistId, vid); console.log(`  + added ${vid}`); }
  catch (e) { console.log(`  ! ${vid}: ${e.message}`); }
}
console.log('\nplaylist: https://www.youtube.com/playlist?list=' + playlistId);
