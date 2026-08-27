#!/usr/bin/env node
/**
 * GOLDEN-FRAME COMPARISON — proof that an edit round changed only what it meant
 * to, and that a refactor changed nothing at all.
 *
 *   node scripts/compare.mjs <a.frames> <b.frames>
 *
 * It scores every matching cue still and prints the worst first. Stills are
 * matched on the CUE NAME, not the timestamp: an audio edit legitimately moves a
 * cue's time, and matching on time would report every frame as changed.
 *
 * READING THE NUMBERS. Anything on the set that rides wall time rather than the
 * stage clock — a video, a live app, an animated background — makes two takes of
 * IDENTICAL intent land around 0.85 to 0.95. The score's job is to RANK what to
 * look at, not to pass or fail. Eyeball the lowest pairs. A frame present in
 * only one take is a finding, not a skip, so those are listed loudly.
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ffmpeg, ffmpegPath } from './lib.mjs'

const [dirA, dirB] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!dirA || !dirB || !existsSync(dirA) || !existsSync(dirB)) {
  console.error('Usage: node scripts/compare.mjs <a.frames> <b.frames>')
  process.exit(1)
}
const FF = await ffmpegPath()

const cueOf = (f) => f.replace(/^\d+(\.\d+)?s-/, '').replace(/\.png$/, '')
const mapOf = (dir) => {
  const m = new Map()
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.png'))) m.set(cueOf(f), join(dir, f))
  return m
}

const A = mapOf(dirA)
const B = mapOf(dirB)
const shared = [...A.keys()].filter((k) => B.has(k))

const rows = []
for (const cue of shared) {
  const out = ffmpeg(
    FF,
    ['-hide_banner', '-i', A.get(cue), '-i', B.get(cue), '-filter_complex', '[0:v][1:v]ssim', '-f', 'null', '-'],
    `ssim:${cue}`,
  )
  const all = /All:([\d.]+)/.exec(out)?.[1]
  if (all) rows.push({ cue, ssim: Number(all) })
}
rows.sort((a, b) => a.ssim - b.ssim)

console.log(`\n  ${dirA}\n  vs\n  ${dirB}\n`)
for (const r of rows) {
  const bar = '#'.repeat(Math.max(0, Math.round((r.ssim - 0.5) * 28)))
  const flag = r.ssim < 0.85 ? '← eyeball this' : bar
  console.log(`  ${r.ssim.toFixed(4)}  ${r.cue.padEnd(16)} ${flag}`)
}

const onlyA = [...A.keys()].filter((k) => !B.has(k))
const onlyB = [...B.keys()].filter((k) => !A.has(k))
if (onlyA.length || onlyB.length) {
  console.log('\n  ⚠ cue coverage differs:')
  for (const k of onlyA) console.log(`    only in A: ${k}`)
  for (const k of onlyB) console.log(`    only in B: ${k}`)
}
console.log('\n  (anything on wall time — video, a live app — puts identical takes at ~0.85-0.95: rank, do not gate)\n')
