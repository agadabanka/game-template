#!/bin/bash
# Finish the re-upload: L9–L13 hit YouTube's DAILY upload-count cap on the day we
# re-recorded everything. Run this once the cap resets (~24h) to upload the new
# (new-art + boss + platforms) versions and retire the old placeholders.
cd /home/user/the-platformer
set -a; . ./.env.youtube; set +a
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PORT=3000
PLAYLIST="the-platformer — AI playthroughs"
REPO="https://github.com/agadabanka/the-platformer"
declare -A NAME=( [9]="Mire of Woe" [10]="Cinder Depths" [11]="Crystal Hollow" [12]="Stormspire" [13]="Final Bastion" )
# old placeholder IDs (new-art predecessors) to delete after each new upload succeeds
declare -A OLD=( [9]=Ofjh-jnlWi8 [10]=Kwh3uFcyzeA [11]=Mhe9zyCVlF8 [12]=xAe8odjGJsI [13]=M21ZI9iA_xk )
# ensure the dev server is up (recording needs it)
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null)" = 200 ] || { (PORT=3000 node server.js >/tmp/srv.log 2>&1 &); sleep 3; }
for L in 9 10 11 12 13; do
  F="tools/eval/video/level${L}-win.mp4"
  if [ ! -f "$F" ]; then
    LEVEL=$L SHOWCASE=1 REQUIRE_WIN=1 RECSECONDS=95 timeout 520 node tools/eval/record.mjs 2>&1 | grep -E "result|mp4"
    cp tools/eval/video/playthrough.mp4 "$F"
  fi
  TITLE="the-platformer — Level ${L}: ${NAME[$L]} (AI playthrough)"
  DESC="An AI autopilot completes Level ${L} '${NAME[$L]}' of the-platformer — a Super Mario-style browser platformer built with Claude (Phaser 3, Railway), with a distinct enemy per level and a boss on L13. ${REPO}"
  OUT=$(node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy unlisted --desc "$DESC" --playlist "$PLAYLIST" 2>&1)
  echo "L$L: $(echo "$OUT" | grep -oE 'https://youtu.be/[A-Za-z0-9_-]+|exceeded|error')"
  echo "$OUT" | grep -q "youtu.be" && node tools/yt-delete.mjs "${OLD[$L]}" 2>&1 | grep -oE "deleted .*"
done
echo "FINISH DONE"
