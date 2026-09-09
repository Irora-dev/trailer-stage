#!/bin/zsh
# Cut the narrated cabin chase (take 1, Colby's pick): the master's picture → fade to dark over the last
# 0.6 s → a black card with the word Daylight fading in and a small disclosure line; the soundtrack is the
# mix builder's output (the shot's own sound as the bed, ducked under The Clipped Newsreel), trimmed to
# the picture and faded at the end. Free: nothing here renders or spends.
# Usage: zsh scripts/tools/cut-cabin-chase.sh   (from ~/Irora-dev/trailer-stage)
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
D=.footage/daylight-cabin-chase
A=.audio/daylight-cabin-chase/daylight-cabin-chase.wav
OUT=~/Downloads/Daylight/Cabin-chase
FINAL=daylight-cabin-chase-take1-narrated-1080p.mp4
FONT=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf
FONT2=/System/Library/Fonts/Supplemental/Arial.ttf
CARD=${CARD_SEC:-3.8}
mkdir -p "$OUT" "$D/cut"
SRC="$D/chase-t1.master.mp4"
DUR=$("$FF" -i "$SRC" 2>&1 | grep -oE 'Duration: [0-9:.]+' | awk '{print $2}' | awk -F: '{print $1*3600+$2*60+$3}')
FADE=$(echo "$DUR - 0.6" | bc)
TOTAL=$(echo "$DUR + $CARD" | bc)
AFADE=$(echo "$TOTAL - 0.8" | bc)
# the shot's picture only (the sound comes from the mix): 1080p, 24 fps, fading to black over the last 0.6 s
"$FF" -y -v error -i "$SRC" -an \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=24,format=yuv420p,fade=t=out:st=$FADE:d=0.6" \
  -c:v libx264 -preset slow -crf 18 "$D/cut/shot.mp4"
# the card: black, the word fades in over 0.5 s; the plate fades in under it as the narrator reaches it
# (about 1.0 s into the card); a small grey disclosure line at the bottom
"$FF" -y -v error -f lavfi -i "color=c=black:s=1920x1080:r=24:d=$CARD" \
  -vf "drawtext=fontfile='$FONT':text='Daylight':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2-30:alpha='if(lt(t,0.5),t/0.5,1)',drawtext=fontfile='$FONT2':text='the on-chain survival kit':fontcolor=white@0.85:fontsize=38:x=(w-text_w)/2:y=(h/2)+50:alpha='if(lt(t,1.0),0,if(lt(t,1.4),(t-1.0)/0.4,1))',drawtext=fontfile='$FONT2':text='Contains AI-generated footage':fontcolor=white@0.45:fontsize=26:x=(w-text_w)/2:y=h-110:alpha='if(lt(t,0.5),t/0.5,1)'" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$D/cut/card.mp4"
printf "file 'shot.mp4'\nfile 'card.mp4'\n" > "$D/cut/list.txt"
"$FF" -y -v error -f concat -safe 0 -i "$D/cut/list.txt" -c copy "$D/cut/picture.mp4"
# the soundtrack: the mix (bed + narration), trimmed to the picture, faded over the last 0.8 s
"$FF" -y -v error -i "$D/cut/picture.mp4" -i "$A" -filter_complex "[1:a]atrim=0:$TOTAL,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st=$AFADE:d=0.8[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart "$D/cut/cabin-chase-narrated.mp4"
cp "$D/cut/cabin-chase-narrated.mp4" "$OUT/$FINAL"
"$FF" -hide_banner -i "$OUT/$FINAL" 2>&1 | grep -E 'Duration|Stream' | cut -c1-110
echo "cut → $OUT/$FINAL  (shot $DUR s + card $CARD s = $TOTAL s)"
