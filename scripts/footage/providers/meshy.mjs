/**
 * Meshy — the 2D image endpoints of its API, by hand (docs read 2026-09-07).
 *
 *   text-to-image   POST https://api.meshy.ai/openapi/v1/text-to-image   { ai_model, prompt, aspect_ratio }
 *   image-to-image  POST https://api.meshy.ai/openapi/v1/image-to-image  { ai_model, prompt, aspect_ratio, reference_image_urls: [1..5 urls or data URIs] }
 *   both answer     { result: "<task id>" }; poll GET .../<kind>/<id> → { status: PENDING|IN_PROGRESS|SUCCEEDED|FAILED|CANCELED, image_urls, consumed_credits }
 *   balance         GET  https://api.meshy.ai/openapi/v1/balance → { balance }
 *   auth            Authorization: Bearer <key>
 *
 * ai_model is one of nano-banana (3 credits) · nano-banana-2 (6) · nano-banana-pro (9) ·
 * gpt-image-2 (9 text, 12 image). Credits are PREPAID on Colby's plan, so the board prints
 * credits, and dollars only when the spec says what a credit cost.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const BASE = 'https://api.meshy.ai/openapi/v1'

export function meshyKey({ required = true } = {}) {
  const env = process.env.MESHY_API_KEY
  if (env) return env.trim()
  const file = `${homedir()}/.config/meshy/api-key`
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  if (!required) return null
  throw new Error('No Meshy key. export MESHY_API_KEY=… or put it in ~/.config/meshy/api-key (chmod 600).')
}

const headersFor = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

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

/** Prepaid credits left on the account. */
export async function meshyBalance(key) {
  const b = await json(`${BASE}/balance`, { headers: headersFor(key) }, 'meshy balance')
  return Number(b.balance ?? NaN)
}

/** The request as Meshy takes it. `model` is our id, "meshy/<ai_model>". */
export function meshyInput({ model, prompt, aspect = '16:9', refs }) {
  const ai_model = String(model).replace(/^meshy\//, '')
  const images = refs?.images ?? []
  const kind = images.length ? 'image-to-image' : 'text-to-image'
  const input = { ai_model, prompt, aspect_ratio: aspect }
  if (images.length) input.reference_image_urls = images.slice(0, 5)
  return { kind, input }
}

/** Submit only; returns what a re-run needs to find the result again. */
export async function meshySubmit({ kind, input, key }) {
  const sub = await json(`${BASE}/${kind}`, { method: 'POST', headers: headersFor(key), body: JSON.stringify(input) }, `meshy ${kind} submit`)
  const requestId = sub.result
  if (!requestId) throw new Error(`meshy submit returned no task id: ${JSON.stringify(sub).slice(0, 300)}`)
  return { requestId, statusUrl: `${BASE}/${kind}/${requestId}`, responseUrl: `${BASE}/${kind}/${requestId}` }
}

/** Poll to completion; returns the first image url and the credits it consumed. */
export async function meshyAwait({ statusUrl, key, onLog, timeoutSec = 600, pollMs = 3000 }) {
  const t0 = Date.now()
  let lastProgress = -1
  for (;;) {
    if (Date.now() - t0 > timeoutSec * 1000) throw new Error(`meshy: timed out after ${timeoutSec}s waiting on ${statusUrl}`)
    const st = await json(statusUrl, { headers: headersFor(key) }, 'meshy status')
    if (typeof st.progress === 'number' && st.progress !== lastProgress) {
      lastProgress = st.progress
      onLog?.(`progress ${st.progress}%`)
    }
    if (st.status === 'SUCCEEDED') {
      const url = st.image_urls?.[0]
      if (!url) throw new Error(`meshy: succeeded but no image url in ${JSON.stringify(st).slice(0, 300)}`)
      return { url, credits: st.consumed_credits ?? null, raw: st }
    }
    if (st.status === 'FAILED' || st.status === 'CANCELED') throw new Error(`meshy: task ${st.status}: ${JSON.stringify(st.task_error ?? st).slice(0, 300)}`)
    await new Promise((r) => setTimeout(r, pollMs))
  }
}

export async function meshyGenerate({ kind, input, key, onLog, onSubmitted }) {
  const sub = await meshySubmit({ kind, input, key })
  onSubmitted?.(sub)
  const out = await meshyAwait({ ...sub, key, onLog })
  return { ...out, requestId: sub.requestId }
}
