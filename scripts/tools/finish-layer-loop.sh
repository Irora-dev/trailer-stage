#!/bin/zsh
# Finish a magenta-plate LAYER loop whose motion has a direction (dust devils, a tumbleweed: no ping-pong): close the
# rendered shot with the loop tool (duplicate-of-frame-0 search, even-pace re-pick, blend only if the seam is not clean),
# key the magenta to alpha with the motion keyer (parts of the layer move, so no matte lock and a fringe-proof despill),
# and deliver: alpha WebM (VP9) + alpha MOV (HEVC) + the raw loop on magenta + a 3-cycle preview on the page colour and one
# on magenta + the keyed poster frame + the seam sheet + the loop report. Free: nothing here renders or spends.
# Usage: zsh scripts/tools/finish-layer-loop.sh <trailer> <clipId> <outDir> [pageColour=0x120E0A] [similarity=0.45] [erode=3]
#   e.g. zsh scripts/tools/finish-layer-loop.sh highnoon-saloon-loop saloon ~/Downloads/Highnoon/Loops/saloon
set -e
export FFMPEG_PATH=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
FF=$FFMPEG_PATH
TR=$1; CLIP=$2; OUT=$3; PAGE=${4:-0x120E0A}; SIM=${5:-0.45}; ERODE=${6:-3}; BLEND=${BLEND:-auto}   # env BLEND=24 forces a 24-frame cross-fade at the join
D=.footage/$TR
M="$D/$CLIP.master.mp4"; [ -f "$M" ] || { echo "no master at $M"; exit 1; }
mkdir -p "$OUT"
W=$("$FF" -i "$M" 2>&1 | grep -oE '[0-9]{3,4}x[0-9]{3,4}' | head -1)
echo "== closing the loop at $W"
node scripts/loop.mjs "$TR" "$CLIP" --size "$W" | grep -E "frame .* is frame 0|done ·|loop point|seam|blend|even" | head -8
LOOP="$D/$CLIP.loop.mp4"; [ -f "$LOOP" ] || { echo "no loop written"; exit 1; }
# The tool skips its blend whenever it re-picked frames for pace (one median step "needs no blend"), yet a loop point can
# still read as a step. A numeric BLEND runs a SECOND pass on the paced file: no re-pick, a BLEND-frame cross-fade of the
# head over the tail, so the join is both evenly paced and soft (2026-09-09, the High Noon saloon).
if [[ "$BLEND" =~ ^[0-9]+$ ]]; then
  echo "== second pass: ${BLEND}-frame blend on the paced loop"
  node scripts/loop.mjs --file "$LOOP" --even off --blend "$BLEND" --cycles 0 | grep -E "blend|done ·|loop point" | head -4
  [ -f "$D/$CLIP.loop.loop.mp4" ] && mv "$D/$CLIP.loop.loop.mp4" "$D/$CLIP.loop.blend.mp4" && LOOP="$D/$CLIP.loop.blend.mp4"
  [ -f "$D/$CLIP.loop.loop.json" ] && mv "$D/$CLIP.loop.loop.json" "$D/$CLIP.loop.blend.json"
  [ -f "$D/$CLIP.loop.loop.seam.jpg" ] && mv "$D/$CLIP.loop.loop.seam.jpg" "$D/$CLIP.loop.blend.seam.jpg"
fi
echo "== keying (motion keyer, similarity $SIM, erode $ERODE)"
zsh scripts/tools/key-sprite-motion.sh "$LOOP" "$OUT" "$CLIP-loop-alpha" FF00FF "$SIM" "$ERODE" > /dev/null
cp "$LOOP" "$OUT/$CLIP-loop-magenta.mp4"
[ -f "$D/$CLIP.loop.seam.jpg" ] && cp "$D/$CLIP.loop.seam.jpg" "$OUT/$CLIP-loop-seam-last-beside-first.jpg"
[ -f "$D/$CLIP.loop.json" ] && cp "$D/$CLIP.loop.json" "$OUT/$CLIP-loop-report.json"
[ -f "$OUT/$CLIP-loop-alpha-idle.png" ] && mv "$OUT/$CLIP-loop-alpha-idle.png" "$OUT/$CLIP-poster-frame0-keyed.png"
[ -f "$OUT/$CLIP-loop-alpha-key-check.png" ] && mv "$OUT/$CLIP-loop-alpha-key-check.png" "$OUT/$CLIP-key-check-frame0-alpha.png"
echo "== previews: 3 cycles on the page colour and on magenta"
printf "file '%s'\nfile '%s'\nfile '%s'\n" "$PWD/$LOOP" "$PWD/$LOOP" "$PWD/$LOOP" > "$D/x3.txt"
"$FF" -y -v error -f concat -safe 0 -i "$D/x3.txt" -c copy "$OUT/$CLIP-loop-preview-x3-on-magenta.mp4"
# the keyed WebM composited over the page colour, three cycles, so the key can be judged the way the site will show it
"$FF" -y -v error -stream_loop 2 -c:v libvpx-vp9 -i "$OUT/$CLIP-loop-alpha.webm" -f lavfi -i "color=c=${PAGE}:s=${W}:r=24" \
  -filter_complex "[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p[v]" -map "[v]" -c:v libx264 -preset fast -crf 18 "$OUT/$CLIP-loop-preview-x3-on-page-colour.mp4"
ls -la "$OUT" | awk '{print $5, $9}'
