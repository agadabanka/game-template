// ── DESIGN LENS — AI-first level editor + design-evolution player ─────────
// Two modes:
//  • SNAPSHOT — shows a level's real Gemini-scored feel snapshot (read-only).
//  • EVOLVE   — seeds a deliberately rough level, then iterates: a Gemini design
//    critic picks the highest-impact edit, we apply it to an in-memory level, the
//    PREDICTED feel model (feelmodel.js) re-scores instantly, and the lens animates.
//    ?evolve=1[&level=N][&steps=K] auto-runs it (for recording).
import { LEVELS, buildLevelById } from './game/levels.js';
import { biomeOf, HAZARDS } from './game/themes.js';
import { predict, collectBeats } from './game/feelmodel.js';
import { applyOp } from './game/evolve.js';
import { coinReach } from './game/reach.js';

const WEIGHTS = { engagement: 0.35, dynamics: 0.15, arc: 0.25, flow: 0.25 };
const COMPC = { engagement: '#7dff5a', dynamics: '#ffcf45', arc: '#8fd0ff', flow: '#c9a8ff' };
const STEPS = ['INTRODUCE', 'DEVELOP', 'TWIST', 'RESOLVE'];
const idealAt = (t) => 4 + 4 * t + 2.2 * Math.exp(-(((t - 0.84) / 0.11) ** 2));
const hex = (n) => '#' + (n >>> 0 & 0xffffff).toString(16).padStart(6, '0');
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qp = new URLSearchParams(location.search);

let CAPTION = '', GHOST = null;                  // on-canvas caption + a just-placed glyph to flash
window.__lens = { evolving: false, step: 0, done: false, fun: 0 };

const sel = $('lvl');
LEVELS.forEach((l) => { const o = document.createElement('option'); o.value = l.id; o.textContent = `Level ${l.id} · ${l.name}`; sel.appendChild(o); });
sel.onchange = () => loadSnapshot(+sel.value);

// ── SNAPSHOT mode (real Gemini feel) ──────────────────────────────────────
let loadedLevel = null, loadedFeel = null, workLevel = null, editMode = false, editTool = 'spring';
async function loadSnapshot(id) {
  const level = buildLevelById(id);
  let feel = null;
  try { feel = await (await fetch(`/api/feel/${id}`)).json(); } catch (e) { feel = { missing: true }; }
  CAPTION = ''; GHOST = null;
  loadedLevel = level; loadedFeel = feel; editMode = false; setEditUI();
  paint(level, feel, 'GEMINI-SCORED SNAPSHOT');
}

// normalize either a real snapshot or a predicted result into one render shape
function asView(feel) {
  if (feel && feel.components && feel.curve) return feel;       // real snapshot already shaped
  return feel;
}

function paint(level, feel, mode) {
  renderScore(feel, mode);
  const pins = renderFixes(feel, level);
  renderDiag(feel, mode);
  draw(level, feel, pins);
  window.__lens.fun = (feel && (feel.fun_score_0_100 ?? feel.fun)) || 0;
}

// ── EVOLVE mode ────────────────────────────────────────────────────────────
const GT = (L) => L.groundTop;
function cloneLevel(L) { return JSON.parse(JSON.stringify(L)); }

// strip a level down to a rough seed: flat-ish ground, a couple coins, ONE early
// enemy → an early peak, lots of dead air, a low score to climb from.
function seedRough(id) {
  const L = cloneLevel(buildLevelById(id));
  ['springs', 'spouts', 'droppers', 'crumbles', 'dashpads', 'bouncers', 'conveyors',
    'firebars', 'movers', 'zones', 'stickies', 'ices', 'oneways', 'piranhas'].forEach((k) => { L[k] = []; });
  L.enemies = [{ c: Math.round(L.W * 0.12), r: GT(L) - 1, kind: 'goomba' }];   // one early threat
  L.coins = (L.coins || []).filter((_, i) => i % 5 === 0).slice(0, 8);          // a few stray coins
  L.qblocks = (L.qblocks || []).slice(0, 1);
  return L;
}

// predicted score → the render shape (so the lens draws it like a snapshot)
function predictView(L, extra = {}) {
  const p = predict(L);
  return {
    name: L.name, level: L.id, windows: p.n, fun_score_0_100: p.fun, components: p.components,
    curve: p.curve, deadAir: p.deadAir, peakPosition: p.peakPos, distinctVerbs: new Set(collectBeats(L).map((b) => b.type)).size,
    diagnosis: diagnose(p), verdict: extra.verdict || '', fixes: extra.fixes || [], _pred: p,
  };
}
function diagnose(p) {
  const c = p.components;
  if (c.flow < 0.6 && p.deadAir.length) return `FLOW — dead air at ${p.deadAir.slice(0, 3).join(', ')}: drop a beat into the flat run.`;
  if (c.arc < 0.5) return p.peakPos < 0.6 ? `ARC — peak too early (${Math.round(p.peakPos * 100)}%): push the climax late.` : `ARC — shape off-ideal: hook earlier, climax ~84%.`;
  if (c.engagement < 0.6) return `ENGAGEMENT — add a structural verb (spring/mover/spout), not coins.`;
  if (c.dynamics < 0.5) return `DYNAMICS — flat texture: add contrast (a strong beat next to a rest).`;
  return `BALANCED — strong shape; polish only.`;
}

