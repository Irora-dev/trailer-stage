// Shared plumbing for the scripts: the project's config, paths, ffmpeg, and the
// small argument reader they all use. Dependency-free.

import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  const v = i > -1 ? process.argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : fallback
}
export const has = (flag) => process.argv.includes(`--${flag}`)

function readJson(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
  } catch (e) {
    console.error(`  cannot parse ${path}: ${e.message}`)
    return null
  }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

/** studio.config.json, with studio.config.local.json layered on top. */
export function config() {
  const base = readJson(join(ROOT, 'studio.config.json')) ?? {}
  const local = readJson(join(ROOT, 'studio.config.local.json')) ?? {}
  const out = { ...base }
  for (const [k, v] of Object.entries(local)) out[k] = isObj(v) && isObj(out[k]) ? { ...out[k], ...v } : v
  return out
}

export function paths() {
  const c = config()
  const p = c.paths ?? {}
  const abs = (v, d) => (v ? (isAbsolute(v) ? v : join(ROOT, v)) : join(ROOT, d))
  return {
    trailers: abs(p.trailers, 'trailers'),
    takes: abs(p.takes, '.takes'),
    audio: abs(p.audio, '.audio'),
    footage: abs(p.footage, '.footage'),
  }
}

export const timelinePath = (name) => join(paths().trailers, `${name}.timeline.json`)
export const mixSpecPath = (name) => join(paths().trailers, `${name}.mix.json`)
export const storyboardPath = (name) => join(paths().trailers, `${name}.storyboard.md`)
export const takesDir = (name) => join(paths().takes, name)
export const audioDir = (name) => join(paths().audio, name)
export const footageDir = (name) => join(paths().footage, name)

export function ensureDir(d) {
  mkdirSync(d, { recursive: true })
  return d
}

export function readTimeline(name) {
  const p = timelinePath(name)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

/**
 * ffmpeg, in order: an explicit --ffmpeg, FFMPEG_PATH, the optional
 * `ffmpeg-static` package, then whatever is on PATH.
 *
 * It is deliberately NOT a declared dependency. Its install script downloads a
 * binary from the network, which is a thing a build should opt into rather than
 * inherit; `npm i -D ffmpeg-static` is one command when you want it.
 */
export async function ffmpegPath({ required = true } = {}) {
  const explicit = arg('ffmpeg', process.env.FFMPEG_PATH)
  if (explicit && existsSync(explicit)) return explicit
  try {
    const { default: p } = await import('ffmpeg-static')
    if (p && existsSync(p)) return p
  } catch {
    /* not installed; try PATH */
  }
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  if (probe.status === 0) return 'ffmpeg'
  if (!required) return null
  console.error(`
  ffmpeg is needed for this step and was not found. Any one of these works:
    npm i -D ffmpeg-static          (simplest)
    FFMPEG_PATH=/path/to/ffmpeg …   (a binary you already have)
    brew install ffmpeg             (or your platform's package manager)
`)
  process.exit(1)
}

/** Run ffmpeg and return its stderr, which is where it says everything. */
export function ffmpeg(bin, args, label = 'ffmpeg') {
  // spawnSync, not execFileSync: ffmpeg writes its report to stderr even on
  // success, and execFileSync throws that away.
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (r.status !== 0) {
    console.error(`\n  ${label} failed:\n${(r.stderr || '').split('\n').slice(-14).join('\n')}`)
    process.exit(1)
  }
  return r.stderr || ''
}

/** A media file's duration in seconds, by decoding it. */
export function probeDuration(bin, file) {
  const err = ffmpeg(bin, ['-hide_banner', '-i', file, '-f', 'null', '-'], 'probe')
  let last = null
  for (const m of err.matchAll(/time=(\d+):(\d+):([\d.]+)/g)) last = m
  return last ? +last[1] * 3600 + +last[2] * 60 + +last[3] : 0
}

export const r2 = (x) => Math.round(x * 100) / 100

/** Format a byte count for a human. */
export const mb = (n) => `${(n / 1048576).toFixed(1)}MB`
