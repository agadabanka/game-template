// ── MATERIALS: the first slice of the "AI-first engine" element model ────────
// A material bundles the three facets every world element should carry together:
//   • AESTHETIC — a bold-outline cartoon tile recipe (drawn in Boot.bakeMaterials)
//   • PHYSICS   — a friction class the player feels ('normal' | 'slick')
//   • GROUNDING — an `ai` tag describing how the autopilot/feel-model should read
//                 the surface (all current materials are standable 'ground').
// A platform/ground tile can carry `mat:'<key>'` (in the level DSL) to OVERRIDE
// the per-biome ground look with an explicit material — e.g. a METAL ledge in the
// foundry or STONE in the caverns. Look + footing + meaning stay in ONE place, so
// adding a material is one entry here + one draw recipe; the engine wires the rest.
//
// `friction:'slick'` routes through the SAME low-friction path as ice (gate-tested)
// — so a slick material only changes feel, never the autopilot's grounding.

export const MATERIALS = {
  grass: { label: 'Grass',     top: 0x63c74d, fill: 0x9c6b3f, style: 'grass', friction: 'normal', ai: 'ground' },
  stone: { label: 'Stone',     top: 0x9aa2ad, fill: 0x5b626d, style: 'stone', friction: 'normal', ai: 'ground' },
  metal: { label: 'Metal',     top: 0x93a6c0, fill: 0x55606f, style: 'metal', friction: 'slick',  ai: 'ground' },
  lava:  { label: 'Lava rock', top: 0x5a3a30, fill: 0x301f1b, accent: 0xff6a1e, style: 'lava', friction: 'normal', ai: 'ground' },
  wood:  { label: 'Wood',      top: 0xb5793f, fill: 0x7a4f29, style: 'wood', friction: 'normal', ai: 'ground' },
  sand:  { label: 'Sand',      top: 0xe6c878, fill: 0xbf9648, style: 'sand', friction: 'normal', ai: 'ground' },

  // ── STARSWEEPER space materials (normal friction → gate-safe; distinct look per zone) ──
  hull:     { label: 'Hull plate', top: 0x6a7a92, fill: 0x363f4d, style: 'metal', friction: 'normal', ai: 'ground' },
  asteroid: { label: 'Asteroid',   top: 0x8a7c68, fill: 0x423a30, style: 'stone', friction: 'normal', ai: 'ground' },
  brass:    { label: 'Hot brass',  top: 0xb08040, fill: 0x553719, accent: 0xff8a2a, style: 'lava', friction: 'normal', ai: 'ground' },
  crate:    { label: 'Cargo crate',top: 0x7d6a4a, fill: 0x47381f, style: 'wood', friction: 'normal', ai: 'ground' },
  reactor:  { label: 'Core plate', top: 0x7a5a8e, fill: 0x371f44, accent: 0xc060ff, style: 'lava', friction: 'normal', ai: 'ground' },
};

// texture key for a material's surface (role: 'top' | 'fill')
export function materialTex(key, role) { return `mat_${key}_${role}`; }

// a sensible default material per world theme (used by the verticalizer so the
// optional platform towers read as part of each world — the Tin Tyrant builds in
// metal, the caverns are stone, etc.). Falls back to wood.
export const THEME_MATERIAL = {
  cave: 'stone', dusk: 'wood', desert: 'sand', volcano: 'metal', storm: 'metal',
  day: 'grass', sky: 'stone', castle: 'stone', snow: 'stone', jungle: 'wood',
  swamp: 'wood', crystal: 'stone', bastion: 'metal',
};
