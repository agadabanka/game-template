// ── LEVEL ATLAS ───────────────────────────────────────────────────────────
// A live cross-level analysis: how the element vocabulary compounds across the
// campaign, and a generic "consolidate N levels → K" study (here 13 → 5). Pure:
// computed from the real level builders + the predicted feel model (feelmodel.js)
// + the element interest weights. The method generalizes to any campaign.
import { LEVELS, buildLevelById } from './game/levels.js';
import { predict, collectBeats, INTEREST, idealAt } from './game/feelmodel.js';
import { ensureArrays } from './game/evolve.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => c;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// ── analyze every level ─────────────────────────────────────────────────────
const levels = LEVELS.map((l) => buildLevelById(l.id));
const seen = new Set();
const A = levels.map((L) => {
  const beats = collectBeats(L);
  const hist = {}; beats.forEach((b) => { hist[b.type] = (hist[b.type] || 0) + 1; });
  const types = Object.keys(hist);
  const novel = types.filter((t) => !seen.has(t));               // verbs first introduced here
  novel.forEach((t) => seen.add(t));
  const signature = (novel.length ? novel : types).sort((a, b) => (INTEREST[b] || 0) - (INTEREST[a] || 0))[0] || '—';
  const p = predict(L);
  return { id: L.id, name: L.name, theme: L.theme, W: L.W, hist, types, novel, signature,
    fun: p.fun, curve: p.curve, distinct: types.length, coins: (L.coins || []).length };
});
// all mechanics, ordered by interest (high → low)
const MECHS = [...new Set(A.flatMap((a) => a.types))].sort((x, y) => (INTEREST[y] || 0) - (INTEREST[x] || 0));

// ── merge helpers (generic) ─────────────────────────────────────────────────
const ARRS = ['solids', 'coins', 'enemies', 'springs', 'pipes', 'piranhas', 'spouts', 'droppers', 'crumbles', 'conveyors', 'dashpads', 'bouncers', 'ices', 'stickies', 'oneways', 'qblocks', 'firebars', 'movers', 'zones', 'bricks'];
function mergeLevels(group) {
  const base = group[0], out = ensureArrays({ id: 0, name: 'merged', theme: base.theme, H: base.H, groundTop: base.groundTop, W: 0 });
  ARRS.forEach((k) => { if (!out[k]) out[k] = []; });
  out.gaps = []; let off = 0;
  for (const L of group) {
    for (const k of ARRS) (L[k] || []).forEach((e) => {
      const n = { ...e };
      if (n.c != null) n.c += off; if (n.c0 != null) n.c0 += off; if (n.c1 != null) n.c1 += off; if (n.to != null && k === 'movers') n.to += off;
      out[k].push(n);
    });
    (L.gaps || []).forEach(([a, b]) => out.gaps.push([a + off, b + off]));
    off += L.W + 4;                                              // a small seam between sections
  }
  out.W = off; out.coins = out.coins;
  return out;
}
// balanced contiguous partition into exactly K groups (min of max-group-length, DP)
function partition(w, K) {
  const n = w.length, pre = [0]; w.forEach((x) => pre.push(pre[pre.length - 1] + x));
  const dp = Array.from({ length: K + 1 }, () => Array(n + 1).fill(1e15));
  const cut = Array.from({ length: K + 1 }, () => Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let k = 1; k <= K; k++) for (let i = 1; i <= n; i++) for (let j = k - 1; j < i; j++) {
    const v = Math.max(dp[k - 1][j], pre[i] - pre[j]); if (v < dp[k][i]) { dp[k][i] = v; cut[k][i] = j; }
  }
  const groups = []; let i = n, k = K; while (k > 0) { const j = cut[k][i]; groups.unshift([j, i]); i = j; k--; }
  return groups;
}
const peaksOf = (curve) => { let n = 0; for (let i = 1; i < curve.length - 1; i++) if (curve[i] >= 6 && curve[i] >= curve[i - 1] && curve[i] > curve[i + 1]) n++; return n; };

