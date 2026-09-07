/**
 * fal.ai — the queue API, by hand (no SDK dependency to install).
 *
 *   submit   POST https://queue.fal.run/<endpoint>            → { request_id, status_url, response_url }
 *   status   GET  <status_url>?logs=1                          → { status: IN_QUEUE | IN_PROGRESS | COMPLETED, … }
 *   result   GET  <response_url>                               → the model's output ({ video: { url }, seed, … })
 *   auth     Authorization: Key <FAL_KEY>
 *
 * Result URLs live on fal's media host and EXPIRE, so the builder downloads the
 * file the moment the request completes. Image references travel as data URIs
 * (fal accepts them on image_url fields); video and audio references need an
 * upload (fal's storage), which is phase 1 — the builder says so rather than
 * guessing an endpoint.
 *
 * ⚠️ WRITTEN WITHOUT A KEY (2026-09-07): the request shapes are read off fal's
 * docs and model pages, not exercised. The first --go is the proof; keep it to
 * one short shot.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname } from 'node:path'

const QUEUE = 'https://queue.fal.run'

export function falKey({ required = true } = {}) {
  const env = process.env.FAL_KEY
  if (env) return env.trim()
  const file = `${homedir()}/.config/fal/api-key`
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  if (!required) return null
  throw new Error('No fal key. export FAL_KEY=… or put it in ~/.config/fal/api-key (chmod 600). Nothing except rendering needs it.')
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }

/** A local image as a data URI, the way fal image_url fields accept inline files. */
export function imageDataUri(path) {
  const mime = MIME[extname(path).toLowerCase()]
  if (!mime) throw new Error(`not an image reference: ${path}`)
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`
}

async function json(url, init, label) {
  const res = await fetch(url, init)
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  if (!res.ok) throw new Error(`${label}: ${res.status} ${text.slice(0, 400)}`)
  return body
}

/**
 * Submit, wait, and return the finished output. `onLog` receives the model's
 * progress lines as they arrive. Times out after `timeoutSec` (default 20 min).
 */
export async function falGenerate({ endpoint, input, key, onLog, timeoutSec = 1200 }) {
  const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }
  const sub = await json(`${QUEUE}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(input) }, 'fal submit')
  const requestId = sub.request_id
  const statusUrl = sub.status_url ?? `${QUEUE}/${endpoint}/requests/${requestId}/status`
  const resultUrl = sub.response_url ?? `${QUEUE}/${endpoint}/requests/${requestId}`
  if (!requestId) throw new Error(`fal submit returned no request_id: ${JSON.stringify(sub).slice(0, 300)}`)

  const t0 = Date.now()
  let seen = 0
  for (;;) {
    if (Date.now() - t0 > timeoutSec * 1000) throw new Error(`fal ${endpoint}: timed out after ${timeoutSec}s (request ${requestId})`)
    const st = await json(`${statusUrl}${statusUrl.includes('?') ? '&' : '?'}logs=1`, { headers }, 'fal status')
    for (const l of (st.logs ?? []).slice(seen)) onLog?.(l.message ?? String(l))
    seen = (st.logs ?? []).length
    if (st.status === 'COMPLETED') break
    if (st.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(st.status))
      throw new Error(`fal ${endpoint}: request ${requestId} ended ${st.status}: ${JSON.stringify(st).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 4000))
  }
  const out = await json(resultUrl, { headers }, 'fal result')
  const url = out.video?.url ?? out.videos?.[0]?.url ?? out.output?.url ?? out.url
  if (!url) throw new Error(`fal ${endpoint}: completed but no video url in ${JSON.stringify(out).slice(0, 400)}`)
  return { url, seed: out.seed ?? null, requestId, raw: out }
}

/**
 * Upload a local file to fal's storage so a model can read it by URL (video and
 * audio references, and images too large for a data URI). Two steps, as the JS
 * client does it: initiate (signed upload URL + the final file URL), then PUT
 * the bytes. Files over 90 MB would need the multipart flow; a reference that
 * big is a mistake, so this refuses instead.
 */
const REST = 'https://rest.alpha.fal.ai'
const MIME_ALL = { ...MIME, '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' }
export async function uploadToFal(path, key) {
  const bytes = readFileSync(path)
  if (bytes.length > 90 * 1024 * 1024) throw new Error(`${path}: ${(bytes.length / 1048576).toFixed(0)} MB is too large for a reference upload (90 MB cap)`)
  const type = MIME_ALL[extname(path).toLowerCase()] ?? 'application/octet-stream'
  const init = await json(
    `${REST}/storage/upload/initiate?storage_type=fal-cdn-v3`,
    { method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: path.split('/').pop(), content_type: type }) },
    'fal storage initiate',
  )
  if (!init.upload_url || !init.file_url) throw new Error(`fal storage initiate returned no urls: ${JSON.stringify(init).slice(0, 300)}`)
  const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: bytes })
  if (!put.ok) throw new Error(`fal storage upload: ${put.status} ${(await put.text().catch(() => '')).slice(0, 200)}`)
  return init.file_url
}

/** Fetch a result URL into memory. Fal's media URLs expire; do this at once. */
export async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Map the builder's shared request onto a fal endpoint's input. Families were
 * read off their fal pages where marked verified in the catalogue; `raw` (the
 * render block's `input`) is merged LAST so any field can be corrected without
 * touching this file.
 */
export function falInput({ family, endpoint, prompt, negative, seconds, resolution, aspect, audio, seed, refs, raw }) {
  const images = refs?.images ?? []
  let input
  if (family === 'seedance') {
    input = { prompt, resolution, duration: String(seconds), aspect_ratio: aspect ?? '16:9', generate_audio: audio === true }
    if (endpoint.endsWith('/reference-to-video')) {
      if (images.length) input.image_urls = images
      if (refs?.videos?.length) input.video_urls = refs.videos
      if (refs?.audio?.length) input.audio_urls = refs.audio
    } else if (endpoint.endsWith('/image-to-video')) {
      if (images[0]) input.image_url = images[0]
      if (images[1]) input.end_image_url = images[1]
    }
  } else if (family === 'kling') {
    input = { prompt, duration: String(seconds), aspect_ratio: aspect ?? '16:9', generate_audio: audio === true }
    if (negative) input.negative_prompt = negative
    if (images[0]) input.image_url = images[0]
    if (images[1]) input.tail_image_url = images[1]
  } else if (family === 'minimax') {
    input = { prompt, duration: seconds, resolution, aspect_ratio: aspect ?? '16:9' }
    if (images[0]) input.image_url = images[0]
    if (images[1]) input.end_image_url = images[1]
  } else {
    // An endpoint the catalogue does not know: send the common fields and let
    // the render block's `input` fix what the endpoint actually wants.
    input = { prompt, duration: seconds, resolution, aspect_ratio: aspect ?? '16:9' }
    if (images[0]) input.image_url = images[0]
  }
  if (seed !== undefined && seed !== null) input.seed = seed
  return { ...input, ...(raw ?? {}) }
}
