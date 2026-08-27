#!/usr/bin/env node
/**
 * THE EXPORT PACK — the approved take, plus the other shapes a feed wants.
 *
 *   node scripts/export.mjs <name> [--base <url>] [--posters] [--skip-social]
 *
 * It uses the APPROVED take for the wide cut (or the newest, saying so loudly),
 * and RE-RECORDS the vertical and square ratios rather than cropping them,
 * because a layout built for 16:9 does not survive a crop: text leaves the
 * frame, and the thing you were pointing at ends up off-screen.
 *
 * ⚠️ EYEBALL EACH RATIO'S CUE STILLS BEFORE ANYTHING SHIPS. A new ratio is a new
 * layout and it owes you one look. Posting is a person's job; this only builds
 * the files.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { arg, ensureDir, ffmpeg, ffmpegPath, has, ROOT, takesDir } from './lib.mjs'

const name = process.argv[2]
if (!name || name.startsWith('--')) {
  console.error('Usage: node scripts/export.mjs <name> [--posters] [--skip-social]')
  process.exit(1)
}
const dir = takesDir(name)
if (!existsSync(dir)) {
  console.error(`No takes for ${name}.`)
  process.exit(1)
}
const FF = await ffmpegPath()

const takes = readdirSync(dir).filter((f) => /^take-\d+\.mp4$/.test(f)).sort()
let source = null
try {
  const approved = readFileSync(join(dir, 'APPROVED'), 'utf8').trim()
  if (approved && existsSync(join(dir, `${approved}.mp4`))) source = `${approved}.mp4`
} catch {
  /* nothing approved */
}
if (!source) {
  source = takes[takes.length - 1]
  console.log(`  ⚠ no approved take — exporting ${source}, which nobody has signed off on`)
}
if (!source) {
  console.error('  no takes to export')
  process.exit(1)
}

const n = readdirSync(dir).filter((f) => /^export-\d+$/.test(f)).length + 1
const out = ensureDir(join(dir, `export-${String(n).padStart(3, '0')}`))
const wide = join(out, `${name}-16x9.mp4`)
ffmpeg(FF, ['-y', '-i', join(dir, source), '-c', 'copy', wide], 'wide')
console.log(`\n  ${wide}  (from ${source})`)

if (has('posters')) {
  const frames = join(dir, `${source.replace(/\.mp4$/, '')}.frames`)
  if (existsSync(frames)) {
    const p = ensureDir(join(out, 'posters'))
    for (const f of readdirSync(frames).filter((f) => f.endsWith('.png'))) {
      ffmpeg(FF, ['-y', '-i', join(frames, f), '-vf', 'scale=1280:-2', join(p, f.replace(/\.png$/, '.jpg'))], 'poster')
    }
    console.log(`  posters/  ${readdirSync(p).length} stills`)
  }
}

if (!has('skip-social')) {
  const base = arg('base', process.env.STAGE_BASE)
  for (const [label, size] of [
    ['9x16', '720x1280'],
    ['1x1', '1080x1080'],
  ]) {
    console.log(`\n── re-recording ${label} (${size})`)
    const r = spawnSync(
      process.execPath,
      [join(ROOT, 'scripts', 'record.mjs'), name, '--size', size, '--captions', '--out', join(out, `${name}-${label}-cc.mp4`), ...(base ? ['--base', base] : [])],
      { stdio: 'inherit', env: { ...process.env, FFMPEG_PATH: FF } },
    )
    if (r.status !== 0) console.log(`  ${label} did not record — the dev server has to be up for a re-record`)
  }
}

mkdirSync(out, { recursive: true })
console.log(`
  export pack: ${out}

  Before anything ships: open each ratio's cue stills. A new ratio is a new
  layout, and it owes you one look.
`)