// ── overview ────────────────────────────────────────────────────────────────
const totalW = A.reduce((s, a) => s + a.W, 0);
$('overview').innerHTML = [
  ['13', 'levels'], [totalW.toLocaleString() + ' tiles', 'total length (≈' + Math.round(totalW * 64 / 1000) + 'k px)'],
  [MECHS.length, 'distinct mechanics'], [A.reduce((s, a) => s + a.coins, 0), 'coins across the game'],
  [mean(A.map((a) => a.fun)).toFixed(0), 'avg predicted FUN'],
].map(([b, s]) => `<div class="s"><b>${b}</b><span>${s}</span></div>`).join('');

// ── the matrix (mechanics × levels) ─────────────────────────────────────────
(function drawMatrix() {
  const cv = $('matrix'), g = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  const L0 = 250, T0 = 96, BOT = 70;                              // label margins
  const cw = (CW - L0 - 20) / 13, rh = (CH - T0 - BOT) / MECHS.length;
  g.clearRect(0, 0, CW, CH);
  // top: per-level FUN bar + signature + number
  A.forEach((a, j) => {
    const x = L0 + j * cw;
    g.fillStyle = '#8b93a7'; g.font = "12px 'Press Start 2P'"; g.textAlign = 'center';
    g.fillText('L' + a.id, x + cw / 2, 22);
    const fh = (a.fun / 100) * 40;
    g.fillStyle = '#1b2030'; g.fillRect(x + cw * 0.2, 30, cw * 0.6, 40);
    g.fillStyle = a.fun >= 60 ? '#7dff5a' : a.fun >= 45 ? '#ffcf45' : '#ff6b6b'; g.fillRect(x + cw * 0.2, 30 + 40 - fh, cw * 0.6, fh);
    g.fillStyle = '#cfe0ff'; g.font = '11px Inter'; g.fillText(a.fun.toFixed(0), x + cw / 2, 84);
  });
  // rows
  MECHS.forEach((mname, r) => {
    const y = T0 + r * rh;
    g.fillStyle = '#aebbe0'; g.font = '600 15px Inter'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(`${mname}`, 12, y + rh / 2);
    g.fillStyle = '#5b6680'; g.font = '12px Inter'; g.textAlign = 'right'; g.fillText('i' + (INTEREST[mname] || '?'), L0 - 8, y + rh / 2);
    g.textBaseline = 'alphabetic';
    A.forEach((a, j) => {
      const x = L0 + j * cw, ct = a.hist[mname] || 0;
      if (ct) {
        const op = Math.min(0.92, 0.28 + ct * 0.14);
        g.fillStyle = `rgba(125,255,90,${op})`; g.fillRect(x + 2, y + 2, cw - 4, rh - 4);
        if (a.signature === mname) { g.strokeStyle = '#ffcf45'; g.lineWidth = 2.5; g.strokeRect(x + 2, y + 2, cw - 4, rh - 4); }   // signature = its NEW headline verb
        g.fillStyle = '#06210a'; g.font = '700 13px Inter'; g.textAlign = 'center'; g.fillText(ct, x + cw / 2, y + rh / 2 + 4);
      } else { g.fillStyle = '#11151f'; g.fillRect(x + 2, y + 2, cw - 4, rh - 4); }
    });
  });
  g.fillStyle = '#8b93a7'; g.font = "11px 'Press Start 2P'"; g.textAlign = 'left';
  g.fillText('MECHANIC  (by interest →)', 12, T0 - 14);
})();
$('mlegend').innerHTML = [['rgba(125,255,90,.85)', 'mechanic present (count)'], ['#ffcf45', 'the level\'s SIGNATURE (newly introduced)'], ['#7dff5a', 'FUN ≥60'], ['#ffcf45', 'FUN 45–60'], ['#ff6b6b', 'FUN <45']]
  .map(([c, t]) => `<span class="chip"><span class="dot" style="background:${c}"></span><b>${t}</b></span>`).join('');

