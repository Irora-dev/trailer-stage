#!/usr/bin/env node
/**
 * THE STYLE BOARD — try a look for cents before a shot costs dollars.
 *
 *   node scripts/style-board.mjs <name>                       dry run: every style the board still owes, priced
 *   node scripts/style-board.mjs <name> --go                  render the missing stills (in parallel), tile the sheet, write BOARD.md
 *   node scripts/style-board.mjs <name> --pick <styleId> --into <trailer>   copy a winning still into .footage/<trailer>/refs/style/
 *   flags: --only <styleId> · --parallel N (default 6) · --resubmit · --no-schema · --refresh-schemas · --no-sheet
 *
 * A board is boards/<name>.board.json:
 *   { "name", "kind": "styles" (default: one subject, N styles) | "scenes" (one style in `subject`, N scenes in the entries),
 *     "provider": "fal" | "meshy", "model": "<endpoint id, see footage/board.mjs>",
 *     "subject": "the shot, described once", "negative": "…", "size": "landscape_16_9", "seed": 7,
 *     "refs": { "images": [paths] },                         // identity + world, handed to every cell
 *                                                            // (a style may carry its own "refs" instead:
 *                                                            //  e.g. a keyframe board where each cell's
 *                                                            //  reference is that style's own winning still)
 *     "meshyUsdPerCredit": 0.02,                             // optional: dollars for Meshy credits
 *     "styles": [ { "id": "painterly", "label": "Soft painterly 3D", "style": "…" }, … ] }
 *
 * Each style becomes ONE still: `subject STYLE: style Avoid: negative`, the same references, the
 * same seed, so the cells differ by style alone. The stills tile into a labelled contact sheet
 * (`.footage/<name>/<name>.board.jpg`) and BOARD.md maps each cell to its file and prompt. A
 * person points at a cell; `--pick` copies it into a trailer's refs/style/, where the video
 * model reads it as the look (Seedance follows a reference image's style closely).
 *
 * THE LAWS are the footage builder's: dry run by default; a still that exists is never
 * re-rendered; fal requests are conformed to and validated against the endpoint's schema; every
 * paid call writes a pending marker, a ledger row (.footage/SPEND.jsonl) and a sidecar; one board
 * at a time (a lock). Meshy bills prepaid credits: the dry run prints credits and checks the
 * balance before spending.
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { arg, config, ffmpeg, ffmpegPath, footageDir, has, paths, r2, ROOT } from './lib.mjs'
import { boardPrompt, IMAGE_PRICES_AS_OF, imageModelInfo, layoutFor, priceBoard, safeLabel } from './footage/board.mjs'
import { conformInput, inputSchemaOf, loadSchema, validateInput } from './footage/schema.mjs'
import { acquireLock, appendSpend, clearPending, ledgerPathOf, monthToDate, readPending, writePending } from './footage/spend.mjs'
import { download, elideDataUris, falAwait, falGenerate, falKey, imageDataUri, uploadToFal } from './footage/providers/fal.mjs'
import { meshyAwait, meshyBalance, meshyGenerate, meshyInput, meshyKey } from './footage/providers/meshy.mjs'

const target = process.argv[2]
if (!target || target.startsWith('--')) {
  console.error('Usage: node scripts/style-board.mjs <name|board.json> [--go] [--only <styleId>] [--parallel N] [--pick <styleId> --into <trailer>] [--resubmit] [--no-schema] [--no-sheet]')
  process.exit(1)
}
const GO = has('go')
const ONLY = arg('only')
const PICK = arg('pick')
const cfg = config()
const specPath = target.endsWith('.json') ? resolve(target) : join(ROOT, 'boards', `${target}.board.json`)
if (!existsSync(specPath)) {
  console.error(`\n  no board at ${specPath}\n`)
  process.exit(1)
}
const board = JSON.parse(readFileSync(specPath, 'utf8'))
const name = board.name || basename(specPath).replace(/\.board\.json$/, '')
const styles = (board.styles ?? []).filter((s) => s && s.id && (!ONLY || s.id === ONLY))
if (!styles.length) {
  console.error(`\n  the board has no styles${ONLY ? ` matching ${ONLY}` : ''}\n`)
  process.exit(1)
}
// Default provider: Meshy (nano-banana-2) when a Meshy key exists, else fal's Seedream. On the
// first two boards (2026-09-07) the Meshy cells were judged far stronger as pictures; Seedream's
// held the character's identity more tightly. A board may name either.
const provider = board.provider ?? (String(board.model ?? '').startsWith('meshy/') ? 'meshy' : String(board.model ?? '').startsWith('fal-ai/') ? 'fal' : meshyKey({ required: false }) ? 'meshy' : 'fal')
const model = board.model ?? (provider === 'meshy' ? 'meshy/nano-banana-2' : 'fal-ai/bytedance/seedream/v4/edit')
const info = imageModelInfo(model, cfg.footage?.imagePrices)
const usdPerCredit = typeof board.meshyUsdPerCredit === 'number' ? board.meshyUsdPerCredit : null
const perImageUsd = info?.usd ?? (info?.credits != null && usdPerCredit != null ? r2(info.credits * usdPerCredit) : null)
const size = board.size ?? 'landscape_16_9'
const aspect = /16_9|16:9/.test(size) ? '16:9' : /9_16|9:16/.test(size) ? '9:16' : /4_3/.test(size) ? '4:3' : /3_4/.test(size) ? '3:4' : '1:1'
const dir = footageDir(name)
const stylesDir = join(dir, 'styles')
const rel = (p) => String(p).replace(`${ROOT}/`, '')
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')
const FF = await ffmpegPath({ required: false })

/** The still a style owns, if one exists (png or jpg). */
const fileOf = (s) => {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const f = join(stylesDir, `${s.id}.${ext}`)
    if (existsSync(f)) return f
  }
  return null
}
const targetOf = (s) => join(stylesDir, `${s.id}.png`)
const sidecarOf = (s) => join(stylesDir, `${s.id}.style.json`)

