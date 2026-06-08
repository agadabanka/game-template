// Read (and optionally clear) the design notes players/designer left in-game.
// Claude runs this to pull the live feedback queue.
//   node tools/notes.mjs                      # from local server ($PORT or 3000)
//   BASE=https://<railway-domain> node tools/notes.mjs   # from production
//   node tools/notes.mjs --save-shots         # also write pinned screenshots to tools/eval/notes/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || `http://127.0.0.1:${process.env.PORT || 3000}`;
const SAVE = process.argv.includes('--save-shots');
const OUT = path.join(HERE, 'eval', 'notes');

const res = await fetch(`${BASE}/api/notes`).catch((e) => { console.error('fetch failed:', e.message); process.exit(1); });
const { notes } = await res.json();
if (!notes || !notes.length) { console.log('No design notes yet. (Press N in-game to leave one.)'); process.exit(0); }

console.log(`=== ${notes.length} design note(s) from ${BASE} ===\n`);
if (SAVE) fs.mkdirSync(OUT, { recursive: true });
for (const n of notes) {
  const where = n.scene === 'Play' && n.x != null ? `@ x=${n.x} (tile ${n.tileC})` : (n.scene || '');
  const tag = n.kind === 'video_request' ? '🎬 VIDEO REQUEST' : (n.status || 'open');
  console.log(`[${tag}] ${n.created_at}  ${where}`);
  console.log(`  "${n.text}"`);
  if (n.kind === 'video_request') console.log('  → action: run `node tools/eval/record.mjs` and show the video.');
  if (SAVE && n.shot) {
    const f = path.join(OUT, `note_${n.id}.jpg`);
    fs.writeFileSync(f, Buffer.from(n.shot.split(',')[1], 'base64'));
    console.log(`  shot -> ${f}`);
  }
  console.log('');
}