// apply one edit to the in-memory level
function applyEdit(L, x, add) {
  const gt = GT(L); x = Math.max(2, Math.min(L.W - 4, Math.round(x)));
  const span = (n, f) => { for (let i = 0; i < n; i++) f(x + i); };
  switch (add) {
    case 'spring': L.springs.push({ c: x, r: gt - 1 }); [9, 7, 5].forEach((r) => L.coins.push({ c: x, r })); break;
    case 'spout': L.spouts.push({ c: x, r: gt - 1, phase: 0 }); break;
    case 'dropper': L.droppers.push({ c: x, phase: 0 }); break;
    case 'crumble': span(3, (c) => L.crumbles.push({ c, r: gt })); break;
    case 'dashpad': span(4, (c) => L.dashpads.push({ c, r: gt, dir: 1 })); break;
    case 'bounce': span(4, (c) => L.bouncers.push({ c, r: gt })); break;
    case 'conveyor': span(6, (c) => L.conveyors.push({ c, r: gt, dir: 1 })); break;
    case 'ice': span(6, (c) => L.ices.push({ c, r: gt })); break;
    case 'sticky': span(6, (c) => L.stickies.push({ c, r: gt })); break;
    case 'walker': L.enemies.push({ c: x, r: gt - 1, kind: 'goomba' }); break;
    case 'flyer': L.enemies.push({ c: x, r: 8, kind: 'bat', fly: true }); break;
    case 'mover': L.movers.push({ c0: x, r0: gt, dir: 'h', to: x + 5, w: 3, speed: 70 }); break;
    case 'qblock': L.qblocks.push({ c: x, r: gt - 4, power: false }); L.coins.push({ c: x, r: gt - 6 }); break;
    case 'firebar': L.firebars.push({ c: x, len: 2, up: 6, phase: 0 }); break;
    case 'wind': L.zones.push({ type: 'wind', c0: x, c1: x + 8, r0: gt - 7, r1: gt - 1, dir: 1 }); break;
    case 'updraft': L.zones.push({ type: 'updraft', c0: x, c1: x + 5, r0: gt - 7, r1: gt - 1 }); break;
    case 'coins': span(4, (c) => L.coins.push({ c, r: gt - 3 })); break;
    case 'gap': L.solids = L.solids.filter((s) => !(s.c >= x && s.c <= x + 2)); (L.gaps ||= []).push([x, x + 2]); break;
    default: L.coins.push({ c: x, r: gt - 3 }); add = 'coins'; break;
  }
  return add;
}

// deterministic fallback when Gemini is unavailable: target the worst dead window,
// else push a strong late beat; vary the verb so it doesn't repeat.
const VARIETY = ['spring', 'spout', 'dropper', 'crumble', 'dashpad', 'mover', 'bounce', 'conveyor', 'firebar', 'walker', 'ice', 'updraft'];
function chooseFallback(L, p, used) {
  const W = L.W, n = p.n;
  const pick = VARIETY.find((v) => !used.has(v)) || VARIETY[used.size % VARIETY.length];
  if (p.deadIdx.length) {                                  // fill the deepest dead window
    const wi = p.deadIdx.sort((a, b) => p.curve[a] - p.curve[b])[0];
    return { x: Math.round((wi + 0.5) * W / n), add: pick, why: `fill dead air at window ${wi}` };
  }
  if (p.peakPos < 0.7) return { x: Math.round(W * 0.86), add: 'spring', why: 'push the climax into the last quarter' };
  return { x: Math.round(W * (0.3 + Math.random() * 0.4)), add: pick, why: 'add contrast / variety' };
}

async function geminiCritique(L, p, step) {
  try {
    const body = { name: L.name, theme: L.theme, W: L.W, curve: p.curve, components: p.components,
      deadAir: p.deadAir, beats: collectBeats(L), step };
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 14000);   // don't let one slow call stall the video
    const r = await fetch('/api/design/critique', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
    clearTimeout(to);
    const j = await r.json();
    if (j && !j.fallback && j.add) return j;
  } catch (e) { /* fall through */ }
  return null;
}

// count the FUN number up to a target while we hold the frame
async function countTo(target) {
  const el = $('fun'), from = window.__lens.fun || 0;
  for (let i = 0; i <= 10; i++) { const v = (from + (target - from) * i / 10); el.innerHTML = `${v.toFixed(1)}<span>/100</span>`; await sleep(28); }
  window.__lens.fun = target;
}

async function runEvolution(id, steps) {
  let L = seedRough(id);
  window.__lens = { evolving: true, step: 0, done: false, fun: 0 };
  const used = new Set();
  // initial rough state
  CAPTION = 'SEED — a rough first pass: flat, one early threat, lots of dead air.';
  let view = predictView(L, { verdict: 'Starting from a deliberately rough seed. Watch the Gemini critic place beats, fix dead air, and shape the climax.' });
  paint(buildLevel(L), view, 'EVOLVING · LIVE PREDICTED MODEL');
  appendLog(`SEED · FUN ${view.fun_score_0_100}`, '#8b93a7');
  await sleep(3200);

  for (let s = 1; s <= steps; s++) {
    window.__lens.step = s;
    const p = predict(L);
    CAPTION = `Step ${s}/${steps} · Gemini is studying the curve…`;
    paint(buildLevel(L), predictView(L), 'EVOLVING · GEMINI IS CRITIQUING…');
    await sleep(1500);
    let move = await geminiCritique(L, p, s);
    const viaG = !!move;
    if (!move) move = chooseFallback(L, p, used);
    const applied = applyEdit(L, move.x, move.add);
    used.add(applied);
    GHOST = { x: move.x, add: applied };
    const before = p.fun;
    view = predictView(L, { verdict: `${viaG ? 'Gemini' : 'Heuristic'} placed a ${applied} at tile ${Math.round(move.x)}. ${move.why || ''}` });
    CAPTION = `${viaG ? '✦ GEMINI' : '◦ heuristic'}: +${applied} @ x${Math.round(move.x)} — ${move.why || ''}`;
    paint(buildLevel(L), view, 'EVOLVING · LIVE PREDICTED MODEL');
    await countTo(view.fun_score_0_100);
    const d = (view.fun_score_0_100 - before);
    appendLog(`${s}. +${applied} @x${Math.round(move.x)} · FUN ${view.fun_score_0_100} (${d >= 0 ? '+' : ''}${d.toFixed(1)})  ${move.why || ''}`, viaG ? '#7dff5a' : '#8fd0ff');
    await sleep(900); GHOST = null; paint(buildLevel(L), view, 'EVOLVING · LIVE PREDICTED MODEL');
    await sleep(2600);
  }
  CAPTION = `DONE — ${steps} edits. FUN ${window.__lens.fun.toFixed(1)}/100. The curve now hooks early, varies, and climaxes late.`;
  paint(buildLevel(L), predictView(L, { verdict: CAPTION }), 'EVOLVED · FINAL');
  window.__lens.done = true;
}

