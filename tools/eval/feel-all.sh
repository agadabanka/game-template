#!/bin/bash
# Survey the FELT EXPERIENCE across levels — the "overall picture" in one table.
# Each level self-diagnoses (feel.mjs prints ▶ DIAGNOSIS), so this shows where the
# whole game is weak at a glance, and whether a learning generalizes or overfits.
#   LEVELS="1 2 3" SIMS=2 ./tools/eval/feel-all.sh      (default: all 13)
cd /home/user/the-platformer
LEVELS="${LEVELS:-1 2 3 4 5 6 7 8 9 10 11 12 13}"
SIMS="${SIMS:-2}"
C=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null)
[ "$C" != "200" ] && { (PORT=3000 node server.js > /tmp/platformer-server.log 2>&1 &); sleep 3; }
echo "level | fun | engage dyn arc flow | peak | diagnosis"
echo "------+-----+----------------------+------+----------"
for L in $LEVELS; do
  OUT=$(GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-/tmp/gemini-sa.json}" \
    PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" \
    LEVEL=$L SIMS=$SIMS timeout 240 node tools/eval/feel.mjs 2>/dev/null)
  NAME=$(echo "$OUT" | grep -oE "L$L [^ ]+( [^ ]+)*  \(avg" | sed "s/L$L //;s/  (avg//")
  FUN=$(echo "$OUT"  | grep "FUN SCORE" | grep -oE "[0-9.]+/100" | head -1)
  COMP=$(echo "$OUT" | grep "FUN SCORE" | grep -oE "\[.*\]" | sed 's/engagement //;s/dynamics //;s/arc //;s/flow //;s/ · / /g;s/[][]//g')
  PEAK=$(echo "$OUT" | grep "peak at" | grep -oE "[0-9]+% through" | head -1)
  DIAG=$(echo "$OUT" | grep "DIAGNOSIS" | sed 's/.*DIAGNOSIS *: //')
  printf "L%-4s | %-6s | %-20s | %-5s | %s\n" "$L $NAME" "$FUN" "$COMP" "$PEAK" "$DIAG"
done
