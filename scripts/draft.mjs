#!/usr/bin/env node
/**
 * THE BRIEF COMPILER — a brief in, a trailer out. Text only.
 *
 *   NEW    node scripts/draft.mjs <brief.md> --name <slug> [--project <path|git-url>]
 *   EDIT   node scripts/draft.mjs <notes.md> --edit <name> [--stills 12]
 *   OFFLINE node scripts/draft.mjs <brief.md> --name <slug> --from-draft <draft.json>
 *   CHECK  node scripts/draft.mjs --check <name>          (validate, no model)
 *   SCHEMA node scripts/draft.mjs --schema                (print the contract)
 *
 * It writes three files and nothing else:
 *   trailers/<name>.timeline.json   the picture
 *   trailers/<name>.mix.json        the sound (as a spec: nothing is rendered)
 *   trailers/<name>.storyboard.md   the human read, for whoever approves it
 *
 * IT NEVER SPENDS, RENDERS, RECORDS OR APPROVES. Those are `npm run trailer --
 * <name> --go` and a person, in that order.
 *
 * HOW TIMES WORK BEFORE ANY AUDIO EXISTS. The model anchors every beat to a
 * narration LINE ("line:hook.end+0.4") and never guesses seconds. This script
 * estimates each line's length from its text and writes those estimates as the
 * clips' times AND as an `estimated: true` cue map, so the silent draft plays
 * and the studio opens it today. The pipeline then renders, measures, and
 * replaces every estimate with the real number. Nothing is nudged by hand.
 *
 * --project reads the codebase (or clones a git URL) and puts a capped, redacted
 * digest in the prompt, so the trailer is about the actual product. Run with
 * --print-digest to read exactly what would be sent before sending it.
 */

import Anthropic from '@anthropic-ai/sdk'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  arg,
  audioDir,
  config,
  ensureDir,
  ffmpegPath,
  has,
  mixSpecPath,
  r2,
  ROOT,
  storyboardPath,
  takesDir,
  timelinePath,
} from './lib.mjs'
import { digestText, readProject } from './project.mjs'

const cfg = config()
const MODEL = arg('model', 'claude-opus-5')
const EFFORT = arg('effort', 'high')
const DRY = has('dry-run')

const PIECE_KINDS = [
  'browserFrame', 'card', 'marketTape', 'lineChart', 'bento', 'groupFold', 'logoReveal',
  'endCard', 'text', 'chipRow', 'image', 'videoActor', 'sprite', 'pin', 'channelFlip', 'caption',
  'footage',
]

// ── the output contract ─────────────────────────────────────────────────────
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties })
const arrOf = (items) => ({ type: 'array', items })
const str = { type: 'string' }
const num = { type: 'number' }
const nullable = (t) => ({ anyOf: [t, { type: 'null' }] })

export const SCHEMA = obj({
  name: str,
  logline: str,
  /** Narration in order. Each line is one render part; its id is what anchors point at. */
  lines: arrOf(obj({ id: str, text: str, gapAfter: num })),
  bed: nullable(obj({ prompt: str, seconds: num })),
  mix: obj({ prerollSec: num, tailSec: num, bedGainDb: num, duckDb: num }),
  sfx: arrOf(obj({ id: str, anchor: str, prompt: str, seconds: num, gainDb: num })),
  tracks: arrOf(
    obj({
      id: str,
      name: str,
      kind: { type: 'string', enum: ['visual', 'marker'] },
      clips: arrOf(obj({ id: str, anchor: str, anchorUntil: nullable(str), paramsJson: nullable(str) })),
    }),
  ),
  camera: arrOf(obj({ anchor: str, untilAnchor: str, from: num, to: num, cx: num, cy: num })),
  scene: nullable(obj({ kind: { type: 'string', enum: ['theme', 'color', 'image', 'video'] }, color: nullable(str), src: nullable(str), overlay: nullable({ type: 'string', enum: ['crt', 'grain', 'none'] }) })),
  blackoutColor: nullable(str),
  blackoutAnchor: str,
  endAnchor: str,
  storyboard: arrOf(obj({ anchor: str, sees: str, hears: str })),
  notes: arrOf(str),
})

if (has('schema')) {
  console.log(JSON.stringify(SCHEMA, null, 2))
  process.exit(0)
}

// ── anchors inside piece params ─────────────────────────────────────────────
// A clip's own at/until carry anchors the resolver rewrites. The times INSIDE a
// piece's params are TimeRefs the renderer resolves against the cue map at play
// time. So the compiler bridges them: every line becomes a locked marker clip
// `__line-<id>`, and "line:create.start-0.6" inside params becomes the TimeRef
// "@__line-create-0.6", which then moves for free whenever the measured map does.
const ANCHOR_RE = /^\s*(line:([\w-]+)|voice|mix)\.(start|end)\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*$/
const lineClipId = (id) => `__line-${id}`
function anchorToRef(s, lineIds) {
  const m = ANCHOR_RE.exec(s)
  if (!m) return null
  const [, kind, id, edge, sign, delta] = m
  const off = sign ? `${sign}${delta}` : ''
  const tail = edge === 'end' ? '.end' : ''
  if (kind.startsWith('line:')) return `@${lineClipId(id)}${tail}${off}`
  if (kind === 'voice') return `@${lineClipId(edge === 'start' ? lineIds[0] : lineIds[lineIds.length - 1])}${tail}${off}`
  if (edge === 'end') return `@end${off}`
  return sign ? Number(`${sign}${delta}`) : 0
}
function rewriteRefs(v, lineIds) {
  if (typeof v === 'string') return anchorToRef(v, lineIds) ?? v
  if (Array.isArray(v)) return v.map((x) => rewriteRefs(x, lineIds))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewriteRefs(x, lineIds)]))
  return v
}

