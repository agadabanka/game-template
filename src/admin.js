// Brain editor — load + save knowledge.json, optional admin token.

const brainEl = document.getElementById('brain');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const authBox = document.getElementById('admin-auth');
const tokenEl = document.getElementById('admin-token');

const TOKEN_KEY = 'the-rig.admin-token';
let adminRequired = false;

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.classList.remove('is-success', 'is-error');
  if (kind) statusEl.classList.add(kind);
}

async function init() {
  try {
    const cfg = await fetch('/api/config').then((r) => r.json());
    adminRequired = Boolean(cfg.admin_required);
    if (adminRequired) {
      authBox.hidden = false;
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) tokenEl.value = saved;
    }
  } catch {
    // not fatal — leave auth hidden, save attempt will surface 401 if needed
  }

  try {
    const k = await fetch('/api/knowledge').then((r) => r.json());
    brainEl.value = k.brain || '';
    if (k.updated_at) {
      setStatus(`Last saved ${new Date(k.updated_at).toLocaleString()}`);
    } else {
      setStatus('No saved knowledge yet.');
    }
  } catch (err) {
    setStatus(`Failed to load: ${err.message}`, 'is-error');
  }
}

async function save() {
  saveBtn.disabled = true;
  setStatus('Saving…');
  const headers = { 'Content-Type': 'application/json' };
  if (adminRequired) {
    const token = tokenEl.value.trim();
    if (!token) {
      setStatus('Admin token required.', 'is-error');
      saveBtn.disabled = false;
      return;
    }
    headers['x-admin-token'] = token;
    localStorage.setItem(TOKEN_KEY, token);
  }
  try {
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers,
      body: JSON.stringify({ brain: brainEl.value }),
    });
    if (res.status === 401) {
      setStatus('Unauthorized — check admin token.', 'is-error');
      saveBtn.disabled = false;
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const saved = await res.json();
    setStatus(`Saved ${new Date(saved.updated_at).toLocaleString()}`, 'is-success');
  } catch (err) {
    setStatus(`Save failed: ${err.message}`, 'is-error');
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener('click', save);
init();
