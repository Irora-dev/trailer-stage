#!/bin/zsh
# The High Noon saloon living layer, rebuilt as LAYERS (Colby, 2026-09-09 17:54: the dust must pass in front of everything;
# a poster must sway as one sheet with its lettering). Nothing generated moves text any more:
#   base   = the still (1920x1080) with the WANTED poster's footprint cleared to a dark plank tone
#   lights = take one's window and lantern flicker, merged through the glow mask (pixel-locked to the still)
#   doors  = take two's batwing doors, merged through a feathered door mask (no lettering there)
#   poster = the poster cut out of the still (RGBA), warped by a deterministic displacement (pinned at the top, the bottom
#            edge swaying sideways and lifting on a 3.33 s gust cycle with a small flutter harmonic), with a soft drop shadow
#   dust   = the Seedance dust layer generated over black, screened IN FRONT of everything, masked to the building + street
#            silhouette so nothing lands on the magenta and the key stays clean
# Then the loop tool closes the composite (frame 0 stays the still), the motion keyer keys it, and finish-layer-loop delivers.
# Usage: zsh scripts/tools/saloon-layered-loop.sh [stage]   stage = build (default: everything up to the composite) | finish
#   env: DUST=.footage/highnoon-dust-layer/dust.master.mp4 (omit the dust with DUST=none) · OUT=~/Downloads/Highnoon/Loops/saloon
set -e
export FFMPEG_PATH=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
FF=$FFMPEG_PATH
D=.footage/highnoon-saloon-loop
W=.cache/saloon-layers; mkdir -p "$W"
STILL=.cache/saloon-still-1080.png
T1=$D/saloon.v1-agave.master.mp4      # strong flicker
T2=$D/saloon.v2-flatlights.master.mp4 # clean doors
GLOW=.cache/saloon-glow-mask-wide.png
DUST=${DUST:-.footage/highnoon-dust-layer/dust.master.mp4}
OUT=${OUT:-$HOME/Downloads/Highnoon/Loops/saloon}
FRAMES=241; FPS=24; DUR=10.04
# the poster: its rectangle in the 1920x1080 still, the patch canvas around it, and the placement of the patch
PX=476; PY=656; PW=122; PH=172; CX=19; CY=24; CW=160; CH=220
STAGE=${1:-build}
# Colby, 2026-09-09 18:1x: "keep all the posters still and ensure the text is fine and just do lights and dust devils":
# POSTER=off leaves the poster as the still's pixels (no footprint clearing, no warp); DOORS=off leaves the doors as the still.
POSTER=${POSTER:-off}; DOORS=${DOORS:-off}

