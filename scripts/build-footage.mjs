#!/usr/bin/env node
/**
 * THE FOOTAGE BUILDER — the picture's render parts, behind the same --go as the sound.
 *
 *   node scripts/build-footage.mjs <name|timeline.json>          dry run: every shot the timeline still owes, PRICED, then stop
 *   node scripts/build-footage.mjs <name> --go                   render the missing shots, normalise them for the stage, write provenance
 *   node scripts/build-footage.mjs <name> --check                validate every render block offline: model, price, references, the
 *                                                                provider's own schema, the disclosure chip — and cut the stage references
 *   flags: --only <clipId> · --seconds N · --resolution R (overrides for this run, e.g. a first-light shot)
 *          --mock [--mock-file f.mp4] (no provider, no key, no spend: a generated test clip runs the whole path)
 *          --allow-expensive · --accept-stale-prices · --resubmit (ignore a pending marker and pay again)
 *          --parallel N (submit N shots at once; default 1, one at a time in order)
 *          --no-schema (skip the network for schemas) · --refresh-schemas · --no-normalise · --no-master
 *
 * THE LAWS (the sound's, applied to picture):
 *  1. DRY RUN IS THE DEFAULT. It prints what would render and what it costs, in
 *     dollars, from a dated catalogue. --go is a person saying yes to that figure.
 *  2. A FILE THAT EXISTS IS NEVER RE-RENDERED. Change a prompt and nothing happens
 *     until the old file is deleted or renamed.
 *  3. EVERY REQUEST IS CONFORMED TO AND VALIDATED AGAINST THE PROVIDER'S OWN SCHEMA
 *     before it is sent (fal publishes one per endpoint); an error refuses the spend.
 *  4. EVERY PAID CALL RUNS UNDER CAPS: per run (footage.budgetUsd), per shot
 *     (footage.perShotUsd), per month (footage.monthlyUsd, summed from the ledger
 *     .footage/SPEND.jsonl), and a price table older than footage.priceMaxAgeDays
 *     refuses. Each render leaves a provenance sidecar and a ledger row.
 *  5. A CRASH CANNOT PAY TWICE: a pending marker is written at submit and removed at
 *     success; a re-run fetches that result instead of rendering again.
 *  6. ONE BUILDER PER TRAILER (a lock), and nothing here approves, records or publishes.
 *
 * Seconds: a shot is generated for its RESOLVED span plus a margin (the narration
 * re-times spans by fractions; the piece freezes on the last frame), so run this
 * AFTER resolve-cues — trailer.mjs does. Output: the provider's master
 * (`<shot>.master.mp4`) and the stage file (`<shot>.mp4`: capped at the record
 * width, the record fps, yuv420p, silent unless `audio: true`).
 *
 * Exit codes: 0 built (or nothing owed) · 1 dry run with shots owed, or a problem
 * that refused the spend · 2 some shots failed (the rest landed; those record as plates)
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { arg, config, ffmpeg, ffmpegPath, footageDir, has, paths, probeDuration, r2, readTimeline, ROOT, takesDir } from './lib.mjs'
import { createBudget } from './footage/budget.mjs'
import { PRICES_AS_OF, pickSeconds, priceOf } from './footage/models.mjs'
import { abs, disclosureProblem, fmtUsd, footageRenders, isRemote, validatePlan } from './footage/plan.mjs'
import { isStageRef, resolveStageRef, stageRefProblem } from './footage/refs.mjs'
import { conformInput, inputSchemaOf, loadSchema, validateInput } from './footage/schema.mjs'
import { acquireLock, appendSpend, capProblems, clearPending, ledgerPathOf, monthToDate, readPending, writePending } from './footage/spend.mjs'
import { download, elideDataUris, falAwait, falGenerate, falInput, falKey, imageDataUri, uploadToFal } from './footage/providers/fal.mjs'
import { geminiKey, omniAwait, omniGenerate, veoAwait, veoGenerate } from './footage/providers/gemini.mjs'

const target = process.argv[2]
if (!target || target.startsWith('--')) {
  console.error(
    'Usage: node scripts/build-footage.mjs <name|timeline.json> [--go] [--check] [--only <clipId>] [--seconds N] [--resolution R] [--mock [--mock-file f]] [--allow-expensive] [--accept-stale-prices] [--resubmit] [--no-schema] [--refresh-schemas] [--no-normalise] [--no-master]',
  )
  process.exit(1)
}
const GO = has('go')
const CHECK = has('check')
const MOCK = has('mock')
const ONLY = arg('only')

const cfg = config()
const fcfg = cfg.footage ?? {}
const tl = target.endsWith('.json') ? JSON.parse(readFileSync(resolve(target), 'utf8')) : readTimeline(target)
if (!tl || !tl.name || !Array.isArray(tl.tracks)) {
  console.error(`No timeline at ${target.endsWith('.json') ? resolve(target) : `trailers/${target}.timeline.json`}`)
  process.exit(1)
}
const name = tl.name
const asOf = fcfg.pricesAsOf || PRICES_AS_OF
const rel = (p) => String(p).replace(`${ROOT}/`, '')
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

// ── the plan, with this run's overrides ─────────────────────────────────────
let plan = footageRenders(tl, cfg)
if (ONLY) plan = plan.filter((r) => r.clipId === ONLY)
const OV_SEC = arg('seconds')
const OV_RES = arg('resolution')
if (OV_SEC || OV_RES)
  for (const r of plan) {
    if (OV_RES) r.resolution = OV_RES
    if (OV_SEC) r.seconds = pickSeconds(r.info, Number(OV_SEC), r.span)
    r.perSec = typeof r.render.pricePerSec === 'number' ? r.render.pricePerSec : priceOf(r.info, r.resolution, r.render.audio === true)
    r.usd = r.perSec != null ? r.perSec * r.seconds * r.missing.length : null
    r.overridden = true
  }

// ffmpeg serves three jobs here: cutting stage references, normalising renders, and the mock clip.
const FF = has('no-normalise') ? await ffmpegPath({ required: false }) : await ffmpegPath({ required: false })
const refCtx = { tl, takesDir: takesDir(name), refsDir: join(footageDir(name), 'refs'), FF, width: cfg.record?.width ?? 1280 }
const stageRefCheck = (ref) => stageRefProblem(ref, refCtx)

/** Cut every stage reference a render names; returns printable lines. Free. */
function cutStageRefs(r) {
  const lines = []
  const refs = r.render.refs ?? {}
  for (const k of ['images', 'videos', 'audio'])
    for (const ref of Array.isArray(refs[k]) ? refs[k] : [])
      if (isStageRef(ref) && !stageRefProblem(ref, refCtx)) {
        const s = resolveStageRef(ref, refCtx)
        lines.push(`${ref} → ${rel(s.path)}${s.kind === 'video' ? ` (${s.seconds}s)` : ''} from ${s.source}${s.note ? ` · ${s.note}` : ''}`)
      }
  return lines
}

