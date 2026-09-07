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

import { existsSync, readFileSync } from 'node:fs'
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

/** Every footage clip in a timeline (scene video excluded). */
export function footageClips(tl) {
  const out = []
  for (const tr of tl.tracks ?? []) for (const c of tr.clips ?? []) if (c.params?.piece === 'footage') out.push({ trackId: tr.id, clip: c })
  return out
}

/**
 * The disclosure law: a cut with any footage clip carries an endCard chip that
 * says so. Returns the problem, or null. (The compiler's check enforces the same
 * rule on drafts; this one reads a finished timeline, however it was made.)
 */
export function disclosureProblem(tl) {
  if (!footageClips(tl).length) return null
  const chips = []
  for (const tr of tl.tracks ?? [])
    for (const c of tr.clips ?? [])
      if (c.params?.piece === 'endCard' && Array.isArray(c.params.chips)) chips.push(...c.params.chips.map(String))
  return chips.some((ch) => /ai[- ]generated/i.test(ch)) ? null : 'this cut contains footage but no endCard chip discloses it — add a chip like "Contains AI-generated footage"'
}

/**
 * What a take was filmed with: every footage shot, whether its file was on disk,
 * its hash, and the essentials of its provenance sidecar. The recorder writes
 * this beside each take so any frame traces to a model, a prompt and a cost.
 */
export function footageManifest(tl, footageDirAbs, { hashOf } = {}) {
  const shots = []
  for (const { trackId, clip } of footageClips(tl)) {
    const P = clip.params ?? {}
    const render = P.render && typeof P.render === 'object' ? P.render : null
    const src = footageSrcOf(tl.name, clip)
    const takes = Math.max(1, Math.round(Number(render?.takes) || 1))
    const use = Math.min(takes, Math.max(1, Math.round(Number(render?.use) || 1)))
    const playing = takes > 1 ? takeFile(src, use) : src
    const file = isRemote(playing) || playing.startsWith('/') ? null : abs(playing)
    const present = file ? existsSync(file) : null
    let sidecar = null
    if (file) {
      const sc = file.replace(/(\.[a-z0-9]+)$/i, '.footage.json')
      if (existsSync(sc)) {
        try {
          const j = JSON.parse(readFileSync(sc, 'utf8'))
          sidecar = { provider: j.provider ?? null, model: j.model ?? null, seed: j.seed ?? null, requestId: j.requestId ?? null, costUsdEstimated: j.costUsdEstimated ?? null, renderedAt: j.renderedAt ?? null }
        } catch {
          sidecar = null
        }
      }
    }
    shots.push({
      clip: clip.id,
      track: trackId,
      at: clip.at,
      until: clip.until ?? null,
      src: playing,
      present,
      sha1: present && hashOf ? hashOf(file) : null,
      model: render?.model ?? null,
      sidecar,
    })
  }
  return { trailer: tl.name, footageDir: footageDirAbs, at: new Date().toISOString(), present: shots.filter((s) => s.present).length, shots }
}

/** Problems a person should fix before spending. Empty when the plan is sound.
 *  `opts.stageRef(ref, render)` judges `@still:` / `@take:` references (see refs.mjs);
 *  without it they are reported as unresolvable. */
export function validatePlan(plan, opts = {}) {
  const problems = []
  for (const r of plan) {
    const where = `${r.trackId}/${r.clipId}`
    if (!r.model) problems.push(`${where}: render.model is missing`)
    if (!r.provider) problems.push(`${where}: cannot tell the provider of "${r.model}" — set render.provider to "fal" or "gemini"`)
    if (r.info && !r.info.resolutions.includes(r.resolution))
      problems.push(`${where}: ${r.model} does not offer ${r.resolution} (it offers ${r.info.resolutions.join(', ')})`)
    if (r.perSec == null) problems.push(`${where}: no price for ${r.model} at ${r.resolution} — add footage.prices in studio.config.json or render.pricePerSec`)
    if (r.info && !r.info.verified && r.missing.length && !(opts.verified && opts.verified(r)))
      problems.push(`${where}: the endpoint id "${r.model}" is catalogued from the family's naming, not read off the provider's page — confirm it before --go (a fetched schema counts)`)
    if (typeof r.render.prompt !== 'string' || !r.render.prompt.trim()) problems.push(`${where}: render.prompt is empty`)
    const refs = r.render.refs ?? {}
    for (const k of ['images', 'videos', 'audio']) {
      const list = Array.isArray(refs[k]) ? refs[k] : []
      if (r.info && list.length > r.info.refs[k]) problems.push(`${where}: ${list.length} ${k} references but ${r.model} takes ${r.info.refs[k]}`)
      for (const ref of list) {
        if (typeof ref !== 'string') problems.push(`${where}: a ${k} reference is not a string`)
        else if (ref.startsWith('@still:') || ref.startsWith('@take:')) {
          if (ref.startsWith('@still:') && k !== 'images') problems.push(`${where}: "${ref}" is a frame — list it under images`)
          else if (ref.startsWith('@take:') && k !== 'videos') problems.push(`${where}: "${ref}" is a slice — list it under videos`)
          else {
            const p = opts.stageRef ? opts.stageRef(ref, r) : 'stage references cannot be judged here'
            if (p) problems.push(`${where}: ${p}`)
          }
        } else if (!isRemote(ref) && !existsSync(abs(ref))) problems.push(`${where}: reference file not found: ${ref}`)
      }
    }
    if (r.render.seconds !== undefined && r.render.seconds !== 'auto' && !(Number(r.render.seconds) > 0))
      problems.push(`${where}: render.seconds must be a positive number or "auto"`)
  }
  return problems
}