// ── estimated timing, before any audio exists ───────────────────────────────
// Measured on real reads: about 14 characters a second, plus a beat for each
// bracketed direction. Good enough to lay a cut out; replaced by the truth the
// moment the mix is built.
const CPS = 14
const TAG_SEC = 0.6
function estimateLines(lines, prerollSec) {
  const map = { estimated: true, prerollSec, segments: [], lines: {} }
  let cursor = prerollSec
  for (const l of lines) {
    const tags = (l.text.match(/\[[a-z]+\]/gi) ?? []).length
    const plain = l.text.replace(/\[[a-z]+\]/gi, '').replace(/\s+/g, ' ').trim()
    const dur = Math.max(0.8, plain.length / CPS + tags * TAG_SEC)
    map.lines[l.id] = { startsMix: r2(cursor), endsMix: r2(cursor + dur), segments: [] }
    cursor += dur + (l.gapAfter ?? 0.6)
  }
  map.voiceSec = r2(cursor - prerollSec)
  return map
}

function resolveAnchor(anchor, map, tailSec = 3) {
  const m = ANCHOR_RE.exec(anchor ?? '')
  if (!m) return null
  const [, kind, lineId, edge, sign, delta] = m
  let base
  if (kind.startsWith('line:')) {
    const l = map.lines[lineId]
    if (!l) return null
    base = edge === 'start' ? l.startsMix : l.endsMix
  } else if (kind === 'voice') {
    const ls = Object.values(map.lines)
    if (!ls.length) return null
    base = edge === 'start' ? ls[0].startsMix : ls[ls.length - 1].endsMix
  } else {
    const ls = Object.values(map.lines)
    base = edge === 'start' ? 0 : r2((ls.length ? ls[ls.length - 1].endsMix : map.prerollSec) + tailSec)
  }
  return r2(base + (sign ? (sign === '-' ? -1 : 1) * Number(delta) : 0))
}