// ── the providers' schemas (fal publishes one per endpoint) ─────────────────
const schemaOpts = {
  cacheDir: join(ROOT, '.cache', 'schemas'),
  fixturesDir: join(ROOT, 'scripts', 'footage', 'fixtures', 'schemas'),
  maxAgeDays: Number(fcfg.schemaMaxAgeDays ?? 7),
  online: !has('no-schema') && !MOCK,
  refresh: has('refresh-schemas'),
}
const schemas = new Map()
for (const r of plan)
  if (r.provider === 'fal' && r.model && !schemas.has(r.model)) {
    const loaded = await loadSchema(r.model, schemaOpts)
    schemas.set(r.model, { ...loaded, input: loaded.doc ? inputSchemaOf(loaded.doc) : null })
  }
const verifiedBySchema = (r) => !!schemas.get(r.model)?.input
const schemaLabel = (r) => {
  const s = schemas.get(r.model)
  if (!s || !s.input) return r.provider === 'fal' ? 'schema: none (unverified)' : 'schema: n/a'
  return `schema: ${s.source}${s.ageDays != null && s.ageDays > 0.5 ? ` (${Math.floor(s.ageDays)}d old)` : ''}`
}

function baseRequest(r, refs) {
  return {
    family: r.info?.family ?? null,
    endpoint: r.model,
    model: r.model,
    prompt: r.render.prompt,
    negative: r.render.negative,
    seconds: r.seconds,
    resolution: r.resolution,
    aspect: r.render.aspect ?? '16:9',
    audio: r.render.audio === true,
    seed: r.render.seed ?? undefined,
    refs,
    raw: r.render.input,
  }
}
/** The request as the endpoint would receive it, with placeholder references (nothing cut, nothing uploaded). */
function previewRequest(r) {
  const refs = r.render.refs ?? {}
  const ph = (k, list) => (Array.isArray(list) ? list.map((_, i) => `https://example.invalid/${k}-${i + 1}`) : [])
  return r.provider === 'fal' ? falInput(baseRequest(r, { images: ph('image', refs.images), videos: ph('video', refs.videos), audio: ph('audio', refs.audio) })) : null
}
/** Conform a fal request to its schema, then validate what is left. */
function schemaPass(r, input) {
  const s = schemas.get(r.model)
  if (!s?.input)
    return { input, notes: [], errors: [], warnings: [`no schema for ${r.model} (${schemaOpts.online ? 'fal did not answer and nothing is cached' : 'offline'}) — the request goes as mapped`] }
  const { input: conformed, notes } = conformInput(input, s.input)
  const { errors, warnings } = validateInput(conformed, s.input)
  return { input: conformed, notes, errors, warnings }
}

