#!/bin/bash
# Generic record→upload→playlist runner. Replaces the old record-upload-*.sh
# family — parameterize instead of copy-pasting a new script each time.
#
#   LEVELS="1 2 3"  MODE=collect  PLAYLIST="My playlist"  bash tools/playlist.sh
#
# Env:
#   LEVELS      space-separated level ids               (default: 1..13)
#   MODE        collect | showcase | plain              (default: collect)
#                 collect  = coin maximizer (deaths OK, learns + pushes on)
#                 showcase = intended-experience 0-death beats
#                 plain    = straight autopilot to the flag
#   PLAYLIST    YouTube playlist title (created if new) (default: dated)
#   REQUIRE_WIN 1 = keep recording until a win          (default: 1)
#   RECSECONDS  max seconds per clip                    (default: 150)
#   PRIVACY     unlisted | public | private             (default: unlisted)
#   PORT        game server port                        (default: 3066)
#   NO_UPLOAD   1 = record only, skip YouTube           (default: unset)
#   PREFIX      output file prefix in tools/eval/video  (default: pl)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f ./.env.youtube ] && { set -a; . ./.env.youtube; set +a; }
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}
PORT=${PORT:-3066}; export PORT
LEVELS=${LEVELS:-1 2 3 4 5 6 7 8 9 10 11 12 13}
MODE=${MODE:-collect}
REQUIRE_WIN=${REQUIRE_WIN:-1}
RECSECONDS=${RECSECONDS:-150}
PRIVACY=${PRIVACY:-unlisted}
PREFIX=${PREFIX:-pl}
PLAYLIST=${PLAYLIST:-"the-platformer — AI playthroughs ($(date +%Y-%m-%d))"}
REPO="https://github.com/agadabanka/the-platformer"
declare -A NAME=( [1]="First Steps" [2]="Into the Caverns" [3]="Cloudtop Run" [4]="The Keep" [5]="Emberfall" [6]="Frostpeak" [7]="Dune Sea" [8]="Verdant Ruins" [9]="Mire of Woe" [10]="Cinder Depths" [11]="Crystal Hollow" [12]="Stormspire" [13]="Final Bastion" \
  [101]="World 1 · The Deep Roads" [102]="World 2 · Emberfall Keep" [103]="World 3 · Sunken Dunes" [104]="World 4 · Cinder & Crystal" [105]="World 5 · The Final Storm" )

# mode → record.mjs flags
declare -a MODEENV
case "$MODE" in
  collect)  MODEENV=(COLLECT=1) ;;
  showcase) MODEENV=(SHOWCASE=1) ;;
  plain)    MODEENV=() ;;
  *) echo "unknown MODE=$MODE (collect|showcase|plain)"; exit 2 ;;
esac

[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null)" = 200 ] \
  || { nohup env PORT=$PORT ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-sk-dummy} node server.js >"/tmp/srv$PORT.log" 2>&1 & sleep 4; }

echo "PLAYLIST : $PLAYLIST"
echo "MODE     : $MODE   LEVELS: $LEVELS"
for L in $LEVELS; do
  echo "=========== LEVEL $L : ${NAME[$L]:-L$L} ==========="
  env LEVEL=$L "${MODEENV[@]}" REQUIRE_WIN=$REQUIRE_WIN RECSECONDS=$RECSECONDS \
      timeout $((RECSECONDS*4)) node tools/eval/record.mjs 2>&1 | grep -E "result|mp4|events" | head -3 || true
  F="tools/eval/video/${PREFIX}-L${L}.mp4"; cp tools/eval/video/playthrough.mp4 "$F"
  [ "${NO_UPLOAD:-}" = 1 ] && { echo "(NO_UPLOAD) saved $F"; continue; }
  TITLE="the-platformer — Level ${L}: ${NAME[$L]:-L$L} (AI ${MODE})"
  DESC="An AI plays Level ${L} '${NAME[$L]:-L$L}' of the-platformer (${MODE} mode). Built with Claude (Phaser 3, Railway). ${REPO}"
  echo "--- uploading L$L ---"
  node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy "$PRIVACY" --desc "$DESC" --playlist "$PLAYLIST" 2>&1 \
    | grep -iE "youtu.be|exceeded|error|playlist" | head -3 || true
done
echo "PLAYLIST RUN DONE"