// ── vocabulary growth ───────────────────────────────────────────────────────
(function drawVocab() {
  const cv = $('vocab'), g = cv.getContext('2d'), CW = cv.width, CH = cv.height, PAD = 50;
  let cum = new Set(); const pts = A.map((a) => { a.types.forEach((t) => cum.add(t)); return cum.size; });
  g.clearRect(0, 0, CW, CH);
  const x = (j) => PAD + j * (CW - 2 * PAD) / 12, y = (v) => CH - 40 - (v / MECHS.length) * (CH - 80);
  g.strokeStyle = '#202840'; for (let v = 0; v <= MECHS.length; v += 4) { g.beginPath(); g.moveTo(PAD, y(v)); g.lineTo(CW - PAD, y(v)); g.stroke(); g.fillStyle = '#5b6680'; g.font = '13px Inter'; g.textAlign = 'right'; g.fillText(v, PAD - 8, y(v) + 4); }
  // bars = NEW verbs this level
  A.forEach((a, j) => { const bw = (CW - 2 * PAD) / 13 * 0.5; g.fillStyle = 'rgba(143,208,255,.5)'; const h = (a.novel.length / MECHS.length) * (CH - 80); g.fillRect(x(j) - bw / 2, CH - 40 - h, bw, h); });
  // cumulative line
  g.beginPath(); pts.forEach((v, j) => j ? g.lineTo(x(j), y(v)) : g.moveTo(x(j), y(v))); g.strokeStyle = '#7dff5a'; g.lineWidth = 3; g.stroke();
  pts.forEach((v, j) => { g.beginPath(); g.arc(x(j), y(v), 4, 0, 7); g.fillStyle = '#bfffa6'; g.fill(); g.fillStyle = '#8b93a7'; g.font = "11px 'Press Start 2P'"; g.textAlign = 'center'; g.fillText('L' + A[j].id, x(j), CH - 16); });
  g.fillStyle = '#7dff5a'; g.font = '700 14px Inter'; g.textAlign = 'left'; g.fillText('— cumulative distinct verbs', PAD + 6, 26);
  g.fillStyle = '#8fd0ff'; g.fillText('▮ new verbs introduced', PAD + 250, 26);
})();

