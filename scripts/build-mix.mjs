#!/usr/bin/env node
/**
 * THE MIX BUILDER — a spec in, a finished soundtrack and a MEASURED cue map out.
 *
 * This replaces the hand-built filter graph that every edit round used to
 * require. It also produces the thing the rest of the system runs on: the map of
 * where every word actually landed, so the picture can be timed to the voice
 * instead of to a guess.
 *
 *   node scripts/build-mix.mjs <name|spec.json> [--out <path-without-ext>] [--go]
 *
 * THE SPEC (trailers/<name>.mix.json):
 * {
 *   "voices": { "narrator": { "voice_id": "…", "name": "…" } },   // optional overrides
 *   "parts": [
 *     { "id": "hook", "src": "<mp3>", "render": { "text": "[warmly] …", "voice": "narrator" } },
 *     { "gap": 0.8 },                                    // silence, seconds
 *     { "id": "close", "src": "<mp3>", "from": 0, "to": 6.4, "gainDb": 1.0 }
 *   ],
 *   "bed": "<mp3>" | { "src": "<mp3>", "render": { "prompt": "…", "seconds": 60 } },
 *   "bedGainDb": 1.5, "duckDb": 4, "prerollSec": 4, "tailSec": 3,
 *   "sfx": [ { "at": 31.9, "src": "<mp3>", "gainDb": -8, "render": { "prompt": "…", "seconds": 1.5 } } ]
 * }
 *
 * RENDER PARTS ARE THE SPEND GATE, MOVED INTO THE SPEC. When a render part's
 * `src` is missing the builder DRY-RUNS: it prints exactly what would render and
 * exits without splicing or spending. `--go` renders the missing pieces and then
 * builds. A file that exists is never re-rendered.
 *
 * OUTPUT: <out>.vo.wav (voice only), <out>.wav + .mp3 (the mix), and
 * <out>.cues.json — the measured map: every speech segment in mix time, and
 * every named line's span, which is what anchors resolve against.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { arg, audioDir, config, ensureDir, ffmpeg, ffmpegPath, has, mixSpecPath, probeDuration, r2, ROOT } from './lib.mjs'
import { apiKey, renderMusic, renderSfx, renderVoice } from './voice.mjs'

const GO = has('go')
const target = process.argv[2]
if (!target || target.startsWith('--')) {
  console.error('Usage: node scripts/build-mix.mjs <name|spec.json> [--out <path-without-ext>] [--go]')
  process.exit(1)
}

const cfg = config()
const specPath = target.endsWith('.json') ? resolve(target) : mixSpecPath(target)
if (!existsSync(specPath)) {
  console.error(`No mix spec at ${specPath}`)
  process.exit(1)
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const name = target.endsWith('.json') ? target.split('/').pop().replace(/\.mix\.json$/, '') : target
const outBase = (() => {
  const o = arg('out')
  if (o) return isAbsolute(o) ? o : join(ROOT, o)
  return join(ensureDir(audioDir(name)), name)
})()
mkdirSync(dirname(outBase), { recursive: true })

const FF = await ffmpegPath()

// ── the cast ────────────────────────────────────────────────────────────────
const VOICES = { narrator: { voice_id: cfg.voice?.id ?? '', name: cfg.voice?.name ?? 'narrator' }, ...(spec.voices ?? {}) }
const voiceOf = (n) => {
  const v = VOICES[n ?? 'narrator']
  if (!v?.voice_id) {
    console.error(
      `\n  No voice id for "${n ?? 'narrator'}". Set voice.id in studio.config.json, or add it to this spec's "voices".\n` +
        `  To cast one: node scripts/cast.mjs --describe "…" then --create <slug>.\n`,
    )
    process.exit(1)
  }
  return v
}

// ── takes: one line, N readings, one chosen ─────────────────────────────────
// A performance model rolls the dice on every render, so a line can be rendered
// N times in a single spend (`takes: 3`) and the spec picks which reading the
// splice uses (`use: 2`). Changing `use` later re-splices at zero cost, because
// the readings are already on disk.
const takeFile = (src, n) => src.replace(/(\.[a-z0-9]+)$/i, `-t${n}$1`)
const spliceSrcOf = (part) => {
  const n = part.render?.takes ?? 1
  return n > 1 ? takeFile(part.src, part.render?.use ?? 1) : part.src
}

// ── what would spend ────────────────────────────────────────────────────────
const parts = spec.parts ?? []
const sfxSpecs = spec.sfx ?? []
const bedSpec = typeof spec.bed === 'string' ? { src: spec.bed } : (spec.bed ?? null)

for (const [i, p] of [...parts, ...sfxSpecs].entries()) {
  if (p.render && !p.src) {
    console.error(`Part ${i}: a render block needs a "src" — the path the rendered file will be written to.`)
    process.exit(1)
  }
}

const pendingVoice = []
for (const part of parts) {
  if (!part.render || !part.src) continue
  const n = part.render.takes ?? 1
  const files = n > 1 ? Array.from({ length: n }, (_, i) => takeFile(part.src, i + 1)) : [part.src]
  for (const f of files) if (!existsSync(f)) pendingVoice.push({ file: f, part })
}
const pendingSfx = sfxSpecs.filter((s) => s.render && s.src && !existsSync(s.src))
const pendingBed = bedSpec?.render && bedSpec.src && !existsSync(bedSpec.src) ? bedSpec : null

if ((pendingVoice.length || pendingSfx.length || pendingBed) && !GO) {
  console.log('\n  DRY RUN — these are missing and would be rendered (add --go to spend):')
  for (const r of pendingVoice) console.log(`    voice  ${r.file}\n           ← "${r.part.render.text.replace(/\s+/g, ' ').slice(0, 110)}…"`)
  for (const s of pendingSfx) console.log(`    sfx    ${s.src}\n           ← "${s.render.prompt}" (${s.render.seconds ?? 2}s)`)
  if (pendingBed) console.log(`    music  ${pendingBed.src}\n           ← "${pendingBed.render.lyrics ?? pendingBed.render.prompt}" (${pendingBed.render.seconds ?? 60}s)`)
  console.log('\n  Nothing spliced, nothing spent.\n')
  process.exit(1)
}

if (GO && (pendingVoice.length || pendingSfx.length || pendingBed)) {
  const key = apiKey()
  for (const { file, part } of pendingVoice) {
    const v = voiceOf(part.render.voice)
    process.stdout.write(`  rendering voice ${file.split('/').pop()} … `)
    await renderVoice(file, {
      text: part.render.text,
      voiceId: v.voice_id,
      model: part.render.model ?? cfg.voice?.model ?? 'eleven_v3',
      settings: part.render.settings ?? (cfg.voice?.stability !== undefined ? { stability: cfg.voice.stability } : undefined),
      key,
    })
    console.log('done')
  }
  for (const s of pendingSfx) {
    process.stdout.write(`  rendering sfx ${s.src.split('/').pop()} … `)
    await renderSfx(s.src, { prompt: s.render.prompt, seconds: s.render.seconds ?? 2, influence: s.render.influence, key })
    console.log('done')
  }
  if (pendingBed) {
    process.stdout.write(`  rendering music ${pendingBed.src.split('/').pop()} … `)
    await renderMusic(pendingBed.src, {
      prompt: pendingBed.render.prompt,
      lyrics: pendingBed.render.lyrics,
      seconds: pendingBed.render.seconds ?? 60,
      key,
    })
    console.log('done')
  }
}

// ── the voice splice ────────────────────────────────────────────────────────
const F = 'aformat=sample_rates=44100:channel_layouts=stereo'
const inputs = []
const chains = []
const labels = []
let inIdx = 0
for (const [i, part] of parts.entries()) {
  if (part.gap !== undefined) {
    if (!(part.gap > 0)) {
      console.error(`Part ${i}: a gap must be a positive number of seconds (got ${part.gap})`)
      process.exit(1)
    }
    chains.push(`anullsrc=r=44100:cl=stereo:d=${part.gap}[p${i}]`)
  } else {
    const src = spliceSrcOf(part)
    if (!existsSync(src)) {
      console.error(`Part ${i}: no such file\n  ${src}`)
      process.exit(1)
    }
    inputs.push('-i', src)
    const trim =
      part.from !== undefined || part.to !== undefined
        ? `,atrim=${part.from ?? 0}${part.to !== undefined ? `:${part.to}` : ''}`
        : ''
    const gain = part.gainDb ? `,volume=${part.gainDb}dB` : ''
    chains.push(`[${inIdx}:a]${F}${trim}${gain},asetpts=N/SR/TB[p${i}]`)
    inIdx++
  }
  labels.push(`[p${i}]`)
}
chains.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[vo]`)

const voiceWav = `${outBase}.vo.wav`
ffmpeg(FF, ['-y', ...inputs, '-filter_complex', chains.join(';'), '-map', '[vo]', voiceWav], 'splice')
const voiceDur = probeDuration(FF, voiceWav)

// ── the mix ─────────────────────────────────────────────────────────────────
const preroll = spec.prerollSec ?? cfg.mix?.prerollSec ?? 4
const tail = spec.tailSec ?? cfg.mix?.tailSec ?? 3
let mixFile = voiceWav

if (bedSpec?.src) {
  if (!existsSync(bedSpec.src)) {
    console.error(`No such bed file:\n  ${bedSpec.src}`)
    process.exit(1)
  }
  const total = (preroll + voiceDur + tail).toFixed(2)
  mixFile = `${outBase}.wav`

  /**
   * DUCKING. The bed steps back while the narrator speaks, through a sidechain
   * compressor keyed on the DELAYED voice, so the duck lines up with the words.
   * Slow attack and release so it breathes instead of pumping. Makeup stays at
   * 1: a makeup gain here would LIFT the bed after every line, which is the
   * exact opposite of ducking and is surprisingly easy to ship by accident.
   */
  const duckDb = spec.duckDb ?? cfg.mix?.duckDb ?? 4
  // Thresholds here are linear amplitude, and reduction is (dB over threshold) x
  // (1 - 1/ratio) on the RMS detector. Voice in these mixes sits ~6dB over a
  // 0.05 threshold, so the requested duck maps to 1/(1 - duckDb/6).
  const duckRatio = Math.max(1.05, 1 / (1 - Math.min(duckDb, 5.5) / 6)).toFixed(2)
  const duckChain =
    duckDb > 0
      ? `[bg][vsc]sidechaincompress=threshold=0.05:ratio=${duckRatio}:attack=120:release=450:makeup=1[b]`
      : `[bg]anull[b]`

  /**
   * ⚠️ LOOP THE BED WHEN THE CUT OUTGROWS IT. Beds render at a fixed length. A
   * plain trim to a longer total silently produces a short stream, and the mix
   * then ends at the last word with no error anywhere — you lose the musical
   * round-out and only notice when you watch it. Chain enough copies with a
   * crossfade to clear the total before trimming.
   */
  const XFADE = 4
  const bedDur = probeDuration(FF, bedSpec.src)
  const bedCopies = bedDur >= preroll + voiceDur + tail ? 1 : Math.ceil((preroll + voiceDur + tail - bedDur) / Math.max(1, bedDur - XFADE)) + 1
  const bedIn = []
  const bedLoopChains = []
  for (let i = 0; i < bedCopies; i++) bedIn.push('-i', bedSpec.src)
  if (bedCopies > 1) {
    for (let i = 0; i < bedCopies; i++) bedLoopChains.push(`[${1 + i}:a]${F}[bl${i}]`)
    let acc = '[bl0]'
    for (let i = 1; i < bedCopies; i++) {
      const out = i === bedCopies - 1 ? '[blx]' : `[blacc${i}]`
      bedLoopChains.push(`${acc}[bl${i}]acrossfade=d=${XFADE}${out}`)
      acc = out
    }
  }
  const bedSrc = bedCopies > 1 ? '[blx]' : `[1:a]`

  // Effects, delayed to absolute mix times and overlaid AFTER the voice+bed
  // mix, so adding one can never move a measured cue. Each is trimmed so a
  // generation with a long tail cannot smear the whole mix.
  const sfxIn = []
  const sfxChains = []
  const sfxLabels = []
  for (const [i, s] of sfxSpecs.entries()) {
    if (!existsSync(s.src)) {
      console.error(`No such sfx file:\n  ${s.src}`)
      process.exit(1)
    }
    sfxIn.push('-i', s.src)
    const ms = Math.round(s.at * 1000)
    sfxChains.push(`[${1 + bedCopies + i}:a]${F},atrim=0:6,volume=${s.gainDb ?? -8}dB,adelay=${ms}|${ms}[s${i}]`)
    sfxLabels.push(`[s${i}]`)
  }

  const graph = [
    // ⚠️ The sidechain copy is padded to the FULL length: sidechaincompress ends
    // when EITHER input ends, so an unpadded voice silently truncates the bed at
    // the last word.
    `[0:a]adelay=${Math.round(preroll * 1000)}|${Math.round(preroll * 1000)},asplit=2[v][vsc0]`,
    `[vsc0]apad=whole_dur=${total}[vsc]`,
    ...bedLoopChains,
    `${bedSrc}${F},atrim=0:${total},volume=${spec.bedGainDb ?? cfg.mix?.bedGainDb ?? 1.5}dB[bg]`,
    duckChain,
    ...sfxChains,
    // normalize=0 is the recipe: amix's default normalisation would re-duck
    // everything whenever any input speaks — a second, accidental mix.
    `[v][b]${sfxLabels.join('')}amix=inputs=${2 + sfxLabels.length}:duration=longest:normalize=0,atrim=0:${total}[mix]`,
  ]

  ffmpeg(FF, ['-y', '-i', voiceWav, ...bedIn, ...sfxIn, '-filter_complex', graph.join(';'), '-map', '[mix]', mixFile], 'mix')
  ffmpeg(FF, ['-y', '-i', mixFile, '-c:a', 'libmp3lame', '-b:a', '256k', `${outBase}.mp3`], 'mp3')
}

