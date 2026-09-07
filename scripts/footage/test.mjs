#!/usr/bin/env node
/**
 * THE FOOTAGE LANE'S OFFLINE TESTS — no key, no network, no spend.
 *
 *   node scripts/footage/test.mjs        (also: npm run footage:test; part of npm run verify)
 *
 * What is covered: the planner's seconds and prices; the file-naming mirror
 * between the stage and the builder; stage references parsed and (with ffmpeg)
 * cut from a synthetic take; every provider family's request shape, conformed
 * to and validated against the committed endpoint schemas; the schema validator
 * itself; the spend ledger, the caps, pending markers and the lock; the
 * disclosure law and the take manifest; and the builder end to end in --mock
 * mode through download → normalise → sidecar; plus the compiler's check and the
 * pipeline's disclosure gate on scratch trailers. Scratch files live under
 * .cache/footage-test, .footage/__test-… and trailers/__test-… and are removed.
 *
 * Exit 1 on any failure, with each failure named.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ffmpegPath, paths, ROOT } from '../lib.mjs'
import { MODELS, modelInfo, pickSeconds, priceOf } from './models.mjs'
import { disclosureProblem, footageManifest, footageRenders, footageSrcOf, takeFile, validatePlan } from './plan.mjs'
import { cueTimes, parseStageRef, parseTimeExpr, resolveStageRef, stageRefProblem } from './refs.mjs'
import { falInput } from './providers/fal.mjs'
import { omniRequest, veoRequest } from './providers/gemini.mjs'
import { conformInput, inputSchemaOf, loadSchema, validateInput } from './schema.mjs'
import { acquireLock, appendSpend, capProblems, clearPending, ledgerPathOf, monthToDate, readPending, writePending } from './spend.mjs'

let pass = 0
let fail = 0
const ok = (cond, msg) => {
  if (cond) pass++
  else {
    fail++
    console.log(`  ✗ ${msg}`)
  }
}
const section = (t) => console.log(`\n· ${t}`)
const TMP = join(ROOT, '.cache', 'footage-test')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const FF = await ffmpegPath({ required: false })
const FIX = join(ROOT, 'scripts', 'footage', 'fixtures', 'schemas')
const run = (args, env = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...(FF ? { FFMPEG_PATH: FF } : {}), ...env } })
const cleanup = []

try {
  // ── models ────────────────────────────────────────────────────────────────
  section('models: seconds and prices')
  const seedance = modelInfo('bytedance/seedance-2.0/text-to-video')
  const kling = modelInfo('fal-ai/kling-video/v3/pro/text-to-video')
  const veo = modelInfo('veo-3.1-fast-generate-preview')
  ok(pickSeconds(seedance, 'auto', 5.8) === 8, 'auto seconds = ceil(span + 1.5)')
  ok(pickSeconds(seedance, 'auto', 20) === 15, 'seconds clamp to the model maximum')
  ok(pickSeconds(seedance, 2, 0) === 4, 'seconds clamp to the model minimum')
  ok(pickSeconds(veo, 'auto', 5) === 8, 'seconds snap UP to the grid (veo 4/6/8)')
  ok(pickSeconds(null, 'auto', 2.2) === 4, 'unknown model: ceil(span + margin), min 1')
  ok(priceOf(kling, '1080p', true) === 0.168 && priceOf(kling, '1080p', false) === 0.112, 'audio price table')
  ok(priceOf(seedance, 'nonsense') === 0.3034, 'unknown resolution falls back to the default resolution price')
  ok(modelInfo('nobody/knows') === null, 'unknown model → null')
  ok(modelInfo('minimax/h3/text-to-video', { 'minimax/h3/text-to-video': { '768p': 0.5 } }).prices['768p'] === 0.5, 'config price override')
  ok(Object.values(MODELS).every((m) => m.seconds[0] <= m.seconds[1] && m.resolutions.includes(m.defaultResolution)), 'catalogue rows are self-consistent')

  // ── plan ──────────────────────────────────────────────────────────────────
  section('plan: naming, renders, validation')
  ok(footageSrcOf('t', { id: 'a', params: {} }) === '.footage/t/a.mp4', 'default src convention')
  ok(takeFile('x/a.mp4', 2) === 'x/a-t2.mp4', 'take suffix')
  const existing = 'scripts/footage/fixtures/schemas/minimax_h3_text-to-video.json' // any file that exists
  const tlA = {
    name: '__unit',
    end: 20,
    tracks: [
      {
        id: 'shots',
        kind: 'visual',
        clips: [
          { id: 'have', at: 1, until: 5, params: { piece: 'footage', src: existing, render: { provider: 'fal', model: 'bytedance/seedance-2.0/text-to-video', prompt: 'p' } } },
          { id: 'owe', at: 5, until: 10.8, params: { piece: 'footage', render: { provider: 'fal', model: 'bytedance/seedance-2.0/text-to-video', prompt: 'p', takes: 2 } } },
          { id: 'remote', at: 10, until: 12, params: { piece: 'footage', src: 'https://example.invalid/x.mp4', render: { model: 'x/y', prompt: 'p' } } },
          { id: 'nomodel', at: 12, until: 14, params: { piece: 'footage', render: { prompt: 'p' } } },
          { id: 'unpriced', at: 14, until: 16, params: { piece: 'footage', render: { provider: 'fal', model: 'x/y', prompt: 'p' } } },
          { id: 'badrefs', at: 16, until: 18, params: { piece: 'footage', render: { provider: 'fal', model: 'bytedance/seedance-2.0/reference-to-video', prompt: 'p', refs: { images: ['@take:newest:a..b'], videos: ['@still:a'] } } } },
        ],
      },
      { id: 'close', kind: 'visual', clips: [{ id: 'end', at: 18, params: { piece: 'endCard', chips: ['Contains AI-generated footage'] } }] },
    ],
  }
  const plan = footageRenders(tlA, {})
  const by = Object.fromEntries(plan.map((r) => [r.clipId, r]))
  ok(plan.length === 5 && !by.remote, 'a remote src is never a render; the rest are planned')
  ok(by.have.missing.length === 0 && by.owe.missing.length === 2, 'on-disk vs owed, with takes')
  ok(by.owe.seconds === 8 && Math.abs(by.owe.usd - 0.3034 * 8 * 2) < 1e-9, 'owed dollars = price × seconds × missing takes')
  const probs = validatePlan(plan, { stageRef: () => null, verified: () => true })
  ok(probs.some((p) => p.includes('nomodel') && p.includes('render.model is missing')), 'missing model is a problem')
  ok(probs.some((p) => p.includes('unpriced') && p.includes('no price')), 'unpriced model is a problem')
  ok(probs.some((p) => p.includes('badrefs') && p.includes('is a slice')) && probs.some((p) => p.includes('badrefs') && p.includes('is a frame')), 'stage references under the wrong key are problems')
  ok(!probs.some((p) => p.includes('/owe:')), 'a sound render block has no problems')

  // ── the mirror ────────────────────────────────────────────────────────────
  section('the stage ↔ builder file-naming mirror')
  const piecesTs = readFileSync(join(ROOT, 'src', 'lib', 'pieces.ts'), 'utf8')
  const planMjs = readFileSync(join(ROOT, 'scripts', 'footage', 'plan.mjs'), 'utf8')
  ok(piecesTs.includes('`.footage/${trailerName}/${clip.id}.mp4`') && planMjs.includes('`.footage/${trailerName}/${clip.id}.mp4`'), 'both sides share the default path convention')
  ok(piecesTs.includes('`-t${use}$1`') && planMjs.includes('`-t${n}$1`'), 'both sides share the take suffix')

  // ── stage references ──────────────────────────────────────────────────────
  section('stage references: parsing and cutting')
  const cues = cueTimes(tlA)
  ok(cues.have === 1 && cues['have.end'] === 5 && cues.end === 20, 'cue times from a timeline')
  ok(parseTimeExpr('have+2', cues) === 3 && parseTimeExpr('owe.end-0.5', cues) === 10.3 && parseTimeExpr('12.5', cues) === 12.5 && parseTimeExpr('nope', cues) === null, 'time expressions')
  ok(parseStageRef('@still:have+2')?.kind === 'still' && parseStageRef('@take:newest:have..have+2')?.which === 'newest' && parseStageRef('@take:x') === null, 'reference forms')
  const takesDir = join(TMP, 'takes', '__unit')
  ok(stageRefProblem('@still:have+2', { tl: tlA, takesDir, FF })?.includes('no recorded take'), 'no take → a problem, not a guess')
  ok(stageRefProblem('@still:nothing', { tl: tlA, takesDir, FF })?.includes('names no cue'), 'unknown cue → a problem')
  if (FF) {
    mkdirSync(takesDir, { recursive: true })
    const take = join(takesDir, 'take-001.mp4')
    spawnSync(FF, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30', '-t', '3', '-pix_fmt', 'yuv420p', take])
    const ctx = { tl: tlA, takesDir, refsDir: join(TMP, 'refs'), FF, width: 1280 }
    ok(stageRefProblem('@still:have+1', ctx) === null, 'a take on disk clears the problem')
    const still = resolveStageRef('@still:have+1', ctx)
    ok(still.kind === 'image' && existsSync(still.path) && still.at === 2 && /newest/.test(still.note ?? ''), 'a still is cut at the cue time from the newest take, and says so')
    const slice = resolveStageRef('@take:newest:0.5..2', ctx)
    ok(slice.kind === 'video' && existsSync(slice.path) && slice.seconds === 1.5, 'a slice is cut between two times')
    const long = resolveStageRef('@take:take-001:0..20', { ...ctx, maxTakeSec: 15 })
    ok(long.seconds === 15 && /clamped/.test(long.note ?? ''), 'a long slice is clamped and noted')
    const again = resolveStageRef('@still:have+1', ctx)
    ok(again.path === still.path, 'cutting is idempotent')
  } else console.log('  (ffmpeg not found: cutting tests skipped)')

  // ── request shapes against the committed schemas ──────────────────────────
  section('provider requests conform to and validate against the endpoint schemas')
  const schemaFor = async (id) => inputSchemaOf((await loadSchema(id, { cacheDir: join(TMP, 'schemas'), fixturesDir: FIX, online: false })).doc)
  const base = { prompt: 'a shot', negative: 'text', seconds: 8, resolution: '720p', aspect: '16:9', audio: false, seed: 7, refs: { images: ['https://x/1.png', 'https://x/2.png'], videos: ['https://x/v.mp4'], audio: [] } }
  const cases = [
    ['bytedance/seedance-2.0/text-to-video', 'seedance', (i) => i.duration === '8' && i.resolution === '720p' && i.image_url === undefined],
    ['bytedance/seedance-2.0/image-to-video', 'seedance', (i) => i.image_url === 'https://x/1.png' && i.end_image_url === 'https://x/2.png'],
    ['bytedance/seedance-2.0/reference-to-video', 'seedance', (i) => i.image_urls?.length === 2 && i.video_urls?.length === 1 && i.audio_urls === undefined],
    ['bytedance/seedance-2.5/text-to-video', 'seedance', (i) => i.duration === '8'],
    ['fal-ai/kling-video/v3/pro/text-to-video', 'kling', (i) => i.resolution === undefined && i.aspect_ratio === '16:9' && i.duration === '8' && i.negative_prompt === 'text'],
    ['fal-ai/kling-video/v3/pro/image-to-video', 'kling', (i) => i.start_image_url === 'https://x/1.png' && i.end_image_url === 'https://x/2.png' && i.aspect_ratio === undefined],
    ['fal-ai/kling-video/v3/standard/text-to-video', 'kling', (i) => i.duration === '8'],
    ['minimax/h3-max/text-to-video', 'minimax', (i) => i.resolution === '768P' && i.duration === 8 && i.prompt_expansion_mode === 'balanced' && i.seed === 7],
    ['minimax/h3-max/image-to-video', 'minimax', (i) => i.image_url === 'https://x/1.png' && i.aspect_ratio === undefined],
    ['minimax/h3/text-to-video', 'minimax', (i) => i.resolution === '768P'],
  ]
  for (const [id, family, shape] of cases) {
    const schema = await schemaFor(id)
    ok(!!schema, `${id}: fixture schema loads`)
    if (!schema) continue
    const raw = falInput({ ...base, family, endpoint: id, resolution: id.startsWith('minimax') ? '768p' : '720p' })
    const { input, notes } = conformInput(raw, schema)
    const { errors } = validateInput(input, schema)
    ok(errors.length === 0, `${id}: conformed request validates (${errors.join('; ')})`)
    ok(shape(input), `${id}: request shape as the schema describes (${JSON.stringify(input).slice(0, 160)})`)
    if (family === 'seedance') ok(input.seed === undefined && !notes.some((n) => n.includes('seed')), `${id}: no seed is sent (the schema has no such field) and nothing needed dropping`)
  }
  {
    const s = await schemaFor('bytedance/seedance-2.0/reference-to-video')
    const bad = { prompt: 'p', resolution: 'foo', duration: 8, image_urls: Array.from({ length: 10 }, (_, i) => `https://x/${i}`), bogus: 1 }
    const v = validateInput(bad, s)
    ok(v.errors.some((e) => e.includes('"resolution"')) && v.errors.some((e) => e.includes('"duration"')) && v.errors.some((e) => e.includes('at most 9')), 'the validator catches a bad enum, a wrong type and maxItems')
    ok(v.warnings.some((w) => w.includes('bogus')), 'the validator warns on an unknown field')
    const c = conformInput(bad, s)
    ok(c.input.duration === '8' && c.input.bogus === undefined && c.notes.length >= 2, 'conform coerces the duration to a string and drops the unknown field')
    ok(validateInput({}, s).errors.some((e) => e.includes('"prompt"')), 'a missing required field is an error')
    const m = await schemaFor('minimax/h3-max/text-to-video')
    const cm = conformInput({ prompt: 'p', resolution: '768p', duration: '9' }, m)
    ok(cm.input.resolution === '768P' && cm.input.duration === 9 && cm.input.prompt_expansion_mode === 'balanced', 'conform fixes enum case, coerces a numeric string, fills a required default')
  }
  {
    const o = omniRequest({ prompt: 'p', negative: 'n', refs: { images: [] }, resolution: '360p', aspect: '16:9', audio: false, seconds: 5 })
    ok(o.model === 'gemini-omni-1.1-flash' && o.input.at(-1).type === 'text' && o.response_format.resolution === '360p' && o.generation_config.video_config.task === 'text_to_video', 'Omni request shape')
    const v = veoRequest({ prompt: 'p', refs: {}, resolution: '720p', aspect: '16:9', audio: false, seconds: 6 })
    ok(v.instances[0].prompt === 'p' && v.parameters.durationSeconds === 6 && v.parameters.generateAudio === false, 'Veo request shape')
    let threw = false
    try {
      omniRequest({ prompt: 'p', refs: { videos: ['x.mp4'] } })
    } catch {
      threw = true
    }
    ok(threw, 'Omni refuses video references (EEA)')
  }

  // ── spend safety ──────────────────────────────────────────────────────────
  section('spend: ledger, caps, pending markers, lock')
  const ledger = ledgerPathOf(join(TMP, 'footage'))
  const now = new Date()
  const thisMonth = now.toISOString()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString()
  appendSpend(ledger, { at: thisMonth, usdEstimated: 1.5 })
  appendSpend(ledger, { at: thisMonth, usdEstimated: 2.25 })
  appendSpend(ledger, { at: thisMonth, usdEstimated: 99, mock: true })
  appendSpend(ledger, { at: lastMonth, usdEstimated: 50 })
  ok(Math.abs(monthToDate(ledger, now) - 3.75) < 1e-9, 'month-to-date sums this month, excludes mock and last month')
  const capCfg = { perShotUsd: 10, monthlyUsd: 20, priceMaxAgeDays: 30 }
  const fresh = new Date().toISOString().slice(0, 10)
  ok(capProblems({ shots: [{ label: 'a', usd: 12 }], plannedUsd: 12, monthSpent: 0, pricesAsOf: fresh, cfg: capCfg }).some((p) => p.includes('perShotUsd')), 'per-shot cap')
  ok(capProblems({ shots: [{ label: 'a', usd: 12 }], plannedUsd: 12, monthSpent: 0, pricesAsOf: fresh, cfg: capCfg, allowExpensive: true }).length === 0, '--allow-expensive lifts the per-shot cap')
  ok(capProblems({ shots: [], plannedUsd: 15, monthSpent: 10, pricesAsOf: fresh, cfg: capCfg }).some((p) => p.includes('monthlyUsd')), 'monthly cap')
  const stale = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10)
  ok(capProblems({ shots: [], plannedUsd: 1, monthSpent: 0, pricesAsOf: stale, cfg: capCfg }).some((p) => p.includes('days old')), 'stale prices refuse')
  ok(capProblems({ shots: [], plannedUsd: 1, monthSpent: 0, pricesAsOf: stale, cfg: capCfg, acceptStale: true }).length === 0, '--accept-stale-prices lifts it')
  const pf = join(TMP, 'footage', 'x', 'shot.mp4')
  writePending(pf, { provider: 'fal', requestId: 'r1', statusUrl: 'https://s', responseUrl: 'https://r' })
  ok(readPending(pf)?.requestId === 'r1' && readPending(pf).file === pf, 'pending marker round-trips')
  clearPending(pf)
  ok(readPending(pf) === null, 'pending marker clears')
  const lockDir = join(TMP, 'lock')
  const release = acquireLock(lockDir)
  let lockThrew = false
  try {
    acquireLock(lockDir, { pid: process.pid + 100000 })
  } catch {
    lockThrew = true
  }
  ok(lockThrew, 'a second builder is refused while the first is alive')
  release()
  const release2 = acquireLock(lockDir)
  ok(typeof release2 === 'function', 'the lock is free after release')
  release2()
  writeFileSync(join(lockDir, '.lock'), JSON.stringify({ pid: 999999999, at: 'x' }))
  const release3 = acquireLock(lockDir)
  ok(typeof release3 === 'function', 'a dead process\'s lock is taken over')
  release3()

  // ── the disclosure law and the manifest ───────────────────────────────────
  section('disclosure and the take manifest')
  ok(disclosureProblem(tlA) === null, 'a chip that says AI-generated satisfies the law')
  const noChip = { ...tlA, tracks: tlA.tracks.filter((t) => t.id !== 'close') }
  ok(typeof disclosureProblem(noChip) === 'string', 'footage without the chip is a problem')
  ok(disclosureProblem({ name: 'x', end: 1, tracks: [] }) === null, 'no footage, no obligation')
  const man = footageManifest(tlA, join(TMP, 'footage', '__unit'), { hashOf: () => 'deadbeef' })
  ok(man.shots.length === 6 && man.shots.find((s) => s.clip === 'have').present === true && man.shots.find((s) => s.clip === 'have').sha1 === 'deadbeef' && man.shots.find((s) => s.clip === 'owe').present === false && man.shots.find((s) => s.clip === 'remote').present === null, 'the manifest lists every shot, on disk or not, hashed when present')

  // ── the builder, end to end, in mock mode ─────────────────────────────────
  section('the builder end to end (--mock)')
  if (FF) {
    const tname = '__test-footage'
    const tlB = {
      name: tname,
      end: 8,
      mix: null,
      tracks: [
        { id: 'shots', kind: 'visual', clips: [{ id: 'shot', at: 1, until: 5, params: { piece: 'footage', render: { provider: 'fal', model: 'bytedance/seedance-2.0/text-to-video', prompt: 'a test shot', seconds: 4, resolution: '720p', audio: false, seed: 3 } } }] },
        { id: 'close', kind: 'visual', clips: [{ id: 'end', at: 5, params: { piece: 'endCard', chips: ['Contains AI-generated footage'] } }] },
        { id: 'captions', kind: 'visual', clips: [{ id: 'cap', at: 1, until: 5, params: { piece: 'caption', text: 'x' } }] },
      ],
    }
    const tlPath = join(TMP, `${tname}.timeline.json`)
    writeFileSync(tlPath, JSON.stringify(tlB, null, 1))
    const outDir = join(paths().footage, tname)
    cleanup.push(() => rmSync(outDir, { recursive: true, force: true }))
    const before = monthToDate(ledgerPathOf(paths().footage))
    const dry = run(['scripts/build-footage.mjs', tlPath, '--no-schema'])
    ok(dry.status === 1 && dry.stdout.includes('THIS WOULD SPEND') && dry.stdout.includes('$1.21'), `dry run prices the owed shot and stops (status ${dry.status})`)
    const chk = run(['scripts/build-footage.mjs', tlPath, '--check', '--no-schema'])
    ok(chk.status === 0 && /schema: (cache|fixture)/.test(chk.stdout) && /checks out against its schema/.test(chk.stdout), `--check validates against a stored schema offline (status ${chk.status}: ${chk.stdout.trim().split('\n').pop()})`)
    const go = run(['scripts/build-footage.mjs', tlPath, '--mock', '--go'])
    const file = join(outDir, 'shot.mp4')
    ok(go.status === 0 && existsSync(file) && existsSync(join(outDir, 'shot.master.mp4')), `--mock --go renders through download → normalise (status ${go.status}: ${go.stdout.split('\n').slice(-4).join(' | ')})`)
    const sc = existsSync(join(outDir, 'shot.footage.json')) ? JSON.parse(readFileSync(join(outDir, 'shot.footage.json'), 'utf8')) : null
    ok(
      sc && sc.provider === 'mock' && sc.mock === true && sc.request && sc.request.duration === '4' && sc.request.seed === undefined && Math.abs((sc.secondsReturned ?? 0) - 4) < 0.1 && sc.size === '1280x720' && !!sc.fileSha1,
      `the sidecar carries provenance: mock, the conformed request, the probe, the hash (${JSON.stringify(sc && { provider: sc.provider, mock: sc.mock, duration: sc.request?.duration, seed: sc.request?.seed, secondsReturned: sc.secondsReturned, size: sc.size, sha: !!sc.fileSha1 })})`,
    )
    ok(!existsSync(join(outDir, '.lock')) && !existsSync(join(outDir, 'shot.pending.json')), 'lock released and no pending marker after success')
    ok(Math.abs(monthToDate(ledgerPathOf(paths().footage)) - before) < 1e-9, 'a mock render writes nothing to the real ledger')
    const again = run(['scripts/build-footage.mjs', tlPath, '--mock', '--go'])
    ok(again.status === 0 && again.stdout.includes('nothing to render'), 'a file that exists is never re-rendered')
    const noKey = run(['scripts/build-footage.mjs', tlPath, '--go', '--no-schema', '--only', 'nothing'])
    ok(noKey.status === 0 && noKey.stdout.includes('nothing to render'), '--only with no match owes nothing')
    // Scratch trailers in trailers/ for the compiler's check and the pipeline's gate.
    const okName = '__test-disclosure-ok'
    const missName = '__test-disclosure-missing'
    const trailersDir = paths().trailers
    writeFileSync(join(trailersDir, `${okName}.timeline.json`), JSON.stringify({ ...tlB, name: okName }, null, 1))
    writeFileSync(join(trailersDir, `${missName}.timeline.json`), JSON.stringify({ ...tlB, name: missName, tracks: tlB.tracks.filter((t) => t.id !== 'close').concat([{ id: 'close', kind: 'visual', clips: [{ id: 'end', at: 5, params: { piece: 'endCard', chips: ['silent draft'] } }] }]) }, null, 1))
    cleanup.push(() => rmSync(join(trailersDir, `${okName}.timeline.json`), { force: true }), () => rmSync(join(trailersDir, `${missName}.timeline.json`), { force: true }))
    const d1 = run(['scripts/draft.mjs', '--check', okName])
    ok(d1.status === 0, `the compiler's check passes a footage cut with the chip (status ${d1.status}: ${d1.stdout.trim().split('\n').pop()})`)
    const d2 = run(['scripts/draft.mjs', '--check', missName])
    ok(d2.status === 1 && /discloses/.test(d2.stdout), 'the compiler\'s check fails a footage cut without the chip')
    const gate = run(['scripts/trailer.mjs', missName, '--go', '--skip-footage'])
    ok(gate.status === 1 && /Not recording/.test(gate.stderr + gate.stdout), 'the pipeline refuses to record a footage cut without the chip')
    const gateOff = run(['scripts/trailer.mjs', missName, '--go', '--skip-footage', '--no-disclosure-check', '--no-record'])
    ok(gateOff.status === 0, '--no-disclosure-check lets a draft through (status ' + gateOff.status + ')')
  } else console.log('  (ffmpeg not found: builder and gate tests skipped)')
} finally {
  for (const c of cleanup)
    try {
      c()
    } catch {
      /* best effort */
    }
  rmSync(TMP, { recursive: true, force: true })
}

console.log(`\n  ${pass} passed · ${fail} failed\n`)
process.exit(fail ? 1 : 0)
