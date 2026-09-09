#!/bin/zsh
# Merge two first-equals-last-frame takes of the SAME still: everything from take A, the lit regions from take B, through a
# feathered mask of the still's light glow. Born 2026-09-09 (the High Noon saloon layer): take one had strong window flicker
# but a stray agave on the street, take two a clean street and flat lights; both are pixel-locked to the still, so the lights
# of one can sit on the street of the other with no seam. Free: nothing here renders or spends.
# Usage: zsh scripts/tools/merge-takes-by-glow-mask.sh <still.png> <takeA.mp4> <takeB-lights.mp4> <out.mp4> [dilate=14] [blur=8] [rMin=225] [gMin=135] [bMax=40]
#   The mask is written beside the output as <out>.glow-mask.png; check it over the still before trusting the merge.
#   The glow threshold is for warm window light (the saloon's glow was 246,163,1); sample the still first (crop=1:1:x:y).
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
STILL=$1; A=$2; B=$3; OUT=$4; DIL=${5:-14}; BLUR=${6:-8}; RMIN=${7:-225}; GMIN=${8:-135}; BMAX=${9:-40}
W=$("$FF" -i "$A" 2>&1 | grep -oE '[0-9]{3,4}x[0-9]{3,4}' | head -1)
FPS=$("$FF" -i "$A" 2>&1 | grep -oE '[0-9.]+ fps' | head -1 | cut -d' ' -f1)
FRAMES=$("$FF" -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 -i "$A" 2>/dev/null | head -1)
[ -z "$FRAMES" ] && FRAMES=$("$FF" -i "$A" 2>&1 | grep -oE 'Duration: [0-9:.]+' | awk '{print $2}' | awk -F: -v f="$FPS" '{printf "%d", ($1*3600+$2*60+$3)*f+1}')
MASK="${OUT%.mp4}.glow-mask.png"
C="gt(r(X,Y),${RMIN})*gt(g(X,Y),${GMIN})*lt(b(X,Y),${BMAX})"
DILS=""; for i in $(seq 1 $DIL); do DILS="${DILS}dilation,"; done
"$FF" -y -v error -i "$STILL" -vf "scale=${W}:flags=lanczos,format=gbrp,geq=r='if(${C},255,0)':g='if(${C},255,0)':b='if(${C},255,0)',format=gray,${DILS}boxblur=${BLUR}:1" "$MASK"
# a finite mask stream and a frame cap: a looping image input otherwise keeps the graph alive after both takes end
DUR=$(echo "($FRAMES + 2) / $FPS" | bc -l)
"$FF" -y -v error -i "$A" -i "$B" -loop 1 -t "$DUR" -r "$FPS" -i "$MASK" -filter_complex "[0:v]format=gbrp[base];[1:v]format=gbrp[lights];[2:v]format=gray,scale=${W}[m];[base][lights][m]maskedmerge,format=yuv420p[v]" -map "[v]" -frames:v "$FRAMES" -c:v libx264 -preset fast -crf 16 -r "$FPS" "$OUT"
echo "merged → $OUT ($FRAMES frames at $FPS fps, $W) · mask $MASK (mean coverage: $("$FF" -v info -i "$MASK" -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null - 2>&1 | grep -o 'YAVG=[0-9.]*' | head -1))"
