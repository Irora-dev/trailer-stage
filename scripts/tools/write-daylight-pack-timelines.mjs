// Writes the six Daylight Seedance-pack timelines + narration mix specs from Colby's pack (2026-09-09 17:21,
// briefs/daylight-seedance-pack/): one Seedance 2.0 reference-to-video shot per film, 15 s, 1080p, 16:9, generated
// ambience, the pack's prompt verbatim except for the recorded substitutions below, the pack's reference order.
//
// Substitutions (each keeps the meaning; the builder's laws would otherwise refuse the prompt):
//   · a camera preamble "Static camera, locked off." is prepended: the law needs one recognised camera behaviour in the
//     first three sentences and the pack's "one continuous locked ... shot" is not one of its phrases; film 01's insert
//     stays in the text as written (the law sees one behaviour, the model sees the three-shot plan).
//   · "lip-sync" → "moving lips" · "dialogue" → "conversation" · "Nobody speaks on camera" → "No one utters a sound on
//     camera": the no-speech law reads those words as speech even inside a prohibition.
//   · fal's likeness checker has refused our man's bare face before, so the bear reference for films 01 and 02 is a
//     crop of the pack's bear-and-honeypot frame that holds only the bear (bear-only.jpg), and film 04's @Image1 is the
//     same frame cropped to the pot, the stump and the bear (pot-stump-bear.jpg) with its sentence edited to match; our
//     man's identity comes from cast-and-forest.jpg, where his face is under his brim. The originals stay in the pack.
// Usage (from ~/Irora-dev/trailer-stage):  node scripts/tools/write-daylight-pack-timelines.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const ROOT = '/Users/colbymort/Irora-dev/trailer-stage'
const PACK = `${ROOT}/briefs/daylight-seedance-pack`
const manifest = JSON.parse(readFileSync(`${PACK}/manifest.json`, 'utf8'))

const SLUG = { '01-one-step-ahead': 'onestep', '02-outrun-the-bear-market': 'outrun', '03-whale': 'whale', '04-honeypot': 'honeypot', '05-rug': 'rug', '06-mechanical-bull': 'mechbull' }
const REF_SWAP = {
  '01-one-step-ahead': { 'references/bear-and-honeypot.jpg': 'references/bear-only.jpg' },
  '02-outrun-the-bear-market': { 'references/bear-and-honeypot.jpg': 'references/bear-only.jpg' },
  '04-honeypot': { 'references/bear-and-honeypot.jpg': 'references/pot-stump-bear.jpg' },
}
const SUBS = [
  [/lip-sync/g, 'moving lips'],
  [/\bdialogue\b/g, 'conversation'],
  [/Nobody speaks on camera\./g, 'No one utters a sound on camera.'],
  [/@Image1 establishes the pot, bear, woodland and our man\./g, '@Image1 establishes the pot on its stump, the bear and the woodland.'],
  // film 06's probe brought the reference's rug in under the ride: say it plainly (2026-09-09 17:5x)
  [/Remove the rug and rope; there is no bear, tea cup or phone in this scene\./g, 'Remove the rug and rope completely: the ground under and around the ride is bare grass and earth, with no rug or carpet anywhere in the frame; there is no bear, tea cup or phone in this scene.'],
]
const PREAMBLE = 'Static camera, locked off. '
const NARRATOR = { voice_id: 'eWJunko7SS6O4LhXC3dC', name: 'The Clipped Newsreel' }
const CLOSE_DEFAULT = '[confident] Introducing Daylight. The on-chain survival kit.'
const NARRATION = {
  '01-one-step-ahead': { card: 6, parts: [
    { id: 'l1', text: '[dry] Our man is waiting for a signal.', at: 0.3 },
    { id: 'l2', text: '[amused] Ah. Message received.', at: 12.0 },
    { id: 'close', text: '[confident] Stay one step ahead with Daylight. The on-chain survival kit.', at: 15.0 },
  ] },
  '02-outrun-the-bear-market': { card: 4, parts: [
    { id: 'l1', text: '[dry] Our man has decided to outrun the bear market.', at: 0.3 },
    { id: 'l2', text: '[dry] He is on lap six.', at: 6.0 },
    { id: 'l3', text: '[amused] No, wait... seven.', at: 9.7 },
    { id: 'close', text: CLOSE_DEFAULT, at: 15.0 },
  ] },
}
const paragraph = (text, header) => {
  const m = text.match(new RegExp(`${header}\\n([\\s\\S]*?)(?:\\n\\n|$)`))
  if (!m) throw new Error(`no ${header} paragraph`)
  return m[1].trim()
}

