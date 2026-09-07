/**
 * THE FOOTAGE PLAN — read a timeline, find every shot the picture still owes,
 * and price it. Pure: nothing here spends, renders or writes.
 *
 * A `footage` clip's `render` block is the spend spec (see the vocabulary in
 * src/lib/pieces.ts). The file it plays is its `src`, or the convention
 * `.footage/<trailer>/<clipId>.mp4`; a `takes: N` render writes `-t1…-tN` and
 * `use` picks the one that plays — the narration's own convention. The stage
 * reads the same rule through `footageFileOf` in src/lib/pieces.ts; the two are
 * kept in step by hand.
 *
 * Both the builder and `trailer.mjs` (the one-command dry run) read this file,
 * so the spend list a person sees is computed once.
 */

import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { ROOT } from '../lib.mjs'
import { guessProvider, modelInfo, pickSeconds, priceOf } from './models.mjs'

export const takeFile = (src, n) => src.replace(/(\.[a-z0-9]+)$/i, `-t${n}$1`)
export const abs = (p) => (isAbsolute(p) ? p : join(ROOT, p))
export const isRemote = (p) => /^https?:\/\//.test(p)

/** The `src` a footage clip plays, before any take suffix. */
export function footageSrcOf(trailerName, clip) {
  const P = clip.params ?? {}
  return typeof P.src === 'string' && P.src ? P.src : `.footage/${trailerName}/${clip.id}.mp4`
}

/**
 * Every render the timeline asks for: clips whose piece is `footage` with a
 * `render` block, plus a scene video with one. Each entry says what is on disk,
 * what is missing, how many seconds would be asked for, and what that costs.
 */
export function footageRenders(tl, cfg = {}) {
  const out = []
  const overrides = cfg.footage?.prices ?? {}

  const add = (kind, trackId, clip) => {
    const P = clip.params ?? {}
    const render = P.render
    if (!render || typeof render !== 'object') return
    const src = footageSrcOf(tl.name, clip)
    // A remote URL or a /public asset is never rendered here: it already exists.
    if (isRemote(src) || src.startsWith('/')) return
    const takes = Math.max(1, Math.round(Number(render.takes) || 1))
    const use = Math.min(takes, Math.max(1, Math.round(Number(render.use) || 1)))
    const files = (takes > 1 ? Array.from({ length: takes }, (_, i) => takeFile(src, i + 1)) : [src]).map(abs)
    const missing = files.filter((f) => !existsSync(f))
    const model = typeof render.model === 'string' ? render.model : ''
    const info = modelInfo(model, overrides)
    const provider = render.provider ?? info?.provider ?? guessProvider(model)
    const span = Math.max(0, (clip.until ?? tl.end) - clip.at)
    const seconds = pickSeconds(info, render.seconds, span)
    const resolution = typeof render.resolution === 'string' ? render.resolution : info?.defaultResolution ?? '720p'
    const perSec =
      typeof render.pricePerSec === 'number' ? render.pricePerSec : priceOf(info, resolution, render.audio === true)
    out.push({
      kind,
      trackId,
      clipId: clip.id,
      clip,
      render,
      src,
      playing: abs(takes > 1 ? takeFile(src, use) : src),
      files,
      missing,
      takes,
      use,
      model,
      info,
      provider,
      span,
      seconds,
      resolution,
      perSec,
      /** USD this plan would spend NOW: only the missing files. */
      usd: perSec != null ? perSec * seconds * missing.length : null,
    })
  }

  for (const tr of tl.tracks ?? []) for (const c of tr.clips ?? []) if (c.params?.piece === 'footage') add('clip', tr.id, c)
  if (tl.scene?.kind === 'video' && tl.scene.render && typeof tl.scene.src === 'string')
    add('scene', 'scene', { id: '__scene', at: 0, until: tl.end, params: { src: tl.scene.src, render: tl.scene.render } })
  return out
}

export const fmtUsd = (n) => (n == null ? '$?' : `$${n.toFixed(2)}`)

/** Problems a person should fix before spending. Empty when the plan is sound. */
export function validatePlan(plan) {
  const problems = []
  for (const r of plan) {
    const where = `${r.trackId}/${r.clipId}`
    if (!r.model) problems.push(`${where}: render.model is missing`)
    if (!r.provider) problems.push(`${where}: cannot tell the provider of "${r.model}" — set render.provider to "fal" or "gemini"`)
    if (r.info && !r.info.resolutions.includes(r.resolution))
      problems.push(`${where}: ${r.model} does not offer ${r.resolution} (it offers ${r.info.resolutions.join(', ')})`)
    if (r.perSec == null) problems.push(`${where}: no price for ${r.model} at ${r.resolution} — add footage.prices in studio.config.json or render.pricePerSec`)
    if (r.info && !r.info.verified && r.missing.length)
      problems.push(`${where}: the endpoint id "${r.model}" is catalogued from the family's naming, not read off the provider's page — confirm it before --go`)
    if (typeof r.render.prompt !== 'string' || !r.render.prompt.trim()) problems.push(`${where}: render.prompt is empty`)
    const refs = r.render.refs ?? {}
    for (const k of ['images', 'videos', 'audio']) {
      const list = Array.isArray(refs[k]) ? refs[k] : []
      if (r.info && list.length > r.info.refs[k]) problems.push(`${where}: ${list.length} ${k} references but ${r.model} takes ${r.info.refs[k]}`)
      for (const ref of list) {
        if (typeof ref !== 'string') problems.push(`${where}: a ${k} reference is not a string`)
        else if (ref.startsWith('@still:') || ref.startsWith('@take:'))
          problems.push(`${where}: "${ref}" — stage-derived references are phase 2; not resolved yet`)
        else if (!isRemote(ref) && !existsSync(abs(ref))) problems.push(`${where}: reference file not found: ${ref}`)
      }
    }
    if (r.render.seconds !== undefined && r.render.seconds !== 'auto' && !(Number(r.render.seconds) > 0))
      problems.push(`${where}: render.seconds must be a positive number or "auto"`)
  }
  return problems
}
