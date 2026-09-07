#!/usr/bin/env node
/**
 * THE RECORDER — one continuous take of the stage, muxed with its mix.
 *
 *   node scripts/record.mjs <name> [--base http://localhost:3000] [--out file.mp4]
 *                           [--size 1280x720] [--captions] [--no-stills] [--lufs -23]
 *
 * How it stays in sync: the page is captured frame by frame through the
 * browser's own screencast, and the stage clock is armed ONLY AFTER the first
 * captured frame arrives. Footage time therefore equals mix time by
 * construction, rather than by measuring the drift afterwards and correcting.
 *
 * It never starts a dev server. Two dev servers sharing one build cache is a
 * documented way to lose an afternoon; if nothing answers, it says so and stops.
 *
 * After the mux it VERIFIES the file it just wrote — streams, duration, loudness
 * — because a plausible-looking mp4 that no player will open is a thing that
 * ships silently. Then it extracts one labelled still per cue: read those
 * frames. The log cannot see a clipped actor or a caption sitting on a logo.
 */

import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arg, config, ensureDir, ffmpeg, ffmpegPath, has, ROOT, takesDir } from './lib.mjs'

const name = process.argv[2]
if (!name || name.startsWith('--')) {
  console.error('Usage: node scripts/record.mjs <name> [--base <url>] [--size WxH] [--captions] [--no-stills]')
  process.exit(1)
}

const cfg = config()
const BASE = (arg('base', process.env.STAGE_BASE) ?? 'http://localhost:3000').replace(/\/+$/, '')
const [W, H] = (arg('size', `${cfg.record?.width ?? 1280}x${cfg.record?.height ?? 720}`).split('x').map(Number)).map((n) =>
  // Even dimensions only: the encoder's chroma subsampling requires it, and an
  // odd number fails deep inside ffmpeg with an unhelpful message.
  Math.max(2, Math.round(n / 2) * 2),
)
const FPS = cfg.record?.fps ?? 30
const TARGET_LUFS = Number(arg('lufs', cfg.record?.lufs ?? -23))
const CAPTIONS = has('captions')

const FF = await ffmpegPath()

// ── the browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const explicit = arg('browser', process.env.PUPPETEER_EXECUTABLE_PATH)
  if (explicit && existsSync(explicit)) return explicit
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ]
  const found = candidates.find((p) => existsSync(p))
  if (found) return found
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['google-chrome'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim().split('\n')[0]
  console.error(`
  No Chrome-family browser found. Point at one:
    --browser /path/to/chrome     or  PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
`)
  process.exit(1)
}

let puppeteer
try {
  puppeteer = (await import('puppeteer-core')).default
} catch {
  console.error('\n  puppeteer-core is missing. Run: npm install\n')
  process.exit(1)
}

// ── is anything serving the stage? ──────────────────────────────────────────
const stageUrl = `${BASE}/stage/${name}${CAPTIONS ? '?captions=1' : ''}`
try {
  const probe = await fetch(`${BASE}/stage/${name}`, { signal: AbortSignal.timeout(20000) })
  if (!probe.ok) {
    console.error(`\n  ${BASE}/stage/${name} answered ${probe.status}. Is that trailer registered in trailers/?\n`)
    process.exit(1)
  }
} catch {
  console.error(`
  Nothing answers at ${BASE}. Start the dev server first:

      npm run dev

  then re-run this, passing --base if it is not on ${BASE}. (This script will
  not start a server itself: two dev servers on one build cache corrupt it.)
`)
  process.exit(1)
}

