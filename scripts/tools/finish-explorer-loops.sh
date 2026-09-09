#!/bin/zsh
# Finish the paper-explorer loops (Colby, 2026-09-09): for each animation, close the rendered shot into a seamless
# loop (the still was first AND last frame; the loop tool finds the duplicate of frame 0, re-picks an even pace if
# the model braked into its end frame, blends a dirty seam), then key the magenta plate to alpha (VP9 WebM + HEVC
# MOV) with the lane's four-step keyer, and deliver: the keyed files, the loop on magenta, the 3-cycle preview, the
# seam sheet and a keyed idle frame. Free: nothing here renders or spends.
# Usage: zsh scripts/tools/finish-explorer-loops.sh <anim> [<anim> ...]     (from ~/Irora-dev/trailer-stage)
#   e.g. zsh scripts/tools/finish-explorer-loops.sh wave compass hop lookaround hattip binoculars
set -e
export FFMPEG_PATH=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
OUTROOT=${OUTROOT:-$HOME/Downloads/Daylight/Explorer-loops}
for A in "$@"; do
  N=explorer-paper-$A
  D=.footage/$N
  [ -f "$D/$A.master.mp4" ] || { echo "== $A: no master yet, skipped"; continue; }
  echo "== $A: closing the loop"
  node scripts/loop.mjs "$N" "$A" --size 1440x1440 | grep -E "cut|seam|pace|blend|loop|wrote|→" | head -8
  LOOP="$D/$A.loop.mp4"
  [ -f "$LOOP" ] || { echo "== $A: loop.mjs wrote no $LOOP"; continue; }
  echo "== $A: keying the magenta to alpha (the motion keyer: these figures move)"
  OUT="$OUTROOT/$A"; mkdir -p "$OUT"
  zsh scripts/tools/key-sprite-motion.sh "$LOOP" "$OUT" "$A" FF00FF 0.45 4 > /dev/null
  cp "$LOOP" "$OUT/$A-loop-magenta-1080.mp4"
  [ -f "$D/$A.loop-x3.mp4" ] && cp "$D/$A.loop-x3.mp4" "$OUT/$A-loop-preview-x3.mp4"
  [ -f "$D/$A.loop.seam.jpg" ] && cp "$D/$A.loop.seam.jpg" "$OUT/$A-seam-sheet.jpg"
  [ -f "$D/$A.loop.json" ] && cp "$D/$A.loop.json" "$OUT/$A-loop-report.json"
  ls "$OUT" | tr '\n' ' '; echo
done
