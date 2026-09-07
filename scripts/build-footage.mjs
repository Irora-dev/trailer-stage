#!/usr/bin/env node
/**
 * THE FOOTAGE BUILDER — the picture's render parts, behind the same --go as the sound.
 *
 *   node scripts/build-footage.mjs <name>            dry run: every shot the timeline still owes, PRICED, then stop
 *   node scripts/build-footage.mjs <name> --go       render the missing shots, normalise them for the stage, write provenance
 *   node scripts/build-footage.mjs <name> --check    validate every render block offline (model, price, references, seconds)
 *   flags: --only <clipId>   --no-normalise   --no-master (delete the provider's master after normalising)
 *
 * A `footage` clip's `render` block is a spend spec (src/lib/pieces.ts). This
 * script is to picture what build-mix.mjs is to sound, and it keeps the same
 * laws:
 *  1. DRY RUN IS THE DEFAULT. It prints what would render and what it costs, in
 *     dollars, from the catalogue's per-second prices (scripts/footage/models.mjs,
 *     dated). --go is a person saying yes to that figure.
 *  2. A FILE THAT EXISTS IS NEVER RE-RENDERED. Change a prompt and nothing happens
 *     until the old file is deleted or renamed — the same deliberate act the
 *     audio side asks for.
 *  3. EVERY PAID CALL RUNS UNDER A HARD BUDGET (studio.config.json →
 *     footage.budgetUsd; past it, calls throw) and leaves a PROVENANCE SIDECAR
 *     (`<shot>.footage.json`: provider, model, prompt, references and their
 *     hashes, seconds asked and returned, seed, request id, cost, time).
 *  4. NOTHING HERE APPROVES, RECORDS OR PUBLISHES, and nothing schedules itself.
 *
 * Seconds: a shot is generated for its RESOLVED span plus a margin (the
 * narration re-times spans by fractions; the piece freezes on the last frame),
 * so run this AFTER resolve-cues — trailer.mjs does. Output: the provider's
 * master (`<shot>.master.mp4`) and the stage file (`<shot>.mp4`, capped at the
 * record width, the record fps, yuv420p, silent unless `audio: true`).
 *
 * Exit codes: 0 built (or nothing owed) · 1 dry run with shots owed, or a config
 * problem · 2 some shots failed (the rest landed; those shots record as plates).
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { arg, config, ffmpeg, ffmpegPath, footageDir, has, probeDuration, r2, readTimeline, ROOT, takesDir } from './lib.mjs'
import { createBudget } from './footage/budget.mjs'
import { PRICES_AS_OF } from './footage/models.mjs'
import { abs, fmtUsd, footageRenders, isRemote, validatePlan } from './footage/plan.mjs'
import { isStageRef, resolveStageRef, stageRefProblem } from './footage/refs.mjs'
import { download, falGenerate, falInput, falKey, imageDataUri, uploadToFal } from './footage/providers/fal.mjs'
import { geminiKey, omniGenerate, veoGenerate } from './footage/providers/gemini.mjs'

const name = process.argv[2]
if (!name || name.startsWith('--')) {
  console.error('Usage: node scripts/build-footage.mjs <name> [--go] [--check] [--only <clipId>] [--no-normalise] [--no-master]')
  process.exit(1)
}
const GO = has('go')
const CHECK = has('check')
const ONLY = arg('only')

const cfg = config()
const tl = readTimeline(name)
if (!tl) {
  console.error(`No trailers/${name}.timeline.json`)
  process.exit(1)
}

let plan = footageRenders(tl, cfg)
if (ONLY) plan = plan.filter((r) => r.clipId === ONLY)
const asOf = cfg.footage?.pricesAsOf || PRICES_AS_OF

// Stage-derived references (@still: / @take:) are cut from recorded takes with
// ffmpeg — free, so the check and the dry run resolve them too and say what
// would be sent. Without ffmpeg they are reported, never guessed.
const FF_REFS = await ffmpegPath({ required: false })
const refCtx = { tl, takesDir: takesDir(name), refsDir: join(footageDir(name), 'refs'), FF: FF_REFS, width: cfg.record?.width ?? 1280 }
const stageRefCheck = (ref) => stageRefProblem(ref, refCtx)
const rel = (p) => String(p).replace(`${ROOT}/`, '')

/** Cut every stage reference a render names; returns notes for the printout. */
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