const disclosure = disclosureProblem(tl)

// ── --check: the plan, read back, with every problem a person should fix ────
if (CHECK) {
  console.log(`\n  ${name}: ${plan.length} footage render block(s)${ONLY ? ` (only ${ONLY})` : ''}`)
  const problems = validatePlan(plan, { stageRef: stageRefCheck, verified: verifiedBySchema })
  for (const r of plan) {
    const state = r.missing.length === 0 ? 'on disk' : r.missing.length === r.files.length ? 'MISSING' : `${r.files.length - r.missing.length}/${r.files.length} on disk`
    console.log(
      `    ${r.clipId.padEnd(14)} ${state.padEnd(12)} ${r.model || '(no model)'} · ${r.resolution} · span ${r.span.toFixed(1)}s → ask ${r.seconds}s · ${r.perSec != null ? `$${r.perSec}/s` : 'unpriced'}${r.takes > 1 ? ` · ${r.takes} takes, use ${r.use}` : ''} · ${schemaLabel(r)}`,
    )
    for (const l of cutStageRefs(r)) console.log(`${' '.repeat(19)}ref ${l}`)
    if (r.provider === 'fal' && r.model) {
      const p = schemaPass(r, previewRequest(r))
      for (const n of p.notes) console.log(`${' '.repeat(19)}conform ${n}`)
      for (const w of p.warnings) console.log(`${' '.repeat(19)}⚠ ${w}`)
      for (const e of p.errors) problems.push(`${r.trackId}/${r.clipId}: request rejected by ${r.model}'s schema — ${e}`)
    }
  }
  if (disclosure) problems.push(disclosure)
  if (problems.length) {
    console.log(`\n  ${problems.length} problem(s):`)
    for (const p of problems) console.log(`    - ${p}`)
    process.exit(1)
  }
  console.log(plan.length ? '\n  every render block checks out against its schema (nothing rendered, nothing spent)\n' : '\n  no footage in this trailer\n')
  process.exit(0)
}

// ── what is owed ────────────────────────────────────────────────────────────
const owed = plan.filter((r) => r.missing.length)
if (!owed.length) {
  console.log(`\n  footage ${name}: nothing to render — every shot is on disk${plan.length ? '' : ' (no footage in this trailer)'}\n`)
  process.exit(0)
}

