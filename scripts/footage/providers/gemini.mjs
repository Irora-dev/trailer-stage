/**
 * Google Gemini API — Omni Flash (the Interactions API) and Veo 3.1 (a
 * long-running operation), by hand over REST.
 *
 *   Omni   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *          { model: 'gemini-omni-1.1-flash', input: [ {type:'text'}, {type:'image', data, mime_type}… ],
 *            response_format: { resolution, aspect_ratio }, generation_config: { video_config: { task } },
 *            delivery: 'uri' }                                   → { id, status?, output_video: { data | uri } }
 *          An `output_video.uri` names a File; poll files/<id> until ACTIVE, then download it.
 *   Veo    POST …/v1beta/models/<model>:predictLongRunning        → { name: 'operations/…' }
 *          GET  …/v1beta/<name> until done                        → response.generateVideoResponse.generatedSamples[0].video.uri
 *   auth   x-goog-api-key: <GEMINI_API_KEY>   (paid tier; the free tier has no video)
 *
 * Submit and await are separate (omniSubmit/omniAwait, veoSubmit/veoAwait) so the
 * builder can write a pending marker in between and resume after a crash.
 *
 * ⚠️ WRITTEN WITHOUT A KEY (2026-09-07): shapes are read off ai.google.dev, not
 * exercised. The first --go is the proof; keep it to one short 360p shot on Omni,
 * the cheapest thing this file can ask for.
 *
 * EEA NOTE: editing or extending an UPLOADED video is not offered to EEA/CH/UK
 * accounts. Generating from text and images is. So these adapters take image
 * references and refuse video references with a plain message.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname } from 'node:path'

const API = 'https://generativelanguage.googleapis.com'

export function geminiKey({ required = true } = {}) {
  const env = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (env) return env.trim()
  const file = `${homedir()}/.config/gemini/api-key`
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  if (!required) return null
  throw new Error('No Gemini key. export GEMINI_API_KEY=… or put it in ~/.config/gemini/api-key (chmod 600). Nothing except rendering needs it.')
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const inlineImage = (path) => {
  const mime = MIME[extname(path).toLowerCase()]
  if (!mime) throw new Error(`not an image reference: ${path}`)
  return { mime, data: readFileSync(path).toString('base64') }
}

async function call(path, key, init = {}, label = 'gemini') {
  const res = await fetch(`${API}${path}`, { ...init, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
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

async function downloadFile(uriOrName, key) {
  // A File resource is downloaded through the download host with alt=media.
  const m = /files\/([A-Za-z0-9_-]+)/.exec(uriOrName)
  if (!m) {
    const res = await fetch(uriOrName, { headers: { 'x-goog-api-key': key } })
    if (!res.ok) throw new Error(`download ${res.status}: ${uriOrName}`)
    return Buffer.from(await res.arrayBuffer())
  }
  const name = `files/${m[1]}`
  const t0 = Date.now()
  for (;;) {
    const info = await call(`/v1beta/${name}`, key, {}, 'gemini files.get')
    const state = info.state?.name ?? info.state
    if (state === 'ACTIVE') break
    if (state === 'FAILED') throw new Error(`gemini file ${name} failed to process`)
    if (Date.now() - t0 > 600_000) throw new Error(`gemini file ${name} never became ACTIVE`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  const res = await fetch(`${API}/download/v1beta/${name}:download?alt=media`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) throw new Error(`gemini download ${res.status} for ${name}`)
  return Buffer.from(await res.arrayBuffer())
}

const DONE = new Set(['completed', 'succeeded', 'done'])
const FAILED = new Set(['failed', 'error', 'cancelled'])

// ── Omni ────────────────────────────────────────────────────────────────────
export function omniRequest({ model = 'gemini-omni-1.1-flash', prompt, negative, refs, resolution = '720p', aspect = '16:9', audio, seconds, raw }) {
  if (refs?.videos?.length || refs?.audio?.length)
    throw new Error('Omni: video/audio references are not wired here (and editing uploaded video is not offered in the EEA) — use a Seedance reference-to-video endpoint on fal for that shot')
  const input = []
  for (const p of refs?.images ?? []) {
    const { mime, data } = inlineImage(p)
    input.push({ type: 'image', data, mime_type: mime })
  }
  const direction = [prompt, negative ? `Avoid: ${negative}.` : '', audio === true ? '' : 'No audio.', seconds ? `About ${seconds} seconds.` : ''].filter(Boolean).join(' ')
  input.push({ type: 'text', text: direction })
  return {
    model,
    input,
    response_format: { resolution, aspect_ratio: aspect },
    generation_config: { video_config: { task: refs?.images?.length ? 'image_to_video' : 'text_to_video' } },
    delivery: 'uri',
    ...(raw ?? {}),
  }
}

export async function omniSubmit(body, key) {
  const res = await call('/v1beta/interactions', key, { method: 'POST', body: JSON.stringify(body) }, 'gemini interactions.create')
  return { id: res.id ?? null, first: res }
}

/** Poll an interaction to completion and download its video. `first` may be the create response. */
export async function omniAwait({ id, first = null, key, onLog, timeoutSec = 1200 }) {
  let res = first ?? (await call(`/v1beta/interactions/${id}`, key, {}, 'gemini interactions.get'))
  const t0 = Date.now()
  while (res.status && !DONE.has(String(res.status).toLowerCase()) && !res.output_video) {
    if (FAILED.has(String(res.status).toLowerCase())) throw new Error(`Omni interaction ${res.id} ${res.status}: ${JSON.stringify(res).slice(0, 400)}`)
    if (Date.now() - t0 > timeoutSec * 1000) throw new Error(`Omni interaction ${res.id} timed out`)
    onLog?.(`interaction ${res.id}: ${res.status}`)
    await new Promise((r) => setTimeout(r, 5000))
    res = await call(`/v1beta/interactions/${res.id ?? id}`, key, {}, 'gemini interactions.get')
  }
  const video = res.output_video ?? res.output?.find?.((o) => o.type === 'video')
  if (!video) throw new Error(`Omni: no output_video in ${JSON.stringify(res).slice(0, 400)}`)
  const buffer = video.data ? Buffer.from(video.data, 'base64') : await downloadFile(video.uri, key)
  return { buffer, requestId: res.id ?? id ?? null, seed: null, raw: { id: res.id, status: res.status, usage: res.usage ?? null } }
}

