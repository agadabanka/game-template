// ── Deterministic UI / scene state machine ───────────────────────────────
// One source of truth for "where in the app are we", so the flow menu → play →
// pause → resume → exit → menu → … is explicit, validatable, and regression-
// tested (tools/eval/ui-check.mjs). Every scene transition goes through
// uiTransition(); invalid transitions are flagged (and throw in strict mode),
// and the full transition log lives in the registry for the eval to assert on.

export const STATES = ['boot', 'menu', 'playing', 'paused', 'won', 'gameover'];

// from → allowed next states
export const TRANSITIONS = {
  boot:     ['menu'],
  menu:     ['playing'],
  playing:  ['paused', 'won', 'gameover', 'menu'],
  paused:   ['playing', 'menu'],
  won:      ['playing', 'menu'],
  gameover: ['playing', 'menu'],
};

export function uiState(scene) {
  return (scene.registry && scene.registry.get('uistate')) || 'boot';
}

// Transition to `to`; returns true if the transition was legal. Records it.
export function uiTransition(scene, to) {
  const reg = scene.registry;
  const from = reg.get('uistate') || 'boot';
  const ok = from === to || (TRANSITIONS[from] || []).includes(to);
  reg.set('uistate', to);
  const log = reg.get('uistate_log') || [];
  log.push({ from, to, ok, scene: scene.scene ? scene.scene.key : '?' });
  reg.set('uistate_log', log);
  if (!ok) {
    const msg = `[uistate] illegal transition ${from} → ${to}`;
    if (typeof window !== 'undefined' && window.__uistateStrict) throw new Error(msg);
    if (typeof console !== 'undefined') console.warn(msg);
  }
  return ok;
}
