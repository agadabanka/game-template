#!/bin/bash
# 0-death gate: run the deterministic autopilot win-check across a set of levels
# and print a pass/fail table. This is the project's correctness bar.
#
#   LEVELS="1 2 3"  bash tools/gate.sh
#   SHOWCASE=1 LEVELS="1-13" bash tools/gate.sh   # check the showcase beats too
#
# Env: LEVELS (default 1..13; ranges like "1-13" or "1 5 7"), PORT (default 3068),
#      SHOWCASE (1 = run the intended-experience policy), WCSTEPS (frame cap).
set -uo pipefail
cd "$(dirname "$0")/.."
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}
PORT=${PORT:-3068}; export PORT
RAW=${LEVELS:-1 2 3 4 5 6 7 8 9 10 11 12 13}
# expand a-b ranges
LEVELS=$(for tok in $RAW; do if [[ "$tok" == *-* ]]; then seq "${tok%-*}" "${tok#*-}"; else echo "$tok"; fi; done | tr '\n' ' ')
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null)" = 200 ] \
  || { nohup env PORT=$PORT ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-sk-dummy} node server.js >"/tmp/srv$PORT.log" 2>&1 & sleep 4; }
pass=0; fail=0
echo "  L   RESULT   DEATHS"
for L in $LEVELS; do
  OUT=$(env LEVEL=$L PORT=$PORT ${SHOWCASE:+SHOWCASE=1} ${WCSTEPS:+WCSTEPS=$WCSTEPS} node tools/eval/wincheck.mjs 2>&1)
  RES=$(echo "$OUT" | grep -oiE "result : [a-z]+" | awk '{print $3}' | head -1)
  DTH=$(echo "$OUT" | grep -oiE "deaths: [0-9]+" | grep -oE "[0-9]+" | head -1)
  if [ "$RES" = "win" ] && [ "${DTH:-0}" = "0" ]; then pass=$((pass+1)); mark="✓"; else fail=$((fail+1)); mark="✗"; fi
  printf "  %-3s %s %-6s  %s\n" "$L" "$mark" "${RES:-?}" "${DTH:-?}"
done
echo "  ── $pass pass / $fail fail ──"
[ "$fail" = 0 ]
