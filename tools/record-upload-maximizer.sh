#!/bin/bash
cd /home/user/the-platformer
set -a; . ./.env.youtube; set +a
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PORT=3062
PLAYLIST="the-platformer — Levels 1–13 (coin maximizer · deaths OK)"
REPO="https://github.com/agadabanka/the-platformer"
declare -A NAME=( [1]="First Steps" [2]="Into the Caverns" [3]="Cloudtop Run" [4]="The Keep" [5]="Emberfall" [6]="Frostpeak" [7]="Dune Sea" [8]="Verdant Ruins" [9]="Mire of Woe" [10]="Cinder Depths" [11]="Crystal Hollow" [12]="Stormspire" [13]="Final Bastion" )
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3062/ 2>/dev/null)" = 200 ] || { nohup env PORT=3062 ANTHROPIC_API_KEY=sk-dummy node server.js >/tmp/srv62.log 2>&1 & sleep 4; }
for L in 1 2 3 4 5 6 7 8 9 10 11 12 13; do
  echo "=========== LEVEL $L : ${NAME[$L]} ==========="
  LEVEL=$L COLLECT=1 REQUIRE_WIN=0 RECSECONDS=130 timeout 520 node tools/eval/record.mjs 2>&1 | grep -E "result|mp4|events" | head -3
  F="tools/eval/video/max-L${L}.mp4"; cp tools/eval/video/playthrough.mp4 "$F"
  TITLE="the-platformer — Level ${L}: ${NAME[$L]} (AI coin maximizer)"
  DESC="A reward-maximizing AI plays Level ${L} '${NAME[$L]}' of the-platformer — it goes after coins, ? blocks and enemy stomps (deaths allowed; it learns from death and moves on), via a generic reward model + planner. Built with Claude (Phaser 3, Railway). ${REPO}"
  echo "--- uploading L$L ---"
  node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy unlisted --desc "$DESC" --playlist "$PLAYLIST" 2>&1 | grep -iE "youtu.be|exceeded|error|playlist" | head -3
done
echo "MAXIMIZER PLAYLIST DONE"