const total = owed.reduce((n, r) => (r.usd == null || n == null ? null : n + r.usd), 0)
const seconds = owed.reduce((n, r) => n + r.seconds * r.missing.length, 0)
const ledger = ledgerPathOf(paths().footage)
const monthSpent = monthToDate(ledger)
console.log(`\n  footage ${name} — ${MOCK ? 'MOCK (no provider, no spend)' : GO ? 'GO' : 'dry run'} · prices as of ${asOf}${OV_SEC || OV_RES ? ' · overrides applied for this run' : ''}`)
console.log(`\n  THIS WOULD SPEND: ${owed.reduce((n, r) => n + r.missing.length, 0)} footage render(s) = ${seconds}s ≈ ${fmtUsd(total)}`)
console.log(`  spent this month so far: ${fmtUsd(monthSpent)} of $${fcfg.monthlyUsd ?? 200}`)
for (const r of owed) {
  for (const f of r.missing)
    console.log(
      `    footage ${r.clipId.padEnd(12)} ${rel(f)}${readPending(f) ? '   (pending marker: a previous run submitted this — it will be fetched, not paid again)' : ''}\n            ${r.model} · ${r.resolution} · ${r.seconds}s${r.render.audio === true ? ' + audio' : ''} ≈ ${fmtUsd(r.perSec == null ? null : r.perSec * r.seconds)} · ${schemaLabel(r)}\n            ← "${String(r.render.prompt ?? '').replace(/\s+/g, ' ').slice(0, 110)}${String(r.render.prompt ?? '').length > 110 ? '…' : ''}"`,
    )
  for (const l of cutStageRefs(r)) console.log(`            ref ${l}`)
  if (r.provider === 'fal' && r.model) for (const n of schemaPass(r, previewRequest(r)).notes) console.log(`            conform ${n}`)
}
if (disclosure) console.log(`\n  ⚠ ${disclosure}`)
if (!GO) {
  console.log('\n  dry run: nothing rendered, nothing spent. Re-run with --go to spend.\n')
  process.exit(1)
}

// ── --go: refuse a plan with problems, then spend under the caps ────────────
const problems = validatePlan(owed, { stageRef: stageRefCheck, verified: verifiedBySchema })
for (const r of owed)
  if (r.provider === 'fal' && r.model) for (const e of schemaPass(r, previewRequest(r)).errors) problems.push(`${r.trackId}/${r.clipId}: request rejected by ${r.model}'s schema — ${e}`)
if (!MOCK) {
  const shots = owed.flatMap((r) => r.missing.map((f) => ({ label: `${r.clipId}${r.takes > 1 ? ` take ${/-t(\d+)\./.exec(f)?.[1] ?? ''}` : ''}`, usd: r.perSec == null ? null : r.perSec * r.seconds })))
  problems.push(...capProblems({ shots, plannedUsd: total, monthSpent, pricesAsOf: asOf, cfg: fcfg, allowExpensive: has('allow-expensive'), acceptStale: has('accept-stale-prices') }))
}
if (problems.length) {
  console.error(`\n  not spending — ${problems.length} problem(s):`)
  for (const p of problems) console.error(`    - ${p}`)
  process.exit(1)
}
const keys = {}
if (!MOCK) {
  const providers = new Set(owed.map((r) => r.provider))
  try {
    if (providers.has('fal')) keys.fal = falKey()
    if (providers.has('gemini')) keys.gemini = geminiKey()
  } catch (e) {
    console.error(`\n  ${e.message}\n`)
    process.exit(1)
  }
}
const cap = Number(fcfg.budgetUsd ?? 100)
const budget = createBudget({ cap, warnAt: cap * 0.8 })
if (!MOCK && total != null && total > cap) {
  console.error(`\n  this run would spend ≈ ${fmtUsd(total)} against a budget of $${cap} (footage.budgetUsd) — trim the plan or raise the cap deliberately.\n`)
  process.exit(1)
}
if (!FF && !has('no-normalise')) console.log('  (no ffmpeg found: masters will be used as the stage files, un-normalised)')

let release = () => {}
try {
  release = acquireLock(footageDir(name))
} catch (e) {
  console.error(`\n  ${e.message}\n`)
  process.exit(1)
}
process.on('exit', release)
process.on('SIGINT', () => {
  release()
  process.exit(130)
})

const masterOf = (file) => file.replace(/(\.[a-z0-9]+)$/i, '.master$1')
const sidecarOf = (file) => file.replace(/(\.[a-z0-9]+)$/i, '.footage.json')
const audioOf = (file) => file.replace(/(\.[a-z0-9]+)$/i, '.audio.m4a')

/** A generated test clip for --mock: the whole download → normalise → sidecar path runs on it. */
function mockBuffer(seconds) {
  const explicit = arg('mock-file')
  if (explicit) return readFileSync(resolve(explicit))
  if (!FF) throw new Error('--mock needs ffmpeg to generate a test clip (or pass --mock-file <mp4>)')
  const dir = join(ROOT, '.cache', 'mock')
  mkdirSync(dir, { recursive: true })
  const f = join(dir, `testsrc-${seconds}s.mp4`)
  if (!existsSync(f)) ffmpeg(FF, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30', '-t', String(seconds), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', f], 'mock clip')
  return readFileSync(f)
}

