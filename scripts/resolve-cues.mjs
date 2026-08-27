#!/usr/bin/env node
/**
 * CUES BY CONSTRUCTION — the step that keeps the picture on the voice.
 *
 * Naming cues used to be a human step: build the mix, read the measured map,
 * type the numbers into the trailer. Then you re-render one line, every number
 * after it is wrong, and you nudge thirty of them by eye.
 *
 * Instead, a clip carries an ANCHOR saying where its time comes from:
 *
 *   "seg:12.start+0.17"    the 12th measured speech segment, plus a nudge
 *   "seg:3.end"            a segment's end
 *   "line:close.start"     a named part of the mix spec (parts carry "id")
 *   "voice.end+0.5"        the last spoken word
 *   "mix.end"              the whole mix
 *
 * This script resolves them against the cue map and rewrites `at` / `until`. The
 * stage and the studio never parse an anchor: they read resolved numbers, as
 * before. So the loop is: re-render a line → build the mix → resolve → record.
 * Nothing is nudged by hand, ever.
 *
 *   node scripts/resolve-cues.mjs <name> [--cues <file>] [--write] [--check] [--sync-vo]
 *
 * --check exits 1 if anything would move (use it as a gate).
 * --sync-vo rebuilds the locked narration track from the measured segments, so
 * the studio's audio lane matches the audio.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { arg, audioDir, has, timelinePath } from './lib.mjs'

const target = process.argv[2]
if (!target || target.startsWith('--')) {
  console.error('Usage: node scripts/resolve-cues.mjs <name> [--cues <file>] [--write] [--check] [--sync-vo]')
  process.exit(1)
}
const WRITE = has('write')
const CHECK = has('check')
const SYNC_VO = has('sync-vo')

const tlPath = target.endsWith('.json') ? resolve(target) : timelinePath(target)
if (!existsSync(tlPath)) {
  console.error(`No timeline at ${tlPath}`)
  process.exit(1)
}
const tl = JSON.parse(readFileSync(tlPath, 'utf8'))

// The cue map lives beside the mix the timeline points at; a compiled draft may
// instead have an ESTIMATED map in the audio directory.
const cuesPath = (() => {
  const explicit = arg('cues')
  if (explicit) return resolve(explicit)
  if (typeof tl.mix === 'string') {
    const beside = tl.mix.replace(/(\.vo)?\.(wav|mp3)$/i, '.cues.json')
    if (existsSync(beside)) return beside
  }
  const guess = `${audioDir(tl.name)}/${tl.name}.cues.json`
  return existsSync(guess) ? guess : null
})()

if (!cuesPath || !existsSync(cuesPath)) {
  console.error(`No cue map found. Build the mix first, or pass --cues <file>.`)
  process.exit(1)
}
const map = JSON.parse(readFileSync(cuesPath, 'utf8'))
const segments = map.segments ?? []
if (map.estimated)
  console.log(
    '\n  ⚠ this cue map is an ESTIMATE (the mix has not been built yet) — every time here is a guess until you run the pipeline with --go',
  )

/** Resolve one anchor against a cue map. Null when it names nothing. */
export function resolveAnchor(anchor, m) {
  const re = /^\s*(seg:(\d+)|line:([\w-]+)|voice|mix)\.(start|end)\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*$/
  const hit = re.exec(anchor ?? '')
  if (!hit) return null
  const [, kind, segN, lineId, edge, sign, delta] = hit
  let base
  if (kind.startsWith('seg:')) {
    const s = (m.segments ?? [])[Number(segN) - 1]
    if (!s) return null
    base = edge === 'start' ? s.startsMix : s.endsMix
  } else if (kind.startsWith('line:')) {
    const l = (m.lines ?? {})[lineId]
    if (!l) return null
    base = edge === 'start' ? l.startsMix : l.endsMix
  } else if (kind === 'voice') {
    const segs = m.segments ?? []
    if (!segs.length) return null
    base = edge === 'start' ? segs[0].startsMix : segs[segs.length - 1].endsMix
  } else {
    base = edge === 'start' ? 0 : m.mixSec
  }
  if (typeof base !== 'number') return null
  return Math.round((base + (sign ? (sign === '-' ? -1 : 1) * Number(delta) : 0)) * 100) / 100
}