// ── --check: the plan, read back, with every problem a person should fix ────
if (CHECK) {
  console.log(`\n  ${name}: ${plan.length} footage render block(s)`)
  for (const r of plan) {
    const state = r.missing.length === 0 ? 'on disk' : r.missing.length === r.files.length ? 'MISSING' : `${r.files.length - r.missing.length}/${r.files.length} on disk`
    console.log(
      `    ${r.clipId.padEnd(14)} ${state.padEnd(12)} ${r.model || '(no model)'} · ${r.resolution} · span ${r.span.toFixed(1)}s → ask ${r.seconds}s · ${r.perSec != null ? `$${r.perSec}/s` : 'unpriced'}${r.takes > 1 ? ` · ${r.takes} takes, use ${r.use}` : ''}`,
    )
    for (const l of cutStageRefs(r)) console.log(`${' '.repeat(19)}ref ${l}`)
  }
  const problems = validatePlan(plan, { stageRef: stageRefCheck })
  if (problems.length) {
    console.log(`\n  ${problems.length} problem(s):`)
    for (const p of problems) console.log(`    - ${p}`)
    process.exit(1)
  }
  console.log(plan.length ? '\n  every render block checks out (nothing rendered, nothing spent)\n' : '\n  no footage in this trailer\n')
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
console.log(`\n  footage ${name} — ${GO ? 'GO' : 'dry run'} · prices as of ${asOf}`)
console.log(`\n  THIS WOULD SPEND: ${owed.reduce((n, r) => n + r.missing.length, 0)} footage render(s) = ${seconds}s ≈ ${fmtUsd(total)}`)
for (const r of owed) {
  for (const f of r.missing)
    console.log(
      `    footage ${r.clipId.padEnd(12)} ${rel(f)}\n            ${r.model} · ${r.resolution} · ${r.seconds}s${r.render.audio === true ? ' + audio' : ''} ≈ ${fmtUsd(r.perSec == null ? null : r.perSec * r.seconds)}\n            ← "${String(r.render.prompt ?? '').replace(/\s+/g, ' ').slice(0, 110)}${String(r.render.prompt ?? '').length > 110 ? '…' : ''}"`,
    )
  for (const l of cutStageRefs(r)) console.log(`            ref ${l}`)
}
if (!GO) {
  console.log('\n  dry run: nothing rendered, nothing spent. Re-run with --go to spend.\n')
  process.exit(1)
}

// ── --go: refuse a plan with problems, then spend under the cap ─────────────
const problems = validatePlan(owed, { stageRef: stageRefCheck })
if (problems.length) {
  console.error(`\n  not spending — ${problems.length} problem(s) in the plan:`)
  for (const p of problems) console.error(`    - ${p}`)
  process.exit(1)
}
const providers = new Set(owed.map((r) => r.provider))
const keys = {}
try {
  if (providers.has('fal')) keys.fal = falKey()
  if (providers.has('gemini')) keys.gemini = geminiKey()
} catch (e) {
  console.error(`\n  ${e.message}\n`)
  process.exit(1)
}
const cap = Number(cfg.footage?.budgetUsd ?? 100)
const budget = createBudget({ cap, warnAt: cap * 0.8 })
if (total != null && total > cap) {
  console.error(`\n  this run would spend ≈ ${fmtUsd(total)} against a budget of $${cap} (footage.budgetUsd) — trim the plan or raise the cap deliberately.\n`)
  process.exit(1)
}
const FF = has('no-normalise') ? null : await ffmpegPath({ required: false })
if (!FF && !has('no-normalise')) console.log('  (no ffmpeg found: masters will be used as the stage files, un-normalised)')

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')
const masterOf = (file) => file.replace(/(\.[a-z0-9]+)$/i, '.master$1')
const sidecarOf = (file) => file.replace(/(\.[a-z0-9]+)$/i, '.footage.json')

/**
 * References become what the provider can read. A stage reference (@still: /
 * @take:) is first cut from a recorded take. Then, for fal: a small image is a
 * data URI, anything else is uploaded to fal storage and passed by URL; for
 * Gemini: images travel inline, and video/audio are refused (the adapter does
 * not edit uploads, and the EEA is not offered that anyway). Remote URLs pass
 * through. Every reference is hashed for the sidecar.
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
      if (r.provider === 'fal') {
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

function normalise(master, file, { audio }) {
  const W = cfg.record?.width ?? 1280
  const FPS = cfg.record?.fps ?? 30
  // Cap the width at the record width and keep the source aspect (a 9:16 shot
  // stays 9:16); constant fps and yuv420p so headless playback never stutters.
  const args = ['-y', '-i', master, '-vf', `scale='min(iw,${W})':-2:flags=lanczos,fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart']
  args.push(...(audio ? ['-c:a', 'aac', '-b:a', '160k'] : ['-an']), file)
  ffmpeg(FF, args, `normalise ${file.split('/').pop()}`)
}

let failed = 0
let spentUsd = 0
for (const r of owed) {
  for (const file of r.missing) {
    const take = r.takes > 1 ? Number(/-t(\d+)\.[a-z0-9]+$/i.exec(file)?.[1] ?? 1) : 1
    const label = `${r.clipId}${r.takes > 1 ? ` take ${take}` : ''}`
    const est = r.perSec != null ? r2(r.perSec * r.seconds) : 0
    process.stdout.write(`  rendering ${label} on ${r.model} (${r.seconds}s, ≈ ${fmtUsd(est)}) … `)
    const t0 = Date.now()
    try {
      budget.check(label)
      const refs = await resolveRefs(r)
      const req = {
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
      const onLog = (m) => process.stdout.write(`\n      ${String(m).slice(0, 120)}`)
      let buffer
      let meta
      if (r.provider === 'fal') {
        const out = await falGenerate({ endpoint: r.model, input: falInput(req), key: keys.fal, onLog })
        buffer = await download(out.url)
        meta = { requestId: out.requestId, seed: out.seed, url: out.url }
      } else if (r.provider === 'gemini') {
        const out = req.family === 'veo' || /^veo-/.test(r.model) ? await veoGenerate({ ...req, key: keys.gemini, onLog }) : await omniGenerate({ ...req, key: keys.gemini, onLog })
        buffer = out.buffer
        meta = { requestId: out.requestId, seed: out.seed }
      } else throw new Error(`unknown provider ${r.provider}`)

      mkdirSync(dirname(file), { recursive: true })
      const master = masterOf(file)
      writeFileSync(master, buffer)
      if (FF) normalise(master, file, { audio: req.audio })
      else renameSync(master, file)
      const returnedSec = FF ? r2(probeDuration(FF, file)) : null
      if (has('no-master') && existsSync(master)) rmSync(master)
      budget.add(est, label)
      spentUsd += est
      writeFileSync(
        sidecarOf(file),
        JSON.stringify(
          {
            trailer: name,
            clip: r.clipId,
            take,
            provider: r.provider,
            model: r.model,
            prompt: r.render.prompt,
            negative: r.render.negative ?? null,
            refs: refs.hashes,
            secondsAsked: r.seconds,
            secondsReturned: returnedSec,
            resolution: r.resolution,
            aspect: req.aspect,
            audio: req.audio,
            seed: meta.seed ?? null,
            requestId: meta.requestId ?? null,
            costUsdEstimated: est,
            pricePerSec: r.perSec,
            pricesAsOf: asOf,
            renderedAt: new Date().toISOString(),
            elapsedSec: r2((Date.now() - t0) / 1000),
            master: existsSync(master) ? master.split('/').pop() : null,
            fileSha1: sha1(readFileSync(file)),
          },
          null,
          2,
        ) + '\n',
      )
      console.log(`\n      done · ${returnedSec != null ? `${returnedSec}s · ` : ''}${((Date.now() - t0) / 1000).toFixed(0)}s wall · ${file.split('/').pop()}`)
    } catch (e) {
      failed++
      console.log(`\n      FAILED: ${e.message.split('\n')[0].slice(0, 300)}`)
    }
  }
}

console.log(`\n  spent ≈ ${fmtUsd(spentUsd)} of $${cap} on ${budget.calls()} call(s)${failed ? ` · ${failed} FAILED (those shots record as placeholder plates)` : ''}\n`)
process.exit(failed ? 2 : 0)
