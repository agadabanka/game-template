#!/usr/bin/env bash
# Record the remaining Jazz worlds (showcase clips) and upload each to a NEW
# YouTube playlist (never deletes the old one). Run from the-platformer dir so
# playwright + the youtube tool resolve. Args: PORT and the world ids to do.
set -u
PORT="${PORT:-3334}"
PLAYLIST="Jazz — bunny with a bazooka (blaster + Lyria build)"
JAZZ=/home/user/jazz
PLAT=/home/user/the-platformer
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
# youtube auth from the env file
set -a; . "$PLAT/.env.youtube"; set +a

declare -A NAME=( [101]="World 1: Carrot Caverns" [102]="World 2: Sunset Strip" [103]="World 3: Dustbowl Dunes" [104]="World 4: Lava Lagoon" [105]="World 5: Thunder Dome" )
LEVELS="${LEVELS_LIST:-102 103 104 105}"

for L in $LEVELS; do
  echo "=== recording world $L (${NAME[$L]}) ==="
  rm -rf "$JAZZ/tools/eval/video/frames/"* 2>/dev/null
  ( cd "$JAZZ" && SHOWCASE=1 REQUIRE_WIN=1 RECSECONDS="${RECSECONDS:-40}" PORT="$PORT" LEVEL="$L" \
      node tools/eval/record.mjs >/tmp/rec_$L.log 2>&1 )
  MP4="$JAZZ/tools/eval/video/playthrough.mp4"
  if [ ! -f "$MP4" ]; then echo "FAIL: no mp4 for $L"; continue; fi
  cp "$MP4" "$JAZZ/tools/eval/video/w$L.mp4"
  echo "=== uploading world $L ==="
  ( cd "$PLAT" && node tools/youtube-upload.mjs "$JAZZ/tools/eval/video/w$L.mp4" \
      --title "Jazz — ${NAME[$L]}" \
      --playlist "$PLAYLIST" \
      --desc "Jazz, a bunny with a bazooka, blasts the Tin Tyrant's bots across ${NAME[$L]}. Cartoon run-and-gun built on the-platformer's methodology, with a Lyria soundtrack. Deployed on Railway. https://github.com/agadabanka/jazz" \
      2>&1 | tail -3 )
done
echo "=== batch done ==="
