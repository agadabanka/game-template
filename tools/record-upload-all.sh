#!/bin/bash
cd /home/user/the-platformer
set -a; . ./.env.youtube; set +a
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PORT=3000
PLAYLIST="the-platformer — Levels 1–13 (current)"
REPO="https://github.com/agadabanka/the-platformer"
declare -A NAME=( [1]="First Steps" [2]="Into the Caverns" [3]="Cloudtop Run" [4]="The Keep" [5]="Emberfall" [6]="Frostpeak" [7]="Dune Sea" [8]="Verdant Ruins" [9]="Mire of Woe" [10]="Cinder Depths" [11]="Crystal Hollow" [12]="Stormspire" [13]="Final Bastion" )
declare -A BLURB=( \
 [1]="the grassy tutorial — run, jump, stomp, coins" \
 [2]="a cave of piranha-pipes under a low ceiling" \
 [3]="sky-high spring bounce-pads with a piranha gate" \
 [4]="a castle of timed FIRE SPOUTS over lava (taught four-step)" \
 [5]="a dusk-lit lava medley — spout, piranha and spring" \
 [6]="an icy climb where glides feed a spring launch" \
 [7]="a desert of quicksand, a giant dune and a sand-vent spout" \
 [8]="jungle canopy with crumbling bridges and one-way shelves" \
 [9]="a swamp of acid, a piranha causeway and a crumbling bog-log" \
 [10]="a volcano of timed FALLING-ROCK droppers (taught four-step)" \
 [11]="a crystal cavern: a conveyor current and a dropper gallery over spikes" \
 [12]="a stormy high-wire of wind shelves, ice and lightning droppers" \
 [13]="the grand finale recombining every mechanic at once" )

for L in 1 2 3 4 5 6 7 8 9 10 11 12 13; do
  echo "=========== LEVEL $L : ${NAME[$L]} ==========="
  echo "--- recording ---"
  LEVEL=$L SHOWCASE=1 REQUIRE_WIN=1 RECSECONDS=95 timeout 520 node tools/eval/record.mjs 2>&1 | grep -E "result|mp4" | head -3
  F="tools/eval/video/level${L}-win.mp4"
  cp tools/eval/video/playthrough.mp4 "$F"
  TITLE="the-platformer — Level ${L}: ${NAME[$L]} (AI playthrough)"
  DESC="An AI autopilot completes Level ${L} '${NAME[$L]}' — ${BLURB[$L]}. A Super Mario-style browser platformer built with Claude (Phaser 3, deployed on Railway), with sound and on-screen controls; recorded by the game's autopilot driver. ${REPO}"
  echo "--- uploading ---"
  node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy unlisted --desc "$DESC" --playlist "$PLAYLIST" 2>&1 | grep -iE "uploaded|http|playlist|error|fail" | head -4
done
echo "ALL DONE"
