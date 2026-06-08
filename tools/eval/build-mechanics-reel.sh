#!/bin/bash
# Build the mechanics showcase reel: labeled segments (label PNGs overlaid, since
# ffmpeg-static lacks drawtext), concatenated, with a music bed.
set -e
cd "$(dirname "$0")/../.."
FF=$(node -e "console.log(require('ffmpeg-static'))")
V=tools/eval/video; M=$V/mframes; L=$V/labels
mkdir -p $V/segs
seg(){ # dir start count labelfile fadeout-start out
  "$FF" -y -loglevel error -framerate 60 -start_number $2 -i "$M/$1/f%05d.jpg" -loop 1 -i "$L/$4.png" \
    -filter_complex "[0:v]scale=1280:720,format=yuv420p[v];[v][1:v]overlay=0:H-150[o];[o]fade=t=in:st=0:d=0.3,fade=t=out:st=$5:d=0.3[f]" \
    -map "[f]" -frames:v $3 -r 60 -c:v libx264 -crf 19 -pix_fmt yuv420p "$V/segs/$6.mp4"; }
#   dir          start cnt  label  fadeout out
seg c1_dash      40   420  seg1   6.7  seg1
seg c2_spout     44   420  seg2   6.7  seg2
seg c3_conveyor  24   420  seg3   6.7  seg3
seg c4_boss      10   240  seg4   3.7  seg4
printf "file 'seg1.mp4'\nfile 'seg2.mp4'\nfile 'seg3.mp4'\nfile 'seg4.mp4'\n" > $V/segs/list.txt
"$FF" -y -loglevel error -f concat -safe 0 -i $V/segs/list.txt -c copy $V/segs/reel-noaudio.mp4
"$FF" -y -loglevel error -stream_loop 3 -i $V/final-L103.mp4 -vn -c:a aac -b:a 160k $V/segs/bed.m4a
"$FF" -y -loglevel error -i $V/segs/reel-noaudio.mp4 -i $V/segs/bed.m4a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart $V/showcase-mechanics.mp4
echo "mechanics reel: $("$FF" -hide_banner -i $V/showcase-mechanics.mp4 2>&1 | grep -oE 'Duration: [0-9:.]+' | head -1)"