// ── validation (the model is good; these checks are cheaper than a bad take) ─
export function validateDraft(d) {
  const problems = []
  const lineIds = new Set()
  for (const l of d.lines ?? []) {
    if (!/^[\w-]+$/.test(l.id)) problems.push(`line "${l.id}": the id must be one word`)
    if (lineIds.has(l.id)) problems.push(`line "${l.id}": duplicate id`)
    lineIds.add(l.id)
    const words = l.text.replace(/\[[a-z]+\]/gi, '').trim().split(/\s+/).length
    if (words > 160) problems.push(`line "${l.id}": ${words} words — split it where the picture changes`)
  }
  if (!lineIds.size) problems.push('no narration lines')

  const clipIds = new Set()
  const clips = []
  for (const tr of d.tracks ?? [])
    for (const c of tr.clips) {
      if (clipIds.has(c.id)) problems.push(`clip "${c.id}": duplicate id`)
      clipIds.add(c.id)
      clips.push({ tr, c })
    }

  const checkAnchor = (where, a) => {
    if (a === null || a === undefined) return
    const m = ANCHOR_RE.exec(a)
    if (!m) problems.push(`${where}: anchor "${a}" is not line:<id>.start|end[±s], voice.*, or mix.*`)
    else if (m[2] && !lineIds.has(m[2])) problems.push(`${where}: anchor "${a}" names no line`)
  }

  const chartIds = new Set()
  for (const { c } of clips) {
    if (!c.paramsJson) continue
    try {
      const p = JSON.parse(c.paramsJson)
      if (p.piece === 'marketTape' || p.piece === 'lineChart') chartIds.add(c.id)
    } catch {
      /* reported below */
    }
  }

  const timeRefOk = (ref) => {
    if (typeof ref !== 'string' || !ref.startsWith('@')) return true
    const m = /^@([A-Za-z0-9_.~-]+?)(?:\s*[+-]\s*\d+(?:\.\d+)?)?$/.exec(ref.trim())
    if (!m) return false
    const nm = m[1] === 'end' || m[1] === 'blackout' ? null : m[1].endsWith('.end') ? m[1].slice(0, -4) : m[1]
    return nm === null || clipIds.has(nm)
  }
  const walkRefs = (where, v) => {
    if (typeof v === 'string') {
      // `@still:` / `@take:` are stage references (a frame or a slice of a recorded
      // take, see scripts/footage/refs.mjs), not TimeRefs; the footage builder judges them.
      if (v.startsWith('@') && !/^@(still|take):/.test(v) && !timeRefOk(v)) problems.push(`${where}: TimeRef "${v}" names no clip`)
      const am = ANCHOR_RE.exec(v)
      if (am && am[2] && !lineIds.has(am[2])) problems.push(`${where}: anchor "${v}" names no line`)
    } else if (Array.isArray(v)) v.forEach((x, i) => walkRefs(`${where}[${i}]`, x))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkRefs(`${where}.${k}`, x)
  }

  for (const { tr, c } of clips) {
    const where = `${tr.id}/${c.id}`
    checkAnchor(where, c.anchor)
    checkAnchor(where, c.anchorUntil)
    if (!c.paramsJson) continue
    let p
    try {
      p = JSON.parse(c.paramsJson)
    } catch {
      problems.push(`${where}: paramsJson is not valid JSON`)
      continue
    }
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      problems.push(`${where}: paramsJson must be an object`)
      continue
    }
    if (p.piece !== undefined && !PIECE_KINDS.includes(p.piece)) problems.push(`${where}: unknown piece "${p.piece}"`)
    walkRefs(where, p)
    const chart = p.anchor?.tape ?? p.header?.tape
    if (chart !== undefined && !chartIds.has(chart)) problems.push(`${where}: tape "${chart}" is not a chart clip`)
    if (p.piece === 'chipRow' && p.track && !(d.tracks ?? []).some((t) => t.id === p.track))
      problems.push(`${where}: chipRow.track "${p.track}" names no track`)
  }
  for (const s of d.sfx ?? []) checkAnchor(`sfx/${s.id}`, s.anchor)
  for (const [i, cm] of (d.camera ?? []).entries()) {
    checkAnchor(`camera[${i}]`, cm.anchor)
    checkAnchor(`camera[${i}]`, cm.untilAnchor)
  }
  checkAnchor('blackoutAnchor', d.blackoutAnchor)
  checkAnchor('endAnchor', d.endAnchor)

  const kinds = new Set(
    clips.map(({ c }) => {
      try {
        return JSON.parse(c.paramsJson ?? 'null')?.piece
      } catch {
        return undefined
      }
    }),
  )
  if (!kinds.has('endCard') && !kinds.has('logoReveal') && !kinds.has('text'))
    problems.push('nothing closes the cut: end on a logoReveal, an endCard, or text')
  if (!(d.tracks ?? []).some((t) => t.id === 'captions')) problems.push('no captions track')
  // Generated footage owes the viewer a disclosure (EU AI Act, Art. 50): an
  // endCard chip that says so. The compiler adds it; a hand-written cut must too.
  if (kinds.has('footage')) {
    const chips = clips.flatMap(({ c }) => {
      try {
        const p = JSON.parse(c.paramsJson ?? 'null')
        return p?.piece === 'endCard' && Array.isArray(p.chips) ? p.chips.map(String) : []
      } catch {
        return []
      }
    })
    if (!chips.some((ch) => /ai[- ]generated/i.test(ch)))
      problems.push('footage present but nothing discloses it: give the endCard a chip like "Contains AI-generated footage"')
  }
  return problems
}

// ── check mode (offline) ────────────────────────────────────────────────────
if (has('check')) {
  const name = arg('check')
  const tlPath = timelinePath(name)
  if (!existsSync(tlPath)) {
    console.error(`no ${tlPath}`)
    process.exit(1)
  }
  const tl = JSON.parse(readFileSync(tlPath, 'utf8'))
  const specPath = mixSpecPath(name)
  const lineIds = existsSync(specPath)
    ? (JSON.parse(readFileSync(specPath, 'utf8')).parts ?? []).filter((p) => p.src).map((p, i) => p.id ?? `part${i}`)
    : ['only']
  const d = {
    lines: lineIds.map((id) => ({ id, text: 'x', gapAfter: 0 })),
    tracks: tl.tracks
      .filter((t) => t.kind !== 'audio')
      .map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({
          id: c.id,
          anchor: c.anchor ?? `line:${lineIds[0]}.start`,
          anchorUntil: c.anchorUntil ?? null,
          paramsJson: c.params ? JSON.stringify(c.params) : null,
        })),
      })),
    sfx: [],
    camera: [],
    blackoutAnchor: 'mix.end',
    endAnchor: 'mix.end',
  }
  const problems = validateDraft(d).filter((p) => !p.startsWith('no captions') || !tl.tracks.some((t) => t.id === 'captions'))
  if (problems.length) {
    console.log(`\n  ${name}: ${problems.length} problem(s)`)
    for (const p of problems) console.log(`    - ${p}`)
    process.exit(1)
  }
  console.log(`\n  ${name}: pieces, TimeRefs, anchors and chart references all check out\n`)
  process.exit(0)
}

// ── the standing instructions ───────────────────────────────────────────────
function headerComment(file) {
  const src = readFileSync(file, 'utf8')
  const m = /\/\*\*([\s\S]*?)\*\//.exec(src)
  return m ? m[1].replace(/^\s*\* ?/gm, '').trim() : ''
}