// ── --pick: a winning still becomes a trailer's style reference ─────────────
if (PICK) {
  const into = arg('into')
  const s = (board.styles ?? []).find((x) => x.id === PICK)
  const f = s && fileOf(s)
  if (!into || !s || !f) {
    console.error(`\n  --pick needs a rendered style id and --into <trailer> (${!s ? `no style "${PICK}"` : !f ? `"${PICK}" is not rendered yet` : 'no --into'})\n`)
    process.exit(1)
  }
  const destDir = join(footageDir(into), 'refs', 'style')
  mkdirSync(destDir, { recursive: true })
  const dest = join(destDir, `board-${name}-${PICK}${f.slice(f.lastIndexOf('.'))}`)
  copyFileSync(f, dest)
  console.log(`\n  picked ${PICK} (${s.label ?? ''}) → ${rel(dest)}\n  put it first in that trailer's refs.images and name it in the prompts as @Image1\n`)
  process.exit(0)
}

// ── the plan ────────────────────────────────────────────────────────────────
const owed = styles.filter((s) => !fileOf(s))
const price = priceBoard(styles, { usd: perImageUsd, credits: info?.credits ?? null }, { missing: (s) => !fileOf(s) })
console.log(`\n  style board ${name} — ${GO ? 'GO' : 'dry run'} · ${provider} · ${model} · ${size} · prices as of ${IMAGE_PRICES_AS_OF}`)
console.log(`  subject: "${String(board.subject ?? '').replace(/\s+/g, ' ').slice(0, 120)}${String(board.subject ?? '').length > 120 ? '…' : ''}"`)
console.log(`  references: ${(board.refs?.images ?? []).map(rel).join(', ') || 'none'}`)
if (!info) console.log(`  ⚠ ${model} is not in the image catalogue (footage/board.mjs): unpriced, the request goes as mapped`)
console.log(`\n  ${styles.length} style(s), ${owed.length} owed → ${price.usd != null ? `≈ $${price.usd.toFixed(2)}` : ''}${price.credits != null ? `${price.usd != null ? ' · ' : ''}${price.credits} Meshy credits` : ''}${price.usd == null && price.credits == null ? 'unpriced' : ''}`)
for (const s of styles) console.log(`    ${(fileOf(s) ? 'on disk ' : 'MISSING ').padEnd(9)}${s.id.padEnd(16)} ${s.label ?? ''}`)
if (!owed.length && !has('no-sheet')) {
  console.log('\n  nothing to render — every still is on disk; rebuilding the sheet')
} else if (!GO) {
  console.log('\n  dry run: nothing rendered, nothing spent. Re-run with --go to spend.\n')
  process.exit(1)
}

