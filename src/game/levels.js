// Level registry — maps id → builder. Add new levels here; Title's level-select
// and Play (?level=N) read from this list. Each builder returns the level object
// ({ id, name, theme, W, H, ..., start, goal }).
import { buildLevel1 } from './level.js';
import { buildLevel2 } from './level2.js';
import { buildLevel3 } from './level3.js';
import { buildLevel4 } from './level4.js';
import { buildLevel5 } from './level5.js';
import { WORLDS, buildWorldById } from './merged.js';

// Starsweeper is a 5-zone game. (The 8 inherited jazz worlds were removed in the
// cleanup pass — they weren't shipped and referenced deleted assets.)
export const LEVELS = [
  { id: 1, name: 'First Steps', theme: 'day', build: buildLevel1 },
  { id: 2, name: 'Caverns', theme: 'cave', build: buildLevel2 },
  { id: 3, name: 'Skyway', theme: 'sky', build: buildLevel3 },
  { id: 4, name: 'The Keep', theme: 'castle', build: buildLevel4 },
  { id: 5, name: 'Finale', theme: 'dusk', build: buildLevel5 },
];

// The 5 zones are also exposed as selectable "worlds" 101–105 (see merged.js).
export { WORLDS, buildWorldById };

export function buildLevelById(id) {
  if (Number(id) >= 101) { const w = WORLDS.find((x) => x.id === Number(id)); if (w) return buildWorldById(w.id); }
  const entry = LEVELS.find((l) => l.id === Number(id)) || LEVELS[0];
  return entry.build();
}