if [ "$STAGE" = "build" ]; then
  if [ "$POSTER" = "on" ]; then
    echo "== 1 base: the still with the poster footprint cleared"
    "$FF" -y -v error -i "$STILL" -vf "drawbox=x=${PX}:y=${PY}:w=${PW}:h=${PH}:color=0x2A1608@1:t=fill" "$W/base.png"
  else
    echo "== 1 base: the still, untouched (POSTER=off)"; cp "$STILL" "$W/base.png"
  fi
  echo "== 2 lights: take one through the glow mask, PROTECTED over every lettering region"
  # Colby 18:1x: the text still broke with the poster layer off. The glow mask's feathered blobs reached the poster and the
  # boards, and take one's own moving lettering ghosted through. Black rectangles (6 px padded) zero the mask over the round
  # sign, the WANTED poster, the TRUST and RISK boards, the COLD STORAGE crate and the TIE UP YOUR BAGS sign.
  "$FF" -y -v error -i "$GLOW" -vf "format=gray,drawbox=x=92:y=642:w=217:h=207:color=black@1:t=fill,drawbox=x=470:y=650:w=134:h=184:color=black@1:t=fill,drawbox=x=1124:y=666:w=182:h=132:color=black@1:t=fill,drawbox=x=1352:y=770:w=127:h=122:color=black@1:t=fill,drawbox=x=170:y=866:w=122:h=78:color=black@1:t=fill" "$W/glow-protected.png"
  GLOW="$W/glow-protected.png"
  "$FF" -y -v error -loop 1 -t ${DUR} -r ${FPS} -i "$W/base.png" -i "$T1" -loop 1 -t ${DUR} -r ${FPS} -i "$GLOW" -filter_complex "[0:v]format=gbrp[b];[1:v]format=gbrp[l];[2:v]format=gray,scale=1920:1080[m];[b][l][m]maskedmerge,format=yuv444p[v]" -map "[v]" -frames:v ${FRAMES} -c:v libx264 -preset fast -crf 12 -pix_fmt yuv444p "$W/base-lights.mp4"
  if [ "$DOORS" = "on" ]; then
    echo "== 3 doors: take two through a feathered door mask"
    "$FF" -y -v error -f lavfi -i "color=c=black:s=1920x1080" -vf "drawbox=x=896:y=636:w=112:h=246:color=white@1:t=fill,boxblur=6:1,format=gray" -frames:v 1 "$W/door-mask.png"
    "$FF" -y -v error -i "$W/base-lights.mp4" -i "$T2" -loop 1 -t ${DUR} -r ${FPS} -i "$W/door-mask.png" -filter_complex "[0:v]format=gbrp[b];[1:v]format=gbrp[d];[2:v]format=gray[m];[b][d][m]maskedmerge,format=yuv444p[v]" -map "[v]" -frames:v ${FRAMES} -c:v libx264 -preset fast -crf 12 -pix_fmt yuv444p "$W/base-lights-doors.mp4"
  else
    echo "== 3 doors: static (DOORS=off)"; cp "$W/base-lights.mp4" "$W/base-lights-doors.mp4"
  fi
  if [ "$POSTER" = "off" ]; then
    echo "== 4 poster: static (POSTER=off)"; cp "$W/base-lights-doors.mp4" "$W/composite-no-dust.mp4"
  else
  echo "== 4 poster: cutout, displacement maps, warp, shadow"
  # the cutout on a pure-green canvas (displace moves colour planes, not alpha, so the transparency is keyed AFTER the warp)
  "$FF" -y -v error -i "$STILL" -vf "crop=${PW}:${PH}:${PX}:${PY},pad=${CW}:${CH}:${CX}:${CY}:color=0x00FF00,format=rgb24" -frames:v 1 "$W/poster-cutout.png"
  # displacement maps over time: x = sideways sway growing with the square of the distance from the pinned top + a flutter; y = a lift
  S="pow(max(Y-${CY},0)/${PH},2)"; S3="pow(max(Y-${CY},0)/${PH},3)"
  "$FF" -y -v error -f lavfi -i "color=c=gray:s=${CW}x${CH}:r=${FPS}:d=${DUR}" -vf "geq=lum='128 + 8*$S*sin(2*PI*T/3.3467) + 2*$S3*sin(2*PI*2.3*T/3.3467+1.1)'" -frames:v ${FRAMES} -pix_fmt gray -c:v libx264 -qp 0 "$W/xmap.mp4"
  "$FF" -y -v error -f lavfi -i "color=c=gray:s=${CW}x${CH}:r=${FPS}:d=${DUR}" -vf "geq=lum='128 - 4*$S*(0.5+0.5*sin(2*PI*T/3.3467+0.6))'" -frames:v ${FRAMES} -pix_fmt gray -c:v libx264 -qp 0 "$W/ymap.mp4"
  # warp the opaque cutout (edge=smear keeps the key colour at the canvas border), key the green to alpha, erode a pixel,
  # make a soft shadow from that alpha, composite shadow then poster onto the base-lights-doors
  "$FF" -y -v error -loop 1 -t ${DUR} -r ${FPS} -i "$W/poster-cutout.png" -i "$W/xmap.mp4" -i "$W/ymap.mp4" -i "$W/base-lights-doors.mp4" -filter_complex "[0:v]format=gbrp[p];[1:v]format=gray[x];[2:v]format=gray[y];[p][x][y]displace=edge=smear,format=rgba,colorkey=0x00FF00:0.30:0.05,format=gbrap,split[c][m];[m]alphaextract,erosion,format=gray[a1];[c][a1]alphamerge,format=rgba,split[pw][ps];[ps]alphaextract,boxblur=3:1,lut=y='val*0.55',format=gray[sh_a];color=c=black:s=${CW}x${CH}:r=${FPS}:d=${DUR},format=rgba[blk];[blk][sh_a]alphamerge[shadow];[3:v]format=rgba[bg];[bg][shadow]overlay=x=$((PX-CX+3)):y=$((PY-CY+4)):shortest=1[bg2];[bg2][pw]overlay=x=$((PX-CX)):y=$((PY-CY)):shortest=1,format=yuv444p[v]" -map "[v]" -frames:v ${FRAMES} -c:v libx264 -preset fast -crf 12 -pix_fmt yuv444p "$W/composite-no-dust.mp4"
  fi
  if [ "$DUST" != "none" ] && [ -f "$DUST" ]; then
    echo "== 5 dust: screened in front, masked to the building and street"
    "$FF" -y -v error -i "$STILL" -vf "format=rgba,colorkey=0xFF00FF:0.45:0.0,alphaextract,erosion,erosion,boxblur=2:1,format=gray" -frames:v 1 "$W/silhouette-mask.png"
    "$FF" -y -v error -i "$W/composite-no-dust.mp4" -i "$DUST" -loop 1 -t ${DUR} -r ${FPS} -i "$W/silhouette-mask.png" -filter_complex "[1:v]scale=1920:594,pad=1920:1080:0:486:color=black,format=gbrp[dust];[2:v]format=gray[m];color=c=black:s=1920x1080:r=${FPS}:d=${DUR},format=gbrp[blk];[blk][dust][m]maskedmerge,format=gbrp[dustm];[0:v]format=gbrp[base];[base][dustm]blend=all_mode=screen:shortest=1,format=yuv420p[v]" -map "[v]" -frames:v ${FRAMES} -c:v libx264 -preset slow -crf 14 "$D/saloonv2.master.mp4"
  else
    echo "== 5 dust: skipped (DUST=$DUST)"; "$FF" -y -v error -i "$W/composite-no-dust.mp4" -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p "$D/saloonv2.master.mp4"
  fi
  "$FF" -y -v error -i "$D/saloonv2.master.mp4" -vf "fps=1,scale=384:-2,tile=5x2" -frames:v 1 -q:v 3 "$W/composite-strip.jpg"
  echo "composite → $D/saloonv2.master.mp4 · strip $W/composite-strip.jpg"
fi

if [ "$STAGE" = "finish" ]; then
  echo "== close, key, deliver (finish-layer-loop.sh on clip saloonv2)"
  zsh scripts/tools/finish-layer-loop.sh highnoon-saloon-loop saloonv2 "$OUT" 0x120E0A 0.45 3
fi