// the in-memory level already has all arrays; just ensure render-required fields
function buildLevel(L) { return L; }

// PLAYBACK — animate a precomputed evolution (tools/eval/evolve-compute.mjs) smoothly,
// no live latency. This is what the recorder captures.
function frameView(f, verdict) {
  return { name: f.level.name, level: f.level.id, windows: f.n, fun_score_0_100: f.fun, components: f.components,
    curve: f.curve, deadAir: f.deadAir, peakPosition: f.peakPos, deadIdx: f.deadIdx,
    reach: f.reach, total: f.total, unreach: f.unreach || [],
    diagnosis: diagnose({ components: f.components, deadAir: f.deadAir, peakPos: f.peakPos }),
    verdict: verdict || '', fixes: [] };
}
async function playEvolution() {
  let data = null;
  try { data = await (await fetch(`/api/evolution?level=${+(qp.get('level') || 1)}`)).json(); } catch (e) { data = null; }
  if (!data || data.missing || !data.frames) { return runEvolution(+(qp.get('level') || 1), +(qp.get('steps') || 10)); }
  const F = data.frames;
  window.__lens = { evolving: true, step: 0, done: false, fun: 0 };
  logLines = [];
  // seed
  let f = F[0];
  CAPTION = f.caption; GHOST = null;
  paint(buildLevel(f.level), frameView(f, 'Starting from a deliberately rough seed. Watch the Gemini critic place beats, fix dead air, and shape the climax toward a late peak.'), 'EVOLVING · LIVE PREDICTED MODEL');
  $('fun').innerHTML = `${f.fun}<span>/100</span>`; window.__lens.fun = f.fun;
  appendLog(`SEED · FUN ${f.fun}`, '#8b93a7');
  await sleep(3000);
  for (let i = 1; i < F.length; i++) {
    f = F[i]; window.__lens.step = i;
    const before = F[i - 1].fun, via = f.via === 'gemini';
    // brief "studying" beat
    CAPTION = `Step ${i}/${data.steps} · Gemini studies the curve…`;
    paint(buildLevel(F[i - 1].level), frameView(F[i - 1]), 'EVOLVING · GEMINI IS CRITIQUING…');
    await sleep(1100);
    // reveal the move (ghost) on the prior layout, then the new state
    GHOST = { x: f.move.x, add: f.move.applied };
    CAPTION = f.caption;
    paint(buildLevel(f.level), frameView(f, `${via ? 'Gemini' : 'Heuristic'} placed a ${f.move.applied} at tile ${Math.round(f.move.x)}. ${f.move.why || ''}`), 'EVOLVING · LIVE PREDICTED MODEL');
    await countTo(f.fun);
    const d = f.fun - before;
    appendLog(`${i}. +${f.move.applied} @x${Math.round(f.move.x)} · FUN ${f.fun} (${d >= 0 ? '+' : ''}${d.toFixed(1)})  ${f.move.why || ''}`, via ? '#7dff5a' : '#8fd0ff');
    await sleep(1000); GHOST = null;
    paint(buildLevel(f.level), frameView(f), 'EVOLVING · LIVE PREDICTED MODEL');
    await sleep(1900);
  }
  CAPTION = `DONE — ${data.steps} edits. FUN ${f.fun}/100. The curve now hooks early, varies window-to-window, and climaxes late.`;
  paint(buildLevel(f.level), frameView(f, CAPTION), 'EVOLVED · FINAL');
  window.__lens.done = true;
}

let logLines = [];
function appendLog(txt, col) { logLines.unshift({ txt, col }); logLines = logLines.slice(0, 12);
  $('fixes').innerHTML = logLines.map((l) => `<li><span class="pin" style="background:${l.col}">▸</span><span>${esc(l.txt)}</span></li>`).join(''); }

