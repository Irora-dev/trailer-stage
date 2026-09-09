#!/bin/zsh
# Finish one Daylight Seedance-pack film: the shot's own generated ambience becomes the bed (padded to 25 s), the mix
# builder renders the pack's narration lines once and mixes them over it, and cut-mini.sh cuts picture + Daylight card
# + mix (the card length comes from the pack: 6 s for film 01, 4 s for the rest). Free after the render.
# Usage: zsh scripts/tools/daylight-pack-finish.sh <trailer> <clipId> [cardSec=4] [outDir=~/Downloads/Daylight/Seedance-pack]
set -e
export FFMPEG_PATH=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
FF=$FFMPEG_PATH
TR=$1; CLIP=$2; CARD=${3:-4}; OUT=${4:-$HOME/Downloads/Daylight/Seedance-pack}
D=.footage/$TR; AD=.audio/$TR; SRC="$D/$CLIP.master.mp4"
[ -f "$SRC" ] || { echo "no master at $SRC"; exit 1; }
mkdir -p "$AD" "$OUT"
"$FF" -y -v error -i "$SRC" -vn -af apad -t 25 -ar 48000 -ac 2 "$AD/native-padded.wav"
node scripts/build-mix.mjs "$TR" --go
zsh scripts/tools/cut-mini.sh "$TR" "$CLIP" "$OUT" "$TR-narrated-1080p.mp4" "$CARD"
