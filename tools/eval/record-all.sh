#!/bin/bash
# Record winning playthroughs for Levels 4–13 sequentially (record.mjs uses a
# fixed output + frames dir, so no parallelism). Saves each as levelN-win.mp4.
cd /home/user/the-platformer
LOG=/tmp/record-all.log
: > "$LOG"
echo "START $(date)" >> "$LOG"
for L in 4 5 6 7 8 9 10 11 12 13; do
  # make sure the static server is up before each recording
  C=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null)
  if [ "$C" != "200" ]; then (PORT=3000 node server.js > /tmp/platformer-server.log 2>&1 &); sleep 3; fi
  echo "=== L$L recording $(date) ===" >> "$LOG"
  LEVEL=$L REQUIRE_WIN=1 PORT=3000 node tools/eval/record.mjs >> "$LOG" 2>&1
  cp tools/eval/video/playthrough.mp4 "tools/eval/video/level$L-win.mp4" 2>>"$LOG"
  cp tools/eval/video/playthrough.webm "tools/eval/video/level$L-win.webm" 2>/dev/null
  echo "SAVED level$L-win.mp4 ($(grep -c . /dev/null))" >> "$LOG"
done
echo "DONE $(date)" >> "$LOG"