/** Omni Flash: text/image → video. Returns a Buffer. */
export async function omniGenerate(req) {
  const { key, onLog, onSubmitted } = req
  const body = omniRequest(req)
  const sub = await omniSubmit(body, key)
  onSubmitted?.({ requestId: sub.id })
  return omniAwait({ id: sub.id, first: sub.first, key, onLog })
}

// ── Veo ─────────────────────────────────────────────────────────────────────
export function veoRequest({ prompt, negative, refs, resolution = '1080p', aspect = '16:9', audio, seconds = 8, raw }) {
  if (refs?.videos?.length || refs?.audio?.length) throw new Error('Veo: video/audio references are not wired here')
  const instance = { prompt }
  if (refs?.images?.[0]) {
    const { mime, data } = inlineImage(refs.images[0])
    instance.image = { bytesBase64Encoded: data, mimeType: mime }
  }
  return {
    instances: [instance],
    parameters: { aspectRatio: aspect, resolution, durationSeconds: seconds, generateAudio: audio === true, ...(negative ? { negativePrompt: negative } : {}) },
    ...(raw ?? {}),
  }
}

export async function veoSubmit(model, body, key) {
  const op = await call(`/v1beta/models/${model}:predictLongRunning`, key, { method: 'POST', body: JSON.stringify(body) }, 'veo predictLongRunning')
  if (!op.name) throw new Error(`Veo: no operation name in ${JSON.stringify(op).slice(0, 300)}`)
  return { name: op.name, first: op }
}

export async function veoAwait({ name, first = null, key, onLog, timeoutSec = 1200 }) {
  let cur = first ?? (await call(`/v1beta/${name}`, key, {}, 'veo operations.get'))
  const t0 = Date.now()
  while (!cur.done) {
    if (Date.now() - t0 > timeoutSec * 1000) throw new Error(`Veo operation ${name} timed out`)
    onLog?.(`${name}: running`)
    await new Promise((r) => setTimeout(r, 8000))
    cur = await call(`/v1beta/${name}`, key, {}, 'veo operations.get')
  }
  if (cur.error) throw new Error(`Veo: ${JSON.stringify(cur.error).slice(0, 400)}`)
  const sample = cur.response?.generateVideoResponse?.generatedSamples?.[0] ?? cur.response?.generatedSamples?.[0]
  const uri = sample?.video?.uri
  if (!uri) throw new Error(`Veo: no video uri in ${JSON.stringify(cur.response ?? cur).slice(0, 400)}`)
  const buffer = await downloadFile(uri, key)
  return { buffer, requestId: name, seed: null, raw: { name } }
}

/** Veo 3.1: text (+ a start image) → video as a long-running operation. Returns a Buffer. */
export async function veoGenerate(req) {
  const { model = 'veo-3.1-fast-generate-preview', key, onLog, onSubmitted } = req
  const body = veoRequest(req)
  const sub = await veoSubmit(model, body, key)
  onSubmitted?.({ requestId: sub.name })
  return veoAwait({ name: sub.name, first: sub.first, key, onLog })
}