// MANUAL playback API — the recorder drives the timeline (page timers throttle ~7×
// under headless capture, so we render on command and let the recorder pace + shoot).
let EVO = null;
async function manualInit() {
  const lv = +(qp.get('level') || 1), kind = qp.get('kind') || '';
  let data = null; try { data = await (await fetch(`/api/evolution?level=${lv}&kind=${kind}`)).json(); } catch (e) {}
  if (!data || data.missing || !data.frames) return;
  EVO = data; logLines = []; window.__lens = { evolving: true, step: 0, done: false, fun: 0 };
  const F = EVO.frames;
  const seedV = 'Starting from a deliberately rough seed. Watch the Gemini critic place beats, fix dead air, and shape the climax toward a late peak.';
  window.__evo = {
    ready: true, len: F.length, steps: EVO.steps, funAt: (i) => F[i].fun,
    seed() { CAPTION = F[0].caption; GHOST = null; paint(F[0].level, frameView(F[0], seedV), 'EVOLVING · LIVE PREDICTED MODEL'); evoFun(F[0].fun); appendLog(`SEED · FUN ${F[0].fun}`, '#8b93a7'); },
    study(i) { CAPTION = `Step ${i}/${EVO.steps} · Gemini studies the curve…`; GHOST = null; paint(F[i - 1].level, frameView(F[i - 1]), 'EVOLVING · GEMINI IS CRITIQUING…'); },
    reveal(i) { const f = F[i], via = f.via === 'gemini'; if (!f.move) { GHOST = null; CAPTION = f.caption || ''; paint(f.level, frameView(f, f.caption || ''), 'EVOLVING · LIVE PREDICTED MODEL'); window.__lens.step = i; return; } GHOST = { x: f.move.x, add: f.move.type, op: f.move.op }; CAPTION = f.caption; paint(f.level, frameView(f, `${via ? 'Gemini' : 'Heuristic'}: ${f.move.label} at tile ${Math.round(f.move.x)}. ${f.move.why || ''}`), 'EVOLVING · LIVE PREDICTED MODEL'); const d = f.fun - F[i - 1].fun; appendLog(`${i}. ${f.move.label} @x${Math.round(f.move.x)} · FUN ${f.fun} (${d >= 0 ? '+' : ''}${d.toFixed(1)})  ${f.move.why || ''}`, via ? '#7dff5a' : '#8fd0ff'); window.__lens.step = i; },
    settle(i) { GHOST = null; paint(F[i].level, frameView(F[i]), 'EVOLVING · LIVE PREDICTED MODEL'); },
    fun: (v) => evoFun(v),
    finish() { const f = F[F.length - 1]; CAPTION = `DONE — ${EVO.steps} edits. FUN ${f.fun}/100. Hooks early, varies window-to-window, climaxes late.`; GHOST = null; paint(f.level, frameView(f, CAPTION), 'EVOLVED · FINAL'); evoFun(f.fun); window.__lens.done = true; },
  };
  window.__evo.seed();
}
function evoFun(v) { $('fun').innerHTML = `${Number(v).toFixed(1)}<span>/100</span>`; window.__lens.fun = +v; }

