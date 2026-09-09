#!/bin/zsh
# Finish the dog-tag sways (Colby, 2026-09-09): for each tag, close the rendered shot as a PING-PONG loop (a sway
# oscillates, so forward-then-back has no seam by construction), slow it with motion interpolation so the pendulum
# reads light (default 1.5×), key the magenta to alpha with the standard four-step keyer (the silhouette moves, so
# no matte lock), and deliver both paces: the slowed loop as the primary, the natural pace under natural-pace/.
# Free: nothing here renders or spends.
# Usage: zsh scripts/tools/finish-dogtag-loops.sh <tag> [<tag> ...]     (from ~/Irora-dev/trailer-stage)
#   env: SLOW=1.5 (time factor) · OUTROOT=~/Downloads/Daylight/Dog-tags · SIM=0.36 · ERODE=1
set -e
export FFMPEG_PATH=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
FF=$FFMPEG_PATH
SLOW=${SLOW:-1.5}; OUTROOT=${OUTROOT:-$HOME/Downloads/Daylight/Dog-tags}; SIM=${SIM:-0.36}; ERODE=${ERODE:-1}
for T in "$@"; do
  N=dogtag-$T; D=.footage/$N
  [ -f "$D/$T.master.mp4" ] || { echo "== $T: no master yet, skipped"; continue; }
  W=$("$FF" -i "$D/$T.master.mp4" 2>&1 | grep -oE '[0-9]{3,4}x[0-9]{3,4}' | head -1)
  echo "== $T: closing the ping-pong loop at $W"
  node scripts/loop.mjs "$N" "$T" --size "$W" --pingpong | grep -E "frame .* is frame 0|done ·|loop point" | head -4
  LOOP="$D/$T.loop.mp4"; [ -f "$LOOP" ] || { echo "== $T: no loop written"; continue; }
  echo "== $T: slowing ${SLOW}× with motion interpolation"
  "$FF" -y -v error -i "$LOOP" -vf "setpts=${SLOW}*PTS,minterpolate='fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'" -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p "$D/$T.loop.slow.mp4"
  OUT="$OUTROOT/$T"; mkdir -p "$OUT/natural-pace"
  echo "== $T: keying both paces"
  zsh scripts/tools/key-sprite.sh "$D/$T.loop.slow.mp4" "$OUT" FF00FF $SIM $ERODE "$T" > /dev/null
  zsh scripts/tools/key-sprite.sh "$LOOP" "$OUT/natural-pace" FF00FF $SIM $ERODE "$T" > /dev/null
  cp "$D/$T.loop.slow.mp4" "$OUT/$T-sway-loop-magenta.mp4"
  cp "$LOOP" "$OUT/natural-pace/$T-sway-loop-magenta.mp4"
  [ -f "$D/$T.loop-x3.mp4" ] && cp "$D/$T.loop-x3.mp4" "$OUT/natural-pace/$T-loop-preview-x3.mp4"
  printf "file '%s'\nfile '%s'\nfile '%s'\n" "$PWD/$D/$T.loop.slow.mp4" "$PWD/$D/$T.loop.slow.mp4" "$PWD/$D/$T.loop.slow.mp4" > "$D/x3.txt"
  "$FF" -y -v error -f concat -safe 0 -i "$D/x3.txt" -c copy "$OUT/$T-loop-preview-x3.mp4"
  [ -f "$D/$T.loop.seam.jpg" ] && cp "$D/$T.loop.seam.jpg" "$OUT/natural-pace/$T-seam-sheet.jpg"
  [ -f "$D/$T.loop.json" ] && cp "$D/$T.loop.json" "$OUT/$T-loop-report.json"
  ls "$OUT" | tr '\n' ' '; echo
done