/**
 * References become what the provider can read. A stage reference is first cut
 * from a recorded take. Then, for fal: a small image is a data URI, anything else
 * is uploaded to fal storage and passed by URL; for Gemini: images travel inline,
 * video/audio are refused. Remote URLs pass through. Everything is hashed.
 */
const DATA_URI_MAX = 3 * 1024 * 1024
async function resolveRefs(r) {
  const refs = r.render.refs ?? {}
  const out = { images: [], videos: [], audio: [], hashes: [] }
  for (const k of ['images', 'videos', 'audio']) {
    for (const ref of Array.isArray(refs[k]) ? refs[k] : []) {
      if (isRemote(ref)) {
        out[k].push(ref)
        out.hashes.push({ kind: k, ref, sha1: null, url: ref })
        continue
      }
      let path = abs(ref)
      let note = null
      if (isStageRef(ref)) {
        const s = resolveStageRef(ref, refCtx)
        path = s.path
        note = `${s.kind} from ${s.source}${s.note ? ` · ${s.note}` : ''}`
      }
      const bytes = readFileSync(path)
      const entry = { kind: k, ref, file: rel(path), sha1: sha1(bytes), url: null, note }
      if (MOCK) out[k].push(`mock://${rel(path)}`)
      else if (r.provider === 'fal') {
        if (k === 'images' && bytes.length <= DATA_URI_MAX) out[k].push(imageDataUri(path))
        else {
          process.stdout.write(`\n      uploading ${k.slice(0, -1)} ${rel(path)} (${(bytes.length / 1048576).toFixed(1)} MB) … `)
          entry.url = await uploadToFal(path, keys.fal)
          out[k].push(entry.url)
        }
      } else if (r.provider === 'gemini') {
        if (k === 'images') out[k].push(path)
        else throw new Error(`${r.clipId}: Gemini takes image references only here — put a shot that needs ${ref} on a Seedance reference-to-video endpoint (fal)`)
      }
      out.hashes.push(entry)
    }
  }
  return out
}

/** Duration and frame size of a video file, by decoding it. */
function probeVideo(file) {
  if (!FF) return { seconds: null, width: null, height: null }
  const err = ffmpeg(FF, ['-hide_banner', '-i', file, '-f', 'null', '-'], 'probe')
  const dims = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(err)
  let last = null
  for (const m of err.matchAll(/time=(\d+):(\d+):([\d.]+)/g)) last = m
  return { seconds: last ? r2(+last[1] * 3600 + +last[2] * 60 + +last[3]) : null, width: dims ? +dims[1] : null, height: dims ? +dims[2] : null }
}
const aspectOf = (s) => {
  const m = /^(\d+):(\d+)$/.exec(String(s))
  return m ? +m[1] / +m[2] : null
}