// ── score header + gauges ─────────────────────────────────────────────────
function renderScore(feel, mode) {
  const has = feel && feel.components;
  const fun = has ? (feel.fun_score_0_100 ?? feel.fun) : null;
  if (!window.__lens.evolving) $('fun').innerHTML = has ? `${fun}<span>/100</span>` : `—<span>/100</span>`;
  const c = has ? feel.components : { engagement: 0, dynamics: 0, arc: 0, flow: 0 };
  $('funlabel') && ($('funlabel').textContent = mode || 'FUN SCORE');
  const reachChip = (has && feel.total != null) ? `<span>coins <b style="color:${feel.reach === feel.total ? '#7dff5a' : '#ff6b6b'}">${feel.reach}/${feel.total}</b> reachable</span>` : '';
  $('meta').innerHTML = has
    ? `<span>${mode || ''}</span>${reachChip}<span><b>${feel.windows || (feel.curve || []).length}</b> windows</span><span>peak @ <b>${Math.round((feel.peakPosition || 0) * 100)}%</b></span><span>dead-air <b>${(feel.deadAir || []).length}</b></span>`
    : `<span class="miss">No feel snapshot yet — run <code>feel.mjs</code>.</span>`;
  $('gauges').innerHTML = Object.keys(WEIGHTS).map((k) => {
    const v = c[k] || 0, col = COMPC[k];
    return `<div class="g"><div class="gn" style="color:${col}"><span>${k}</span></div>
      <div class="gv">${v.toFixed(2)}</div><div class="bar"><i style="width:${Math.round(v * 100)}%;background:${col}"></i></div>
      <div class="gw">weight ${WEIGHTS[k]} → +${(v * WEIGHTS[k] * 100).toFixed(1)}</div></div>`;
  }).join('');
  $('formula').textContent = has
    ? `FUN = 100·(0.35·${c.engagement} + 0.15·${c.dynamics} + 0.25·${c.arc} + 0.25·${c.flow}) = ${fun}`
    : `FUN = 100·(0.35·engagement + 0.15·dynamics + 0.25·arc + 0.25·flow)`;
}
function renderFixes(feel, level) {
  if (window.__lens.evolving) return [];                  // in evolve mode the fixes panel is the step log
  const fixes = (feel && feel.fixes) || [];
  const pins = [];
  $('fixes').innerHTML = fixes.length ? fixes.map((f, i) => {
    const m = String(f).match(/x?(\d{1,3})\s*[–-]\s*x?(\d{1,3})|x(\d{1,3})/);
    let c0 = null, c1 = null;
    if (m) { if (m[1]) { c0 = +m[1]; c1 = +m[2]; } else { c0 = +m[3]; c1 = c0; } }
    if (c0 != null) pins.push({ n: i + 1, c0, c1: c1 ?? c0 });
    return `<li><span class="pin">${c0 != null ? '▲' + (i + 1) : '•'}</span><span>${esc(f)}</span></li>`;
  }).join('') : `<li style="border:0;color:var(--dim)">No fixes — balanced, or no snapshot.</li>`;
  return pins;
}
function renderDiag(feel, mode) {
  const d = (feel && feel.diagnosis) || '';
  const tagColor = d.startsWith('FLOW') ? '#c9a8ff' : d.startsWith('ARC') ? '#8fd0ff' : d.startsWith('ENGAGEMENT') ? '#7dff5a' : d.startsWith('DYNAMICS') ? '#ffcf45' : '#9fe8b0';
  const tag = d.split('—')[0].trim() || 'NO DATA';
  $('diag').innerHTML = d ? `<span class="tag" style="background:${tagColor}">${esc(tag)}</span>${esc(d.split('—').slice(1).join('—').trim())}` : '<span class="miss">No diagnosis.</span>';
  $('verdict').textContent = (feel && feel.verdict) || '';
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ── canvas: curve (top) + level map (bottom) on a shared x-axis ────────────
function draw(level, feel, pins) {
  const cv = $('cv'), g = cv.getContext('2d');
  const CW = cv.width, CH = cv.height, PAD = 34;
  const W = level.W, H = level.H, gt = level.groundTop;
  const biome = biomeOf(level.theme);
  const innerW = CW - 2 * PAD;
  const X = (c) => PAD + (c / W) * innerW;
  const tw = innerW / W;
  g.clearRect(0, 0, CW, CH);
  const curveTop = 24, curveBot = 352, mapTop = 470, mapBot = CH - 60;
  const rh = (mapBot - mapTop) / H;

  const dead = (feel && feel.deadAir || []).map((s) => s.split('-').map(Number));
  dead.forEach(([a, b]) => { g.fillStyle = 'rgba(255,107,107,.10)'; g.fillRect(X(a), curveTop, X(b) - X(a), mapBot - curveTop); g.fillStyle = 'rgba(255,107,107,.5)'; g.fillRect(X(a), curveBot - 3, X(b) - X(a), 3); });

  // grid + ideal arc
  g.strokeStyle = '#202840'; g.lineWidth = 1;
  for (let v = 0; v <= 10; v += 2) { const y = curveBot - (v / 10) * (curveBot - curveTop - 10); g.beginPath(); g.moveTo(PAD, y); g.lineTo(CW - PAD, y); g.stroke(); }
  const curve = (feel && feel.curve) || [], n = curve.length;
  const cx = (i) => PAD + (n > 1 ? i / (n - 1) : 0) * innerW;
  const cy = (v) => curveBot - (Math.max(0, Math.min(10, v)) / 10) * (curveBot - curveTop - 10);
  g.setLineDash([7, 7]); g.strokeStyle = '#56607e'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= 60; i++) { const t = i / 60, x = PAD + t * innerW, y = cy(idealAt(t)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.setLineDash([]);
  if (n) {
    const grd = g.createLinearGradient(0, curveTop, 0, curveBot); grd.addColorStop(0, 'rgba(125,255,90,.34)'); grd.addColorStop(1, 'rgba(125,255,90,.02)');
    g.beginPath(); g.moveTo(cx(0), curveBot); curve.forEach((v, i) => g.lineTo(cx(i), cy(v))); g.lineTo(cx(n - 1), curveBot); g.closePath(); g.fillStyle = grd; g.fill();
    g.beginPath(); curve.forEach((v, i) => i ? g.lineTo(cx(i), cy(v)) : g.moveTo(cx(i), cy(v))); g.strokeStyle = '#7dff5a'; g.lineWidth = 3; g.stroke();
    curve.forEach((v, i) => { g.beginPath(); g.arc(cx(i), cy(v), 3.3, 0, 7); g.fillStyle = '#bfffa6'; g.fill(); });
    const pk = curve.indexOf(Math.max(...curve)); star(g, cx(pk), cy(curve[pk]) - 16, 9, '#ffcf45');
    g.fillStyle = '#ffcf45'; g.font = '700 16px Inter'; g.textAlign = 'center'; g.fillText('peak', cx(pk), cy(curve[pk]) - 30);
  }
  g.fillStyle = '#8b93a7'; g.font = "11px 'Press Start 2P'"; g.textAlign = 'left'; g.fillText('INTEREST', PAD + 4, curveTop + 16);
  g.fillStyle = '#56607e'; g.fillText('— — ideal arc', PAD + 190, curveTop + 16);

  // map: sky
  const sky = biome.sky || (level.theme === 'sky' ? [0x9cc3f0, 0xd6e8fb] : level.theme === 'cave' ? [0x10131f, 0x1b2740] : [0x244e7a, 0x8fc1ef]);
  const sg = g.createLinearGradient(0, mapTop, 0, mapBot); sky.forEach((c, i) => sg.addColorStop(i / (sky.length - 1), hex(c))); g.fillStyle = sg; g.fillRect(PAD, mapTop, innerW, mapBot - mapTop);
  const haz = HAZARDS[biome.hazard] || null;
  (level.gaps || []).forEach(([a, b]) => { const x = X(a), w = X(b + 1) - X(a), y = gt * rh + mapTop; g.fillStyle = haz ? hex(haz.colors[0]) : 'rgba(0,0,0,.55)'; g.fillRect(x, y, w, mapBot - y); if (haz) { g.fillStyle = hex(haz.surf); g.fillRect(x, y, w, 3); } });
  const gTop = biome.groundTop != null ? hex(biome.groundTop) : '#67c04e', gDirt = biome.groundDirt != null ? hex(biome.groundDirt) : '#3f7a2e';
  const topRowOf = {}; (level.solids || []).forEach(({ c, r }) => { if (topRowOf[c] == null || r < topRowOf[c]) topRowOf[c] = r; });
  (level.solids || []).forEach(({ c, r }) => { g.fillStyle = (r === topRowOf[c]) ? gTop : gDirt; g.fillRect(X(c), r * rh + mapTop, tw + 0.6, rh + 0.6); });
  (level.pipes || []).forEach(({ c, r, h }) => { g.fillStyle = '#2fa84f'; g.fillRect(X(c), r * rh + mapTop, tw * 2, h * rh); });
  (level.oneways || []).forEach(({ c, r }) => { g.fillStyle = '#caa46a'; g.fillRect(X(c), r * rh + mapTop, tw, rh * 0.4); });

  const glyph = (c, r, t, col, size = rh * 0.8) => { g.fillStyle = col; g.font = `700 ${size}px Inter`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, X(c) + tw / 2, r * rh + mapTop + rh / 2); g.textBaseline = 'alphabetic'; };
  strip(g, level.ices, X, tw, rh, mapTop, 'rgba(143,208,255,.6)'); strip(g, level.stickies, X, tw, rh, mapTop, 'rgba(110,77,44,.85)');
  strip(g, level.dashpads, X, tw, rh, mapTop, 'rgba(125,255,90,.85)'); (level.dashpads || []).forEach((d) => glyph(d.c, d.r, '»', '#0b160a', rh * 0.7));
  strip(g, level.conveyors, X, tw, rh, mapTop, 'rgba(143,208,255,.45)'); strip(g, level.bouncers, X, tw, rh, mapTop, 'rgba(255,207,69,.8)');
  (level.springs || []).forEach((s) => glyph(s.c, s.r, '▲', '#ffcf45', rh * 0.9));
  (level.spouts || []).forEach((s) => glyph(s.c, gt - 1, '♨', '#ff7a3c', rh));
  (level.droppers || []).forEach((d) => glyph(d.c, 2, '⬤', '#6b5142', rh * 0.7));
  (level.crumbles || []).forEach((c) => { g.fillStyle = 'rgba(180,120,70,.9)'; g.fillRect(X(c.c), c.r * rh + mapTop, tw, rh * 0.45); });
  (level.firebars || []).forEach((f) => glyph(f.c, gt - (f.up || 6), '✺', '#ff7a2c', rh));
  const zc = { wind: 'rgba(159,223,255,.18)', updraft: 'rgba(174,255,200,.20)', lowgrav: 'rgba(201,168,255,.20)', water: 'rgba(73,160,255,.28)' };
  (level.zones || []).forEach((z) => { g.fillStyle = zc[z.type] || zc.wind; g.fillRect(X(z.c0), z.r0 * rh + mapTop, X(z.c1 + 1) - X(z.c0), (z.r1 - z.r0 + 1) * rh); });
  (level.movers || []).forEach((mv) => { const x0 = X(mv.c0) + tw / 2, y0 = mv.r0 * rh + mapTop + rh / 2, x1 = mv.dir === 'h' ? X(mv.to) + tw / 2 : x0, y1 = mv.dir === 'v' ? mv.to * rh + mapTop + rh / 2 : y0; g.strokeStyle = 'rgba(224,184,120,.7)'; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); g.fillStyle = '#8a5a2c'; g.fillRect(X(mv.c0), mv.r0 * rh + mapTop, tw * (mv.w || 3), rh * 0.5); });
  (level.piranhas || []).forEach((p) => glyph(p.c, (p.topR != null ? p.topR - 1 : gt - 3), '✿', '#e0556a', rh * 0.8));
  const unreachSet = new Set(((feel && feel.unreach) || []).map((u) => `${u.c},${u.r}`));
  (level.coins || []).forEach((c) => { const bad = unreachSet.has(`${c.c},${c.r}`); g.beginPath(); g.arc(X(c.c) + tw / 2, c.r * rh + mapTop + rh / 2, Math.max(2.4, rh * (bad ? 0.34 : 0.26)), 0, 7); g.fillStyle = bad ? '#ff5050' : '#ffcf45'; g.fill(); if (bad) { g.strokeStyle = '#ff9a9a'; g.lineWidth = 2; g.stroke(); } });
  (level.enemies || []).forEach((e) => { const x = X(e.c) + tw / 2, y = e.r * rh + mapTop + rh / 2; if (e.boss) { g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(x, y, rh * 0.9, 0, 7); g.fill(); } else if (e.fly) { g.fillStyle = '#c08bff'; diamond(g, x, y, rh * 0.5); } else { g.fillStyle = '#ff7a6b'; g.fillRect(x - rh * 0.32, y - rh * 0.32, rh * 0.64, rh * 0.64); } });
  if (level.goal) { const gx = X(level.goal.c) + tw / 2, by = (level.goal.baseR || 4) * rh + mapTop, fy = gt * rh + mapTop; g.strokeStyle = '#e8eef7'; g.lineWidth = 3; g.beginPath(); g.moveTo(gx, by); g.lineTo(gx, fy); g.stroke(); g.fillStyle = '#7dff5a'; g.beginPath(); g.moveTo(gx, by); g.lineTo(gx + tw * 1.6, by + rh * 0.6); g.lineTo(gx, by + rh * 1.2); g.fill(); }

  // four-step bands
  for (let s = 0; s < 4; s++) { const a = X(W * s / 4), b = X(W * (s + 1) / 4); if (s) { g.strokeStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(a, mapTop); g.lineTo(a, mapBot); g.stroke(); } g.fillStyle = 'rgba(231,236,245,.5)'; g.font = "10px 'Press Start 2P'"; g.textAlign = 'center'; g.fillText(STEPS[s], (a + b) / 2, mapBot + 22); }

  // fix pins (snapshot) OR ghost flash (evolve)
  (pins || []).forEach((p) => { const x = X((p.c0 + p.c1) / 2 + 0.5); g.fillStyle = 'rgba(255,207,69,.18)'; g.fillRect(X(p.c0), curveTop, X(p.c1 + 1) - X(p.c0), mapBot - curveTop); g.fillStyle = '#ffcf45'; g.beginPath(); g.moveTo(x, mapTop - 4); g.lineTo(x - 10, mapTop - 22); g.lineTo(x + 10, mapTop - 22); g.closePath(); g.fill(); g.fillStyle = '#0b0b0b'; g.font = "10px 'Press Start 2P'"; g.textAlign = 'center'; g.fillText(p.n, x, mapTop - 9); });
  if (GHOST) { const x = X(GHOST.x + 1); const col = GHOST.op === 'remove' ? '#ff6b6b' : GHOST.op === 'relocate' ? '#8fd0ff' : '#7dff5a'; const lab = GHOST.op === 'remove' ? 'CUT' : GHOST.op === 'relocate' ? 'MOVE' : 'NEW'; g.strokeStyle = col; g.lineWidth = 3; g.setLineDash([6, 5]); g.strokeRect(X(GHOST.x), mapTop, Math.max(tw * 3, 30), mapBot - mapTop); g.setLineDash([]); g.fillStyle = col; g.beginPath(); g.moveTo(x, mapTop - 4); g.lineTo(x - 12, mapTop - 24); g.lineTo(x + 12, mapTop - 24); g.closePath(); g.fill(); g.fillStyle = '#06210a'; g.font = "9px 'Press Start 2P'"; g.textAlign = 'center'; g.fillText(lab, x, mapTop - 11); }

  // caption bar
  if (CAPTION) { g.fillStyle = 'rgba(8,12,22,.86)'; g.fillRect(PAD, curveBot + 14, innerW, 40); g.fillStyle = '#e7ecf5'; g.font = "700 18px Inter"; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(CAPTION, PAD + 14, curveBot + 34); g.textBaseline = 'alphabetic'; }
}

