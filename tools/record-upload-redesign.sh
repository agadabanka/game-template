#!/bin/bash
cd /home/user/the-platformer
set -a; . ./.env.youtube; set +a
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PORT=3061
PLAYLIST="the-platformer — Levels 1–13 (full redesign)"
REPO="https://github.com/agadabanka/the-platformer"
declare -A NAME=( [1]="First Steps" [2]="Into the Caverns" [3]="Cloudtop Run" [4]="The Keep" [5]="Emberfall" [6]="Frostpeak" [7]="Dune Sea" [8]="Verdant Ruins" [9]="Mire of Woe" [10]="Cinder Depths" [11]="Crystal Hollow" [12]="Stormspire" [13]="Final Bastion" )
declare -A BLURB=( \
 [1]="grassy tutorial — now with a dash pad, tailwind, a vertical lift, a required moving-platform ferry and a bounce tile" \
 [2]="a cave of piranha-pipes under a low ceiling" \
 [3]="sky spring bounce-pads, a thermal updraft and a piranha gate" \
 [4]="a castle of timed FIRE SPOUTS over lava" \
 [5]="a dusk-lit lava medley — spout, piranha and spring" \
 [6]="an icy climb with a low-gravity powder drift and a slush patch, feeding a spring launch" \
 [7]="a desert of quicksand, a giant dune and a sand-vent spout" \
 [8]="jungle canopy with crumbling bridges, a buoyant pool and an overhead fire bar" \
 [9]="a swamp of acid, a piranha causeway and a crumbling bog-log" \
 [10]="a volcano of timed FALLING-ROCK droppers" \
 [11]="a crystal cavern: a conveyor current and a dropper gallery over spikes" \
 [12]="a stormy high-wire of wind shelves, ice and lightning droppers" \
 [13]="the grand finale recombining every mechanic, ending in a boss fight" )
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3061/ 2>/dev/null)" = 200 ] || { nohup env PORT=3061 ANTHROPIC_API_KEY=sk-dummy node server.js >/tmp/srv61.log 2>&1 & sleep 4; }
for L in 1 2 3 4 5 6 7 8 9 10 11 12 13; do
  echo "=========== LEVEL $L : ${NAME[$L]} ==========="
  LEVEL=$L SHOWCASE=1 REQUIRE_WIN=1 RECSECONDS=95 timeout 520 node tools/eval/record.mjs 2>&1 | grep -E "result|mp4" | head -3
  F="tools/eval/video/redesign-L${L}.mp4"; cp tools/eval/video/playthrough.mp4 "$F"
  TITLE="the-platformer — Level ${L}: ${NAME[$L]} (AI playthrough)"
  DESC="An AI autopilot completes Level ${L} '${NAME[$L]}' — ${BLURB[$L]}. A Super Mario-style browser platformer built with Claude (Phaser 3, Railway), distinct enemy per level + a boss on L13; recorded by the game's autopilot. ${REPO}"
  echo "--- uploading L$L ---"
  node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy unlisted --desc "$DESC" --playlist "$PLAYLIST" 2>&1 | grep -iE "youtu.be|exceeded|error|playlist" | head -3
done
echo "REDESIGN PLAYLIST DONE"