// ── keys, balance, schema ───────────────────────────────────────────────────
const keys = {}
let schema = null
if (owed.length) {
  try {
    if (provider === 'fal') keys.fal = falKey()
    if (provider === 'meshy') keys.meshy = meshyKey()
  } catch (e) {
    console.error(`\n  ${e.message}\n`)
    process.exit(1)
  }
  if (provider === 'meshy' && info?.credits != null) {
    const bal = await meshyBalance(keys.meshy)
    console.log(`  Meshy balance: ${bal} credits${Number.isFinite(bal) && bal < price.credits ? '  ✗ not enough for this board' : ''}`)
    if (Number.isFinite(bal) && bal < price.credits) process.exit(1)
  }
  if (provider === 'fal') {
    const loaded = await loadSchema(model, { cacheDir: join(ROOT, '.cache', 'schemas'), fixturesDir: join(ROOT, 'scripts', 'footage', 'fixtures', 'schemas'), maxAgeDays: Number(cfg.footage?.schemaMaxAgeDays ?? 7), online: !has('no-schema'), refresh: has('refresh-schemas') })
    schema = loaded.doc ? inputSchemaOf(loaded.doc) : null
    console.log(`  schema: ${loaded.source ?? 'none (the request goes as mapped)'}`)
  }
}

let release = () => {}
try {
  release = acquireLock(dir)
} catch (e) {
  console.error(`\n  ${e.message}\n`)
  process.exit(1)
}
process.on('exit', release)

// ── references: the board's, or a style's own (a per-cell look, e.g. that cell's own still) ──
const DATA_URI_MAX = 3 * 1024 * 1024
const refCache = new Map()
let refHashes = []
async function refs(list) {
  const key = JSON.stringify(list)
  if (refCache.has(key)) return refCache.get(key)
  const urls = []
  for (const ref of list) {
    if (/^https?:\/\//.test(ref)) {
      urls.push(ref)
      refHashes.push({ ref, sha1: null })
      continue
    }
    const p = resolve(ROOT, ref)
    if (!existsSync(p)) throw new Error(`reference not found: ${ref}`)
    const bytes = readFileSync(p)
    refHashes.push({ ref, sha1: sha1(bytes) })
    if (provider === 'meshy' || bytes.length <= DATA_URI_MAX) urls.push(imageDataUri(p))
    else {
      process.stdout.write(`\n      uploading ${rel(p)} (${(bytes.length / 1048576).toFixed(1)} MB) … `)
      urls.push(await uploadToFal(p, keys.fal))
    }
  }
  refCache.set(key, urls)
  return urls
}
const refsOf = (s) => (Array.isArray(s.refs?.images) ? s.refs.images : board.refs?.images ?? [])

/** The fal request for one cell, per family, then conformed to the schema. */
function falRequest(prompt, images) {
  const fam = info?.family ?? (model.includes('seedream') ? 'seedream' : model.includes('nano-banana') ? 'nano-banana' : model.includes('recraft') ? 'recraft' : 'other')
  let input
  if (fam === 'seedream') {
    input = { prompt, image_size: size, num_images: 1, enhance_prompt_mode: 'standard' }
    if (images.length && model.endsWith('/edit')) input.image_urls = images
  } else if (fam === 'nano-banana') {
    input = { prompt, aspect_ratio: aspect, num_images: 1, output_format: 'png' }
    if (images.length && model.endsWith('/edit')) input.image_urls = images
  } else if (fam === 'recraft') {
    input = { prompt, image_size: size, style: 'digital_illustration' }
  } else {
    input = { prompt, image_size: size }
    if (images.length) input.image_urls = images
  }
  if (typeof board.seed === 'number') input.seed = board.seed
  if (!schema) return { input, notes: [], errors: [] }
  const { input: conformed, notes } = conformInput(input, schema)
  const { errors } = validateInput(conformed, schema)
  return { input: conformed, notes, errors }
}

