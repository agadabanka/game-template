// Boot: load the Kenney CC0 pixel-art pack, then BAKE it into the TILE-sized
// texture keys the rest of the game already expects (so Play/UI stay stable).
// Procedural sky/hills/clouds/pipe/particles are drawn here too, so the look is
// one cohesive pipeline. Pixel art is scaled with NEAREST (pixelArt:true).
import { C, GAME_W, GAME_H, TILE } from '../consts.js';
import * as A from '../assets.js';
import { BIOMES, HAZARDS } from '../themes.js';
import { MATERIALS, materialTex } from '../materials.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    A.preload(this);
    // world thumbnails for the Title menu (clickable cards). Missing files just
    // fall back to a generated placeholder in Title, so this is safe if absent.
    for (let i = 1; i <= 5; i++) this.load.image(`thumb_w${i}`, `/assets/thumbs/world${i}.png`);
    this.load.image('jazz_keyart', '/assets/jazz-keyart.jpg');   // Jazz title splash art
    // Starsweeper: a bespoke space backdrop per zone (generated to align with the
    // game — a wrecked hangar, the asteroid void, reactor vents, the cargo bay, the core).
    // simple loading bar over the HTML loader
    const w = 420, x = (GAME_W - w) / 2, y = GAME_H / 2;
    const bar = this.add.graphics();
    this.load.on('progress', (p) => {
      bar.clear();
      bar.fillStyle(0x29335a, 1).fillRoundedRect(x, y, w, 16, 8);
      bar.fillStyle(0xffd34d, 1).fillRoundedRect(x, y, w * p, 16, 8);
    });
    this.load.on('complete', () => bar.destroy());
  }

  create() {
    this.bakeFromKenney();
    this.drawProcedural();
    this.defineAnims();
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hide');
    // a live-test level from /build.html → straight into Play (skip the menu)
    if (typeof window !== 'undefined' && window.__CUSTOM_LEVEL) this.scene.start('Play', { levelId: 999 });
    else this.scene.start('Title');
  }

  // ── bake a TILE-sized texture from a loaded source image ───────────────
  bake(key, srcKey, w, h, opt = {}) {
    const { sx = 1, fitW = w, fitH = h, flipX = false, tint = null, ax = 0.5, ay = 0.5, px = w / 2, py = h / 2 } = opt;
    const rt = this.make.renderTexture({ width: w, height: h }, false);
    const img = this.make.image({ key: srcKey, add: false }).setOrigin(ax, ay);
    img.setDisplaySize(fitW * sx, fitH);
    img.setPosition(px, py);
    if (flipX) img.setFlipX(true);
    if (tint != null) img.setTint(tint);
    rt.draw(img);
    rt.saveTexture(key);
    img.destroy();
  }

  // Recolor a tile to a new biome via a Canvas2D per-pixel hue shift (a multiply
  // tint can't turn green→blue since green lacks a blue channel). We desaturate
  // toward luminance, then push toward the target color. Believable cave stone.
  bakeTinted(key, srcKey, w, h, target) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const src = this.textures.get(srcKey).getSourceImage();
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, w, h);
    const tr = (target >> 16) & 255, tg = (target >> 8) & 255, tb = target & 255;
    const im = ctx.getImageData(0, 0, w, h); const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;                       // keep transparent pixels
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; // 0..1
      // map luminance onto the target color (dark→darker target, light→lighter)
      d[i] = Math.min(255, tr * (0.5 + lum));
      d[i + 1] = Math.min(255, tg * (0.5 + lum));
      d[i + 2] = Math.min(255, tb * (0.5 + lum));
    }
    ctx.putImageData(im, 0, 0);
    this.textures.addCanvas(key, canvas);
  }

  bakeFromKenney() {
    const tk = A.tileKey, ck = A.charKey;
    // ground / blocks — CARTOON tiles (bold black outline, flat fills), drawn
    // procedurally so they tile perfectly and read as Jazz's look, NOT the
    // platformer's pixel tiles. ground_grass/ground_dirt keep good LUMINANCE
    // structure so the per-biome recolor (bakeTinted) below still reads; `day`
    // shows their literal cartoon green/brown.
    this.cartoonGround('ground_grass', 0x63c74d, 0x9c6b3f, true);
    this.cartoonGround('ground_dirt', 0x9c6b3f, 0x6f4a2a, false);
    // every non-day biome recolors the SAME cartoon source per its palette.
    for (const [key, b] of Object.entries(BIOMES)) {
      if (key === 'day' || b.groundTop == null) continue;
      this.bakeTinted('ground_grass_' + key, 'ground_grass', TILE, TILE, b.groundTop);
      this.bakeTinted('ground_dirt_' + key, 'ground_dirt', TILE, TILE, b.groundDirt);
    }
    this.cartoonBrick('brick');
    this.cartoonQ('qblock', false);
    this.cartoonQ('usedblock', true);
    this.cartoonCrate('blastblock');   // shoot-to-clear crate (the bazooka beat)
    this.bakeMaterials();          // themeable platform/ground materials (mat_<key>_top/fill)
    this.bake('bush', tk(A.T.bushL), TILE * 1.6, TILE);

    // flag cloth
    this.bake('flag', tk(A.T.flag), TILE, TILE);

    // coins: spin frames by squashing width
    const cw = 44, ch = 50;
    this.bake('coin0', tk(A.T.coinA), cw, ch);
    this.bake('coin1', tk(A.T.coinA), cw, ch, { sx: 0.55 });
    this.bake('coin2', tk(A.T.coinB), cw, ch, { sx: 0.5 });
    this.bake('coin3', tk(A.T.coinA), cw, ch, { sx: 0.55, flipX: true });

    // hero: animated Pixel Adventure frog (spritesheets via assets.preloadHero);
    // real per-frame animations are defined in defineAnims(). No baking.

    // enemy from the mushroom tile
    const GW = 56, GH = 52;
    this.bake('goomba1', tk(A.T.mushroom), GW, GH, { ax: 0.5, ay: 1, px: GW / 2, py: GH });
    this.bake('goomba2', tk(A.T.mushroom), GW, GH, { ax: 0.5, ay: 1, px: GW / 2, py: GH, flipX: true });
    this.bake('goomba_squish', tk(A.T.mushroom), GW, GH, { fitH: GH * 0.5, ax: 0.5, ay: 1, px: GW / 2, py: GH });
  }

  // ── CARTOON tiles (Canvas2D → addCanvas, so bakeTinted can recolor them) ──
  // bold black outline + flat fills + one highlight = the Saturday-morning look.
  _canvas(key, draw) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
    draw(x, hex);
    this.textures.addCanvas(key, c);
  }
  // a grass/surface tile (hasGrass) or a plain fill tile. Top has the bold outline;
  // sides are left clean so the strip tiles seamlessly.
  cartoonGround(key, topCol, bodyCol, hasGrass) {
    this._canvas(key, (x, hex) => {
      x.fillStyle = hex(bodyCol); x.fillRect(0, 0, TILE, TILE);                 // dirt body
      x.fillStyle = 'rgba(0,0,0,0.16)';                                          // speckle shadows
      for (let i = 0; i < 7; i++) { const px = (i * 23) % TILE, py = 18 + (i * 17) % (TILE - 20); x.fillRect(px, py, 5, 5); }
      x.fillStyle = 'rgba(255,255,255,0.10)';
      for (let i = 0; i < 5; i++) x.fillRect((i * 31 + 7) % TILE, 22 + (i * 13) % (TILE - 26), 4, 4);
      if (hasGrass) {
        x.fillStyle = hex(topCol); x.fillRect(0, 0, TILE, 20);                   // grass band
        x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(0, 3, TILE, 4);       // top highlight
        x.fillStyle = hex(topCol);                                              // scalloped lower edge
        for (let cx = 6; cx < TILE; cx += 16) { x.beginPath(); x.arc(cx, 20, 7, 0, Math.PI); x.fill(); }
      } else {
        x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(0, 0, TILE, 3);
      }
      x.fillStyle = 'rgba(0,0,0,0.9)'; x.fillRect(0, 0, TILE, 3);                // bold top outline
    });
  }
  cartoonBrick(key) {
    this._canvas(key, (x, hex) => {
      x.fillStyle = hex(0xc8602f); x.fillRect(0, 0, TILE, TILE);                 // brick fill
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(4, 4, TILE - 8, 7);     // top sheen
      x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3;                       // mortar lines
      x.beginPath(); x.moveTo(0, TILE / 2); x.lineTo(TILE, TILE / 2);
      x.moveTo(TILE / 2, 0); x.lineTo(TILE / 2, TILE / 2); x.moveTo(TILE / 4, TILE / 2); x.lineTo(TILE / 4, TILE); x.moveTo(TILE * 3 / 4, TILE / 2); x.lineTo(TILE * 3 / 4, TILE); x.stroke();
      x.strokeStyle = '#1a1020'; x.lineWidth = 4; x.strokeRect(2, 2, TILE - 4, TILE - 4);  // bold outline
    });
  }
  cartoonQ(key, used) {
    this._canvas(key, (x, hex) => {
      x.fillStyle = hex(used ? 0x8a6a3a : 0xffc828); x.fillRect(0, 0, TILE, TILE);
      if (!used) { x.fillStyle = 'rgba(255,255,255,0.30)'; x.fillRect(5, 5, TILE - 10, 8); }
      x.fillStyle = used ? 'rgba(0,0,0,0.35)' : '#2a1f10';                       // rivets
      for (const [rx, ry] of [[8, 8], [TILE - 14, 8], [8, TILE - 14], [TILE - 14, TILE - 14]]) x.fillRect(rx, ry, 6, 6);
      if (!used) { x.fillStyle = '#2a1f10'; x.font = 'bold 38px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', TILE / 2, TILE / 2 + 2); }
      x.strokeStyle = '#1a1020'; x.lineWidth = 4; x.strokeRect(2, 2, TILE - 4, TILE - 4);
    });
  }

  // a BLAST CRATE: a riveted metal crate with a bright red TARGET, so it reads
  // "shoot me". Bold outline like the rest of the cartoon tiles.
  cartoonCrate(key) {
    this._canvas(key, (x, hex) => {
      x.fillStyle = hex(0x9a7b4a); x.fillRect(0, 0, TILE, TILE);                  // wood body
      x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(4, 4, TILE - 8, 6);
      x.strokeStyle = 'rgba(40,24,10,0.65)'; x.lineWidth = 4;                     // plank frame
      x.strokeRect(5, 5, TILE - 10, TILE - 10);
      x.beginPath(); x.moveTo(6, 6); x.lineTo(TILE - 6, TILE - 6); x.moveTo(TILE - 6, 6); x.lineTo(6, TILE - 6); x.stroke(); // diagonal braces
      // red target roundel (the "shoot here")
      x.fillStyle = '#e23b3b'; x.beginPath(); x.arc(TILE / 2, TILE / 2, 11, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(TILE / 2, TILE / 2, 7, 0, 7); x.fill();
      x.fillStyle = '#e23b3b'; x.beginPath(); x.arc(TILE / 2, TILE / 2, 3.5, 0, 7); x.fill();
      x.strokeStyle = '#1a1020'; x.lineWidth = 4; x.strokeRect(2, 2, TILE - 4, TILE - 4); // bold outline
    });
  }

  // ── MATERIALS: one cartoon tile recipe per material × role (top/fill) ──────
  // Each is drawn in the bold-outline cartoon style so a themed platform (grass /
  // stone / metal / lava / wood / sand) reads as part of Jazz's world.
  bakeMaterials() {
    for (const [key, m] of Object.entries(MATERIALS)) {
      this._matTile(materialTex(key, 'top'), m, true);
      this._matTile(materialTex(key, 'fill'), m, false);
    }
  }
  _matTile(key, m, top) {
    this._canvas(key, (x, hex) => {
      const base = top ? m.top : m.fill;
      x.fillStyle = hex(base); x.fillRect(0, 0, TILE, TILE);
      const dark = 'rgba(0,0,0,0.20)', lite = 'rgba(255,255,255,0.16)';
      // style detail
      if (m.style === 'grass' && top) {
        x.fillStyle = hex(m.fill); x.fillRect(0, 18, TILE, TILE - 18);            // dirt body below grass
        x.fillStyle = hex(m.top); x.fillRect(0, 0, TILE, 20);
        x.fillStyle = lite; x.fillRect(0, 3, TILE, 4);
        x.fillStyle = hex(m.top); for (let cx = 6; cx < TILE; cx += 16) { x.beginPath(); x.arc(cx, 20, 7, 0, Math.PI); x.fill(); }
      } else if (m.style === 'stone') {
        x.strokeStyle = dark; x.lineWidth = 3; x.beginPath();                     // a couple of cracks
        x.moveTo(14, 8); x.lineTo(26, 26); x.lineTo(20, 42); x.moveTo(44, 14); x.lineTo(52, 34); x.stroke();
        if (top) { x.fillStyle = lite; x.fillRect(0, 4, TILE, 5); }
      } else if (m.style === 'metal') {
        x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(10, 0, 10, TILE);      // bright vertical sheen
        x.fillStyle = dark; for (const [rx, ry] of [[7, 7], [TILE - 13, 7], [7, TILE - 13], [TILE - 13, TILE - 13]]) { x.fillRect(rx, ry, 6, 6); } // rivets
        if (top) { x.fillStyle = 'rgba(255,255,255,0.30)'; x.fillRect(0, 3, TILE, 4); }
        x.strokeStyle = 'rgba(0,0,0,0.30)'; x.lineWidth = 2; x.strokeRect(3, 3, TILE - 6, TILE - 6); // panel seam
      } else if (m.style === 'lava') {
        x.fillStyle = hex(m.accent || 0xff6a1e); x.globalAlpha = 0.9;             // glowing cracks
        x.fillRect(10, 22, 18, 4); x.fillRect(8, 23, 4, 14); x.fillRect(38, 10, 4, 20); x.fillRect(38, 30, 16, 4);
        x.globalAlpha = 1; x.fillStyle = 'rgba(255,180,80,0.18)'; x.fillRect(0, 0, TILE, TILE); // ember haze
        if (top) { x.fillStyle = 'rgba(255,120,40,0.5)'; x.fillRect(0, 0, TILE, 3); }
      } else if (m.style === 'wood') {
        x.strokeStyle = dark; x.lineWidth = 2;                                    // plank grain
        for (let gy = (top ? 10 : 6); gy < TILE; gy += 16) { x.beginPath(); x.moveTo(0, gy); x.lineTo(TILE, gy); x.stroke(); }
        x.fillStyle = dark; x.beginPath(); x.arc(20, 30, 4, 0, 7); x.fill();      // a knot
        if (top) { x.fillStyle = lite; x.fillRect(0, 2, TILE, 4); }
      } else if (m.style === 'sand') {
        x.fillStyle = lite; for (let i = 0; i < 8; i++) x.fillRect((i * 19 + 5) % TILE, 14 + (i * 11) % (TILE - 18), 4, 3);
        x.fillStyle = dark; for (let i = 0; i < 6; i++) x.fillRect((i * 27) % TILE, 24 + (i * 13) % (TILE - 26), 3, 3);
        if (top) { x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(0, 4, TILE, 5); }
      }
      // the bold top outline (the cartoon read) — only the top tile gets the heavy edge
      x.fillStyle = top ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.18)';
      x.fillRect(0, 0, TILE, top ? 3 : 2);
    });
  }

  // ── procedural: sky, mountains, hills, clouds, green pipe, particles ────
  drawProcedural() {
    const g0 = (w, h, draw) => { const g = this.make.graphics({ add: false }); draw(g); g.generateTexture.length; return g; };
    const tex = (key, w, h, draw) => { const g = this.make.graphics({ add: false }); draw(g); g.generateTexture(key, w, h); g.destroy(); };
    const adj = (hex, f) => {
      let r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
      if (f >= 0) { r += (255 - r) * f; gg += (255 - gg) * f * 0.9; b += (255 - b) * f * 0.6; }
      else { const k = -f; r -= r * k * 0.8; gg -= gg * k * 0.85; b -= b * k; }
      const c = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
      return (c(r) << 16) | (c(gg) << 8) | c(b);
    };
    const mix = (a, b, t) => {
      const c = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
      return (c(ar + (br - ar) * t) << 16) | (c(ag + (bg - ag) * t) << 8) | c(ab + (bb - ab) * t);
    };

    // ── PIXEL SKY: discrete dithered bands (no smooth gradient) ──────────
    // 5 horizontal color bands top→bottom with a 2px Bayer stipple at each
    // seam, so it reads as limited-palette pixel art, not a CSS gradient.
    // Drawn at a low internal resolution then displayed scaled (chunky pixels).
    const skyBands = [0x3b7dd8, 0x4e9be6, 0x6fb6f0, 0x95cdf6, 0xbfe3fb];
    tex('sky_px', 160, 90, (g) => {
      const bh = 90 / skyBands.length;
      skyBands.forEach((col, i) => { g.fillStyle(col, 1); g.fillRect(0, Math.floor(i * bh), 160, Math.ceil(bh) + 1); });
      // Bayer-ish dither at the seams: stipple the upper band's color one row down
      for (let i = 1; i < skyBands.length; i++) {
        const y = Math.floor(i * bh);
        g.fillStyle(skyBands[i - 1], 1);
        for (let x = 0; x < 160; x += 2) { g.fillRect(x + (Math.floor(y / 2) % 2), y, 1, 1); g.fillRect(x + 1 - (Math.floor(y / 2) % 2), y - 1, 1, 1); }
      }
      // chunky pixel sun (stepped disc, upper-left) — no soft glow
      const sx = 34, sy = 20, R = 9;
      for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
        const d = Math.round(Math.sqrt(xx * xx + yy * yy));
        if (d <= R) { g.fillStyle(d > R - 2 ? 0xffe08a : (d > R - 5 ? 0xfff3c4 : 0xfffdf0), 1); g.fillRect(sx + xx, sy + yy, 1, 1); }
      }
    });

    // ── pixel hill rows: a single Kenney hill-tile row, scaled up so the hills
    //    read as real rolling hills (not thin strips). Far = bluer/flatter. ──
    const SRC = 18;
    const hillRow = (key, tileKeys, scale, tint) => {
      const tilesW = 40, w = tilesW * SRC * scale, h = SRC * scale;
      if (this.textures.exists(key)) this.textures.remove(key);
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      for (let c = 0; c < tilesW; c++) {
        const k = tileKeys[c % tileKeys.length];
        ctx.drawImage(this.textures.get(k).getSourceImage(), c * SRC * scale, 0, SRC * scale, SRC * scale);
      }
      if (tint) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; }
      this.textures.addCanvas(key, canvas);
    };
    hillRow('bg_hills_far', ['bg14', 'bg15'], 5, 'rgba(120,170,235,0.45)');  // distant: hazed blue
    hillRow('bg_hills_near', ['bg15', 'bg14'], 4, 'rgba(90,200,120,0.12)');  // near: greener

    // ── clouds: drawn procedurally as pixel blobs (Saint11: simple shape, one
    //    highlight + one shadow). NOTE: Kenney bg tiles 9-11 are TREELINE tiles
    //    (white field w/ trees), not clouds — using them put "trees in the sky".
    //    Drawing our own guarantees they read as clouds and tile seamlessly.
    {
      const PX = 4;                       // chunky pixel size
      const cols = 320, rows = 64;        // band in PX units (band repeats every cols*PX)
      const w = cols * PX, h = rows * PX;
      if (this.textures.exists('bg_clouds')) this.textures.remove('bg_clouds');
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x * PX, y * PX, PX, PX); };
      // one fluffy cloud: white body of overlapping circles, then a 1px lighter
      // shadow ONLY along the bottom edge of each column (no grey patches).
      const cloud = (cx, cy, scale) => {
        const lobes = [[-7, 1, 4], [-2, -2, 6], [4, -1, 5], [9, 1, 4], [1, 2, 7]];
        const colBottom = {};   // track lowest white pixel per column for shading
        lobes.forEach(([dx, dy, r]) => {
          const RR = Math.round(r * scale);
          for (let yy = -RR; yy <= RR; yy++) for (let xx = -RR; xx <= RR; xx++) {
            if (xx * xx + yy * yy <= RR * RR) {
              const X = cx + Math.round(dx * scale) + xx, Y = cy + dy + yy;
              px(X, Y, '#ffffff');
              if (Y > (colBottom[X] ?? -1e9)) colBottom[X] = Y;
            }
          }
        });
        // soft shadow: recolor only the bottom 1-2 px of each column
        Object.entries(colBottom).forEach(([X, Y]) => { px(+X, Y, '#cfe2f5'); px(+X, Y - 1, '#e8f2fc'); });
      };
      cloud(42, 30, 1.2); cloud(120, 20, 0.85); cloud(196, 34, 1.4); cloud(270, 22, 1.0);
      this.textures.addCanvas('bg_clouds', canvas);
    }

    // ── distant treeline: NOW correctly uses the tree tiles (9-11) on horizon ──
    hillRow('bg_treeline', ['bg9', 'bg10', 'bg11'], 4, 'rgba(120,170,235,0.5)');

    // CARTOON pipe (bold black outline, flat green, big highlight) — 4 quadrant
    // tiles. The rim (top row) is a fat capsule lip; the body has clean shading.
    const body = (g, rim) => {
      const top = rim ? 16 : 0;
      g.fillStyle(adj(C.pipe, -0.3), 1); g.fillRect(0, top, TILE, TILE - top);   // body base
      g.fillStyle(C.pipe, 1); g.fillRect(4, top, TILE - 8, TILE - top);          // mid
      g.fillStyle(adj(C.pipe, 0.5), 1); g.fillRect(9, top, 9, TILE - top);       // bright highlight stripe
      g.fillStyle(adj(C.pipe, -0.15), 1); g.fillRect(TILE - 11, top, 7, TILE - top);
    };
    const outlineL = (g, top) => { g.fillStyle(0x14210f, 1); g.fillRect(0, top, 4, TILE - top); };  // left edge
    const outlineR = (g, top) => { g.fillStyle(0x14210f, 1); g.fillRect(TILE - 4, top, 4, TILE - top); };
    const lip = (g, side) => {  // the rim cap: a fat lip overhanging, with outline + sheen
      g.fillStyle(0x14210f, 1); g.fillRect(side === 'l' ? -8 : 0, 0, TILE + 8, 18);
      g.fillStyle(C.pipe, 1); g.fillRect(side === 'l' ? -6 : 2, 2, TILE + 6, 14);
      g.fillStyle(adj(C.pipe, 0.5), 1); g.fillRect(side === 'l' ? 6 : 2, 4, side === 'l' ? TILE : TILE - 6, 5);
    };
    tex('pipe_tl', TILE, TILE, (g) => { body(g, true); outlineL(g, 16); lip(g, 'l'); });
    tex('pipe_tr', TILE, TILE, (g) => { body(g, true); outlineR(g, 16); lip(g, 'r'); });
    tex('pipe_bl', TILE, TILE, (g) => { body(g, false); outlineL(g, 0); });
    tex('pipe_br', TILE, TILE, (g) => { body(g, false); outlineR(g, 0); });

    // particles
    tex('dust', 20, 20, (g) => { g.fillStyle(0xffffff, 0.95); g.fillCircle(10, 10, 9); g.fillStyle(0xeaf2ff, 0.6); g.fillCircle(10, 10, 5); });
    tex('spark', 18, 18, (g) => { g.fillStyle(C.coinShine, 1); g.fillTriangle(9, 0, 11, 7, 7, 7); g.fillTriangle(9, 18, 11, 11, 7, 11); g.fillTriangle(0, 9, 7, 7, 7, 11); g.fillTriangle(18, 9, 11, 7, 11, 11); g.fillCircle(9, 9, 3); });
    tex('chunk', 16, 16, (g) => { g.fillStyle(adj(C.brick, -0.2), 1); g.fillRect(1, 1, 14, 14); g.fillStyle(C.brick, 1); g.fillRect(2, 2, 11, 11); });
    tex('pixel', 6, 6, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(3, 3, 3); });

    // power-up mushroom: red cap + white spots + cream stem (classic, distinct
    // from the brown goomba enemy). 48px.
    tex('mushroom', 48, 44, (g) => {
      g.fillStyle(0xf5ead2, 1); g.fillRoundedRect(13, 22, 22, 20, 5);          // stem
      g.fillStyle(adj(0xf5ead2, -0.12), 1); g.fillRect(13, 36, 22, 6);          // stem shade
      g.fillStyle(0x2a2a33, 1); g.fillRect(17, 28, 5, 6); g.fillRect(26, 28, 5, 6); // eyes
      g.fillStyle(0xd83a36, 1); g.fillEllipse(24, 18, 44, 28);                  // red cap
      g.fillStyle(adj(0xd83a36, -0.2), 1); g.fillEllipse(24, 22, 44, 18);       // cap underside shade
      g.fillStyle(0xd83a36, 1); g.fillEllipse(24, 17, 44, 24);
      g.fillStyle(0xffffff, 1);                                                 // spots
      g.fillCircle(11, 16, 5); g.fillCircle(37, 16, 5); g.fillCircle(24, 9, 6);
      g.fillStyle(adj(0xd83a36, 0.3), 1); g.fillEllipse(16, 11, 12, 6);         // cap highlight
    });

    // piranha plant: toothy green head on a stem (the L2 hazard you avoid).
    // Origin top-ish so it reads emerging from the pipe.
    tex('piranha', 44, 56, (g) => {
      g.fillStyle(0x2f9c47, 1); g.fillRect(18, 30, 8, 26);                       // stem
      g.fillStyle(adj(0x2f9c47, 0.25), 1); g.fillRect(19, 30, 3, 26);            // stem hilite
      g.fillStyle(0xffffff, 1); g.fillCircle(13, 24, 3); g.fillCircle(31, 24, 3); // spots
      g.fillStyle(0xd83a55, 1); g.fillEllipse(22, 20, 40, 34);                   // red head
      g.fillStyle(adj(0xd83a55, -0.22), 1); g.fillEllipse(22, 26, 40, 20);       // lower shade
      g.fillStyle(0xffffff, 1);                                                  // teeth (open mouth)
      g.fillTriangle(8, 18, 12, 24, 6, 24); g.fillTriangle(36, 18, 38, 24, 32, 24);
      g.fillStyle(0x2a2a33, 1); g.fillRect(14, 12, 16, 6);                        // mouth gap
      g.fillStyle(0xffffff, 1); g.fillCircle(12, 8, 4); g.fillCircle(32, 8, 4);   // eyes
      g.fillStyle(0x2a2a33, 1); g.fillCircle(13, 8, 2); g.fillCircle(31, 8, 2);
    });

    // cave sky: dark, near-black with a faint blue vignette (the underground)
    tex('sky_cave', 160, 90, (g) => {
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        g.fillStyle(mix(0x0b0b1a, 0x16243f, t), 1);
        g.fillRect(0, Math.floor(t * 90), 160, 7);
      }
      // a few faint cave specks
      g.fillStyle(0x2a3a5a, 1);
      for (let i = 0; i < 30; i++) g.fillRect((i * 53) % 160, (i * 31) % 90, 1, 1);
    });

    // sky-biome backdrop (L3): high altitude — deep azure up top fading to a
    // hazy near-white horizon (atmospheric perspective), so white cloud
    // platforms pop. Dithered bands like sky_px, plus a high bright sun.
    const skyHi = [0x2f6fd6, 0x4d8ce8, 0x74b0f0, 0xa6d4f7, 0xd6eefc];
    tex('sky_sky', 160, 90, (g) => {
      const bh = 90 / skyHi.length;
      skyHi.forEach((col, i) => { g.fillStyle(col, 1); g.fillRect(0, Math.floor(i * bh), 160, Math.ceil(bh) + 1); });
      for (let i = 1; i < skyHi.length; i++) {
        const y = Math.floor(i * bh);
        g.fillStyle(skyHi[i - 1], 1);
        for (let x = 0; x < 160; x += 2) { g.fillRect(x + (Math.floor(y / 2) % 2), y, 1, 1); g.fillRect(x + 1 - (Math.floor(y / 2) % 2), y - 1, 1, 1); }
      }
      const sx = 124, sy = 16, R = 8;   // bright sun, upper-right
      for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
        const d = Math.round(Math.sqrt(xx * xx + yy * yy));
        if (d <= R) { g.fillStyle(d > R - 2 ? 0xffe9a6 : (d > R - 5 ? 0xfff6d6 : 0xfffefb), 1); g.fillRect(sx + xx, sy + yy, 1, 1); }
      }
    });

    // ── per-biome skies (Levels 4–13): same dithered-band recipe as sky_px,
    //    colors from the biome table, optional stamped sun → sky_<theme>. ──
    const bandSky = (key, bands, sun) => tex(key, 160, 90, (g) => {
      const bh = 90 / bands.length;
      bands.forEach((col, i) => { g.fillStyle(col, 1); g.fillRect(0, Math.floor(i * bh), 160, Math.ceil(bh) + 1); });
      for (let i = 1; i < bands.length; i++) {
        const y = Math.floor(i * bh);
        g.fillStyle(bands[i - 1], 1);
        for (let x = 0; x < 160; x += 2) { g.fillRect(x + (Math.floor(y / 2) % 2), y, 1, 1); g.fillRect(x + 1 - (Math.floor(y / 2) % 2), y - 1, 1, 1); }
      }
      if (sun) {
        const [sxx, syy] = sun, R = 8;
        for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
          const d = Math.round(Math.sqrt(xx * xx + yy * yy));
          if (d <= R) { g.fillStyle(d > R - 2 ? 0xffe2a0 : (d > R - 5 ? 0xfff2cf : 0xfffdf4), 1); g.fillRect(sxx + xx, syy + yy, 1, 1); }
        }
      }
    });
    for (const [key, b] of Object.entries(BIOMES)) { if (b.sky) bandSky('sky_' + key, b.sky, b.sun); }

    // ── deadly pit fills (lava/acid/quicksand/spikes) → hz_<type>, tiled across
    //    a level's gap columns by Play.buildHazards. Liquid = color bands + a
    //    bright wavy surface; 'teeth' = a metal spike sawtooth row. ──
    const hazTile = (key, hz) => tex(key, TILE, TILE, (g) => {
      if (hz.teeth) {
        g.fillStyle(hz.colors[0], 1); g.fillRect(0, 0, TILE, TILE);
        g.fillStyle(hz.colors[1] || hz.colors[0], 1); g.fillRect(0, TILE / 2, TILE, TILE / 2);
        const teeth = 4, tw = TILE / teeth;
        for (let i = 0; i < teeth; i++) {
          const x = i * tw;
          g.fillStyle(hz.surf, 1); g.fillTriangle(x + 1, 24, x + tw / 2, 1, x + tw - 1, 24);
          g.fillStyle(0xffffff, 0.55); g.fillTriangle(x + tw / 2, 2, x + tw / 2 - 2, 15, x + tw / 2 + 1, 15);
        }
        return;
      }
      const cols = hz.colors, bh = TILE / cols.length;
      cols.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(0, Math.floor(i * bh), TILE, Math.ceil(bh) + 1); });
      g.fillStyle(hz.surf, 1);
      for (let x = 0; x < TILE; x++) { const y = 5 + Math.round(3 * Math.sin(x * 0.49)); g.fillRect(x, y, 1, 3); }
      g.fillStyle(hz.surf, 0.6);
      for (let i = 0; i < 9; i++) g.fillRect((i * 23) % TILE, 18 + (i * 13) % (TILE - 22), 2, 2);
    });
    for (const [key, hz] of Object.entries(HAZARDS)) hazTile('hz_' + key, hz);

    // spring / bounce pad — a coiled trampoline that sits on the floor and flings
    // the player skyward. Two frames (rest + compressed) for a squash on contact.
    const springTex = (key, squashed) => tex(key, TILE, TILE, (g) => {
      const topY = squashed ? TILE - 26 : TILE - 42;     // plate height
      g.fillStyle(0x3a3f4d, 1); g.fillRect(10, TILE - 8, TILE - 20, 8);          // base
      g.fillStyle(0xe24b3a, 1);                                                  // red coil
      const coilTop = topY + 6, coils = squashed ? 2 : 3;
      for (let i = 0; i < coils; i++) g.fillRect(16, TILE - 12 - i * ((TILE - 14 - coilTop) / coils || 8), TILE - 32, 4);
      g.fillStyle(0xc0c6d4, 1); g.fillRect(6, topY, TILE - 12, 10);              // top plate
      g.fillStyle(0xffffff, 0.55); g.fillRect(10, topY + 1, TILE - 20, 3);       // plate shine
    });
    springTex('spring', false);
    springTex('spring_hit', true);

    // one-way platform — a thin wooden plank at the TOP of its cell (air below):
    // you land on it from above but pass straight up through it from beneath.
    tex('oneway', TILE, TILE, (g) => {
      g.fillStyle(0x7a4f29, 1); g.fillRect(0, 0, TILE, 18);             // plank body
      g.fillStyle(0xa9743c, 1); g.fillRect(0, 0, TILE, 6);             // top highlight
      g.fillStyle(0x5a3a1d, 1); g.fillRect(0, 15, TILE, 3);           // underside shade
      g.fillStyle(0x5a3a1d, 1); for (let x = 12; x < TILE; x += 21) g.fillRect(x, 1, 2, 14); // seams
    });

    // ice — a glossy frozen surface block (low friction; you slide on it)
    tex('ice', TILE, TILE, (g) => {
      g.fillStyle(0xbfe9ff, 1); g.fillRect(0, 0, TILE, TILE);          // ice body
      g.fillStyle(0xe8f8ff, 1); g.fillRect(0, 0, TILE, 9);             // top sheen
      g.fillStyle(0x9fd6f5, 1); g.fillRect(0, TILE - 7, TILE, 7);      // bottom shade
      g.fillStyle(0xffffff, 0.55); g.fillRect(7, 14, 18, 4); g.fillRect(32, 30, 14, 3); // glints
      g.lineStyle(2, 0x8fc4e8, 0.6); g.strokeRect(1, 1, TILE - 2, TILE - 2);
    });

  }

  defineAnims() {
    const a = this.anims;
    if (!a.exists('coin_spin')) a.create({ key: 'coin_spin', frames: [0, 1, 2, 3].map((i) => ({ key: `coin${i}` })), frameRate: 12, repeat: -1 });
    // one loop per enemy KIND — 2-frame bot walk cycles: slow waddle for ground
    // chassis, faster for the drones (their two rotor poses read as a spin blur).
    const erate = { goomba: 6, beetle: 7, ghoul: 8, snowman: 5, spider: 6, lavaslug: 7,
      bat: 12, bird: 12, buzzard: 11, fly: 13, shard: 11, crow: 12, boss: 2, shieldbot: 6, spiderbot: 9 };
    Object.keys(A.ENEMY_SPRITES).forEach((k) => {
      if (a.exists(`${k}_walk`)) return;
      a.create({ key: `${k}_walk`, frames: a.generateFrameNumbers(k), frameRate: erate[k] || 8, repeat: -1 });
    });
    // Pip (astronaut) — model-sheet-consistent sprites: a real 6-frame run cycle
    // + distinct idle/jump/fall poses. Motion also gets engine squash/stretch.
    const heroFrame = (key, tex) => { if (!a.exists(key)) a.create({ key, frames: [{ key: tex, frame: 0 }], frameRate: 1, repeat: -1 }); };
    if (!a.exists('hero_run')) a.create({ key: 'hero_run', frames: a.generateFrameNumbers('jazz_run', { start: 0, end: 5 }), frameRate: 14, repeat: -1 });
    heroFrame('hero_idle', 'jazz_idle');
    heroFrame('hero_jump', 'jazz_jump');
    heroFrame('hero_fall', 'jazz_fall');     // a distinct falling pose now
    heroFrame('hero_djump', 'jazz_jump');
  }
}