function buildSystem(projectDigest) {
  const vocabulary = headerComment(join(ROOT, 'src', 'lib', 'pieces.ts'))
  const manual = existsSync(join(ROOT, 'docs', 'MANUAL.md')) ? readFileSync(join(ROOT, 'docs', 'MANUAL.md'), 'utf8') : ''
  const example = existsSync(join(ROOT, 'trailers', 'example.timeline.json'))
    ? readFileSync(join(ROOT, 'trailers', 'example.timeline.json'), 'utf8')
    : ''
  const exampleMix = existsSync(join(ROOT, 'trailers', 'example.mix.json'))
    ? readFileSync(join(ROOT, 'trailers', 'example.mix.json'), 'utf8')
    : ''

  const voiceBrief = cfg.voice?.brief || 'A warm, expressive narrator with real dynamic range.'
  const VOICE = `THE NARRATOR: ${voiceBrief}

LINE RULES — these are trailer lines, and the model that speaks them takes direction:
- A line is one continuous read, 1 to 4 sentences. Split the narration wherever the PICTURE
  changes act, because anchors point at line starts and ends: a beat you want to time needs its
  own line boundary.
- DIRECT THE READ. Bracketed directions ([warmly] [curious] [excited] [amused] [confident]),
  ellipses for a real pause, CAPS on the one word that carries the sentence. A line handed over
  as plain text is read flat, and flat is the most common reason a trailer sounds dead.
- Spell numbers out as words where the narrator says them; a product name may keep its digits.
- No em dashes. Use commas, full stops, ellipses.
- Never restate what is already on screen. Add the stake, the reaction, or the reason.`

  const LAWS = `THE CONTRACT:
- Anchors may ONLY be "line:<id>.start", "line:<id>.end" (optionally +N or -N seconds),
  "voice.end+N", or "mix.end". NEVER a bare number: no audio exists yet, so a number is a guess.
- Every clip is a cue named by its id. A beat that another piece references by "@id" must exist
  as a clip (marker clips on a "beats" track carry no paramsJson).
- A piece clip's paramsJson is a JSON object string with a "piece" key from the vocabulary.
  Times INSIDE paramsJson are TimeRefs: "@clipId", "@clipId+0.4", "@clipId.end", "@end".
- Give the timeline a "captions" track (one caption clip per line, the line without its
  direction tags), a "beats" marker track for anything referenced by name, and visual tracks per
  layer.
- The house arc, unless the brief says otherwise: set the scene, show the thing working, turn on
  the point being made, then the close — a logoReveal or an endCard or text on the ground.
- Camera: at most two deliberate in-and-out arcs, ~5s round trip, zoom 1.25 to 1.3, each
  out-move on the SAME centre as its in-move. No ambient drift.
- Effects sparse or none, -8 to -16 dB.
- Anything invented on screen must be labelled as an example. Never present made-up numbers or
  names as real.
- FOOTAGE (a generated shot) is for the world AROUND the product, never the product itself: the
  app comes from browserFrame or from real stills. Use it only when the brief wants a scene,
  a person, a place or a metaphor that cannot be filmed. A footage clip's paramsJson carries a
  "render" block: provider ("fal" or "gemini"), model (an id from the catalogue in the manual's
  footage chapter), prompt (ONE shot: subject · action · camera and lens · light · texture; no
  on-screen text, no logos, no real or recognisable people), negative ("text, logos, real
  people"), seconds "auto", resolution "720p", aspect "16:9", audio false. fit "cover" for a
  full-bleed shot, "contain" or "card" for a shot in a box. Six shots or fewer, each 3 to 8 s
  of the cut. Nothing renders until a person runs the pipeline with --go and pays for it.
  To put the REAL product inside a generated scene, give a reference-to-video model the stage's
  own recording as a reference: refs.images may hold "@still:<clipId>+<s>" (one frame of the
  recorded take at that clip's time) and refs.videos "@take:newest:<clipId>..<clipId>+<s>" (a
  slice of it), then name them in the prompt as @Image1 / @Video1 ("the monitor shows @Image1").
  Those need a recorded take first, so use them only when the brief says one exists.
- When ANY footage clip exists the endCard MUST carry a chip that says "Contains AI-generated
  footage" — the disclosure the law asks for.
- blackoutAnchor is ~0.5s after the final word; endAnchor ~2s after that.`

  return [
    {
      type: 'text',
      text: `You compile a trailer BRIEF into a stage's data formats. Return ONE JSON object matching the schema. The caller writes the files, estimates timings, and a human decides every spend.\n\n${VOICE}\n\n${LAWS}\n\nTHE PIECE VOCABULARY (verbatim from the source):\n${vocabulary}\n\n${manual ? `FROM THE MANUAL:\n${manual.slice(0, 12000)}` : ''}`,
    },
    ...(example
      ? [
          {
            type: 'text',
            text: `A WORKED EXAMPLE. Its clips carry numeric at/until because its mix exists; YOUR clips carry anchors instead. Match its structure and its params.\n\nexample.timeline.json:\n${example}\n\nexample.mix.json:\n${exampleMix}`,
            cache_control: { type: 'ephemeral' },
          },
        ]
      : []),
    ...(projectDigest
      ? [{ type: 'text', text: `THE PROJECT THIS TRAILER IS ABOUT:\n${projectDigest}`, cache_control: { type: 'ephemeral' } }]
      : []),
  ]
}

