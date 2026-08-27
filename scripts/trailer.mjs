#!/usr/bin/env node
/**
 * ONE COMMAND — the whole pipeline, with the spend behind one keystroke.
 *
 *   npm run trailer -- <name>          dry run: lists every render it would pay
 *                                      for, then stops
 *   npm run trailer -- <name> --go     the human click: render the missing audio,
 *                                      build the mix, re-time every anchored beat
 *                                      from the measured result, record, compare
 *
 *   flags: --base <url> · --captions · --size WxH · --no-record · --critic
 *          --skip-audio (picture only, even if a mix spec exists)
 *
 * The gates it keeps, and they are the point:
 *   · `--go` is the ONLY path that spends money.
 *   · Nothing here approves a take. Approval is a button a person presses.
 *   · Nothing is pushed, posted or published.
 *
 * When nothing would spend — every render already on disk — it runs without
 * `--go`, because rebuilding a mix from existing files is free and that is how
 * an edit round re-times a trailer.
 *
 * It never starts a dev server: two dev servers on one build cache corrupt it.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { arg, config, ffmpegPath, has, mixSpecPath, ROOT, takesDir, timelinePath } from './lib.mjs'

const name = process.argv[2]
if (!name || name.startsWith('--')) {
  console.error('Usage: npm run trailer -- <name> [--go] [--base <url>] [--captions] [--size WxH] [--no-record] [--critic]')
  process.exit(1)
}
const GO = has('go')
const cfg = config()

const tlPath = timelinePath(name)
if (!existsSync(tlPath)) {
  console.error(`\n  No trailers/${name}.timeline.json. Compile one:\n    npm run draft -- brief.md --name ${name}\n`)
  process.exit(1)
}
const tl = JSON.parse(readFileSync(tlPath, 'utf8'))
const specPath = mixSpecPath(name)
const spec = existsSync(specPath) && !has('skip-audio') ? JSON.parse(readFileSync(specPath, 'utf8')) : null

const FF = await ffmpegPath({ required: false })
const run = (label, file, args, env = {}) => {
  console.log(`\n── ${label}`)
  return spawnSync(process.execPath, [join(ROOT, 'scripts', file), ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...(FF ? { FFMPEG_PATH: FF } : {}), ...env },
  }).status ?? 1
}

// ── what this would cost ────────────────────────────────────────────────────
const takeFile = (src, n) => src.replace(/(\.[a-z0-9]+)$/i, `-t${n}$1`)
const renders = []
if (spec) {
  for (const p of spec.parts ?? []) {
    if (!p.render || !p.src) continue
    const n = p.render.takes ?? 1
    const files = n > 1 ? Array.from({ length: n }, (_, i) => takeFile(p.src, i + 1)) : [p.src]
    for (const f of files) if (!existsSync(f)) renders.push({ kind: 'voice', file: f, chars: p.render.text.length, text: p.render.text })
  }
  const bed = typeof spec.bed === 'string' ? { src: spec.bed } : spec.bed
  if (bed?.render && bed.src && !existsSync(bed.src))
    renders.push({ kind: 'music', file: bed.src, seconds: bed.render.seconds ?? 60, text: bed.render.lyrics ?? bed.render.prompt })
  for (const s of spec.sfx ?? [])
    if (s.render && s.src && !existsSync(s.src)) renders.push({ kind: 'sfx', file: s.src, seconds: s.render.seconds ?? 2, text: s.render.prompt })
}

console.log(`\n  trailer ${name} — ${spec ? (tl.mix ? 'voiced' : 'mix spec present, timeline silent') : 'picture only'}${GO ? ' · GO' : ' · dry run'}`)
if (renders.length) {
  const chars = renders.filter((r) => r.kind === 'voice').reduce((n, r) => n + r.chars, 0)
  const music = renders.filter((r) => r.kind === 'music').reduce((n, r) => n + r.seconds, 0)
  const sfx = renders.filter((r) => r.kind === 'sfx').length
  console.log(
    `\n  THIS WOULD SPEND: ${renders.filter((r) => r.kind === 'voice').length} narration render(s) = ${chars} characters${music ? ` · ${music}s of music` : ''}${sfx ? ` · ${sfx} effect(s)` : ''}`,
  )
  for (const r of renders)
    console.log(`    ${r.kind.padEnd(5)} ${r.file}\n          ← "${String(r.text).replace(/\s+/g, ' ').slice(0, 110)}${String(r.text).length > 110 ? '…' : ''}"`)
  if (!GO) {
    console.log('\n  dry run: nothing rendered, nothing spent. Re-run with --go to spend and record.\n')
    process.exit(0)
  }
} else if (spec) {
  console.log('  nothing to render: every part is on disk (rebuilding the mix is free)')
}

// ── audio: build the mix, then re-time the picture from it ──────────────────
if (spec && tl.mix) {
  const outBase = String(tl.mix).replace(/(\.vo)?\.(wav|mp3)$/i, '')
  const status = run('build the mix', 'build-mix.mjs', [name, '--out', outBase, ...(GO ? ['--go'] : [])])
  if (status !== 0) {
    console.error('\n  the mix did not build; stopping before anything is recorded.')
    process.exit(status)
  }
  const rs = run('re-time from the measured cue map', 'resolve-cues.mjs', [name, '--write', '--sync-vo'])
  if (rs === 2) console.log('  (some anchors could not be resolved — see above; the rest moved)')
} else {
  console.log('\n── audio: none (silent draft) — anchored beats keep their estimated times')
}

// ── the live server ─────────────────────────────────────────────────────────
async function liveBase() {
  const explicit = arg('base', process.env.STAGE_BASE)
  for (const base of explicit ? [explicit] : ['http://localhost:3000', 'http://localhost:3001']) {
    try {
      const r = await fetch(`${base}/stage/${name}`, { signal: AbortSignal.timeout(20000) })
      if (r.ok) return base
      console.log(`  ${base} answered ${r.status} for /stage/${name}`)
    } catch {
      /* not listening */
    }
  }
  return null
}

let recorded = false
if (!has('no-record')) {
  const base = await liveBase()
  if (!base) {
    console.error(`
  No dev server is serving this trailer. Start one:

      npm run dev

  then re-run, passing --base if it is not on :3000. (This script will not start
  a server itself: two dev servers on one build cache corrupt it.)
`)
    process.exit(1)
  }
  const args = [name, '--base', base]
  if (has('captions')) args.push('--captions')
  if (arg('size')) args.push('--size', arg('size'))
  const status = run(`record on ${base}`, 'record.mjs', args)
  if (status !== 0) process.exit(status)
  recorded = true
}

// ── after ───────────────────────────────────────────────────────────────────
const dir = takesDir(name)
const takes = existsSync(dir) ? readdirSync(dir).filter((f) => /^take-\d+.*\.mp4$/.test(f)).sort() : []
const latest = takes[takes.length - 1]
if (recorded && latest) {
  console.log(`\n  take: ${join(cfg.paths?.takes ?? '.takes', name, latest)} · stills beside it · review: npm run review`)
  const approved = join(dir, 'APPROVED')
  console.log(
    existsSync(approved)
      ? `  compared against the approved take (${readFileSync(approved, 'utf8').trim()}) above`
      : '  no approved take yet — approve one on the review board and every later take self-compares',
  )
  if (has('critic')) {
    const cs = run('the critic reads the frames', 'critic.mjs', [name, '--take', latest.replace(/\.mp4$/, '')])
    if (cs !== 0) console.log('  (the critic needs an Anthropic API key: export ANTHROPIC_API_KEY=…)')
  }
}
console.log('')