// ── 13 → 5 proposal ─────────────────────────────────────────────────────────
const groupsIdx = partition(A.map((a) => a.W), 5);
const merged = groupsIdx.map(([s, e]) => {
  const grp = levels.slice(s, e), gA = A.slice(s, e);
  const ml = mergeLevels(grp), mp = predict(ml);
  return { idxs: gA.map((a) => a.id), names: gA.map((a) => a.name), W: ml.W, fun: mp.fun, curve: mp.curve,
    peaks: peaksOf(mp.curve), avgFun: mean(gA.map((a) => a.fun)), verbs: new Set(gA.flatMap((a) => a.types)).size };
});
$('groups').innerHTML = merged.map((m, i) => `
  <div class="g">
    <h3>Merged ${i + 1}</h3>
    <div class="lv">L${m.idxs.join(' + L')} · ${m.W} tiles · ${m.verbs} verbs</div>
    <canvas id="mc${i}" width="420" height="120"></canvas>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
      <span class="fun" style="color:${m.fun >= 60 ? 'var(--accent)' : m.fun >= 45 ? 'var(--gold)' : 'var(--warn)'}">${m.fun.toFixed(0)}</span>
      <span style="font-size:11px;color:var(--dim)">vs ${m.avgFun.toFixed(0)} avg parts</span>
    </div>
    <div class="verdict">${m.peaks > 1
      ? `<span class="flag">⚠ ${m.peaks} interest peaks</span> — concatenation stacks each level's climax. Re-author one <b>late</b> peak.`
      : `<span class="ok">✓ single arc</span> — reads as one rising level.`}</div>
  </div>`).join('');
merged.forEach((m, i) => {
  const cv = $('mc' + i), g = cv.getContext('2d'), CW = cv.width, CH = cv.height, n = m.curve.length;
  const cx = (j) => 6 + j / (n - 1) * (CW - 12), cy = (v) => CH - 8 - (v / 10) * (CH - 16);
  g.clearRect(0, 0, CW, CH);
  g.setLineDash([5, 5]); g.strokeStyle = '#56607e'; g.beginPath(); for (let k = 0; k <= 40; k++) { const t = k / 40; (k ? g.lineTo : g.moveTo).call(g, 6 + t * (CW - 12), cy(idealAt(t))); } g.stroke(); g.setLineDash([]);
  const grd = g.createLinearGradient(0, 0, 0, CH); grd.addColorStop(0, 'rgba(125,255,90,.32)'); grd.addColorStop(1, 'rgba(125,255,90,.02)');
  g.beginPath(); g.moveTo(cx(0), CH); m.curve.forEach((v, j) => g.lineTo(cx(j), cy(v))); g.lineTo(cx(n - 1), CH); g.closePath(); g.fillStyle = grd; g.fill();
  g.beginPath(); m.curve.forEach((v, j) => j ? g.lineTo(cx(j), cy(v)) : g.moveTo(cx(j), cy(v))); g.strokeStyle = '#7dff5a'; g.lineWidth = 2.5; g.stroke();
});
const wins = merged.filter((m) => m.peaks <= 1).length;
const mF = mean(merged.map((m) => m.fun)), pF = mean(merged.map((m) => m.avgFun));
$('finding').innerHTML = `<b>The finding (and the catch).</b> Balanced into 5 contiguous groups, every merge keeps a
clean rising curriculum and a <b>richer vocabulary</b> per level, and the predicted FUN actually comes out
<b>higher</b> (${mF.toFixed(0)} vs the parts' ${pF.toFixed(0)} average) — more content lifts engagement &amp; dynamics.
<b>But that number is optimistic:</b> <b>${5 - wins} of 5</b> merges show <b>multiple interest peaks</b> — naive
concatenation stacks each part's climax — and the <i>arc</i> term (only ¼ of the score) under‑penalizes that, where a
human would feel the anticlimax of a second, smaller peak. So <b>merging makes sense</b> for fewer‑but‑deeper levels —
but the real work the raw score hides is <b>re‑authoring each merged arc to one late climax</b> (interior peaks become
rest valleys). The atlas shows you that debt before you commit.`;

// ── generic strategy ────────────────────────────────────────────────────────
$('strategy').innerHTML = `
  <p>Consolidating a campaign of <b>N</b> levels to <b>K</b> is a generic, mechanical procedure — nothing here is
  frog‑specific:</p>
  <ol class="method">
    <li><b>Profile each level</b> from its builder: an <i>element histogram</i> (verb → count), its <i>signature</i>
      (the highest‑interest <b>newly introduced</b> verb), length, and a predicted <i>interest arc</i>.</li>
    <li><b>Partition into K contiguous groups balanced by length</b> (a DP minimizing the largest group). Contiguity
      preserves the two things that make a campaign work: the <b>rising difficulty</b> and the <b>compounding
      vocabulary</b> (level <i>N</i> reuses 1…<i>N‑1</i>).</li>
    <li><b>Merge & re‑author the arc.</b> Concatenation is the easy part; the real work is collapsing each group's
      stacked climaxes into <b>one four‑step arc</b> (introduce → develop → twist → resolve) with a single late peak —
      the interior peaks become rest valleys.</li>
    <li><b>Re‑gate &amp; re‑score.</b> The merged level must still pass the hard gate (autopilot at 0 deaths) and beat
      its old <code>feel</code> arc — same two bars, now over a longer canvas.</li>
  </ol>
  <p style="color:var(--dim)">The trade: fewer levels = less menu friction and deeper mechanic throughlines, at the cost
  of re‑tuning K arcs. The atlas above is the decision tool — it quantifies the re‑authoring debt (the FUN gap and the
  peak count) before you commit.</p>`;