// ── stills for edit mode ────────────────────────────────────────────────────
let ffmpegBin = null
async function stillForUpload(path) {
  // 1024px JPEGs: a full-size PNG is about a megabyte, and a dozen of them
  // brush the request cap while adding nothing a defect check can use.
  if (ffmpegBin === null) ffmpegBin = (await ffmpegPath({ required: false })) ?? false
  if (ffmpegBin) {
    const r = spawnSync(ffmpegBin, ['-v', 'error', '-i', path, '-vf', 'scale=1024:-2', '-q:v', '4', '-f', 'mjpeg', 'pipe:1'], {
      maxBuffer: 1 << 26,
    })
    if (r.status === 0 && r.stdout?.length) return { media_type: 'image/jpeg', data: r.stdout.toString('base64') }
  }
  return { media_type: 'image/png', data: readFileSync(path).toString('base64') }
}

// ── materialize ─────────────────────────────────────────────────────────────
function materialize(d, { name, mixDir, bedFile, briefPath, briefText, voice }) {
  const est = estimateLines(d.lines, d.mix.prerollSec)
  const tailSec = d.mix.tailSec
  const t = (a) => resolveAnchor(a, est, tailSec)
  const end = t(d.endAnchor) ?? r2(est.prerollSec + est.voiceSec + tailSec)
  const blackoutAt = t(d.blackoutAnchor) ?? r2(end - 1.4)
  const hasBed = !!(bedFile || d.bed)
  const outBase = join(mixDir, name)
  const lineIds = d.lines.map((l) => l.id)

  const tracks = d.tracks.map((tr) => ({
    id: tr.id,
    name: tr.name,
    kind: tr.kind,
    clips: tr.clips.map((c) => {
      const clip = { id: c.id, at: t(c.anchor) ?? 0, anchor: c.anchor }
      if (c.anchorUntil) {
        clip.until = t(c.anchorUntil) ?? undefined
        clip.anchorUntil = c.anchorUntil
      }
      if (c.paramsJson) clip.params = rewriteRefs(JSON.parse(c.paramsJson), lineIds)
      return clip
    }),
  }))
  // The line markers every inner TimeRef points at.
  tracks.push({
    id: 'lines',
    name: 'Narration lines',
    kind: 'marker',
    locked: true,
    clips: d.lines.map((l) => ({
      id: lineClipId(l.id),
      at: est.lines[l.id].startsMix,
      until: est.lines[l.id].endsMix,
      anchor: `line:${l.id}.start`,
      anchorUntil: `line:${l.id}.end`,
      params: { label: l.id },
    })),
  })
  // The locked audio truth for the editor (estimated until the mix is built).
  tracks.push({
    id: 'vo',
    name: 'Narration (estimated until the mix is built)',
    kind: 'audio',
    locked: true,
    clips: d.lines.map((l) => ({
      id: `vo-${l.id}`,
      at: est.lines[l.id].startsMix,
      until: est.lines[l.id].endsMix,
      params: { label: l.id },
    })),
  })
  if (hasBed)
    tracks.push({
      id: 'bed',
      name: 'Music bed',
      kind: 'audio',
      locked: true,
      clips: [{ id: 'bed', at: 0, until: end, params: { label: bedFile ? basename(bedFile) : d.bed.prompt.slice(0, 60) } }],
    })

  const timeline = {
    name,
    end,
    blackoutAt,
    endAnchor: d.endAnchor,
    blackoutAnchor: d.blackoutAnchor,
    mix: hasBed ? `${outBase}.wav` : `${outBase}.vo.wav`,
    ...(d.camera?.length
      ? { camera: d.camera.map((cm) => ({ at: t(cm.anchor) ?? 0, until: t(cm.untilAnchor) ?? 0, from: cm.from, to: cm.to, cx: cm.cx, cy: cm.cy })) }
      : {}),
    ...(d.scene ? { scene: Object.fromEntries(Object.entries(d.scene).filter(([, v]) => v !== null)) } : {}),
    ...(d.blackoutColor ? { blackoutColor: d.blackoutColor } : {}),
    tracks,
  }

  const voiceName = voice ? 'narrator' : 'narrator'
  const parts = []
  d.lines.forEach((l, i) => {
    parts.push({
      id: l.id,
      src: `${outBase}-${l.id}.vo.mp3`,
      render: { text: l.text, voice: voiceName, ...(voice?.settings ? { settings: voice.settings } : {}) },
    })
    if (i < d.lines.length - 1) parts.push({ gap: r2(l.gapAfter ?? 0.6) })
  })
  const mix = {
    comment: `${name}: compiled by scripts/draft.mjs from ${briefPath}. Rebuild: npm run mix -- ${name}`,
    ...(voice?.id ? { voices: { narrator: { voice_id: voice.id, name: voice.name ?? 'narrator' } } } : {}),
    parts,
    ...(bedFile ? { bed: bedFile } : d.bed ? { bed: { src: `${outBase}-bed.music.mp3`, render: { prompt: d.bed.prompt, seconds: d.bed.seconds } } } : {}),
    bedGainDb: d.mix.bedGainDb,
    duckDb: d.mix.duckDb,
    prerollSec: d.mix.prerollSec,
    tailSec: d.mix.tailSec,
    ...(d.sfx?.length
      ? { sfx: d.sfx.map((s) => ({ at: t(s.anchor) ?? 0, anchor: s.anchor, src: `${outBase}-${s.id}.sfx.mp3`, gainDb: s.gainDb, render: { prompt: s.prompt, seconds: s.seconds } })) }
      : {}),
  }

  const chars = d.lines.reduce((n, l) => n + l.text.length, 0)
  const fmtT = (x) => (x === null || x === undefined ? '—' : `${x.toFixed(1)}s`)
  const story = [
    `# ${name} — storyboard`,
    '',
    `> status: draft · compiled by scripts/draft.mjs from \`${briefPath}\``,
    `> Times are ESTIMATES (${CPS} characters/second, plus ${TAG_SEC}s per direction) until the mix is built.`,
    `> Every clip carries its narration anchor, so \`npm run trailer -- ${name} --go\` renders, builds and re-times everything from the measured audio.`,
    '',
    `**${d.logline}**`,
    '',
    '## Beats',
    '',
    '| est. | anchor | you see | you hear |',
    '|---|---|---|---|',
    ...d.storyboard.map((b) => `| ${fmtT(t(b.anchor))} | \`${b.anchor}\` | ${b.sees} | ${b.hears} |`),
    '',
    `## Narration — ${d.lines.length} lines, ${chars} characters`,
    '',
    ...d.lines.map((l) => `- **${l.id}** (${fmtT(est.lines[l.id].startsMix)} → ${fmtT(est.lines[l.id].endsMix)}, est.) ${l.text}`),
    '',
    '## Sound',
    '',
    bedFile ? `- bed: reuses \`${bedFile}\` (no music spend)` : d.bed ? `- bed: RENDER ${d.bed.seconds}s — "${d.bed.prompt}"` : '- bed: none (voice only)',
    `- bed ${d.mix.bedGainDb} dB · duck ${d.mix.duckDb} dB · preroll ${d.mix.prerollSec}s · tail ${d.mix.tailSec}s`,
    ...(d.sfx?.length ? d.sfx.map((s) => `- sfx **${s.id}** at \`${s.anchor}\`: "${s.prompt}" (${s.seconds}s, ${s.gainDb} dB)`) : ['- sfx: none']),
    '',
    '## On stage',
    '',
    ...tracks.filter((tr) => tr.kind !== 'audio').map((tr) => `- **${tr.name}** (${tr.id}): ${tr.clips.map((c) => (c.params?.piece ? `${c.id}·${c.params.piece}` : c.id)).join(', ')}`),
    '',
    '## Check these on the cue stills',
    '',
    ...d.notes.map((n) => `- ${n}`),
    '',
    '## Next',
    '',
    '```',
    `npm run trailer -- ${name}          # dry run: lists every render it would pay for`,
    `npm run trailer -- ${name} --go     # the human click: render, build, re-time, record`,
    '```',
    '',
    '## The brief, verbatim',
    '',
    '```',
    briefText.trim(),
    '```',
    '',
  ].join('\n')

  return { timeline, mix, story, est }
}