function strip(g, arr, X, tw, rh, mapTop, col) { (arr || []).forEach((t) => { g.fillStyle = col; g.fillRect(X(t.c), t.r * rh + mapTop - rh * 0.15, tw + 0.5, rh * 0.3); }); }
function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); }
function star(g, x, y, r, col) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fillStyle = col; g.fill(); }

$('legend').innerHTML = [['#ffcf45', 'coin/spring'], ['#ff7a6b', 'walker'], ['#c08bff', 'flyer'], ['#7dff5a', 'dash/new'], ['#8fd0ff', 'conveyor/ice'], ['#ff7a3c', 'spout/firebar'], ['#8a5a2c', 'mover'], ['rgba(255,107,107,.5)', 'dead-air'], ['#56607e', 'ideal arc']].map(([c, t]) => `<span class="chip"><span class="dot" style="background:${c}"></span><b>${t}</b></span>`).join('');

// ── DESIGN BY FEELING — point at a spot, tell the feeling, the AI places the beat ─
// Deeply integrates the legacy spatial editor with the AI+notes world: you express a
// FEELING (the MDA aesthetics from design.js) at a position; Gemini picks the mechanic
// that evokes it; the move is applied, re-scored live, and recorded as a NOTE in the
// brain (/api/notes) — a running design conversation between human and AI.
const FEELINGS = [
  ['Challenge', 'obstacle / mastery'], ['Sensation', 'juicy thrill'], ['Discovery', 'a secret / the new'],
  ['Expression', 'choose your route'], ['Submission', 'easy flow / breather'], ['Fantasy', 'a heroic moment'],
  ['Narrative', 'rising drama'], ['Fellowship', 'a shared beat'],
];
let pendingX = null, pickFeeling = 'Challenge', intentLog = [];

