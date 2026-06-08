#!/usr/bin/env bash
# Runs at the start of every Claude Code session (configured in .claude/settings.json).
# Installs deps if needed and verifies required secrets are present in the runtime.
# Secrets are set in the Claude Code web environment config (or your shell), NOT committed.

set -u

# 1. Install dependencies on a cold checkout.
if [ -f package.json ] && [ ! -d node_modules ]; then
  echo "session-start: installing npm dependencies..."
  npm install --silent || echo "session-start: npm install failed (continue manually)"
fi

# 2. Verify required env vars. ANTHROPIC_API_KEY is mandatory for chat to work.
#    Add others your project needs (RAILWAY_TOKEN, GH_TOKEN, GEMINI_API_KEY...).
required=(ANTHROPIC_API_KEY)
missing=()
for var in "${required[@]}"; do
  if [ -z "${!var:-}" ]; then missing+=("$var"); fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "session-start: ⚠ missing required env var(s): ${missing[*]}"
  echo "session-start:   set them in the Claude Code web environment config before deploying."
else
  echo "session-start: ✓ required env vars present"
fi

echo "session-start: ready"