// ── the call ────────────────────────────────────────────────────────────────
async function callModel({ system, user, label }) {
  const sysChars = system.reduce((n, b) => n + b.text.length, 0)
  const userChars = user.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0)
  const images = user.filter((b) => b.type === 'image').length
  console.log(`  ${label}: system ${(sysChars / 1000).toFixed(1)}k chars · user ${(userChars / 1000).toFixed(1)}k chars · ${images} still${images === 1 ? '' : 's'} · ${MODEL} effort ${EFFORT}`)
  if (DRY) return null
  const client = new Anthropic()
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
    system,
    messages: [{ role: 'user', content: user }],
  })
  const res = await stream.finalMessage()
  if (res.stop_reason === 'refusal') {
    console.error(`  the model declined: ${res.stop_details?.category ?? 'unspecified'}`)
    process.exit(3)
  }
  if (res.stop_reason === 'max_tokens') {
    console.error('  the draft was cut off. Shorten the brief, or raise max_tokens.')
    process.exit(3)
  }
  console.log(`  tokens: in ${res.usage.input_tokens} (cache read ${res.usage.cache_read_input_tokens ?? 0}) · out ${res.usage.output_tokens}`)
  return JSON.parse(res.content.find((b) => b.type === 'text')?.text ?? '{}')
}

