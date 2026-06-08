// List my channel's recent uploads + the contents of given playlists, so we can
// see what to keep/replace. Usage: node tools/yt-list.mjs [playlistId ...]
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
async function token() {
  const body = new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json(); if (!j.access_token) throw new Error('refresh failed: ' + JSON.stringify(j));
  return j.access_token;
}
const t = await token();
const H = { Authorization: `Bearer ${t}` };
// my recent uploads (search by mine)
const sr = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=25&order=date', { headers: H });
const sj = await sr.json();
console.log('=== MY RECENT UPLOADS ===');
if (sj.error) console.log('  error:', sj.error.message);
for (const it of sj.items || []) console.log(`  ${it.id?.videoId}  ${it.snippet?.title}`);
// playlists passed as args
for (const pid of process.argv.slice(2)) {
  console.log(`\n=== PLAYLIST ${pid} ===`);
  let pageToken = '';
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${pid}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: H });
    const j = await r.json();
    if (j.error) { console.log('  error:', j.error.message); break; }
    for (const it of j.items || []) console.log(`  item=${it.id}  vid=${it.snippet.resourceId?.videoId}  ${it.snippet.title}`);
    pageToken = j.nextPageToken || '';
  } while (pageToken);
}