const extOf = (buf) => (buf[0] === 0x89 && buf[1] === 0x50 ? 'png' : buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' : buf.slice(8, 12).toString() === 'WEBP' ? 'webp' : 'png')

// ── render the owed cells, N at a time ──────────────────────────────────────
const PARALLEL = Math.max(1, Math.min(8, Math.round(Number(arg('parallel', '6')) || 6)))
const ledger = ledgerPathOf(paths().footage)
let failed = 0
let spentUsd = 0
let spentCredits = 0
async function renderOne(s) {
  const file = targetOf(s)
  // A "styles" board (default) varies the style around one subject; a "scenes" board keeps one
  // style (board.subject) and varies the scene (each entry's `style` field is the scene).
  const prompt = board.kind === 'scenes' ? boardPrompt(s.style, board.subject, board.negative) : boardPrompt(board.subject, s.style, board.negative)
  const pending = readPending(file)
  const est = perImageUsd ?? 0
  process.stdout.write(`  ${pending && !has('resubmit') ? 'fetching' : 'rendering'} ${s.id} (${s.label ?? ''}${perImageUsd != null ? `, ≈ $${perImageUsd.toFixed(2)}` : info?.credits != null ? `, ${info.credits} credits` : ''}) … `)
  const t0 = Date.now()
  const onLog = (m) => process.stdout.write(`\n      [${s.id}] ${String(m).slice(0, 100)}`)
  try {
    let buffer
    let meta
    let request = null
    let notes = []
    if (pending && !has('resubmit')) {
      const out = provider === 'fal' ? await falAwait({ statusUrl: pending.statusUrl, responseUrl: pending.responseUrl, key: keys.fal, onLog }) : await meshyAwait({ statusUrl: pending.statusUrl, key: keys.meshy, onLog })
      buffer = await download(out.url)
      meta = { requestId: pending.requestId, resumed: true, credits: out.credits ?? null, seed: out.seed ?? null }
    } else {
      if (pending) clearPending(file)
      const images = await refs(refsOf(s))
      const onSubmitted = (sub) => writePending(file, { provider, kind: provider, endpoint: model, clip: s.id, take: 1, est, ...sub })
      if (provider === 'fal') {
        const r = falRequest(prompt, images)
        request = r.input
        notes = r.notes
        if (r.errors.length) throw new Error(`schema: ${r.errors.join('; ')}`)
        const out = await falGenerate({ endpoint: model, input: r.input, key: keys.fal, onLog, onSubmitted })
        buffer = await download(out.url)
        meta = { requestId: out.requestId, seed: out.seed ?? null, url: out.url }
      } else {
        const { kind, input } = meshyInput({ model, prompt, aspect, refs: { images } })
        request = input
        const out = await meshyGenerate({ kind, input, key: keys.meshy, onLog, onSubmitted })
        buffer = await download(out.url)
        meta = { requestId: out.requestId, credits: out.credits ?? null, url: out.url }
      }
    }
    mkdirSync(stylesDir, { recursive: true })
    const ext = extOf(buffer)
    const out = ext === 'png' ? file : file.replace(/\.png$/, `.${ext}`)
    writeFileSync(out, buffer)
    clearPending(file)
    const credits = meta.credits ?? info?.credits ?? null
    if (!meta.resumed) appendSpend(ledger, { trailer: name, clip: s.id, take: 1, provider, model, seconds: 0, resolution: size, usdEstimated: est, credits: credits ?? undefined, requestId: meta.requestId ?? null })
    spentUsd += est
    if (provider === 'meshy' && credits) spentCredits += credits
    writeFileSync(
      sidecarOf(s),
      JSON.stringify(
        {
          board: name,
          style: s.id,
          label: s.label ?? null,
          provider,
          model,
          prompt,
          stylePhrase: s.style,
          refs: refHashes.filter((h) => refsOf(s).includes(h.ref)),
          request: request ? elideDataUris(request) : null,
          schemaNotes: notes,
          seed: meta.seed ?? board.seed ?? null,
          requestId: meta.requestId ?? null,
          resumed: meta.resumed ?? false,
          costUsdEstimated: est,
          credits,
          pricesAsOf: IMAGE_PRICES_AS_OF,
          renderedAt: new Date().toISOString(),
          elapsedSec: r2((Date.now() - t0) / 1000),
          file: basename(out),
          fileSha1: sha1(buffer),
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`\n      done · ${basename(out)} · ${(buffer.length / 1024).toFixed(0)} KB · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  } catch (e) {
    failed++
    console.log(`\n      FAILED ${s.id}: ${e.message.split('\n')[0].slice(0, 300)}`)
  }
}
if (owed.length) {
  console.log(`\n  ${owed.length} still(s), ${Math.min(PARALLEL, owed.length)} at a time`)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(PARALLEL, owed.length) }, async () => {
    while (next < owed.length) await renderOne(owed[next++])
  }))
}

// ── the sheet and the index ─────────────────────────────────────────────────
const rendered = styles.filter((s) => fileOf(s))
if (rendered.length && FF && !has('no-sheet')) {
  const { cols, rows } = layoutFor(rendered.length)
  const font = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find((f) => existsSync(f))
  const W = 640
  const H = 360
  const inputs = rendered.flatMap((s) => ['-i', fileOf(s)])
  const cells = rendered.map((s, i) => {
    const label = safeLabel(`${i + 1}. ${s.id}  ${s.label ?? ''}`)
    const text = font ? `,drawtext=fontfile=${font}:text='${label}':fontcolor=0xf3efe4:fontsize=20:x=12:y=h-32:box=1:boxcolor=0x000000@0.55:boxborderw=8` : ''
    return `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0f0d14,setsar=1,format=yuv420p${text}[c${i}]`
  })
  const fc = `${cells.join(';')};${rendered.map((_, i) => `[c${i}]`).join('')}concat=n=${rendered.length}:v=1:a=0,tile=${cols}x${rows}:padding=10:margin=14:color=0x0f0d14[v]`
  const sheet = join(dir, `${name}.board.jpg`)
  ffmpeg(FF, ['-y', '-v', 'error', ...inputs, '-filter_complex', fc, '-map', '[v]', '-frames:v', '1', '-q:v', '3', sheet], 'contact sheet')
  console.log(`\n  sheet: ${rel(sheet)} (${cols}×${rows})`)
}
if (rendered.length) {
  const lines = [
    `# Style board — ${name}`,
    '',
    `> ${provider} · ${model} · ${size} · seed ${board.seed ?? 'none'} · prices as of ${IMAGE_PRICES_AS_OF} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    `> subject: ${String(board.subject ?? '').replace(/\s+/g, ' ')}`,
    `> references: ${(board.refs?.images ?? []).join(' · ') || 'none'}`,
    `> pick one: \`npm run styles -- ${name} --pick <id> --into <trailer>\``,
    '',
    '| # | id | label | style phrase | file |',
    '|---|---|---|---|---|',
    ...rendered.map((s, i) => `| ${i + 1} | \`${s.id}\` | ${s.label ?? ''} | ${String(s.style ?? '').replace(/\|/g, '/')} | \`${rel(fileOf(s))}\` |`),
    '',
  ]
  writeFileSync(join(dir, 'BOARD.md'), lines.join('\n'))
}
release()
const monthUsd = monthToDate(ledger)
console.log(`\n  spent ≈ $${spentUsd.toFixed(2)}${spentCredits ? ` · ${spentCredits} Meshy credits` : ''} on ${owed.length - failed} still(s)${failed ? ` · ${failed} FAILED` : ''} · footage ledger month to date ≈ $${monthUsd.toFixed(2)}\n`)
process.exit(failed ? 2 : 0)