// ── modes ───────────────────────────────────────────────────────────────────
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1]?.startsWith('--')))
const briefPath = positional[0]
if (!briefPath || !existsSync(briefPath)) {
  console.error(`
Usage:
  node scripts/draft.mjs <brief.md> --name <slug> [--project <path|git-url>] [--bed <file.mp3>]
  node scripts/draft.mjs <notes.md> --edit <name> [--stills 12]
  node scripts/draft.mjs --check <name>      node scripts/draft.mjs --schema
`)
  process.exit(1)
}
const briefText = readFileSync(briefPath, 'utf8')
const editName = arg('edit')

// The project digest (optional, and printable before it is sent).
let digest = null
let project = null
const projectArg = arg('project')
if (projectArg) {
  try {
    project = readProject(projectArg)
    digest = digestText(project)
    console.log(`  project: ${project.name} (${project.kind}) · ${project.routes.length} routes · digest ${(digest.length / 1000).toFixed(1)}k chars`)
    if (has('print-digest')) {
      console.log('\n──── digest ────\n' + digest + '\n──── end ────\n')
      if (!has('go')) {
        console.log('  (--print-digest without --go: nothing was sent. Re-run without --print-digest to compile.)\n')
        process.exit(0)
      }
    }
  } catch (e) {
    console.error(`  could not read the project: ${e.message}`)
    process.exit(1)
  }
}

let name, mixDir, bedFile, userContent, existing
if (editName) {
  name = editName
  const tlPath = timelinePath(name)
  const specPath = mixSpecPath(name)
  if (!existsSync(tlPath) || !existsSync(specPath)) {
    console.error(`--edit needs both ${name}.timeline.json and ${name}.mix.json`)
    process.exit(1)
  }
  existing = { tl: JSON.parse(readFileSync(tlPath, 'utf8')), mix: JSON.parse(readFileSync(specPath, 'utf8')) }
  const firstSrc = existing.mix.parts?.find((p) => p.src)?.src
  mixDir = firstSrc ? resolve(firstSrc, '..') : ensureDir(audioDir(name))
  bedFile = typeof existing.mix.bed === 'string' ? existing.mix.bed : null
  const cuesPath = typeof existing.tl.mix === 'string' ? existing.tl.mix.replace(/(\.vo)?\.(wav|mp3)$/i, '.cues.json') : null
  const cues = cuesPath && existsSync(cuesPath) ? readFileSync(cuesPath, 'utf8') : null

  // The latest take's cue stills, thinned — so "at fourteen seconds" lands on a
  // frame the model can actually see.
  const dir = takesDir(name)
  let stills = []
  if (existsSync(dir)) {
    const takes = readdirSync(dir).filter((f) => /^take-\d+.*\.frames$/.test(f)).sort()
    const chosen = arg('take') ? `${arg('take')}.frames` : takes[takes.length - 1]
    if (chosen && existsSync(join(dir, chosen))) {
      const all = readdirSync(join(dir, chosen)).filter((f) => f.endsWith('.png')).sort()
      const want = Math.max(1, Number(arg('stills', 12)))
      const step = Math.max(1, Math.ceil(all.length / want))
      stills = all.filter((_, i) => i % step === 0).map((f) => ({ file: f, path: join(dir, chosen, f) }))
      console.log(`  stills: ${stills.length} of ${all.length} from ${chosen}`)
    }
  }
  const shots = []
  for (const s of stills) {
    const u = await stillForUpload(s.path)
    shots.push(
      { type: 'text', text: `Cue still ${s.file} (the filename is <mix seconds>s-<cue name>):` },
      { type: 'image', source: { type: 'base64', media_type: u.media_type, data: u.data } },
    )
  }
  userContent = [
    {
      type: 'text',
      text: `EDIT MODE. Apply these notes to "${name}" and return the COMPLETE revised trailer in the schema — every line, every track, every clip, not a diff.

RULES FOR EDITS:
- Keep every line whose WORDS do not change exactly as it is, same id, same text: the caller then reuses its rendered audio at zero cost. A changed or new line gets a NEW id (suffix -v2), so the old audio stays untouched and only the new line renders.
- The current clips carry numeric times from the measured cue map below; express your revised clips as anchors. A note that says "at fourteen seconds" refers to the CURRENT timing: find the clip or line at that time in the timeline, the cue map and the stills.
- Change only what the notes ask for. Everything else stays identical.

THE NOTES (verbatim):
${briefText}

CURRENT ${name}.timeline.json:
${JSON.stringify(existing.tl, null, 1)}

CURRENT ${name}.mix.json:
${JSON.stringify(existing.mix, null, 1)}

${cues ? `MEASURED CUE MAP:\n${cues}` : 'No measured cue map yet (the mix has not been built).'}`,
    },
    ...shots,
  ]
} else {
  name = arg('name')
  if (!name || !/^[\w-]{1,64}$/.test(name)) {
    console.error('--name <slug> is required for a new trailer (letters, numbers, dashes)')
    process.exit(1)
  }
  if (existsSync(timelinePath(name)) && !has('force')) {
    console.error(`${name}.timeline.json exists. Use --edit ${name} to revise it, or --force to overwrite.`)
    process.exit(1)
  }
  mixDir = ensureDir(arg('mix-dir') ? resolve(arg('mix-dir')) : audioDir(name))
  bedFile = arg('bed')
  if (bedFile && !existsSync(bedFile)) {
    console.error(`--bed file not found: ${bedFile}`)
    process.exit(1)
  }
  const target = cfg.target?.url
  userContent = [
    {
      type: 'text',
      text: `NEW TRAILER, name "${name}".${bedFile ? ' The caller supplies the music bed (return bed: null).' : ' Propose a music bed prompt unless the brief says voice only.'}
${target ? `The app is running and can be filmed with the browserFrame piece: it is proxied at "${cfg.target.basePath}".` : 'No app is configured for filming, so build the picture from the other pieces.'}
The project's own name is "${cfg.project?.name ?? name}"${cfg.project?.tagline ? `, described as "${cfg.project.tagline}"` : ''}.

THE BRIEF (a transcript or typed notes, verbatim):
${briefText}`,
    },
  ]
}