function setEditUI() {
  const on = editMode;
  $('editToggle').classList.toggle('on', on);
  $('editToggle').textContent = on ? '✓ Designing by feeling' : '✎ Design by feeling';
  $('resetEdit').style.display = on ? 'inline-block' : 'none';
  $('edithint').style.display = on ? 'inline' : 'none';
  const fl = $('fixeslabel'); if (fl) fl.innerHTML = on ? 'Design conversation &nbsp;·&nbsp; <span style="color:var(--dim)">your feelings → my beats → notes</span>' : 'Top fixes &nbsp;·&nbsp; <span style="color:var(--dim)">pinned to the map ▲</span>';
  if (!on) $('feelpanel').style.display = 'none';
}
function editView() {                                          // predicted score of the working level
  const p = predict(workLevel); const rr = coinReach(workLevel);
  return { name: workLevel.name + ' (edited)', windows: p.n, fun_score_0_100: p.fun, components: p.components,
    curve: p.curve, deadAir: p.deadAir, peakPosition: p.peakPos, deadIdx: p.deadIdx, distinctVerbs: new Set(collectBeats(workLevel).map((b) => b.type)).size,
    reach: rr.reachable, total: rr.total, unreach: rr.un.map((u) => ({ c: u.c, r: u.r })),
    diagnosis: diagnose(p), verdict: 'Live predicted model — every feeling you place re-scores instantly. Unreachable coins show RED.', fixes: [] };
}
function renderIntent() {
  $('fixes').innerHTML = intentLog.length
    ? intentLog.map((l) => `<li><span class="pin" style="background:${l.col}">✦</span><span>${esc(l.text)}</span></li>`).join('')
    : `<li style="border:0;color:var(--dim)">Click the map and name a feeling — your edits log here and persist as notes in the brain.</li>`;
}
$('editToggle').onclick = () => {
  if (!loadedLevel) return;
  editMode = !editMode; setEditUI();
  if (editMode) { workLevel = JSON.parse(JSON.stringify(loadedLevel)); intentLog = []; renderIntent(); CAPTION = 'Click the map where you want a feeling.'; paint(workLevel, editView(), 'DESIGNING BY FEELING · LIVE PREDICTED'); }
  else { CAPTION = ''; paint(loadedLevel, loadedFeel, 'GEMINI-SCORED SNAPSHOT'); }
};
$('resetEdit').onclick = () => { if (!editMode) return; workLevel = JSON.parse(JSON.stringify(loadedLevel)); intentLog = []; renderIntent(); CAPTION = 'Reset to the original level.'; $('feelpanel').style.display = 'none'; paint(workLevel, editView(), 'DESIGNING BY FEELING · LIVE PREDICTED'); };
$('cv').addEventListener('click', (e) => {
  if (!editMode || !workLevel) return;
  const cv = $('cv'), r = cv.getBoundingClientRect();
  const ix = (e.clientX - r.left) * (cv.width / r.width), iy = (e.clientY - r.top) * (cv.height / r.height);
  if (iy < 460) return;                                       // clicks land on the MAP, not the curve
  const c = Math.round((ix - 34) / (cv.width - 68) * workLevel.W);
  if (c < 1 || c > workLevel.W - 2) return;
  openFeelPanel(c);
});
const SUGGEST = ['(let the AI decide)', 'spring', 'spout', 'dropper', 'crumble', 'dashpad', 'bounce', 'walker', 'mover', 'conveyor', 'ice', 'sticky', 'firebar', 'coins', 'gap', 'remove'];
function openFeelPanel(x) {
  pendingX = x;
  $('feelpanel').style.display = 'block';
  $('feelpanel').innerHTML = `<div class="fp">
    <div class="fp-h">Make the player feel… <b>@ tile ${x}</b></div>
    <div class="fp-chips" id="fpchips">${FEELINGS.map(([f, d]) => `<span class="fchip${f === pickFeeling ? ' on' : ''}" title="${d}" data-f="${f}">${f}</span>`).join('')}</div>
    <input id="fpnote" class="fp-in" placeholder="optional — describe the moment in your words: e.g. “a breath of relief before the big climb”"/>
    <div class="fp-row">
      <span class="fp-lbl">suggest:</span>
      <select id="fpsug" class="fp-sel">${SUGGEST.map((s) => `<option>${s}</option>`).join('')}</select>
      <button id="fpgo" class="ebtn on">✦ Let the AI place it</button>
      <button id="fpcancel" class="ebtn">cancel</button>
    </div></div>`;
  $('fpchips').querySelectorAll('.fchip').forEach((el) => el.onclick = () => { pickFeeling = el.dataset.f; openFeelPanel(x); });
  $('fpcancel').onclick = () => { $('feelpanel').style.display = 'none'; };
  $('fpgo').onclick = () => placeByFeeling(x);
}
async function placeByFeeling(x) {
  const note = $('fpnote').value || '', sugRaw = $('fpsug').value, suggest = sugRaw.startsWith('(') ? '' : sugRaw;
  $('fpgo').textContent = '✦ Gemini is thinking…'; $('fpgo').disabled = true;
  const before = predict(workLevel).fun;
  let add = suggest || 'spring', why = '', via = 'you';
  try {
    const body = { x, feeling: pickFeeling, note, suggest, theme: workLevel.theme, W: workLevel.W,
      beats: collectBeats(workLevel).filter((b) => Math.abs(b.x - x) < 22).map((b) => `${Math.round(b.x)}:${b.type}`) };
    const r = await fetch('/api/design/place', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); if (j && j.add) { add = j.add; why = j.why || ''; via = j.fallback ? 'you' : 'gemini'; }
  } catch (e) {}
  const res = applyOp(workLevel, { op: add === 'remove' ? 'remove' : 'add', x, add });
  GHOST = { x: res.x, add: res.type, op: res.op };
  const v = editView(), d = v.fun_score_0_100 - before;
  CAPTION = `feel “${pickFeeling}” @x${x} → ${res.label}  ·  FUN ${v.fun_score_0_100} (${d >= 0 ? '+' : ''}${d.toFixed(1)})`;
  paint(workLevel, v, 'DESIGNING BY FEELING · LIVE PREDICTED');
  $('feelpanel').style.display = 'none';
  const text = `feel:${pickFeeling} @x${x}${note ? ` — “${note}”` : ''} → ${res.label}${why ? ` · ${via === 'gemini' ? 'Gemini' : 'you'}: ${why}` : ''}  (FUN ${v.fun_score_0_100})`;
  intentLog.unshift({ text, col: res.op === 'remove' ? '#ff6b6b' : via === 'gemini' ? '#7dff5a' : '#8fd0ff' }); renderIntent();
  try { fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '[design] ' + text, kind: 'design', tileC: x, scene: workLevel.name }) }); } catch (e) {}
  setTimeout(() => { GHOST = null; if (editMode) paint(workLevel, editView(), 'DESIGNING BY FEELING · LIVE PREDICTED'); }, 1100);
}

// ── boot ───────────────────────────────────────────────────────────────────
const isAuto = ['manual', 'play', 'evolve'].some((k) => qp.get(k) === '1');
if (isAuto) document.querySelector('.editbar').style.display = 'none';
if (qp.get('manual') === '1') {
  sel.value = +(qp.get('level') || 1);
  manualInit();
} else if (qp.get('play') === '1') {
  sel.value = +(qp.get('level') || 1);
  playEvolution();
} else if (qp.get('evolve') === '1') {
  const id = +(qp.get('level') || 1), steps = +(qp.get('steps') || 10);
  sel.value = id;
  runEvolution(id, steps);
} else {
  loadSnapshot(1);
}
