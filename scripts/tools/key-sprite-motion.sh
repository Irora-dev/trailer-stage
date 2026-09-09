#!/bin/zsh
# Key a magenta-plate sprite that MOVES (a swinging tag, a running figure) to alpha, without the magenta fringe that
# motion blur leaves on the leading edges (2026-09-09, the dog tags). Same four steps as key-sprite.sh, with two
# changes: the erode defaults to 2 px, and the despill is stronger and colour-aware: any kept pixel that is bluer
# than it is green has magenta mixed into it (brass, paper, khaki and rope all have blue below green), so its blue is
# clamped to its green and the same amount is taken off its red. Pure brass and paper are untouched.
# Usage: zsh scripts/tools/key-sprite-motion.sh <in.mp4> <outdir> <name> [keycolor=FF00FF] [similarity=0.40] [erode=2]
# Writes: <outdir>/<name>.webm (VP9 + alpha) · <name>.mov (HEVC + alpha) · <name>-idle.png (frame 0 keyed)
#         <name>-key-check.png (the alpha of frame 0)
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
IN=$1; OUT=$2; NAME=$3; KEY=${4:-FF00FF}; SIM=${5:-0.45}; ERODE=${6:-4}
mkdir -p "$OUT"
ERO=""; for i in $(seq 1 $ERODE); do ERO="${ERO}erosion,"; done
# Motion blur mixes the plate into a leading edge. A kept pixel with BOTH blue and red well above green is plate-tinted
# beyond saving and is DROPPED (alpha 0, filled with the page colour). A kept pixel only mildly bluer than green is
# neutralised: blue clamped to green and the same excess taken off red. Cream paper (blue a little under green) and brass
# (blue far under green) pass untouched; the paper's chroma is why the test must be "well above", not "above".
STRONG="gt(b(X,Y),g(X,Y)+28)*gt(r(X,Y),g(X,Y)+28)"
KEEP="gt(alpha(X,Y),127)*not(${STRONG})"
CHAIN="format=rgba,colorkey=0x${KEY}:${SIM}:0.0,format=gbrap,split[c][m];[m]alphaextract,${ERO}format=gray[m2];[c][m2]alphamerge,geq=r='if(${KEEP},if(gt(b(X,Y),g(X,Y)),max(r(X,Y)-(b(X,Y)-g(X,Y)),g(X,Y)),r(X,Y)),15)':g='if(${KEEP},g(X,Y),13)':b='if(${KEEP},min(b(X,Y),g(X,Y)),20)':a='if(${KEEP},255,0)'"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${CHAIN},format=yuva420p[v]" -map "[v]" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -row-mt 1 -an "$OUT/$NAME.webm"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${CHAIN},format=bgra[v]" -map "[v]" -c:v hevc_videotoolbox -alpha_quality 0.9 -q:v 65 -tag:v hvc1 -an "$OUT/$NAME.mov" || echo "(hevc alpha not available in this ffmpeg build)"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${CHAIN},format=rgba,select=eq(n\,0)[v]" -map "[v]" -frames:v 1 "$OUT/$NAME-idle.png"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${CHAIN},alphaextract,select=eq(n\,0)[v]" -map "[v]" -frames:v 1 "$OUT/$NAME-key-check.png"
ls -la "$OUT" | awk '{print $5, $9}'
