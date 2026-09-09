#!/bin/zsh
# Finish a High Noon single-shot mini: the shot's own sound becomes the bed (padded to 20 s), the mix builder renders the
# narration parts once and mixes them over it (ducked), then the picture fades to dark over the last 0.6 s into a High Noon
# end card (ivory on ink: HIGH NOON · RATING AGENCY · Rated in the light of day. · the disclosure line) with the mix under it.
# The mix spec is trailers/<trailer>.mix.json (write-highnoon-mix-specs.mjs). Only the ElevenLabs parts cost anything, and
# only once: an existing part is never re-rendered.
# Usage: zsh scripts/tools/highnoon-mini-finish.sh <trailer> <clipId> [outDir] [cardSec]   (from ~/Irora-dev/trailer-stage)
#   e.g. zsh scripts/tools/highnoon-mini-finish.sh highnoon-mini-rugpull rugpull ~/Downloads/Highnoon/Trailers
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
TR=$1; CLIP=$2; OUT=${3:-$HOME/Downloads/Highnoon/Trailers}; CARD=${4:-4.4}
D=.footage/$TR
AD=.audio/$TR
SRC="$D/$CLIP.master.mp4"
[ -f "$SRC" ] || { echo "no master at $SRC"; exit 1; }
mkdir -p "$OUT" "$D/cut" "$AD"
FONT=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf
FONT2=/System/Library/Fonts/Supplemental/Arial.ttf
FONT3=/System/Library/Fonts/Supplemental/Georgia\ Italic.ttf
# 1 · the bed: the shot's own native sound, padded with silence to 20 s
"$FF" -y -v error -i "$SRC" -vn -af apad -t 20 -ar 48000 -ac 2 "$AD/native-padded.wav"
# 2 · the mix (narration parts rendered once, the bed ducked under them)
node scripts/build-mix.mjs "$TR" --go
A="$AD/$TR.wav"
[ -f "$A" ] || { echo "no mix at $A"; exit 1; }
# 3 · the cut
DUR=$("$FF" -i "$SRC" 2>&1 | grep -oE 'Duration: [0-9:.]+' | awk '{print $2}' | awk -F: '{print $1*3600+$2*60+$3}')
FADE=$(echo "$DUR - 0.6" | bc)
TOTAL=$(echo "$DUR + $CARD" | bc)
AFADE=$(echo "$TOTAL - 0.8" | bc)
"$FF" -y -v error -i "$SRC" -an \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=24,format=yuv420p,fade=t=out:st=$FADE:d=0.6" \
  -c:v libx264 -preset slow -crf 18 "$D/cut/shot.mp4"
"$FF" -y -v error -f lavfi -i "color=c=0x120E0A:s=1920x1080:r=24:d=$CARD" \
  -vf "drawtext=fontfile='$FONT':text='HIGH NOON':fontcolor=0xF3E9D2:fontsize=104:x=(w-text_w)/2:y=(h-text_h)/2-70:alpha='if(lt(t,0.5),t/0.5,1)',drawtext=fontfile='$FONT2':text='RATING AGENCY':fontcolor=0xC9A55A:fontsize=40:x=(w-text_w)/2:y=(h/2)+10:alpha='if(lt(t,0.6),0,if(lt(t,1.0),(t-0.6)/0.4,1))',drawtext=fontfile='$FONT3':text='Rated in the light of day.':fontcolor=0xF3E9D2@0.85:fontsize=36:x=(w-text_w)/2:y=(h/2)+80:alpha='if(lt(t,1.2),0,if(lt(t,1.6),(t-1.2)/0.4,1))',drawtext=fontfile='$FONT2':text='Contains AI-generated footage':fontcolor=0xF3E9D2@0.45:fontsize=26:x=(w-text_w)/2:y=h-110:alpha='if(lt(t,0.5),t/0.5,1)'" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$D/cut/card.mp4"
printf "file 'shot.mp4'\nfile 'card.mp4'\n" > "$D/cut/list.txt"
"$FF" -y -v error -f concat -safe 0 -i "$D/cut/list.txt" -c copy "$D/cut/picture.mp4"
"$FF" -y -v error -i "$D/cut/picture.mp4" -i "$A" -filter_complex "[1:a]atrim=0:$TOTAL,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st=$AFADE:d=0.8[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart "$D/cut/$TR-narrated.mp4"
FINAL="$TR-narrated-draft-1080p.mp4"
cp "$D/cut/$TR-narrated.mp4" "$OUT/$FINAL"
"$FF" -hide_banner -i "$OUT/$FINAL" 2>&1 | grep -E 'Duration' | cut -c1-40
echo "cut → $OUT/$FINAL  (shot $DUR s + card $CARD s = $TOTAL s)"
