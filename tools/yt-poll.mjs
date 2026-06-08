// Poll an existing device_code for approval and save the refresh token.
// Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_DEVICE_CODE
import fs from 'node:fs';
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_DEVICE_CODE } = process.env;
const deadline = Date.now() + 1600 * 1000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 6000));
  const t = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
      device_code: YT_DEVICE_CODE, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  }).then((r) => r.json());
  if (t.refresh_token) {
    fs.writeFileSync('/tmp/yt_refresh.txt', t.refresh_token);
    console.log('GOT_REFRESH_TOKEN (saved /tmp/yt_refresh.txt)');
    process.exit(0);
  }
  if (t.error && !['authorization_pending', 'slow_down'].includes(t.error)) {
    console.log('ERR:' + t.error + ' ' + (t.error_description || ''));
    process.exit(1);
  }
  process.stdout.write('.');
}
console.log('TIMEOUT');
process.exit(1);
