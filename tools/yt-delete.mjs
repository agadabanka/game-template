// Delete videos by id (also removes them from any playlist). Used to replace the
// old SILENT playthroughs with the new with-sound versions.
// Usage: node tools/yt-delete.mjs <videoId> [<videoId>...]
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
async function token() {
  const body = new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json(); if (!j.access_token) throw new Error('refresh failed: ' + JSON.stringify(j));
  return j.access_token;
}
const t = await token();
for (const id of process.argv.slice(2)) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
  if (r.status === 204) console.log(`✓ deleted ${id}`);
  else console.log(`! ${id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}
