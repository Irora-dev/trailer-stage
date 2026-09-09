#!/bin/zsh
# Cut the single-shot bear run: the master with its native audio → fade to dark over the last 0.6 s →
# 1.8 s of black with the word DAYLIGHT fading in → out. Free.
# Usage: zsh scripts/tools/cut-bear-run.sh   (from ~/Irora-dev/trailer-stage)
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
D=.footage/daylight-bear-run
OUT=~/Downloads/Daylight/Bear-run
FINAL=daylight-bear-run-single-clip-1080p.mp4
FONT=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf
mkdir -p "$OUT" "$D/cut"
SRC="$D/run.master.mp4"
DUR=$("$FF" -i "$SRC" 2>&1 | grep -oE 'Duration: [0-9:.]+' | awk '{print $2}' | awk -F: '{print $1*3600+$2*60+$3}')
FADE=$(echo "$DUR - 0.6" | bc)
# the shot: 1080p, 24 fps, stereo 48 kHz, picture and sound fading to black over the last 0.6 s
# the approaching footsteps (law 5 in spirit: the native track was near silent for the first 2.5 s) — panned right,
# fading in from 0.2 s and out by 2.8 s, mixed under the shot's own sound
SFX="$D/sfx-footsteps.mp3"
"$FF" -y -v error -i "$SRC" -i "$SFX" -filter_complex "[0:a]aresample=48000,aformat=channel_layouts=stereo[nat];[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=200|200,afade=t=in:st=0.2:d=0.4,afade=t=out:st=2.2:d=0.6,pan=stereo|c0=0.30*c0|c1=1.0*c1,volume=0.9[steps];[nat][steps]amix=inputs=2:duration=first:normalize=0,afade=t=out:st=$FADE:d=0.6[a]" \
  -map 0:v -map "[a]" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=24,format=yuv420p,fade=t=out:st=$FADE:d=0.6" \
  -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -ar 48000 -ac 2 "$D/cut/shot.mp4"
# the card: black, the word fades in over 0.5 s, holds; silent
"$FF" -y -v error -f lavfi -i "color=c=black:s=1920x1080:r=24:d=2.0" -f lavfi -i "anullsrc=r=48000:cl=stereo" -t 2.0 \
  -vf "drawtext=fontfile='$FONT':text='Daylight':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.5),t/0.5,1)'" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "$D/cut/card.mp4"
printf "file 'shot.mp4'\nfile 'card.mp4'\n" > "$D/cut/list.txt"
"$FF" -y -v error -f concat -safe 0 -i "$D/cut/list.txt" -c copy -movflags +faststart "$D/cut/bear-run.mp4"
cp "$D/cut/bear-run.mp4" "$OUT/$FINAL"
"$FF" -hide_banner -i "$OUT/$FINAL" 2>&1 | grep -E 'Duration|Stream' | cut -c1-110
echo "cut → $OUT/$FINAL"