// ── the measured cue map ────────────────────────────────────────────────────
// Boundaries come from the VOICE track (a bed would mask the silences), shifted
// into mix time by the preroll. These numbers are the truth every anchored beat
// in the picture resolves against.
const det = ffmpeg(FF, ['-hide_banner', '-i', voiceWav, '-af', 'silencedetect=noise=-40dB:d=0.30', '-f', 'null', '-'], 'silencedetect')
const bounds = []
for (const m of det.matchAll(/silence_(start|end): ([\d.]+)/g)) bounds.push({ kind: m[1], voice: +m[2] })

const segments = []
let openAt = 0
for (const b of bounds) {
  if (b.kind === 'start') {
    // A track that opens in silence yields a zero-length segment at 0; drop the
    // noise rather than print a cue nobody can use.
    if (b.voice - openAt > 0.05) segments.push({ startsMix: r2(openAt + preroll), endsMix: r2(b.voice + preroll) })
  } else {
    openAt = b.voice
  }
}
if (voiceDur - openAt > 0.05) segments.push({ startsMix: r2(openAt + preroll), endsMix: r2(voiceDur + preroll) })

// Each part's span, from the concat arithmetic — the spans NAME what the
// segments only measure, so an anchor can say "line:close.start" rather than
// counting silences.
const lines = {}
{
  const spans = []
  let cursor = preroll
  for (const [i, part] of parts.entries()) {
    const dur = part.gap !== undefined ? part.gap : (part.to ?? probeDuration(FF, spliceSrcOf(part))) - (part.from ?? 0)
    if (part.gap === undefined) {
      const id = part.id ?? `part${i}`
      spans.push({ id, startsMix: r2(cursor), endsMix: r2(cursor + dur) })
      lines[id] = { startsMix: r2(cursor), endsMix: r2(cursor + dur), segments: [] }
    }
    cursor += dur
  }
  for (const [n, s] of segments.entries()) {
    const owner = spans.find((p) => s.startsMix >= p.startsMix - 0.05 && s.startsMix < p.endsMix + 0.05)
    if (owner) {
      s.line = owner.id
      lines[owner.id].segments.push(n + 1)
    }
  }
}

