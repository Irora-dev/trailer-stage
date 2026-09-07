/**
 * fal.ai — the queue API, by hand (no SDK dependency to install).
 *
 *   submit   POST https://queue.fal.run/<endpoint>            → { request_id, status_url, response_url }
 *   status   GET  <status_url>?logs=1                          → { status: IN_QUEUE | IN_PROGRESS | COMPLETED, … }
 *   result   GET  <response_url>                               → the model's output ({ video: { url }, seed, … })
 *   upload   POST https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3 → { upload_url, file_url }, then PUT
 *   auth     Authorization: Key <FAL_KEY>
 *
 * Submit and await are separate so the builder can write a pending marker in
 * between: a crash after submit still billed the render, and the marker lets a
 * re-run fetch the result instead of paying twice. Result URLs live on fal's
 * media host and EXPIRE, so the file is downloaded the moment a request completes.
 *
 * The family mappings below are read off each endpoint's OpenAPI schema
 * (scripts/footage/fixtures/schemas/, refreshed by the builder). They are a
 * starting point only: the builder CONFORMS every request to the live schema
 * (schema.mjs) before it is sent.
 *
 * ⚠️ WRITTEN WITHOUT A KEY (2026-09-07): exercised against the documented shapes
 * and the schemas, never against the live service. The first --go is the proof;
 * keep it to one short, cheap shot.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname } from 'node:path'

const QUEUE = 'https://queue.fal.run'
const REST = 'https://rest.alpha.fal.ai'

export function falKey({ required = true } = {}) {
  const env = process.env.FAL_KEY
  if (env) return env.trim()
  const file = `${homedir()}/.config/fal/api-key`
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  if (!required) return null
  throw new Error('No fal key. export FAL_KEY=… or put it in ~/.config/fal/api-key (chmod 600). Nothing except rendering needs it.')
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
const MIME_ALL = { ...MIME, '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' }

/** A local image as a data URI, the way fal image_url fields accept inline files. */
export function imageDataUri(path) {
  const mime = MIME[extname(path).toLowerCase()]
  if (!mime) throw new Error(`not an image reference: ${path}`)
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`
}

/**
 * A copy of a request with every inline data URI replaced by a short note (mime,
 * byte count, sha1) — for sidecars and logs. The bytes are already hashed under
 * the sidecar's `refs`; a 4 MB string per reference makes a provenance file
 * nobody can open, and two of them made one 7.7 MB (2026-09-07).
 */
export function elideDataUris(value) {
  if (typeof value === 'string') {
    if (value.length < 200) return value
    const m = /^data:([^;,]+);base64,(.+)$/s.exec(value)
    if (!m) return value
    const bytes = Buffer.from(m[2], 'base64')
    return `data:${m[1]};base64,<elided ${bytes.length} bytes · sha1 ${createHash('sha1').update(bytes).digest('hex')}>`
  }
  if (Array.isArray(value)) return value.map(elideDataUris)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, elideDataUris(v)]))
  return value
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
  if (!res.ok) {
    const err = new Error(`${label}: ${res.status} ${text.slice(0, 400)}`)
    err.status = res.status
    throw err
  }
  return body
}

const headersFor = (key) => ({ Authorization: `Key ${key}`, 'Content-Type': 'application/json' })

/** Submit only. Returns what a re-run needs to find the result again. */
export async function falSubmit({ endpoint, input, key }) {
  const sub = await json(`${QUEUE}/${endpoint}`, { method: 'POST', headers: headersFor(key), body: JSON.stringify(input) }, 'fal submit')
  const requestId = sub.request_id
  if (!requestId) throw new Error(`fal submit returned no request_id: ${JSON.stringify(sub).slice(0, 300)}`)
  return {
    requestId,
    statusUrl: sub.status_url ?? `${QUEUE}/${endpoint}/requests/${requestId}/status`,
    responseUrl: sub.response_url ?? `${QUEUE}/${endpoint}/requests/${requestId}`,
  }
}

/** Poll to completion, then fetch the output. Also how a pending marker is resumed. */
export async function falAwait({ statusUrl, responseUrl, key, onLog, timeoutSec = 1200, pollMs = 4000 }) {
  const headers = headersFor(key)
  const t0 = Date.now()
  let seen = 0
  for (;;) {
    if (Date.now() - t0 > timeoutSec * 1000) throw new Error(`fal: timed out after ${timeoutSec}s waiting on ${statusUrl}`)
    const st = await json(`${statusUrl}${statusUrl.includes('?') ? '&' : '?'}logs=1`, { headers }, 'fal status')
    for (const l of (st.logs ?? []).slice(seen)) onLog?.(l.message ?? String(l))
    seen = (st.logs ?? []).length
    if (st.status === 'COMPLETED') break
    if (st.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error(`fal: request ended ${st.status}: ${JSON.stringify(st).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, pollMs))
  }
  const out = await json(responseUrl, { headers }, 'fal result')
  const url = out.video?.url ?? out.videos?.[0]?.url ?? out.output?.url ?? out.url
  if (!url) throw new Error(`fal: completed but no video url in ${JSON.stringify(out).slice(0, 400)}`)
  return { url, seed: out.seed ?? null, raw: out }
}

