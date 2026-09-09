// Writes the eight DRAFT narration mix specs for the round-two mini trailers (Colby, 2026-09-09 00:0x:
// "love the stills make these videos and narrate"). Seed lines in The Clipped Newsreel's register, for
// Colby to rewrite; the bed is each shot's own native sound padded to 20 s; gaps are placeholders until
// the 1080p frames say where the punch line lands. Run from ~/Irora-dev/trailer-stage:
//   node scripts/tools/write-mini-mix-specs.mjs
import { writeFileSync } from 'node:fs'

const ROOT = '/Users/colbymort/Irora-dev/trailer-stage'
const voices = { narrator: { voice_id: 'eWJunko7SS6O4LhXC3dC', name: 'The Clipped Newsreel' } }
const CLOSE = '[confident] If only he used Daylight... the on-chain survival kit.'
const seeds = {
  honeypot: ['[dry] Easy to get in.', '[amused] Getting out is the interesting part.'],
  whale: ['[dry] One holder had forty percent.', '[amused] He moved.'],
  rocket: ['[dry] It went up.', '[amused] Briefly.'],
  copytrader: ['[dry] He does what the smart money does.', '[amused] A step late.'],
  bagholder: ['[dry] The holders were very generous.', '[amused] With their bags.'],
  lookout: ['[dry] The gentleman saw it coming.', '[amused] He had a telescope.'],
  tugofwar: ['[dry] The holders were on his side.', '[amused] Until they were not.'],
  dip: ['[dry] He bought the dip.', '[amused] It was a hole.'],
}

for (const [n, [setup, punch]] of Object.entries(seeds)) {
  const t = `daylight-mini-${n}`
  const dir = `${ROOT}/.audio/${t}`
  const spec = {
    comment: `${t}: DRAFT narration on the seed line (Colby, 2026-09-09 00:0x: make these videos and narrate), for him to rewrite as he did on the cabin chase. The bed is the shot's own native sound, padded with silence to 20 s so the builder does not loop it under the card. Gaps are tuned from the 1080p frames so the punch line lands on the gag. Rebuild: node scripts/build-mix.mjs ${t} --go`,
    voices,
    parts: [
      { id: 'setup', src: `${dir}/setup.vo.mp3`, render: { text: setup, voice: 'narrator' } },
      { gap: 1.5 },
      { id: 'punch', src: `${dir}/punch.vo.mp3`, render: { text: punch, voice: 'narrator' } },
      { gap: 3.0 },
      { id: 'daylight', src: `${dir}/daylight.vo.mp3`, render: { text: CLOSE, voice: 'narrator' } },
    ],
    bed: `${dir}/native-padded.wav`,
    bedGainDb: 0,
    duckDb: 4,
    prerollSec: 1.0,
    tailSec: 3.0,
  }
  writeFileSync(`${ROOT}/trailers/${t}.mix.json`, JSON.stringify(spec, null, 1) + '\n')
  console.log('wrote', t)
}
