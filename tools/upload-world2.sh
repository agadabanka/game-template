#!/bin/bash
# Upload the 10 World-2 winning playthroughs (L4–L13) to the success playlist.
# Run AFTER record-all.sh finishes. Idempotent it is NOT — run once.
cd /home/user/the-platformer
set -a; . ./.env.youtube; set +a
SP=PL3Nc3-ECJaEs55tVmDBbIa2GuUEJoCEiK   # success playlist
REPO="https://github.com/agadabanka/the-platformer"

names=(
  "4|The Keep|castle keep with deadly LAVA pits"
  "5|Emberfall|a dusk-lit lava medley — the World-1 finale"
  "6|Frostpeak|an icy, athletic climb over frozen chasms"
  "7|Dune Sea|a desert run over sinking QUICKSAND and a giant dune"
  "8|Verdant Ruins|jungle canopy platform-hopping over open air"
  "9|Mire of Woe|a swamp of toxic ACID pools and piranha-pipes"
  "10|Cinder Depths|a relentless VOLCANO lava gauntlet"
  "11|Crystal Hollow|an amethyst cavern over SPIKE pits"
  "12|Stormspire|the longest high-wire athletic run under a storm"
  "13|Final Bastion|the grand castle finale — every mechanic at once"
)

for entry in "${names[@]}"; do
  IFS='|' read -r L NAME DESC <<< "$entry"
  F="tools/eval/video/level${L}-win.mp4"
  if [ ! -f "$F" ]; then echo "!! missing $F, skipping"; continue; fi
  TITLE="the-platformer — Level ${L}: ${NAME} (AI playthrough, with sound)"
  FULLDESC="An AI autopilot completes Level ${L} '${NAME}' of the-platformer — ${DESC}. Super Mario-style browser platformer (Phaser 3, Railway), with sound + on-screen controls. ${REPO}"
  echo "=== uploading L${L}: ${NAME} ==="
  YT_PLAYLIST_ID=$SP node tools/youtube-upload.mjs "$F" --title "$TITLE" --privacy unlisted --desc "$FULLDESC" 2>&1 | grep -E "uploaded|playlist" | head -2
done
echo "ALL UPLOADS DONE"
