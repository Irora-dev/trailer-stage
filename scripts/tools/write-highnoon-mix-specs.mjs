// Writes the DRAFT narration mix specs for the High Noon mini trailers (Colby, 2026-09-09 15:34: "start making some
// trailers"). Seed lines in High Noon's voice (laconic frontier plain-speak, no hype, no "safe"), for Colby to rewrite.
// The narrator is a placeholder premade voice (Bill: wise, mature, American) until a High Noon voice is designed.
// The bed is each shot's own native sound padded to 20 s; gaps are placeholders until the 1080p frames say where the
// punch line lands. Run from ~/Irora-dev/trailer-stage:  node scripts/tools/write-highnoon-mix-specs.mjs
import { writeFileSync } from 'node:fs'
const ROOT = '/Users/colbymort/Irora-dev/trailer-stage'
const voices = { narrator: { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill (premade; High Noon placeholder narrator)' } }
const CLOSE = '[measured] High Noon Rating Agency. Rated in the light of day.'
const seeds = {
  rugpull: ['[dry] Doc Pullman sells a tonic that only goes up.', '[amused] Mind the rug.'],
  honeypot: ['[dry] Miss Lockett\'s honey is free to taste.', '[amused] Nobody has managed to let go.'],
  bundler: ['[dry] Forty buyers hit the launch in the same block.', '[amused] Same hands.'],
  degen: ['[dry] Moonshot went all in at noon.', '[amused] By one, he had gone all out.'],
}
for (const [n, [setup, punch]] of Object.entries(seeds)) {
  const t = `highnoon-mini-${n}`
  const dir = `${ROOT}/.audio/${t}`
  // The rug pull's gag lands at one second, so its punch comes FIRST and the dry setup plays over his stroll away
  // (tuned from the 1080p frames, 16:0x); the other three keep setup → punch → close.
  const parts =
    n === 'rugpull'
      ? [
          { id: 'punch', src: `${dir}/punch.vo.mp3`, render: { text: punch, voice: 'narrator' } },
          { gap: 1.2 },
          { id: 'setup', src: `${dir}/setup.vo.mp3`, render: { text: setup, voice: 'narrator' } },
          { gap: 1.5 },
          { id: 'close', src: `${dir}/close.vo.mp3`, render: { text: CLOSE, voice: 'narrator' } },
        ]
      : [
          { id: 'setup', src: `${dir}/setup.vo.mp3`, render: { text: setup, voice: 'narrator' } },
          { gap: 2.0 },
          { id: 'punch', src: `${dir}/punch.vo.mp3`, render: { text: punch, voice: 'narrator' } },
          { gap: 2.0 },
          { id: 'close', src: `${dir}/close.vo.mp3`, render: { text: CLOSE, voice: 'narrator' } },
        ]
  const spec = {
    comment: `${t}: DRAFT narration on the seed lines (Colby, 2026-09-09 15:34: start making some trailers), for him to rewrite. The bed is the shot's own native sound, padded with silence to 20 s so the builder does not loop it under the card. Gaps are tuned from the 1080p frames so the punch line lands on the gag. Rebuild: node scripts/build-mix.mjs ${t} --go`,
    voices,
    parts,
    bed: `${dir}/native-padded.wav`,
    bedGainDb: 0,
    duckDb: 4,
    prerollSec: 1.0,
    tailSec: 3.0,
  }
  writeFileSync(`${ROOT}/trailers/${t}.mix.json`, JSON.stringify(spec, null, 1) + '\n')
  console.log('wrote', t)
}