function normalise(master, file, { audio }) {
  const W = cfg.record?.width ?? 1280
  const FPS = cfg.record?.fps ?? 30
  const args = ['-y', '-i', master, '-vf', `scale='min(iw,${W})':-2:flags=lanczos,fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart']
  args.push(...(audio ? ['-c:a', 'aac', '-b:a', '160k'] : ['-an']), file)
  ffmpeg(FF, args, `normalise ${file.split('/').pop()}`)
}

/** Resume a render a previous run submitted but never fetched. Returns a Buffer + meta, or throws. */
async function resumePending(r, pending, onLog) {
  if (pending.provider === 'fal') {
    if (!pending.statusUrl || !pending.responseUrl) throw new Error('pending marker has no urls')
    const out = await falAwait({ statusUrl: pending.statusUrl, responseUrl: pending.responseUrl, key: keys.fal, onLog })
    return { buffer: await download(out.url), meta: { requestId: pending.requestId, seed: out.seed, url: out.url, resumed: true } }
  }
  if (pending.provider === 'gemini') {
    if (pending.kind === 'veo') {
      const out = await veoAwait({ name: pending.requestId, key: keys.gemini, onLog })
      return { buffer: out.buffer, meta: { requestId: pending.requestId, seed: null, resumed: true } }
    }
    const out = await omniAwait({ id: pending.requestId, key: keys.gemini, onLog })
    return { buffer: out.buffer, meta: { requestId: pending.requestId, seed: null, resumed: true } }
  }
  throw new Error(`pending marker for an unknown provider (${pending.provider})`)
}

let failed = 0
let spentUsd = 0
// --parallel N submits N shots at once (the provider queues them; the ledger row, the
// pending marker, the sidecar and the cap check are per shot, so nothing shared changes).
// Default 1: one shot at a time, in order, as before.
const PARALLEL = Math.max(1, Math.min(8, Math.round(Number(arg('parallel', '1')) || 1)))
async function renderOne(r, file) {
  {
    const take = r.takes > 1 ? Number(/-t(\d+)\.[a-z0-9]+$/i.exec(file)?.[1] ?? 1) : 1
    const label = `${r.clipId}${r.takes > 1 ? ` take ${take}` : ''}`
    const est = MOCK ? 0 : r.perSec != null ? r2(r.perSec * r.seconds) : 0
    const pending = MOCK ? null : readPending(file)
    process.stdout.write(`  ${pending && !has('resubmit') ? 'fetching' : 'rendering'} ${label} on ${r.model} (${r.seconds}s, ≈ ${fmtUsd(est)}${pending && !has('resubmit') ? ', already paid' : ''}) … `)
    const t0 = Date.now()
    const onLog = (m) => process.stdout.write(`\n      ${PARALLEL > 1 ? `[${label}] ` : ''}${String(m).slice(0, 120)}`)
    const warnings = []
    try {
      let buffer
      let meta
      let request = null
      let schemaNotes = []
      if (pending && !has('resubmit')) {
        ;({ buffer, meta } = await resumePending(r, pending, onLog))
      } else {
        if (pending) clearPending(file)
        budget.check(label)
        const refs = await resolveRefs(r)
        const req = baseRequest(r, refs)
        const onSubmitted = (sub) => writePending(file, { provider: r.provider, kind: req.family === 'veo' || /^veo-/.test(r.model) ? 'veo' : r.family === 'omni' ? 'omni' : r.provider, endpoint: r.model, clip: r.clipId, take, est, ...sub })
        if (MOCK) {
          if (r.provider === 'fal') {
            const p = schemaPass(r, falInput(req))
            request = p.input
            schemaNotes = p.notes
            if (p.errors.length) throw new Error(`schema: ${p.errors.join('; ')}`)
          }
          buffer = mockBuffer(r.seconds)
          meta = { requestId: `mock-${Date.now()}`, seed: null, mock: true }
        } else if (r.provider === 'fal') {
          const p = schemaPass(r, falInput(req))
          request = p.input
          schemaNotes = p.notes
          if (p.errors.length) throw new Error(`schema: ${p.errors.join('; ')}`)
          const out = await falGenerate({ endpoint: r.model, input: p.input, key: keys.fal, onLog, onSubmitted })
          buffer = await download(out.url)
          meta = { requestId: out.requestId, seed: out.seed, url: out.url }
        } else if (r.provider === 'gemini') {
          const out = req.family === 'veo' || /^veo-/.test(r.model) ? await veoGenerate({ ...req, key: keys.gemini, onLog, onSubmitted }) : await omniGenerate({ ...req, key: keys.gemini, onLog, onSubmitted })
          buffer = out.buffer
          meta = { requestId: out.requestId, seed: out.seed }
        } else throw new Error(`unknown provider ${r.provider}`)
        // The reference hashes ride into the sidecar below.
        meta.refs = refs.hashes
      }

      mkdirSync(dirname(file), { recursive: true })
      const master = masterOf(file)
      writeFileSync(master, buffer)
      if (FF && !has('no-normalise')) normalise(master, file, { audio: r.render.audio === true })
      else renameSync(master, file)
      const probe = probeVideo(file)
      if (probe.seconds != null && probe.seconds + 0.25 < r.span) warnings.push(`the shot returned ${probe.seconds}s for a ${r.span.toFixed(1)}s span — it will freeze for ${r2(r.span - probe.seconds)}s`)
      if (probe.seconds != null && probe.seconds + 0.75 < r.seconds) warnings.push(`asked ${r.seconds}s, got ${probe.seconds}s`)
      const wantAspect = aspectOf(r.render.aspect ?? '16:9')
      if (wantAspect && probe.width && probe.height && Math.abs(probe.width / probe.height - wantAspect) > 0.05)
        warnings.push(`aspect ${probe.width}x${probe.height} differs from the requested ${r.render.aspect ?? '16:9'} — a cover fit will crop it`)
      if (r.render.audio === true && FF) {
        try {
          ffmpeg(FF, ['-y', '-v', 'error', '-i', master, '-vn', '-c:a', 'aac', '-b:a', '160k', audioOf(file)], 'footage audio')
          warnings.push(`footage audio is not mixed by the stage (it plays muted); the track is beside the shot as ${audioOf(file).split('/').pop()} for a future sfx part`)
        } catch {
          warnings.push('the provider returned no audio track')
        }
      }
      if (has('no-master') && existsSync(master)) rmSync(master)
      budget.add(est, label)
      spentUsd += est
      if (!MOCK && !meta.resumed) appendSpend(ledger, { trailer: name, clip: r.clipId, take, provider: r.provider, model: r.model, seconds: r.seconds, resolution: r.resolution, usdEstimated: est, requestId: meta.requestId ?? null })
      clearPending(file)
      writeFileSync(
        sidecarOf(file),
        JSON.stringify(
          {
            trailer: name,
            clip: r.clipId,
            take,
            provider: MOCK ? 'mock' : r.provider,
            mock: MOCK || undefined,
            model: r.model,
            prompt: r.render.prompt,
            negative: r.render.negative ?? null,
            refs: meta.refs ?? null,
            request: request ? elideDataUris(request) : null,
            schema: r.provider === 'fal' ? { source: schemas.get(r.model)?.source ?? null, notes: schemaNotes } : null,
            secondsAsked: r.seconds,
            secondsReturned: probe.seconds,
            size: probe.width ? `${probe.width}x${probe.height}` : null,
            resolution: r.resolution,
            aspect: r.render.aspect ?? '16:9',
            audio: r.render.audio === true,
            seed: meta.seed ?? null,
            requestId: meta.requestId ?? null,
            resumed: meta.resumed ?? false,
            overrides: r.overridden ? { seconds: OV_SEC ?? null, resolution: OV_RES ?? null } : null,
            costUsdEstimated: est,
            pricePerSec: r.perSec,
            pricesAsOf: asOf,
            warnings,
            renderedAt: new Date().toISOString(),
            elapsedSec: r2((Date.now() - t0) / 1000),
            master: existsSync(master) ? master.split('/').pop() : null,
            fileSha1: sha1(readFileSync(file)),
          },
          null,
          2,
        ) + '\n',
      )
      console.log(`\n      done · ${probe.seconds != null ? `${probe.seconds}s · ` : ''}${probe.width ? `${probe.width}x${probe.height} · ` : ''}${((Date.now() - t0) / 1000).toFixed(0)}s wall · ${file.split('/').pop()}`)
      for (const w of warnings) console.log(`      ⚠ ${w}`)
    } catch (e) {
      failed++
      console.log(`\n      FAILED: ${e.message.split('\n')[0].slice(0, 300)}`)
      if (readPending(file)) console.log('      (a pending marker remains: the next run fetches this render instead of paying again; --resubmit to pay again)')
    }
  }
}

const jobs = owed.flatMap((r) => r.missing.map((file) => () => renderOne(r, file)))
if (PARALLEL > 1 && jobs.length > 1) console.log(`  ${jobs.length} shot(s), ${Math.min(PARALLEL, jobs.length)} at a time (the lines below interleave; each carries its shot's name)`)
let nextJob = 0
await Promise.all(
  Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => {
    while (nextJob < jobs.length) await jobs[nextJob++]()
  }),
)

release()
console.log(`\n  spent ≈ ${fmtUsd(spentUsd)} of $${cap} on ${budget.calls()} call(s)${MOCK ? ' (mock: nothing spent)' : ''}${failed ? ` · ${failed} FAILED (those shots record as placeholder plates)` : ''}\n`)
process.exit(failed ? 2 : 0)
