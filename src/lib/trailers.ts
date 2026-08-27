/**
 * Reading and writing trailer files. Server-side only.
 *
 * A trailer is three files in the `trailers/` directory, all editable by hand:
 *   <name>.timeline.json   the picture (and the times)
 *   <name>.mix.json        the sound (lines, gaps, a bed, effects)
 *   <name>.storyboard.md   the human read, for whoever approves it
 *
 * The name is whitelisted everywhere it is used. These paths are the only ones
 * the API will read or write, so a request can never walk out of the directory.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from './config'
import type { TrailerTimeline } from './timeline'

export const NAME_RE = /^[\w-]{1,64}$/

export function trailersDir(root = process.cwd()): string {
  return join(root, loadConfig(root).paths.trailers)
}

export function timelinePath(name: string, root = process.cwd()): string | null {
  return NAME_RE.test(name) ? join(trailersDir(root), `${name}.timeline.json`) : null
}

export function mixSpecPath(name: string, root = process.cwd()): string | null {
  return NAME_RE.test(name) ? join(trailersDir(root), `${name}.mix.json`) : null
}

export function listTrailers(root = process.cwd()): string[] {
  try {
    return readdirSync(trailersDir(root))
      .filter((f) => f.endsWith('.timeline.json'))
      .map((f) => f.replace(/\.timeline\.json$/, ''))
      .sort()
  } catch {
    return []
  }
}

export function readTimeline(name: string, root = process.cwd()): TrailerTimeline | null {
  const p = timelinePath(name, root)
  if (!p || !existsSync(p)) return null
  try {
    const tl = JSON.parse(readFileSync(p, 'utf8')) as TrailerTimeline
    if (!tl || !Array.isArray(tl.tracks)) return null
    // A compiled draft names the mix it WILL have. Until the builder writes that
    // file the stage plays it as a silent draft, so a cut can be shot and judged
    // before a single line of narration is rendered.
    if (typeof tl.mix === 'string' && !existsSync(tl.mix)) return { ...tl, mix: null }
    return tl
  } catch {
    return null
  }
}

export async function writeTimeline(name: string, tl: TrailerTimeline, root = process.cwd()): Promise<boolean> {
  const p = timelinePath(name, root)
  if (!p) return false
  // One space of indent: the editor round-trips this file, and a readable diff
  // is how a human reviews what the editor changed.
  await writeFile(p, JSON.stringify(tl, null, 1) + '\n')
  return true
}

/** The mix a timeline points at, if it exists on disk. */
export function mixFileOf(name: string, root = process.cwd()): string | null {
  const p = timelinePath(name, root)
  if (!p || !existsSync(p)) return null
  try {
    const mix = JSON.parse(readFileSync(p, 'utf8')).mix
    return typeof mix === 'string' && existsSync(mix) ? mix : null
  } catch {
    return null
  }
}