/** Submit, then await. `onSubmitted` receives the ids first, for the pending marker. */
export async function falGenerate({ endpoint, input, key, onLog, onSubmitted, timeoutSec }) {
  const sub = await falSubmit({ endpoint, input, key })
  onSubmitted?.(sub)
  const out = await falAwait({ ...sub, key, onLog, timeoutSec })
  return { ...out, requestId: sub.requestId }
}

/**
 * Upload a local file to fal's storage so a model can read it by URL (video and
 * audio references, and images too large for a data URI). Two steps, as the JS
 * client does it: initiate (signed upload URL + the final file URL), then PUT
 * the bytes. Files over 90 MB would need the multipart flow; a reference that
 * big is a mistake, so this refuses instead.
 */
export async function uploadToFal(path, key) {
  const bytes = readFileSync(path)
  if (bytes.length > 90 * 1024 * 1024) throw new Error(`${path}: ${(bytes.length / 1048576).toFixed(0)} MB is too large for a reference upload (90 MB cap)`)
  const type = MIME_ALL[extname(path).toLowerCase()] ?? 'application/octet-stream'
  const init = await json(
    `${REST}/storage/upload/initiate?storage_type=fal-cdn-v3`,
    { method: 'POST', headers: headersFor(key), body: JSON.stringify({ file_name: path.split('/').pop(), content_type: type }) },
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
 * Map the builder's shared request onto an endpoint's input, per family, as the
 * schemas describe them (2026-09-07):
 *   seedance  duration is a STRING enum ("auto","4".."15"; 2.5 to "30"), resolution lowercase,
 *             image-to-video takes image_url + end_image_url, reference-to-video takes
 *             image_urls / video_urls / audio_urls, generate_audio; no seed field.
 *   kling v3  no resolution field at all; duration a STRING ("3".."15"); aspect_ratio only on
 *             text-to-video (16:9 · 9:16 · 1:1); image-to-video takes start_image_url +
 *             end_image_url; negative_prompt; generate_audio.
 *   minimax   duration an INTEGER 5..15; resolution UPPERCASE ("480P","768P","2K","4K");
 *             prompt_expansion_mode is REQUIRED (default "balanced"); seed; image-to-video
 *             takes image_url + end_image_url.
 * `raw` (the render block's `input`) is merged LAST so any field can be corrected
 * without touching this file; the schema conform pass runs after this anyway.
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
    input = { prompt, duration: String(seconds), generate_audio: audio === true }
    if (negative) input.negative_prompt = negative
    if (endpoint.endsWith('/image-to-video')) {
      if (images[0]) input.start_image_url = images[0]
      if (images[1]) input.end_image_url = images[1]
    } else input.aspect_ratio = aspect ?? '16:9'
  } else if (family === 'minimax') {
    input = { prompt, duration: Math.round(seconds), resolution: String(resolution).toUpperCase(), prompt_expansion_mode: 'balanced' }
    if (!endpoint.endsWith('/image-to-video')) input.aspect_ratio = aspect ?? '16:9'
    if (images[0]) input.image_url = images[0]
    if (images[1]) input.end_image_url = images[1]
    if (seed !== undefined && seed !== null) input.seed = seed
  } else {
    // An endpoint the catalogue does not know: the common fields; the schema
    // conform pass and the render block's `input` fix what the endpoint wants.
    input = { prompt, duration: seconds, resolution, aspect_ratio: aspect ?? '16:9' }
    if (images[0]) input.image_url = images[0]
    if (seed !== undefined && seed !== null) input.seed = seed
  }
  return { ...input, ...(raw ?? {}) }
}
