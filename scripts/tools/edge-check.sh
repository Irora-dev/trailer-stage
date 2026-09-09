#!/bin/zsh
# Does a magenta-plate sprite ever touch the frame edge? For each of the four outermost bands (11 px), the fraction of
# plate pixels per frame, reported as the WORST frame (1.00 = the band was pure plate in every frame; 0.86 = on the worst
# frame 14% of the band was not plate, i.e. something reached the edge). Colby's rule (2026-09-09): magenta all around
# throughout the entire animation. Free.
# Usage: zsh scripts/tools/edge-check.sh <video.mp4> [bandPx=11]
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
IN=$1; B=${2:-11}
MAG="geq=r='if(gt(r(X,Y),200)*lt(g(X,Y),90)*gt(b(X,Y),200),255,0)':g=0:b=0"
for band in "top:iw:${B}:0:0" "bottom:iw:${B}:0:ih-${B}" "left:${B}:ih:0:0" "right:${B}:ih:iw-${B}:0"; do
  NAME=${band%%:*}; CROP=${band#*:}
  printf "  %-7s worst frame: " "$NAME"
  "$FF" -hide_banner -i "$IN" -vf "format=rgb24,${MAG},format=gray,crop=${CROP},signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null \
    | grep -oE "YAVG=[0-9.]+" | awk -F= 'NR==1||$2<m {m=$2; f=NR-1} END {printf "%.3f plate at frame %d\n", m/76.245, f}'
done
