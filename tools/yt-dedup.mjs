// Remove duplicate videos from a playlist, keeping the first occurrence of each.
// Env: YT_CLIENT_ID/SECRET/REFRESH_TOKEN (or YT_ACCESS_TOKEN).  Arg: playlistId
const argv = process.argv.slice(2);
const playlistId = argv[0];
if (!playlistId) { console.error('usage: node yt-dedup.mjs <playlistId>'); process.exit(2); }
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, YT_ACCESS_TOKEN } = process.env;
const haveRefresh = YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN;

async function token() {
  if (!haveRefresh) return YT_ACCESS_TOKEN;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!j.access_token) throw new Error(JSON.stringify(j)); return j.access_token;
}
const t = await token();
const H = { Authorization: `Bearer ${t}` };

// list all items
let items = [], pageToken = '';
do {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: H });
  const j = await r.json();
  if (!r.ok) { console.error('list failed', JSON.stringify(j)); process.exit(1); }
  items.push(...(j.items || []));
  pageToken = j.nextPageToken || '';
} while (pageToken);

console.log(`playlist has ${items.length} item(s)`);
const seen = new Set();
let removed = 0;
for (const it of items) {
  const vid = it.snippet?.resourceId?.videoId;
  const title = it.snippet?.title || '';
  if (seen.has(vid)) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?id=${it.id}`, { method: 'DELETE', headers: H });
    console.log(`  removed dup ${vid} (${title.slice(0, 40)}) -> ${r.status}`);
    removed++;
  } else {
    seen.add(vid);
    console.log(`  keep ${vid} (${title.slice(0, 40)})`);
  }
}
console.log(`\ndone: ${seen.size} unique kept, ${removed} duplicate(s) removed.`);
console.log('playlist: https://www.youtube.com/playlist?list=' + playlistId);
