#!/bin/zsh
# Chain one generated shot into the next: take the LAST frame of <prevClip>'s master, save it as the
# next clip's first-frame reference, switch <nextClip> to Seedance image-to-video with that frame as
# its only reference, and render it. The join is then a shared frame (Colby's rule, 2026-09-08).
# Usage: zsh scripts/tools/chain-next.sh <trailer> <prevClip> <nextClip>    (from ~/Irora-dev/trailer-stage)
set -e
FF=${FFMPEG_PATH:-$HOME/Irora-dev/prismies/node_modules/ffmpeg-static/ffmpeg}
TR=$1; PREV=$2; NEXT=$3
D=.footage/$TR
mkdir -p "$D/refs/chain"
FRAME="$D/refs/chain/$PREV-last.png"
"$FF" -y -v error -sseof -0.25 -i "$D/$PREV.master.mp4" -frames:v 1 -update 1 "$FRAME"
node -e '
const fs=require("fs"); const [tr,next,frame]=process.argv.slice(1);
const tp=`trailers/${tr}.timeline.json`; const t=JSON.parse(fs.readFileSync(tp,"utf8"));
const c=t.tracks.flatMap(x=>x.clips||[]).find(x=>x.id===next); if(!c||!c.params?.render){ console.error("no render block for", next); process.exit(1); }
const r=c.params.render; r.model="bytedance/seedance-2.0/image-to-video"; r.refs={images:[frame]};
r.prompt=r.prompt.replace(/@Image[0-9]/g,"the first frame").replace(/@Video[0-9]/g,"the first frame");
r.prompt="Start exactly from the first frame and continue the same continuous take without any cut: "+r.prompt;
fs.writeFileSync(tp, JSON.stringify(t,null,1)+"\n"); console.log(`${next}: image-to-video from ${frame}`);
' "$TR" "$NEXT" "$FRAME"
node scripts/build-footage.mjs "$TR" --go --only "$NEXT"