console.log(`\n  draft — ${editName ? `EDIT ${name}` : `NEW ${name}`}\n`)
const system = buildSystem(digest)
const fromDraft = arg('from-draft')
let draft = fromDraft ? JSON.parse(readFileSync(fromDraft, 'utf8')) : await callModel({ system, user: userContent, label: 'call 1' })
if (DRY && !fromDraft) {
  console.log('\n  dry run: nothing called, nothing written.\n')
  process.exit(0)
}

let problems = validateDraft(draft)
if (problems.length && fromDraft) {
  console.error(`  ${problems.length} problem(s) in ${fromDraft}; nothing written:`)
  for (const p of problems) console.error(`    - ${p}`)
  process.exit(2)
}
if (problems.length) {
  console.log(`  ${problems.length} problem(s) in the first draft; asking for a repair:`)
  for (const p of problems) console.log(`    - ${p}`)
  draft = await callModel({
    system,
    user: [...userContent, { type: 'text', text: `YOUR PREVIOUS DRAFT:\n${JSON.stringify(draft)}\n\nIT FAILED THESE CHECKS. Return the corrected COMPLETE draft:\n${problems.map((p) => `- ${p}`).join('\n')}` }],
    label: 'call 2 (repair)',
  })
  problems = validateDraft(draft)
  if (problems.length) {
    console.error(`  still ${problems.length} problem(s) after the repair round; nothing written:`)
    for (const p of problems) console.error(`    - ${p}`)
    process.exit(2)
  }
}

// In EDIT mode an unchanged line keeps its rendered audio.
if (existing) {
  const oldById = Object.fromEntries((existing.mix.parts ?? []).filter((p) => p.src).map((p, i) => [p.id ?? `part${i}`, p]))
  for (const l of draft.lines) {
    const old = oldById[l.id]
    if (old?.render && old.render.text.trim() === l.text.trim()) l.keepSrc = old.src
  }
}

const voice = {
  id: arg('voice-id', cfg.voice?.id ?? ''),
  name: arg('voice-name', cfg.voice?.name ?? 'narrator'),
  settings: cfg.voice?.stability !== undefined ? { stability: Number(arg('voice-stability', cfg.voice.stability)) } : undefined,
}
const { timeline, mix, story, est } = materialize(draft, { name, mixDir, bedFile, briefPath, briefText, voice })
if (existing) for (const p of mix.parts) {
  const keep = draft.lines.find((l) => l.id === p.id)?.keepSrc
  if (keep) p.src = keep
}

mkdirSync(mixDir, { recursive: true })
writeFileSync(timelinePath(name), JSON.stringify(timeline, null, 1) + '\n')
writeFileSync(mixSpecPath(name), JSON.stringify(mix, null, 2) + '\n')
writeFileSync(storyboardPath(name), story)
// The estimated cue map beside the future mix, marked as an estimate.
const cuesOut = timeline.mix.replace(/(\.vo)?\.(wav|mp3)$/i, '.cues.json')
if (!existsSync(cuesOut) || JSON.parse(readFileSync(cuesOut, 'utf8')).estimated)
  writeFileSync(cuesOut, JSON.stringify({ built: 'scripts/draft.mjs (ESTIMATE)', mixSec: timeline.end, ...est }, null, 2))

const renders = mix.parts.filter((p) => p.src && p.render && !existsSync(p.src))
const chars = renders.reduce((n, p) => n + p.render.text.length, 0)
console.log(`\n  wrote\n    ${timelinePath(name)}\n    ${mixSpecPath(name)}\n    ${storyboardPath(name)}\n    ${cuesOut} (estimate)`)
console.log(`\n  would spend on --go: ${renders.length} narration render(s), ${chars} characters${mix.bed?.render ? ` · ${mix.bed.render.seconds}s of music` : ''}${mix.sfx?.length ? ` · ${mix.sfx.length} effects` : ''}`)
console.log(`  read the storyboard, open http://localhost:3000/studio/${name}, then: npm run trailer -- ${name} --go\n`)
if (project?.cloned) console.log(`  (the cloned copy of the project is in ${project.cloned} — delete it when you are done)\n`)