const cueMap = {
  built: 'scripts/build-mix.mjs',
  spec: specPath,
  voiceSec: r2(voiceDur),
  mixSec: bedSpec?.src ? r2(preroll + voiceDur + tail) : r2(voiceDur),
  prerollSec: preroll,
  note: 'speech segments in mix time (1-based in anchors: seg:N.start|end); lines = each named part\'s span (line:<id>.start|end). scripts/resolve-cues.mjs reads both.',
  segments,
  lines,
}
writeFileSync(`${outBase}.cues.json`, JSON.stringify(cueMap, null, 2))

console.log(`\n  voice   ${voiceWav}  (${voiceDur.toFixed(2)}s)`)
if (bedSpec?.src) console.log(`  mix     ${mixFile}  (${cueMap.mixSec}s)  + .mp3`)
console.log(`  cues    ${outBase}.cues.json`)
console.log('\n  speech segments (mix time):')
for (const [n, s] of segments.entries())
  console.log(`    seg:${String(n + 1).padEnd(3)} ${String(s.startsMix).padStart(7)} → ${String(s.endsMix).padStart(7)}${s.line ? `   ${s.line}` : ''}`)
if (Object.keys(lines).length) {
  console.log('\n  lines:')
  for (const [id, l] of Object.entries(lines))
    console.log(`    ${id.padEnd(14)} ${String(l.startsMix).padStart(7)} → ${String(l.endsMix).padStart(7)}   segments ${l.segments.join(',') || '—'}`)
}
console.log('')
