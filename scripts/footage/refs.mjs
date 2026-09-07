/**
 * STAGE-DERIVED REFERENCES — the stage's own recordings, handed to the generator.
 *
 *   @still:<cue>[±off]               one frame of a recorded take, at that cue's time plus an offset
 *   @take:<which>:<from>..<until>    a slice of a recorded take; which = approved | newest | take-NNN
 *
 * A cue is a clip id (its `at`), `<id>.end` (its `until`), `end`, or plain seconds;
 * an offset is `+1.5` / `-0.5`. Frames and slices are cut with ffmpeg from the
 * APPROVED take (or the newest, and the note says so) into `.footage/<name>/refs/`,
 * named after what they are, so a re-run reuses them and a newer approved take
 * makes new ones. The builder hands them to the model as @Image1 / @Video1.
 *
 * This is how the real product appears inside a generated shot without being
 * generated: the app is filmed by the stage, the world around it is made by the
 * model, and the honesty law holds by construction rather than by discipline.
 *
 * Pure with respect to money: nothing here spends. Cutting a frame is free.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ffmpeg, r2 } from '../lib.mjs'

export const isStageRef = (s) => typeof s === 'string' && /^@(still|take):/.test(s)

/** Every cue a timeline exposes, as seconds: clip ids, `<id>.end`, and `end`. */
export function cueTimes(tl) {
  const cues = { end: tl.end }
  for (const tr of tl.tracks ?? [])
    for (const c of tr.clips ?? []) {
      if (typeof c.at === 'number') cues[c.id] = c.at
      if (typeof c.until === 'number') cues[`${c.id}.end`] = c.until
    }
  return cues
}

/** "lunge+2" · "crowd.end-0.5" · "12.5" → seconds, or null when it names nothing. */
export function parseTimeExpr(s, cues) {
  const m = /^\s*([A-Za-z0-9_.~-]+?)\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*$/.exec(String(s))
  if (!m) return null
  const [, base, sign, delta] = m
  const b = Number.isFinite(Number(base)) && base.trim() !== '' ? Number(base) : cues[base]
  if (b === undefined || !Number.isFinite(b)) return null
  return r2(b + (sign ? (sign === '-' ? -1 : 1) * Number(delta) : 0))
}

/** The take a reference is cut from: the approved one, the newest, or a named one. */
export function sourceTake(takesDir, which = 'approved') {
  if (!existsSync(takesDir)) return null
  const takes = readdirSync(takesDir)
    .filter((f) => /^take-\d+\.mp4$/.test(f))
    .sort()
  if (/^take-\d+$/.test(which)) {
    const f = `${which}.mp4`
    return takes.includes(f) ? { file: join(takesDir, f), label: which, approved: false } : null
  }
  let approved = null
  try {
    const a = readFileSync(join(takesDir, 'APPROVED'), 'utf8').trim()
    if (a && takes.includes(`${a}.mp4`)) approved = a
  } catch {
    /* nothing approved */
  }
  if (which === 'approved' && approved) return { file: join(takesDir, `${approved}.mp4`), label: approved, approved: true }
  const newest = takes[takes.length - 1]
  if (!newest) return null
  return { file: join(takesDir, newest), label: newest.replace(/\.mp4$/, ''), approved: false, fellBack: which === 'approved' }
}

const STILL_RE = /^@still:(.+)$/
const TAKE_RE = /^@take:(approved|newest|take-\d+):(.+?)\.\.(.+)$/

/** Parse a reference into what it asks for. Null when it is not well-formed. */
export function parseStageRef(ref) {
  let m = STILL_RE.exec(ref)
  if (m) return { kind: 'still', at: m[1].trim() }
  m = TAKE_RE.exec(ref)
  if (m) return { kind: 'take', which: m[1], from: m[2].trim(), until: m[3].trim() }
  return null
}

/** A problem a person should fix, or null when the reference can be cut. Free. */
export function stageRefProblem(ref, { tl, takesDir, FF }) {
  const p = parseStageRef(ref)
  if (!p) return `"${ref}" is not @still:<cue>[±s] or @take:<approved|newest|take-NNN>:<from>..<until>`
  const cues = cueTimes(tl)
  if (p.kind === 'still' && parseTimeExpr(p.at, cues) === null) return `"${ref}" names no cue (cues are clip ids, <id>.end, end, or seconds)`
  if (p.kind === 'take') {
    const a = parseTimeExpr(p.from, cues)
    const b = parseTimeExpr(p.until, cues)
    if (a === null || b === null) return `"${ref}": from/until name no cue`
    if (b <= a) return `"${ref}": until must be after from`
  }
  const src = sourceTake(takesDir, p.kind === 'take' ? p.which : 'approved')
  if (!src) return `"${ref}": no recorded take to cut from — record the trailer first (a silent draft is enough)`
  if (!FF) return `"${ref}": cutting a reference needs ffmpeg (FFMPEG_PATH, ffmpeg-static, or PATH)`
  return null
}

/**
 * Cut the reference into `refsDir` and describe it. Idempotent: the file name
 * carries the take label and the times, so an existing file is reused and a
 * different take makes a new one. `maxTakeSec` clamps a slice to what the
 * reference-to-video models accept (Seedance: 15 s in all).
 */
export function resolveStageRef(ref, { tl, takesDir, refsDir, FF, maxTakeSec = 15, width = 1280 }) {
  const p = parseStageRef(ref)
  if (!p) throw new Error(`not a stage reference: ${ref}`)
  const cues = cueTimes(tl)
  const src = sourceTake(takesDir, p.kind === 'take' ? p.which : 'approved')
  if (!src) throw new Error(`${ref}: no recorded take to cut from`)
  mkdirSync(refsDir, { recursive: true })
  const notes = []
  if (src.fellBack) notes.push(`no approved take — cut from the newest (${src.label})`)

  if (p.kind === 'still') {
    const t = parseTimeExpr(p.at, cues)
    if (t === null) throw new Error(`${ref}: names no cue`)
    const path = join(refsDir, `still-${src.label}-${p.at.replace(/[^A-Za-z0-9_.-]/g, (c) => (c === '+' ? '+' : '_'))}.png`)
    if (!existsSync(path)) ffmpeg(FF, ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', src.file, '-frames:v', '1', path], `still ${ref}`)
    return { kind: 'image', path, source: src.label, at: t, note: notes.join('; ') || null }
  }

  let a = parseTimeExpr(p.from, cues)
  let b = parseTimeExpr(p.until, cues)
  if (a === null || b === null) throw new Error(`${ref}: from/until name no cue`)
  if (b - a > maxTakeSec) {
    notes.push(`slice clamped from ${r2(b - a)}s to ${maxTakeSec}s`)
    b = r2(a + maxTakeSec)
  }
  const path = join(refsDir, `take-${src.label}-${a.toFixed(1)}s-${b.toFixed(1)}s.mp4`)
  if (!existsSync(path))
    ffmpeg(
      FF,
      ['-y', '-v', 'error', '-ss', a.toFixed(2), '-to', b.toFixed(2), '-i', src.file, '-vf', `scale='min(iw,${width})':-2:flags=lanczos,format=yuv420p`, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-movflags', '+faststart', path],
      `slice ${ref}`,
    )
  return { kind: 'video', path, source: src.label, from: a, until: b, seconds: r2(b - a), note: notes.join('; ') || null }
}
