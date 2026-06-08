// Vanilla streaming chat client. Reads SSE from /api/chat.

import { marked } from 'https://esm.sh/marked@13.0.3';
import DOMPurify from 'https://esm.sh/dompurify@3.1.7';

marked.setOptions({ gfm: true, breaks: true });

// Open links from assistant replies in a new tab safely.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text));
}

const messagesEl = document.getElementById('messages');
const form = document.getElementById('composer');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const suggestions = document.getElementById('suggestions');
const footerMeta = document.getElementById('footer-meta');

const history = [];
let inFlight = false;

function appendMessage(role, text = '') {
  const el = document.createElement('div');
  el.className = `msg msg--${role}`;
  if (role === 'assistant' && text) {
    el.innerHTML = renderMarkdown(text);
  } else {
    el.textContent = text;
  }
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function setBusy(busy) {
  inFlight = busy;
  sendBtn.disabled = busy;
  input.disabled = busy;
  sendBtn.textContent = busy ? '…' : 'Send';
}

async function sendMessage(text) {
  if (!text.trim() || inFlight) return;
  setBusy(true);

  appendMessage('user', text);
  history.push({ role: 'user', content: text });

  const assistantEl = appendMessage('assistant', '');
  assistantEl.classList.add('is-typing');
  let assistantText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE frames separated by blank lines
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let event = 'message';
        let data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        if (event === 'delta' && typeof parsed.text === 'string') {
          assistantText += parsed.text;
          assistantEl.innerHTML = renderMarkdown(assistantText);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else if (event === 'error') {
          throw new Error(parsed.message || 'stream error');
        }
        // 'done' is informational; we don't need its payload
      }
    }
  } catch (err) {
    assistantEl.remove();
    const errEl = appendMessage('error', `Sorry — ${err.message}. Please try again.`);
    errEl.classList.remove('msg--assistant');
    errEl.classList.add('msg--error');
    history.pop();
    setBusy(false);
    return;
  }

  assistantEl.classList.remove('is-typing');
  if (assistantText.trim()) {
    history.push({ role: 'assistant', content: assistantText });
  } else {
    assistantEl.remove();
    appendMessage('error', 'No response — please try again.').classList.add('msg--error');
    history.pop();
  }
  setBusy(false);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (suggestions) suggestions.style.display = 'none';
  sendMessage(text);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

if (suggestions) {
  suggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const prompt = btn.dataset.prompt;
    if (!prompt) return;
    suggestions.style.display = 'none';
    sendMessage(prompt);
  });
}

// Show model in footer for transparency
fetch('/api/config')
  .then((r) => r.json())
  .then((c) => {
    if (footerMeta && c?.model) footerMeta.textContent = `Powered by ${c.model}`;
  })
  .catch(() => {});