const changes = []
const unresolved = []

for (const tr of tl.tracks) {
  for (const c of tr.clips) {
    if (c.anchor) {
      const t = resolveAnchor(c.anchor, map)
      if (t === null) unresolved.push(`${tr.id}/${c.id}: at ← ${c.anchor}`)
      else if (Math.abs(t - c.at) > 0.004) {
        changes.push(`${tr.id}/${c.id}`.padEnd(28) + `at     ${String(c.at).padStart(7)} → ${String(t).padStart(7)}   (${c.anchor})`)
        c.at = t
      }
    }
    if (c.anchorUntil) {
      const t = resolveAnchor(c.anchorUntil, map)
      if (t === null) unresolved.push(`${tr.id}/${c.id}: until ← ${c.anchorUntil}`)
      else if (c.until === undefined || Math.abs(t - c.until) > 0.004) {
        changes.push(`${tr.id}/${c.id}`.padEnd(28) + `until  ${String(c.until ?? '—').padStart(7)} → ${String(t).padStart(7)}   (${c.anchorUntil})`)
        c.until = t
      }
    }
  }
}

// The cut's own edges are fields, not clips, so they carry their anchors beside
// them. Miss this and a cut fades out a fraction before the last word — which is
// exactly as bad as it sounds and invisible in the file.
for (const [field, anchorField] of [
  ['blackoutAt', 'blackoutAnchor'],
  ['end', 'endAnchor'],
]) {
  const a = tl[anchorField]
  if (!a) continue
  const t = resolveAnchor(a, map)
  if (t === null) unresolved.push(`${field} ← ${a}`)
  else if (tl[field] === undefined || Math.abs(t - tl[field]) > 0.004) {
    changes.push(field.padEnd(28) + `       ${String(tl[field] ?? '—').padStart(7)} → ${String(t).padStart(7)}   (${a})`)
    tl[field] = t
  }
}

if (SYNC_VO && segments.length) {
  let vo = tl.tracks.find((t) => t.id === 'vo')
  if (!vo) {
    vo = { id: 'vo', name: 'Narration', kind: 'audio', locked: true, clips: [] }
    const bedIdx = tl.tracks.findIndex((t) => t.id === 'bed')
    tl.tracks.splice(bedIdx === -1 ? tl.tracks.length : bedIdx, 0, vo)
  }
  const keepLabels = vo.clips.length === segments.length
  const before = JSON.stringify(vo.clips)
  vo.clips = segments.map((s, i) => ({
    id: `vo${String(i + 1).padStart(2, '0')}`,
    at: s.startsMix,
    until: s.endsMix,
    params: {
      label: keepLabels ? String(vo.clips[i]?.params?.label ?? `seg ${i + 1}`) : s.line ? `${s.line} · seg ${i + 1}` : `seg ${i + 1}`,
    },
  }))
  if (JSON.stringify(vo.clips) !== before) changes.push(`vo track rebuilt from ${segments.length} segments`)
}

console.log(`\n  ${tlPath}\n  cues ${cuesPath}\n`)
if (unresolved.length) {
  console.log('  UNRESOLVED anchors (left untouched):')
  for (const u of unresolved) console.log(`    ${u}`)
  console.log('')
}
if (!changes.length) console.log('  every anchored clip already sits where its narration puts it — nothing to move\n')
else {
  console.log(`  ${changes.length} change${changes.length === 1 ? '' : 's'}${WRITE ? ' (written)' : ' (dry run; add --write)'}:`)
  for (const ch of changes) console.log(`    ${ch}`)
  console.log('')
  if (WRITE) writeFileSync(tlPath, JSON.stringify(tl, null, 1) + '\n')
}
if (CHECK && changes.length) process.exit(1)
if (unresolved.length) process.exit(2)