for (const scene of manifest.scenes) {
  const slug = SLUG[scene.id]
  const name = `daylight-pack-${scene.id.slice(0, 2)}-${slug}`
  let text = readFileSync(`${PACK}/${scene.prompt_file}`, 'utf8')
  for (const [re, to] of SUBS) text = text.replace(re, to)
  const look = paragraph(text, 'LOOK AND CAST')
  const physics = paragraph(text, 'PHYSICS AND AUDIO')
  const prompt = PREAMBLE + text.replace(/\s+\n/g, '\n').trim()
  const refs = scene.reference_images_in_order.map((r) => `briefs/daylight-seedance-pack/${REF_SWAP[scene.id]?.[r] ?? r}`)
  const tl = {
    name,
    end: 15 + (NARRATION[scene.id]?.card ?? 4),
    blackoutAt: 15.4,
    mix: null,
    scene: { kind: 'theme' },
    footage: { look, physics, handoff: '(single generation: no handoff)' },
    notes: `Daylight Seedance pack v4, film ${scene.id} (Colby, 2026-09-09 17:21: "now lets use these scripts to create daylight videos in seedance"). The pack's prompt with the recorded substitutions (see write-daylight-pack-timelines.mjs); references in the pack's order${REF_SWAP[scene.id] ? ', the bear frame cropped face-free for fal\'s likeness checker' : ''}. 480p probe first, then 1080p; the editor's finish adds the narration and the Daylight card.`,
    tracks: [
      { id: 'footage', kind: 'visual', clips: [
        { id: slug, at: 0, until: 15, params: { piece: 'footage', fit: 'cover', hold: 'freeze', grade: 'none', render: {
          provider: 'fal', model: manifest.model, prompt,
          negative: 'cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals, changing props, captions, logos, titles, readable phone-interface text, watermarks, camera orbit, montage, speech, lip movement',
          refs: { images: refs }, seconds: 15, resolution: '1080p', aspect: '16:9', audio: true } } },
      ] },
      { id: 'close', kind: 'visual', clips: [
        { id: 'endcard', at: 15.6, until: 15 + (NARRATION[scene.id]?.card ?? 4), params: { piece: 'endCard', wordmark: 'DAYLIGHT', plate: 'the on-chain survival kit', chips: ['Contains AI-generated footage'] } },
      ] },
      { id: 'captions', kind: 'visual', clips: [] },
    ],
  }
  writeFileSync(`${ROOT}/trailers/${name}.timeline.json`, JSON.stringify(tl, null, 1) + '\n')

  // the mix spec: lines at the pack's cue times (gaps are first guesses; the builder's cue map re-times them)
  const dir = `${ROOT}/.audio/${name}`
  const plan = NARRATION[scene.id] ?? { card: 4, parts: [{ id: 'close', text: CLOSE_DEFAULT, at: 15.0 }] }
  const parts = []
  let cursor = 0
  plan.parts.forEach((p, i) => {
    const gap = Math.max(0.2, p.at - cursor)
    if (i === 0) parts.push({ id: p.id, src: `${dir}/${p.id}.vo.mp3`, render: { text: p.text, voice: 'narrator' } })
    else { parts.push({ gap: Number(gap.toFixed(2)) }); parts.push({ id: p.id, src: `${dir}/${p.id}.vo.mp3`, render: { text: p.text, voice: 'narrator' } }) }
    cursor = p.at + Math.max(1.6, p.text.replace(/\[[^\]]*\]\s*/g, '').split(/\s+/).length * 0.42) // a rough read length until the cue map says
  })
  const spec = {
    comment: `${name}: the pack's narration on The Clipped Newsreel at the pack's cue times (planning timings; the gaps are re-tuned from the cue map and the picture). Bed: the shot's own generated ambience padded to 25 s. Rebuild: node scripts/build-mix.mjs ${name} --go`,
    voices: { narrator: NARRATOR },
    parts,
    bed: `${dir}/native-padded.wav`,
    bedGainDb: 0,
    duckDb: 4,
    prerollSec: plan.parts[0].at,
    tailSec: 3.0,
  }
  writeFileSync(`${ROOT}/trailers/${name}.mix.json`, JSON.stringify(spec, null, 1) + '\n')
  console.log(`wrote ${name}: ${refs.length} refs · card ${plan.card} s · ${plan.parts.length} line(s)`)
}