console.log(`\nRecording ${name}\n`)
const browser = await puppeteer.launch({
  executablePath: browserPath(),
  headless: true,
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${W},${H}`,
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
await page.goto(stageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

// The trailer's own file is the single source of truth for its length and its
// audio; the page hands both over.
await page.waitForFunction('window.__stage && window.__stage.meta', { timeout: 45000 })
const META = await page.evaluate(() => window.__stage.meta)
const MIX = META.mix
const END = META.end

const dir = ensureDir(takesDir(name))
let OUT = arg('out')
if (OUT) OUT = resolve(OUT)
else {
  const n = readdirSync(dir).filter((f) => /^take-\d+.*\.mp4$/.test(f)).length + 1
  const suffix = `${W === 1280 && H === 720 ? '' : `-${W}x${H}`}${CAPTIONS ? '-cc' : ''}`
  OUT = join(dir, `take-${String(n).padStart(3, '0')}${suffix}.mp4`)
}

console.log(`  mix     ${MIX ? MIX.split('/').pop() : 'NONE — silent draft'}`)
console.log(`  target  ${TARGET_LUFS} LUFS · ${W}x${H} @${FPS}fps`)
console.log(`  take    ${END.toFixed(1)}s, one continuous capture`)

await page.waitForFunction('window.__stage && window.__stage.readyFlag === true', { timeout: 60000 })
console.log('  stage ready, recording…')

// ── capture ─────────────────────────────────────────────────────────────────
const cachePath = ensureDir(join(ROOT, '.cache'))
const silentTake = join(cachePath, `${name}-take.mp4`)
const enc = spawn(FF, [
  '-y',
  '-f', 'image2pipe',
  '-framerate', String(FPS),
  '-i', 'pipe:0',
  '-an',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  silentTake,
])
let encErr = ''
enc.stderr.on('data', (d) => (encErr += d.toString()))

const client = await page.createCDPSession()
let frames = 0 // delivered by the browser
let written = 0 // placed on the wall clock
let held = 0 // repeats written across gaps (a static hold, a slow paint)
let merged = 0 // frames that arrived inside an already-filled slot (they become the next hold frame, nothing is lost)
let armed = false
let startedAt = 0
let last = null
const emit = (buf) => {
  enc.stdin.write(buf)
  written++
}
client.on('Page.screencastFrame', async ({ data, sessionId }) => {
  frames++
  const buf = Buffer.from(data, 'base64')
  if (!armed) {
    // Arm the stage clock only once a frame has actually been captured: this is
    // what makes footage time equal mix time. The wall clock starts here too.
    armed = true
    startedAt = Date.now()
    emit(buf)
    last = buf
    await page.evaluate(() => window.__stage.start())
  } else {
    // THE TAKE'S CLOCK IS THE WALL CLOCK, NOT THE FRAME COUNT. The screencast only
    // sends a frame when the page repaints, so a static hold (a frozen shot, a
    // card at rest) would otherwise vanish from the take and every later beat
    // would land early — against the mix, and against the cue stills. So each
    // frame is placed at its wall-clock slot: the previous frame is repeated
    // across a gap, and a frame that lands in a slot already filled is kept as
    // the next hold frame rather than written (delivery is jittery: clumps of
    // frames, then none — the clock, not the clump, decides what is a frame).
    const slot = Math.round(((Date.now() - startedAt) / 1000) * FPS)
    while (written < slot) {
      emit(last)
      held++
    }
    if (written <= slot) emit(buf)
    else merged++
    last = buf
  }
  try {
    await client.send('Page.screencastFrameAck', { sessionId })
  } catch {
    /* the cast has already stopped */
  }
})
await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 })

await new Promise((res) => setTimeout(res, (END + 1.2) * 1000))
await client.send('Page.stopScreencast').catch(() => {})
// Hold the last frame to the end of the cut, so a take never comes up short
// because nothing repainted after the final beat (the mux trims at END).
if (last) {
  const need = Math.round((END + 0.4) * FPS)
  while (written < need) {
    emit(last)
    held++
  }
}
enc.stdin.end()
await new Promise((res) => enc.on('close', res))
await browser.close()

if (frames === 0) {
  // Zero frames reads downstream as a mux error ("pipe:0: End of file"), which
  // sends you looking in the wrong place. Name it here.
  console.error('\n  The browser produced NO frames — nothing was captured. Re-run; if it repeats, the page never painted.\n')
  console.error(encErr.split('\n').slice(-8).join('\n'))
  process.exit(1)
}
const capturedSec = written / FPS
console.log(
  `  take        ${frames} frames captured → ${written} placed on the clock (${capturedSec.toFixed(2)}s; want ${END.toFixed(2)}s) · ${held} held · ${merged} merged`,
)
// Holds are normal (a static beat repaints nothing). A take that is MOSTLY holds
// means the browser could not keep up: the picture will step, not move.
if (held > written * 0.5) console.log('  ⚠ more than half the take is held frames — the machine could not paint at this rate; record on a quiet machine or lower record.fps')

// ── the mux ─────────────────────────────────────────────────────────────────
const CAM_SS = 4
function cameraFilter() {
  const moves = META.camera ?? []
  if (!moves.length) return null
  // zoompan rounds its crop origin to whole INPUT pixels, so at native size the
  // window rattles. Supersample first, pan there, scale back.
  const inW = W * CAM_SS
  const inH = H * CAM_SS
  const smooth = (a, b, tExpr) => `(${a}+(${b}-${a})*(3*pow(min(max((${tExpr}),0),1),2)-2*pow(min(max((${tExpr}),0),1),3)))`
  let zoom = '1'
  let cx = '0.5'
  let cy = '0.5'
  for (const m of moves) {
    const tExpr = `(on/${FPS}-${m.at})/${Math.max(0.0001, m.until - m.at)}`
    const inRange = `between(on/${FPS},${m.at},${m.until})`
    const after = `gte(on/${FPS},${m.until})`
    zoom = `if(${inRange},${smooth(m.from, m.to, tExpr)},if(${after},${m.to},${zoom}))`
    cx = `if(gte(on/${FPS},${m.at}),${m.cx ?? 0.5},${cx})`
    cy = `if(gte(on/${FPS},${m.at}),${m.cy ?? 0.5},${cy})`
  }
  return [
    `scale=${inW}:${inH}:flags=lanczos`,
    `zoompan=z='${zoom}':x='iw*(${cx})-(iw/zoom/2)':y='ih*(${cy})-(ih/zoom/2)':d=1:s=${inW}x${inH}:fps=${FPS}`,
    `scale=${W}:${H}:flags=lanczos`,
  ].join(',')
}

const vChain = [cameraFilter(), `fade=t=in:st=0:d=0.8`, `trim=0:${END}`, 'setpts=PTS-STARTPTS'].filter(Boolean).join(',')

const muxArgs = ['-y', '-i', silentTake]
if (MIX) {
  if (!existsSync(MIX)) {
    console.error(`\n  The mix named by this trailer is not on disk:\n    ${MIX}\n  Build it first (npm run trailer -- ${name}).\n`)
    process.exit(1)
  }
  muxArgs.push('-i', MIX)
}
muxArgs.push('-filter_complex', `[0:v]${vChain}[v]`)
if (MIX) {
  muxArgs.push(
    '-filter_complex',
    `[1:a]loudnorm=I=${TARGET_LUFS}:TP=-6:LRA=7,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=out:st=${Math.max(0, END - 1.9)}:d=1.9,atrim=0:${END}[a]`,
  )
}
muxArgs.push('-map', '[v]')
if (MIX) muxArgs.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k')
// No -shortest: loudnorm buffers, and cutting to the shorter stream drops the
// tail of the audio — you lose the last beat and nothing warns you.
muxArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT)
// A silent draft is muxed with NO audio stream at all. An anullsrc track would
// make a loudness check "pass" on silence, which is worse than failing.
ffmpeg(FF, muxArgs, 'mux')

// ── verify the artifact, not the log ────────────────────────────────────────
const size = statSync(OUT).size
const probe = ffmpeg(FF, ['-hide_banner', '-i', OUT, '-f', 'null', '-'], 'verify')
const finalDur = (() => {
  let last = null
  for (const m of probe.matchAll(/time=(\d+):(\d+):([\d.]+)/g)) last = m
  return last ? +last[1] * 3600 + +last[2] * 60 + +last[3] : 0
})()
const hasVideo = /Stream #0:0.*Video: h264/.test(probe)
const hasAudio = MIX ? /Stream #0:1.*Audio: aac/.test(probe) : true

console.log(`\n  ${OUT}`)
console.log(`    ${(size / 1048576).toFixed(1)}MB · ${finalDur.toFixed(2)}s · ${W}x${H} @${FPS}fps`)
console.log(`    video: ${hasVideo ? 'ok' : 'MISSING'}   audio: ${MIX ? (hasAudio ? 'ok' : 'MISSING') : 'none by design'}`)
if (MIX) {
  const ln = ffmpeg(FF, ['-hide_banner', '-i', OUT, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'], 'loudness')
  const I = /Output Integrated:\s*([-\d.]+)/.exec(ln)?.[1]
  const TP = /Output True Peak:\s*([-\d.]+)/.exec(ln)?.[1]
  if (I) console.log(`    loudness: ${I} LUFS / ${TP} dBTP`)
}
if (!hasVideo || !hasAudio || finalDur < END - 3) {
  console.error('\n  This file did not come out right. Do not ship it; re-record.\n')
  process.exit(1)
}

// ── one labelled still per cue ──────────────────────────────────────────────
if (!has('no-stills') && META.cues) {
  const framesDir = OUT.replace(/\.mp4$/, '') + '.frames'
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })
  // A beat after each cue, so an entrance has landed rather than being caught
  // mid-fade at two per cent opacity.
  const SETTLE = 0.6
  const shots = Object.entries(META.cues)
    .filter(([n]) => !n.startsWith('__'))
    .sort((a, b) => a[1] - b[1])
  for (const [cue, at] of shots) {
    const t = Math.min(finalDur - 0.1, at + SETTLE)
    ffmpeg(
      FF,
      ['-y', '-ss', t.toFixed(2), '-i', OUT, '-frames:v', '1', `${framesDir}/${t.toFixed(1).padStart(5, '0')}s-${cue}.png`],
      `still:${cue}`,
    )
  }
  console.log(`    stills: ${shots.length} cue frames → ${framesDir}/`)

  // If a take of this trailer has been approved, rank this one against it now.
  try {
    const approved = readFileSync(join(dir, 'APPROVED'), 'utf8').trim()
    const golden = join(dir, `${approved}.frames`)
    if (approved && existsSync(golden) && resolve(golden) !== resolve(framesDir)) {
      console.log(`\n  vs approved ${approved}:`)
      const cmp = spawnSync(process.execPath, [join(ROOT, 'scripts', 'compare.mjs'), golden, framesDir], {
        encoding: 'utf8',
        env: { ...process.env, FFMPEG_PATH: FF },
      })
      for (const l of (cmp.stdout || '').split('\n').filter((l) => /^\s+(\d|--)/.test(l))) console.log(`  ${l}`)
    }
  } catch {
    /* nothing approved yet — nothing to compare against */
  }
}

console.log('\n  done.\n')
