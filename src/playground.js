// Image playground — only shown if the server reports Gemini is configured.
// Demonstrates the runtime Gemini "ability" (POST /api/image/generate).

const panel = document.getElementById('img-playground');
const form = document.getElementById('img-form');
const input = document.getElementById('img-prompt');
const btn = document.getElementById('img-go');
const out = document.getElementById('img-out');
const note = document.getElementById('img-note');

if (panel) {
  fetch('/api/config')
    .then((r) => r.json())
    .then((c) => {
      if (!c?.gemini) return; // leave hidden if Gemini isn't wired
      panel.hidden = false;
      if (!c.gemini_public) {
        note.textContent =
          'Admin-gated on this server — set GEMINI_PUBLIC=1 to open it, or send an x-admin-token.';
      }
    })
    .catch(() => {});
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = input.value.trim();
  if (!prompt) return;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  out.innerHTML = '';
  try {
    const res = await fetch('/api/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const img = new Image();
    img.src = `data:${data.mimeType};base64,${data.data}`;
    img.alt = prompt;
    img.className = 'img-result';
    out.appendChild(img);
  } catch (err) {
    out.innerHTML = `<p class="img-err">${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate';
  }
});
