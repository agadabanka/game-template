// ── One-time YouTube auth — DEVICE FLOW (the easy way, no redirect URIs) ──
// You visit one URL, type a short code, approve. I poll and capture a DURABLE
// refresh token bound to YOUR client. No OAuth Playground, no redirect config.
//
// Run:  YT_CLIENT_ID=... YT_CLIENT_SECRET=... node tools/youtube-auth.mjs
//
// (If the client is a "Web"/"Desktop" type and device-code is rejected, create
//  a "TVs and Limited Input devices" OAuth client in Cloud Console and use that
//  id/secret here — that client type is purpose-built for this flow.)
const { YT_CLIENT_ID, YT_CLIENT_SECRET } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) { console.error('Set YT_CLIENT_ID, YT_CLIENT_SECRET.'); process.exit(2); }
const SCOPE = 'https://www.googleapis.com/auth/youtube';

// 1) request a device + user code
const dc = await fetch('https://oauth2.googleapis.com/device/code', {
  method: 'POST', body: new URLSearchParams({ client_id: YT_CLIENT_ID, scope: SCOPE }),
}).then((r) => r.json());
if (!dc.device_code) { console.log('device-code request failed:', JSON.stringify(dc)); process.exit(1); }

console.log('\n=== EASY SIGN-IN ===');
console.log('1) On any device, open:  ' + (dc.verification_url || dc.verification_uri));
console.log('2) Enter this code:      ' + dc.user_code);
console.log('3) Approve as your @amith2vincarta channel.\n');
console.log('Waiting for approval (up to ' + Math.round((dc.expires_in || 1800) / 60) + ' min)...');

// 2) poll for the token
const interval = (dc.interval || 5) * 1000;
const deadline = Date.now() + (dc.expires_in || 1800) * 1000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, interval));
  const t = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams({
      client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
      device_code: dc.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  }).then((r) => r.json());
  if (t.refresh_token) {
    console.log('\n✓ SUCCESS — durable refresh token (works forever, your client):');
    console.log('\nYT_REFRESH_TOKEN=' + t.refresh_token + '\n');
    console.log('Save that in the environment config (with YT_CLIENT_ID/SECRET) and uploads/playlists are one command from now on.');
    process.exit(0);
  }
  if (t.error && t.error !== 'authorization_pending' && t.error !== 'slow_down') {
    console.log('\n✗ ' + t.error + ': ' + (t.error_description || ''));
    if (t.error === 'invalid_client' || t.error === 'unauthorized_client') {
      console.log('This client type may not support device flow. In Cloud Console create an OAuth client of type "TVs and Limited Input devices" and use its id/secret.');
    }
    process.exit(1);
  }
  process.stdout.write('.');
}
console.log('\n timed out — re-run to try again.');
