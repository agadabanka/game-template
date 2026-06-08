// Procedural art — one cohesive illustrated style. No image assets.
// Principles applied: single light from upper-left; hue-shifted ramps (cool
// shadows, warm highlights); atmospheric perspective on far layers; rim-lit
// ground tops; soft contact shadows; colored (not pure-black) outlines.
import { C, GAME_W, GAME_H, TILE } from './consts.js';

// ── color helpers ──────────────────────────────────────────────────────
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
function adj(hex, f) {
  let r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f * 0.92; b += (255 - b) * f * 0.6; } // warm highlight
  else { const k = -f; r -= r * k * 0.75; g -= g * k * 0.85; b -= b * k * 1.0; }            // cool shadow
  return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
}
const mix = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (clamp(ar + (br - ar) * t) << 16) | (clamp(ag + (bg - ag) * t) << 8) | clamp(ab + (bb - ab) * t);
};

function tex(scene, key, w, h, draw) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}
function rr(g, x, y, w, h, r) { g.fillRoundedRect(x, y, w, h, r); }
function ol(g, x, y, w, h, r, color, a = 0.5, lw = 3) { g.lineStyle(lw, color, a); g.strokeRoundedRect(x, y, w, h, r); }

export function generateTextures(scene) {
  // ── Sky: soft vertical gradient + warm horizon glow ──────────────────
  tex(scene, 'sky', GAME_W, GAME_H, (g) => {
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyMid, C.skyMid, 1);
    g.fillRect(0, 0, GAME_W, GAME_H * 0.62);
    g.fillGradientStyle(C.skyMid, C.skyMid, C.skyLow, C.skyLow, 1);
    g.fillRect(0, GAME_H * 0.55, GAME_W, GAME_H * 0.5);
    // soft sun glow upper-left-ish key light
    const sx = GAME_W * 0.22, sy = GAME_H * 0.2;
    for (let i = 6; i >= 1; i--) { g.fillStyle(0xfff7da, 0.05); g.fillCircle(sx, sy, i * 46); }
    g.fillStyle(0xfffdf0, 0.95); g.fillCircle(sx, sy, 60);
    g.fillStyle(0xffffff, 1); g.fillCircle(sx, sy, 44);
  });

  // ── Far mountains (atmospheric: desaturated, bluish) ─────────────────
  tex(scene, 'mountains', 1280, 320, (g) => {
    const base = mix(C.hillFar, C.skyLow, 0.45);
    const peaks = [[120, 180], [340, 120], [560, 200], [820, 110], [1040, 170], [1240, 150]];
    peaks.forEach(([x, top], i) => {
      const w = 360 - (i % 2) * 80;
      g.fillStyle(mix(base, 0x3a5a8a, 0.2), 1);
      g.fillTriangle(x - w / 2, 320, x, top, x + w / 2, 320);
      g.fillStyle(adj(base, 0.18), 1); // sunlit left face
      g.fillTriangle(x - w / 2, 320, x, top, x - 6, 320);
      g.fillStyle(0xffffff, 0.5); // snow cap
      g.fillTriangle(x - 26, top + 40, x, top, x + 26, top + 40);
    });
  });

  // ── Rolling hill mound ───────────────────────────────────────────────
  tex(scene, 'hill', 460, 280, (g) => {
    g.fillStyle(C.hillFar, 1); g.fillEllipse(230, 360, 460, 460);
    g.fillStyle(adj(C.hillFar, -0.18), 0.5); g.fillEllipse(150, 380, 250, 360); // shadow side
    g.fillStyle(adj(C.hillFar, 0.18), 0.9); g.fillEllipse(280, 300, 200, 200);  // lit crown
    g.fillStyle(0xffffff, 0.10); g.fillEllipse(300, 270, 120, 90);
  });

  // ── Clouds (soft, shaded underside) ──────────────────────────────────
  tex(scene, 'cloud', 280, 140, (g) => {
    const blobs = [[78, 86, 54], [140, 64, 68], [206, 88, 50], [116, 100, 60], [176, 100, 52]];
    g.fillStyle(C.cloudShade, 1); blobs.forEach(([x, y, r]) => g.fillCircle(x, y + 12, r));
    g.fillStyle(C.cloud, 1); blobs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(0xffffff, 1); g.fillCircle(116, 60, 34); g.fillCircle(150, 52, 26); // lit tops
  });

  // ── Bush ─────────────────────────────────────────────────────────────
  tex(scene, 'bush', 240, 120, (g) => {
    const blobs = [[58, 76, 48], [120, 56, 58], [182, 78, 46], [94, 90, 52], [156, 90, 50]];
    g.fillStyle(C.bushDark, 1); blobs.forEach(([x, y, r]) => g.fillCircle(x, y + 8, r));
    g.fillStyle(C.bush, 1); blobs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(adj(C.bush, 0.25), 0.9); g.fillCircle(98, 54, 22); g.fillCircle(128, 50, 16);
  });

  // ── Ground: grass-topped + dirt ──────────────────────────────────────
  tex(scene, 'ground_grass', TILE, TILE, (g) => {
    // dirt body w/ vertical shade
    g.fillStyle(C.dirt, 1); g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(adj(C.dirt, -0.22), 1); g.fillRect(0, TILE * 0.62, TILE, TILE * 0.38);
    g.fillStyle(adj(C.dirt, -0.12), 1);
    for (let i = 0; i < 8; i++) g.fillCircle((i * 47) % TILE, 26 + ((i * 31) % (TILE - 30)), 3.5); // pebbles
    // grass band
    g.fillStyle(adj(C.grass, -0.18), 1); g.fillRect(0, 16, TILE, 12);
    g.fillStyle(C.grass, 1); g.fillRect(0, 0, TILE, 18);
    g.fillStyle(adj(C.grass, 0.28), 1); g.fillRect(0, 0, TILE, 5);   // rim light on top edge
    g.fillStyle(C.grass, 1);
    for (let i = -4; i < TILE; i += 9) g.fillTriangle(i, 18, i + 5, 7, i + 10, 18); // blades
    g.fillStyle(adj(C.grass, 0.28), 1);
    for (let i = -2; i < TILE; i += 18) g.fillTriangle(i, 16, i + 3, 9, i + 6, 16);
    g.fillStyle(0x000000, 0.12); g.fillRect(0, TILE - 5, TILE, 5);
  });
  tex(scene, 'ground_dirt', TILE, TILE, (g) => {
    g.fillStyle(C.dirt, 1); g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(adj(C.dirt, -0.2), 0.6); g.fillRect(0, TILE * 0.5, TILE, TILE * 0.5);
    g.fillStyle(adj(C.dirt, -0.14), 1);
    for (let i = 0; i < 11; i++) g.fillCircle((i * 41) % TILE, (i * 29) % TILE, 3.5);
    g.fillStyle(adj(C.dirt, 0.12), 0.5); g.fillRect(0, 0, TILE, 4);
  });

  // ── Brick: beveled ───────────────────────────────────────────────────
  tex(scene, 'brick', TILE, TILE, (g) => {
    g.fillStyle(adj(C.brick, -0.28), 1); rr(g, 0, 0, TILE, TILE, 6);
    g.fillStyle(C.brick, 1); rr(g, 2, 2, TILE - 4, TILE - 6, 5);
    g.fillStyle(adj(C.brick, 0.3), 1); g.fillRect(3, 3, TILE - 6, 5);             // top highlight
    g.fillStyle(C.brickLine, 1);                                                   // mortar
    g.fillRect(0, TILE / 2 - 2, TILE, 4);
    g.fillRect(TILE / 2 - 2, 2, 4, TILE / 2 - 2);
    g.fillRect(TILE / 4 - 2, TILE / 2 + 2, 4, TILE / 2 - 2);
    g.fillRect((3 * TILE) / 4 - 2, TILE / 2 + 2, 4, TILE / 2 - 2);
    ol(g, 1, 1, TILE - 2, TILE - 2, 6, adj(C.brick, -0.5), 0.4);
  });

  // ── Question block: beveled metal + glow ─────────────────────────────
  tex(scene, 'qblock', TILE, TILE, (g) => {
    g.fillStyle(adj(C.qBlock, -0.35), 1); rr(g, 0, 0, TILE, TILE, 9);
    g.fillStyle(C.qBlock, 1); rr(g, 3, 3, TILE - 6, TILE - 6, 8);
    g.fillStyle(adj(C.qBlock, 0.4), 1); rr(g, 6, 6, TILE - 12, 12, 5);   // top sheen
    g.fillStyle(adj(C.qBlock, -0.28), 1); rr(g, 6, TILE - 16, TILE - 12, 10, 5); // bottom shade
    g.fillStyle(C.qBlockRivet, 1);
    [[11, 11], [TILE - 11, 11], [11, TILE - 11], [TILE - 11, TILE - 11]].forEach(([x, y]) => g.fillCircle(x, y, 4));
    // "?" glyph
    g.lineStyle(8, adj(C.qBlock, -0.55), 1);
    g.beginPath(); g.arc(TILE / 2, TILE / 2 - 6, 11, Math.PI * 1.04, Math.PI * 0.28, false); g.strokePath();
    g.fillStyle(adj(C.qBlock, -0.55), 1);
    g.fillRect(TILE / 2 - 4, TILE / 2 - 2, 8, 12); g.fillCircle(TILE / 2, TILE / 2 + 19, 5);
    g.fillStyle(0xffffff, 0.3); // glyph highlight
    g.fillRect(TILE / 2 - 3, TILE / 2 - 1, 3, 9);
    ol(g, 1, 1, TILE - 2, TILE - 2, 9, adj(C.qBlock, -0.6), 0.35);
  });
  tex(scene, 'usedblock', TILE, TILE, (g) => {
    g.fillStyle(adj(C.used, -0.3), 1); rr(g, 0, 0, TILE, TILE, 9);
    g.fillStyle(C.used, 1); rr(g, 3, 3, TILE - 6, TILE - 6, 8);
    g.fillStyle(adj(C.used, 0.2), 1); rr(g, 6, 6, TILE - 12, 8, 4);
    g.fillStyle(adj(C.used, 0.35), 1);
    [[11, 11], [TILE - 11, 11], [11, TILE - 11], [TILE - 11, TILE - 11]].forEach(([x, y]) => g.fillCircle(x, y, 4));
  });

  // ── Pipe (2 wide × N) — glossy gradient + rim ────────────────────────
  const pipeBodyCols = (g, x0, w) => {
    g.fillStyle(adj(C.pipe, -0.3), 1); g.fillRect(x0, 0, w, TILE);
    g.fillStyle(C.pipe, 1); g.fillRect(x0 + 3, 0, w - 6, TILE);
    g.fillStyle(adj(C.pipe, 0.4), 1); g.fillRect(x0 + 8, 0, 9, TILE);     // left gloss
    g.fillStyle(adj(C.pipe, -0.18), 1); g.fillRect(x0 + w - 12, 0, 8, TILE); // right shade
  };
  tex(scene, 'pipe_tl', TILE, TILE, (g) => { pipeBodyCols(g, 0, TILE); g.fillStyle(adj(C.pipe, -0.3), 1); g.fillRect(0, 0, TILE + 8, 18); g.fillStyle(C.pipe, 1); g.fillRect(2, 2, TILE + 6, 14); g.fillStyle(adj(C.pipe, 0.45), 1); g.fillRect(6, 4, TILE, 5); });
  tex(scene, 'pipe_tr', TILE, TILE, (g) => { pipeBodyCols(g, 0, TILE); g.fillStyle(adj(C.pipe, -0.3), 1); g.fillRect(-8, 0, TILE + 8, 18); g.fillStyle(C.pipe, 1); g.fillRect(-8, 2, TILE + 6, 14); g.fillStyle(adj(C.pipe, -0.2), 1); g.fillRect(TILE - 14, 4, 12, 12); });
  tex(scene, 'pipe_bl', TILE, TILE, (g) => pipeBodyCols(g, 0, TILE));
  tex(scene, 'pipe_br', TILE, TILE, (g) => pipeBodyCols(g, 0, TILE));

  // ── Coin spin (4 frames) ─────────────────────────────────────────────
  const cw = 44, ch = 50;
  [44, 26, 8, 26].forEach((w, i) => {
    tex(scene, `coin${i}`, cw, ch, (g) => {
      const cx = cw / 2, cy = ch / 2;
      if (w <= 8) { g.fillStyle(C.coinEdge, 1); g.fillRect(cx - 3, 5, 6, ch - 10); return; }
      g.fillStyle(C.coinEdge, 1); g.fillEllipse(cx, cy, w, ch - 4);
      g.fillStyle(C.coin, 1); g.fillEllipse(cx, cy, w - 6, ch - 12);
      g.fillStyle(adj(C.coin, 0.3), 1); g.fillEllipse(cx, cy - 3, w - 14, ch - 22);
      g.fillStyle(C.coinShine, 0.95); g.fillEllipse(cx - w * 0.16, cy - 9, Math.max(3, w * 0.2), ch * 0.34);
      if (w > 30) { g.fillStyle(adj(C.coinEdge, -0.1), 1); g.fillRect(cx - 2, cy - 9, 4, 18); }
    });
  });

  // ── Hero — illustrated mascot, consistent light ──────────────────────
  const HW = 52, HH = 64;
  function hero(g, p) {
    const cx = HW / 2;
    const sx = p.sx || 1, sy = p.sy || 1;
    const ox = (HW - HW * sx) / 2, oy = HH - HH * sy;
    const X = (v) => v * sx + ox, Y = (v) => v * sy + oy;
    const legL = p.legL || 0, legR = p.legR || 0;
    // contact shadow
    g.fillStyle(0x000000, 0.16); g.fillEllipse(X(cx), Y(60), 34 * sx, 8);
    // shoes
    g.fillStyle(adj(C.heroShoe, -0.2), 1); rr(g, X(cx - 17 + legL), Y(50), 15 * sx, 12, 5); rr(g, X(cx + 3 + legR), Y(50), 15 * sx, 12, 5);
    g.fillStyle(C.heroShoe, 1); rr(g, X(cx - 17 + legL), Y(50), 15 * sx, 7, 5); rr(g, X(cx + 3 + legR), Y(50), 15 * sx, 7, 5);
    // overalls
    g.fillStyle(adj(C.heroOveralls, -0.22), 1); rr(g, X(cx - 16), Y(30), 32 * sx, 24 * sy, 7);
    g.fillStyle(C.heroOveralls, 1); rr(g, X(cx - 16), Y(28), 32 * sx, 22 * sy, 7);
    g.fillStyle(adj(C.heroOveralls, 0.3), 1); g.fillRect(X(cx - 13), Y(30), 5, 20 * sy); // left hi-light
    g.fillStyle(adj(C.heroOveralls, -0.18), 1); g.fillRect(X(cx + 9), Y(30), 6, 20 * sy);
    // shirt + arms
    g.fillStyle(C.heroShirt, 1); rr(g, X(cx - 18), Y(24), 36 * sx, 14 * sy, 7);
    g.fillStyle(adj(C.heroShirt, 0.28), 1); rr(g, X(cx - 16), Y(24), 12 * sx, 6, 4);
    const armY = p.arm || 38;
    g.fillStyle(C.heroGlove, 1); g.fillCircle(X(cx - 18), Y(armY), 7); g.fillCircle(X(cx + 18), Y(armY - (p.armUp ? 12 : 0)), 7);
    g.fillStyle(adj(C.heroGlove, -0.12), 1); g.fillCircle(X(cx - 18), Y(armY + 2), 4);
    // head
    g.fillStyle(adj(C.heroSkin, -0.16), 1); rr(g, X(cx - 14), Y(7), 28 * sx, 22 * sy, 9);
    g.fillStyle(C.heroSkin, 1); rr(g, X(cx - 14), Y(6), 28 * sx, 20 * sy, 9);
    g.fillStyle(adj(C.heroSkin, 0.2), 1); rr(g, X(cx - 12), Y(8), 10 * sx, 6, 4); // cheek light
    // eyes
    g.fillStyle(0xffffff, 1); g.fillCircle(X(cx + 2), Y(15), 5.5);
    g.fillStyle(C.ink, 1); g.fillCircle(X(cx + 3.5 + (p.look || 0)), Y(15), 2.8);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(X(cx + 4.5 + (p.look || 0)), Y(13.6), 1.1);
    // cap
    g.fillStyle(adj(C.heroCap, -0.25), 1); rr(g, X(cx - 16), Y(2), 32 * sx, 13 * sy, 6);
    g.fillStyle(C.heroCap, 1); rr(g, X(cx - 16), Y(0), 32 * sx, 12 * sy, 6);
    g.fillStyle(C.heroCap, 1); rr(g, X(cx + 6), Y(7), 23 * sx, 7 * sy, 3); // brim
    g.fillStyle(adj(C.heroCap, 0.4), 1); rr(g, X(cx - 12), Y(2), 13 * sx, 4, 2); // shine
    // soft outline
    ol(g, X(cx - 18), Y(0), 36 * sx, 60 * sy, 10, adj(C.heroOveralls, -0.55), 0.12, 2);
  }
  tex(scene, 'hero_idle', HW, HH, (g) => hero(g, { legL: -1, legR: 1, arm: 38 }));
  tex(scene, 'hero_run1', HW, HH, (g) => hero(g, { legL: -8, legR: 8, arm: 35, look: 1 }));
  tex(scene, 'hero_run2', HW, HH, (g) => hero(g, { legL: 0, legR: 0, arm: 40, look: 1, sy: 1.02 }));
  tex(scene, 'hero_run3', HW, HH, (g) => hero(g, { legL: 8, legR: -8, arm: 35, look: 1 }));
  tex(scene, 'hero_jump', HW, HH, (g) => hero(g, { legL: -6, legR: 7, arm: 30, armUp: true, sy: 1.08, sx: 0.94, look: 1 }));
  tex(scene, 'hero_fall', HW, HH, (g) => hero(g, { legL: 5, legR: -4, arm: 44, sy: 0.96, sx: 1.05, look: 1 }));
  tex(scene, 'hero_skid', HW, HH, (g) => hero(g, { legL: 9, legR: -3, arm: 46, look: -2 }));

  // ── Goomba ───────────────────────────────────────────────────────────
  const GW = 60, GH = 56;
  function goomba(g, feet, squished) {
    g.fillStyle(0x000000, 0.16); g.fillEllipse(GW / 2, GH - 4, GW - 12, 7);
    if (squished) { g.fillStyle(adj(C.goomba, -0.2), 1); g.fillEllipse(GW / 2, GH - 9, GW - 8, 16); g.fillStyle(C.goomba, 1); g.fillEllipse(GW / 2, GH - 11, GW - 16, 11); return; }
    g.fillStyle(adj(C.goombaFoot, -0.1), 1); rr(g, 9 + (feet ? 0 : 6), GH - 13, 18, 11, 5); rr(g, GW - 27 - (feet ? 0 : 6), GH - 13, 18, 11, 5);
    g.fillStyle(adj(C.goomba, -0.22), 1); g.fillEllipse(GW / 2, GH / 2 + 7, GW - 6, GH - 8);
    g.fillStyle(C.goomba, 1); g.fillEllipse(GW / 2, GH / 2 + 5, GW - 14, GH - 14);
    g.fillStyle(adj(C.goomba, 0.25), 0.9); g.fillEllipse(GW / 2 - 9, 17, 22, 12); // lit crown
    g.fillStyle(0xffffff, 1); g.fillEllipse(GW / 2 - 11, 27, 13, 16); g.fillEllipse(GW / 2 + 11, 27, 13, 16);
    g.fillStyle(C.ink, 1); g.fillEllipse(GW / 2 - 9, 29, 5, 8); g.fillEllipse(GW / 2 + 13, 29, 5, 8);
    g.fillStyle(adj(C.goombaFoot, -0.1), 1); g.fillTriangle(GW / 2 - 21, 15, GW / 2 - 2, 25, GW / 2 - 21, 25); g.fillTriangle(GW / 2 + 21, 15, GW / 2 + 2, 25, GW / 2 + 21, 25);
    ol(g, 5, 8, GW - 10, GH - 12, 20, adj(C.goomba, -0.5), 0.18, 3);
  }
  tex(scene, 'goomba1', GW, GH, (g) => goomba(g, true, false));
  tex(scene, 'goomba2', GW, GH, (g) => goomba(g, false, false));
  tex(scene, 'goomba_squish', GW, GH, (g) => goomba(g, false, true));

  // ── Flag ─────────────────────────────────────────────────────────────
  tex(scene, 'flag', 56, 40, (g) => { g.fillStyle(adj(C.flagCloth, -0.2), 1); g.fillTriangle(0, 2, 56, 20, 0, 40); g.fillStyle(C.flagCloth, 1); g.fillTriangle(0, 0, 52, 19, 0, 36); g.fillStyle(0xffffff, 0.85); g.fillCircle(15, 18, 6); });

  // ── Particles ────────────────────────────────────────────────────────
  tex(scene, 'dust', 20, 20, (g) => { g.fillStyle(0xffffff, 0.95); g.fillCircle(10, 10, 9); g.fillStyle(0xeaf2ff, 0.6); g.fillCircle(10, 10, 5); });
  tex(scene, 'spark', 18, 18, (g) => { g.fillStyle(C.coinShine, 1); g.fillTriangle(9, 0, 11, 7, 7, 7); g.fillTriangle(9, 18, 11, 11, 7, 11); g.fillTriangle(0, 9, 7, 7, 7, 11); g.fillTriangle(18, 9, 11, 7, 11, 11); g.fillCircle(9, 9, 3); });
  tex(scene, 'chunk', 16, 16, (g) => { g.fillStyle(adj(C.brick, -0.2), 1); g.fillRect(1, 1, 14, 14); g.fillStyle(C.brick, 1); g.fillRect(2, 2, 11, 11); g.fillStyle(C.brickLine, 1); g.fillRect(2, 7, 11, 2); });
  tex(scene, 'pixel', 6, 6, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(3, 3, 3); });
}

export function defineAnims(scene) {
  const a = scene.anims;
  if (!a.exists('coin_spin')) a.create({ key: 'coin_spin', frames: [0, 1, 2, 3].map((i) => ({ key: `coin${i}` })), frameRate: 12, repeat: -1 });
  if (!a.exists('hero_run')) a.create({ key: 'hero_run', frames: ['hero_run1', 'hero_run2', 'hero_run3', 'hero_run2'].map((k) => ({ key: k })), frameRate: 14, repeat: -1 });
  if (!a.exists('goomba_walk')) a.create({ key: 'goomba_walk', frames: [{ key: 'goomba1' }, { key: 'goomba2' }], frameRate: 5, repeat: -1 });
}
