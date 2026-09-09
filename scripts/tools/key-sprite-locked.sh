#!/bin/zsh
# Key a magenta-plate sprite to alpha with the matte LOCKED to frame 0's silhouette (2026-09-09, for the idles).
# Same four steps as key-sprite.sh (hard key · erode · despill · fill), plus one: the alpha is multiplied by a
# dilated matte of frame 0 (the still, whose plate is flawless), so anything the model paints on the plate later
# in the clip (Seedance grounds a moving figure with a shadow under his boots) can never survive the key, whatever
# its colour. Right only for near-still motion (idles): the silhouette may drift by at most the dilation.
# Usage: zsh scripts/tools/key-sprite-locked.sh <in.mp4> <outdir> <name> [dilatePx=14] [keycolor=FF00FF] [similarity=0.36] [erode=1]
# Writes: <outdir>/<name>.webm (VP9 + alpha) · <name>.mov (HEVC + alpha) · <name>-idle.png (frame 0 keyed)
#         <name>-matte.png (the lock) · <name>-key-check-mid.png (the alpha of a mid frame, to prove the plate is gone)
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
IN=$1; OUT=$2; NAME=$3; DIL=${4:-14}; KEY=${5:-FF00FF}; SIM=${6:-0.36}; ERODE=${7:-1}
mkdir -p "$OUT"
ERO=""; for i in $(seq 1 $ERODE); do ERO="${ERO}erosion,"; done
DILC=""; for i in $(seq 1 $DIL); do DILC="${DILC}dilation,"; done
MATTE="$OUT/$NAME-matte.png"
# the lock: frame 0 keyed hard, its alpha dilated
"$FF" -y -v error -i "$IN" -frames:v 1 -vf "select=eq(n\,0),format=rgba,colorkey=0x${KEY}:${SIM}:0.0,alphaextract,${DILC}format=gray" "$MATTE"
MAG="gt(r(X,Y),g(X,Y)+40)*gt(b(X,Y),g(X,Y)+40)"
CHAIN="[1:v]format=gray[mt];[0:v]format=rgba,colorkey=0x${KEY}:${SIM}:0.0,format=gbrap,split[c][m];[m]alphaextract,${ERO}format=gray[m2];[m2][mt]blend=all_mode=multiply:shortest=1[m3];[c][m3]alphamerge,geq=r='if(lt(alpha(X,Y),128),15,if(${MAG},g(X,Y),r(X,Y)))':g='if(lt(alpha(X,Y),128),13,g(X,Y))':b='if(lt(alpha(X,Y),128),20,if(${MAG},g(X,Y),b(X,Y)))':a='if(lt(alpha(X,Y),128),0,255)'"
"$FF" -y -v error -i "$IN" -loop 1 -i "$MATTE" -filter_complex "${CHAIN},format=yuva420p[v]" -map "[v]" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -row-mt 1 -an "$OUT/$NAME.webm"
"$FF" -y -v error -i "$IN" -loop 1 -i "$MATTE" -filter_complex "${CHAIN},format=bgra[v]" -map "[v]" -c:v hevc_videotoolbox -alpha_quality 0.9 -q:v 65 -tag:v hvc1 -an "$OUT/$NAME.mov" || echo "(hevc alpha not available in this ffmpeg build)"
"$FF" -y -v error -i "$IN" -loop 1 -i "$MATTE" -filter_complex "${CHAIN},format=rgba,select=eq(n\,0)[v]" -map "[v]" -frames:v 1 "$OUT/$NAME-idle.png"
MID=$(( $("$FF" -i "$IN" 2>&1 | grep -oE 'Duration: [0-9:.]+' | awk '{print $2}' | awk -F: '{print int(($1*3600+$2*60+$3)*24/2)}') ))
"$FF" -y -v error -i "$IN" -loop 1 -i "$MATTE" -filter_complex "${CHAIN},alphaextract,select=eq(n\,${MID})[v]" -map "[v]" -frames:v 1 "$OUT/$NAME-key-check-mid.png"
ls -la "$OUT" | awk '{print $5, $9}'
