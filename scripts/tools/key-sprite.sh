#!/bin/zsh
# Key a Seedance shot generated on a flat magenta plate into alpha video for the web (2026-09-07, v3: no fringe).
# Usage: zsh scripts/tools/key-sprite.sh <master.mp4> <outdir> [keycolor=FF00FF] [similarity=0.36] [erode=1]
# Writes: <outdir>/wave.webm (VP9 + alpha), <outdir>/wave.mov (HEVC + alpha for Safari),
#         <outdir>/idle.png (frame 0 keyed), <outdir>/key-check.png (alpha matte of frame 0).
#
# Four steps, each for a fringe of its own:
#  1. HARD key (blend 0) at a wider similarity: soft blends leave half-transparent pixels that still carry the plate's tint.
#  2. ERODE the matte one pixel: the model's anti-aliased boundary pixels are the fringe; a pixel at 1248 wide is invisible.
#  3. DESPILL what survives: any pixel that is still truly magenta/purple (red AND blue well above green) is greyed to its
#     green level; skin, khaki and olive have blue below green and the monocle glass has red below green, so they are untouched.
#  4. FILL every transparent pixel with the page colour (#0f0d14): 4:2:0 chroma bleeds whatever sits under the edge into it.
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
IN=$1; OUT=$2; KEY=${3:-FF00FF}; SIM=${4:-0.36}; ERODE=${5:-1}; NAME=${6:-wave}
mkdir -p "$OUT"
ERO=""; for i in $(seq 1 $ERODE); do ERO="${ERO}erosion,"; done
MAG="gt(r(X,Y),g(X,Y)+40)*gt(b(X,Y),g(X,Y)+40)"
KEYCHAIN="format=rgba,colorkey=0x${KEY}:${SIM}:0.0,format=gbrap,split[c][m];[m]alphaextract,${ERO}format=gray[m2];[c][m2]alphamerge,geq=r='if(lt(alpha(X,Y),128),15,if(${MAG},g(X,Y),r(X,Y)))':g='if(lt(alpha(X,Y),128),13,g(X,Y))':b='if(lt(alpha(X,Y),128),20,if(${MAG},g(X,Y),b(X,Y)))':a='if(lt(alpha(X,Y),128),0,255)'"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${KEYCHAIN},format=yuva420p[v]" -map "[v]" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -row-mt 1 -an "$OUT/$NAME.webm"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${KEYCHAIN},format=bgra[v]" -map "[v]" -c:v hevc_videotoolbox -alpha_quality 0.9 -q:v 65 -tag:v hvc1 -an "$OUT/$NAME.mov" || echo "(hevc alpha not available in this ffmpeg build; Safari gets the idle still)"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${KEYCHAIN},format=rgba,select=eq(n\,0)[v]" -map "[v]" -frames:v 1 "$OUT/$NAME-idle.png"
"$FF" -y -v error -i "$IN" -filter_complex "[0:v]${KEYCHAIN},alphaextract,select=eq(n\,0)[v]" -map "[v]" -frames:v 1 "$OUT/$NAME-key-check.png"
ls -la "$OUT" | awk '{print $5, $9}'
