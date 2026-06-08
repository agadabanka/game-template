// Three-state theme picker: system → light → dark → system.
// FOUC is prevented by the inline script in <head> that sets data-theme synchronously.

const root = document.documentElement;
const KEY = 'theme';
const STATES = ['system', 'light', 'dark'];

// Inline SVG paths render identically on iOS Safari, Android Chrome, and desktop.
const PATHS = {
  system:
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none"></path>',
  light:
    '<circle cx="12" cy="12" r="4"></circle>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>',
  dark: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
};
const LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

const stored = () => localStorage.getItem(KEY) || 'system';

function effectiveMode(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(pref) {
  root.dataset.theme = effectiveMode(pref);
}

const btn = document.getElementById('theme-toggle');
const iconEl = btn?.querySelector('.theme-icon');

function refresh() {
  const pref = stored();
  if (iconEl) iconEl.innerHTML = PATHS[pref];
  if (btn) {
    btn.setAttribute('aria-label', `Theme: ${LABELS[pref]} (click to change)`);
    btn.title = `Theme: ${LABELS[pref]}`;
  }
}

btn?.addEventListener('click', () => {
  const cur = stored();
  const next = STATES[(STATES.indexOf(cur) + 1) % STATES.length];
  localStorage.setItem(KEY, next);
  apply(next);
  refresh();
});

window
  .matchMedia('(prefers-color-scheme: light)')
  .addEventListener('change', () => {
    if (stored() === 'system') apply('system');
  });

refresh();
