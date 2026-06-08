#!/usr/bin/env bash
# Re-record specific worlds to local mp4s + dump a mid-clip verification frame
# (NO upload). Verify the frames show the right world, THEN upload separately.
set -u
PORT="${PORT:-3351}"
JAZZ=/home/user/jazz
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
LEVELS="${LEVELS_LIST:-103 104 105}"
FF="$JAZZ/node_modules/ffmpeg-static/ffmpeg"
for L in $LEVELS; do
  echo "=== recording world $L ==="
  rm -rf "$JAZZ/tools/eval/video/frames/"* 2>/dev/null
  ( cd "$JAZZ" && SHOWCASE=1 REQUIRE_WIN=1 RECSECONDS="${RECSECONDS:-18}" PORT="$PORT" LEVEL="$L" \
      node tools/eval/record.mjs >/tmp/rerec_$L.log 2>&1 )
  MP4="$JAZZ/tools/eval/video/playthrough.mp4"
  if [ ! -f "$MP4" ]; then echo "FAIL: no mp4 for $L"; continue; fi
  cp "$MP4" "$JAZZ/tools/eval/video/w$L.mp4"
  # grab a frame ~8s in for visual verification
  "$FF" -y -ss 8 -i "$JAZZ/tools/eval/video/w$L.mp4" -frames:v 1 "/tmp/verify_$L.jpg" >/dev/null 2>&1
  echo "  saved w$L.mp4 + /tmp/verify_$L.jpg"
done
echo "=== done ==="
