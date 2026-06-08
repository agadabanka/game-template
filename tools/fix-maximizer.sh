#!/bin/bash
cd /home/user/the-platformer
set -a; . ./.env.youtube; set +a
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PORT=3063
PLAYLIST="the-platformer — Levels 1–13 (coin maximizer · deaths OK)"
REPO="https://github.com/agadabanka/the-platformer"
declare -A NAME=( [2]="Into the Caverns" [4]="The Keep" [5]="Emberfall" [6]="Frostpeak" [7]="Dune Sea" [8]="Verdant Ruins" [11]="Crystal Hollow" [12]="Stormspire" [13]="Final Bastion" )
declare -A OLD=( [2]=JFsqxlOR5hw [4]=wjjgxI7_Jkc [5]=0hr-M2EaBow [6]=fOnuVDb8IK4 [7]=HCqfsrzv_UA [8]=iXlM_W6kmDo [11]=tYKZJqyOR0M [12]=8CSMVsfXupM [13]=NscmenKDpe0 )
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3063/ 2>/dev/null)" = 200 ] || { nohup env PORT=3063 ANTHROPIC_API_KEY=sk-dummy node server.js >/tmp/srv63.log 2>&1 & sleep 4; }
for L in 2 4 5 6 7 8 11 12 13; do
  echo "=========== LEVEL $L : ${NAME[$L]} ==========="
  LEVEL=$L COLLECT=1 REQUIRE_WIN=1 RECSECONDS=150 timeout 560 node tools/eval/record.mjs 2>&1 | grep -E "result|mp4|events" | head -3
  F="tools/eval/video/max-L${L}.mp4"; cp tools/eval/video/playthrough.mp4 "$F"
  TITLE="the-platformer — Level ${L}: ${NAME[$L]} (AI coin maximizer)"
  DESC="A reward-maximizing AI plays Level ${L} '${NAME[$L]}' — it chases coins, ? blocks and enemy stomps; deaths are a learning signal (it dies, restarts, avoids the deadly spot, and pushes on). Generic reward model + planner. Built with Claude (Phaser 3, Railway). ${REPO}"
  echo "--- uploading L$L ---"
  OUT=$(node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy unlisted --desc "$DESC" --playlist "$PLAYLIST" 2>&1)
  echo "$OUT" | grep -iE "youtu.be|exceeded|error" | head -2
  if echo "$OUT" | grep -q "youtu.be"; then node tools/yt-delete.mjs "${OLD[$L]}" 2>&1 | grep -oiE "deleted.*|error.*" | head -1; fi
done
echo "FIX DONE"
