/**
 * THE MODEL CATALOGUE — what the footage builder knows about each generator:
 * who serves it, the seconds it can return, the resolutions it offers, and the
 * PRICE PER GENERATED SECOND the dry run multiplies out before anyone clicks.
 *
 * Prices were read on the providers' own pages on PRICES_AS_OF and they move
 * monthly. `studio.config.json → footage.prices` overrides any cell
 * (`{ "<model>": { "<resolution>": usdPerSecond } }`), and a model this file
 * does not know still works if its render block carries `pricePerSec` — the
 * builder refuses to spend on a shot it cannot price.
 *
 * Endpoint ids are the providers' own. Marked `verified` when the id and its
 * input schema were read off the provider's page; the rest follow the family's
 * naming and MUST be checked before the first --go (the builder says which).
 */

export const PRICES_AS_OF = '2026-09-07'

/** @typedef {{ provider:'fal'|'gemini', family:string, seconds:[number,number], grid?:number[],
 *   resolutions:string[], defaultResolution:string, prices:Record<string,number>,
 *   audioPrices?:Record<string,number>, refs:{images:number,videos:number,audio:number},
 *   verified:boolean, note?:string }} ModelInfo */

/** @type {Record<string, ModelInfo>} */
export const MODELS = {
  // ── ByteDance Seedance (fal is the official API partner) ──────────────────
  'bytedance/seedance-2.0/text-to-video': {
    provider: 'fal', family: 'seedance', seconds: [4, 15], resolutions: ['480p', '720p', '1080p', '4k'], defaultResolution: '720p',
    prices: { '480p': 0.067, '720p': 0.3034, '1080p': 0.682 }, refs: { images: 0, videos: 0, audio: 0 }, verified: true,
  },
  'bytedance/seedance-2.0/image-to-video': {
    provider: 'fal', family: 'seedance', seconds: [4, 15], resolutions: ['480p', '720p', '1080p', '4k'], defaultResolution: '720p',
    prices: { '480p': 0.067, '720p': 0.3034, '1080p': 0.682 }, refs: { images: 2, videos: 0, audio: 0 }, verified: true,
    note: 'first image = start frame, second (optional) = end frame',
  },
  'bytedance/seedance-2.0/reference-to-video': {
    provider: 'fal', family: 'seedance', seconds: [4, 15], resolutions: ['480p', '720p', '1080p', '4k'], defaultResolution: '720p',
    prices: { '480p': 0.067, '720p': 0.3034, '1080p': 0.682 }, refs: { images: 9, videos: 3, audio: 3 }, verified: true,
    note: 'refer to references in the prompt as @Image1, @Video1, @Audio1; ≤12 files in all',
  },
  'bytedance/seedance-2.5/text-to-video': {
    provider: 'fal', family: 'seedance', seconds: [4, 30], resolutions: ['480p', '720p'], defaultResolution: '720p',
    prices: { '480p': 0.2205, '720p': 0.473 }, refs: { images: 0, videos: 0, audio: 0 }, verified: true,
    note: '30 s in one pass; token-billed underneath, the per-second figure is fal\'s 16:9 rate',
  },
  'bytedance/seedance-2.5/reference-to-video': {
    provider: 'fal', family: 'seedance', seconds: [4, 30], resolutions: ['480p', '720p'], defaultResolution: '720p',
    prices: { '480p': 0.2205, '720p': 0.473 }, refs: { images: 50, videos: 50, audio: 50 }, verified: false,
    note: 'up to 50 multimodal references in all (endpoint id follows the 2.0 naming — confirm before --go)',
  },
  // ── Kuaishou Kling 3.0 (via fal) ──────────────────────────────────────────
  'fal-ai/kling-video/v3/pro/text-to-video': {
    provider: 'fal', family: 'kling', seconds: [3, 15], resolutions: ['720p', '1080p'], defaultResolution: '1080p',
    prices: { '720p': 0.112, '1080p': 0.112 }, audioPrices: { '720p': 0.168, '1080p': 0.168 }, refs: { images: 0, videos: 0, audio: 0 }, verified: true,
    note: 'multi-shot + native audio; +$0.028/s with voice control',
  },
  'fal-ai/kling-video/v3/pro/image-to-video': {
    provider: 'fal', family: 'kling', seconds: [3, 15], resolutions: ['720p', '1080p'], defaultResolution: '1080p',
    prices: { '720p': 0.112, '1080p': 0.112 }, audioPrices: { '720p': 0.168, '1080p': 0.168 }, refs: { images: 2, videos: 0, audio: 0 }, verified: false,
  },
  'fal-ai/kling-video/v3/standard/text-to-video': {
    provider: 'fal', family: 'kling', seconds: [3, 15], resolutions: ['720p', '1080p'], defaultResolution: '720p',
    prices: { '720p': 0.084, '1080p': 0.084 }, refs: { images: 0, videos: 0, audio: 0 }, verified: false,
  },
  // ── MiniMax H3 / H3 Max (fal) ─────────────────────────────────────────────
  'minimax/h3-max/text-to-video': {
    provider: 'fal', family: 'minimax', seconds: [5, 15], resolutions: ['480p', '768p'], defaultResolution: '768p',
    prices: { '480p': 0.05, '768p': 0.08 }, refs: { images: 0, videos: 0, audio: 0 }, verified: true,
    note: 'launch price $0.04/s at 768p until 2026-09-14; 5 free generations a day on fal',
  },
  'minimax/h3-max/image-to-video': {
    provider: 'fal', family: 'minimax', seconds: [5, 15], resolutions: ['480p', '768p'], defaultResolution: '768p',
    prices: { '480p': 0.05, '768p': 0.08 }, refs: { images: 2, videos: 0, audio: 0 }, verified: false,
  },
  'minimax/h3/text-to-video': {
    provider: 'fal', family: 'minimax', seconds: [5, 15], resolutions: ['480p', '768p', '2k', '4k'], defaultResolution: '768p',
    prices: { '480p': 0.05, '768p': 0.06, '2k': 0.13, '4k': 0.16 }, refs: { images: 0, videos: 0, audio: 0 }, verified: true,
  },
  // ── Google (Gemini API, paid tier) ────────────────────────────────────────
  'gemini-omni-1.1-flash': {
    provider: 'gemini', family: 'omni', seconds: [3, 10], resolutions: ['360p', '720p', '1080p', '4k'], defaultResolution: '720p',
    prices: { '360p': 0.03, '720p': 0.1, '1080p': 0.15, '4k': 0.3 }, refs: { images: 9, videos: 1, audio: 1 }, verified: true,
    note: 'extension chains to 40 s; editing/extending UPLOADED video is not offered in the EEA/CH/UK',
  },
  'veo-3.1-generate-preview': {
    provider: 'gemini', family: 'veo', seconds: [4, 8], grid: [4, 6, 8], resolutions: ['720p', '1080p', '4k'], defaultResolution: '1080p',
    prices: { '720p': 0.4, '1080p': 0.4, '4k': 0.6 }, refs: { images: 3, videos: 0, audio: 0 }, verified: false,
  },
  'veo-3.1-fast-generate-preview': {
    provider: 'gemini', family: 'veo', seconds: [4, 8], grid: [4, 6, 8], resolutions: ['720p', '1080p', '4k'], defaultResolution: '1080p',
    prices: { '720p': 0.1, '1080p': 0.12, '4k': 0.3 }, refs: { images: 3, videos: 0, audio: 0 }, verified: false,
  },
  'veo-3.1-lite-generate-preview': {
    provider: 'gemini', family: 'veo', seconds: [4, 8], grid: [4, 6, 8], resolutions: ['720p', '1080p'], defaultResolution: '720p',
    prices: { '720p': 0.05, '1080p': 0.08 }, refs: { images: 3, videos: 0, audio: 0 }, verified: false,
  },
}

/** The catalogue entry for a model id, with config price overrides applied. Null for an unknown model. */
export function modelInfo(id, overrides = {}) {
  const base = id ? MODELS[id] : undefined
  if (!base) return null
  const over = overrides?.[id]
  return over ? { ...base, prices: { ...base.prices, ...over } } : base
}

/** Guess the provider of an unknown model id from its shape, so a render block
 *  may name any fal endpoint or Gemini model without a catalogue row. */
export function guessProvider(id) {
  if (!id) return null
  if (/^(gemini|veo|imagen)-/.test(id)) return 'gemini'
  if (id.includes('/')) return 'fal'
  return null
}

/**
 * The seconds to ask for. A number is honoured (then clamped to the model's
 * range and snapped UP to its grid); 'auto' or nothing means the resolved span
 * plus a margin — the narration re-times the span by fractions and a freeze of
 * half a second reads as a beat, so the shot is generated a little long.
 */
export const AUTO_MARGIN_SEC = 1.5
export function pickSeconds(info, wanted, spanSec) {
  let s = typeof wanted === 'number' && Number.isFinite(wanted) && wanted > 0 ? wanted : Math.ceil(Math.max(0, spanSec) + AUTO_MARGIN_SEC)
  if (info) {
    const [lo, hi] = info.seconds
    s = Math.min(hi, Math.max(lo, Math.ceil(s)))
    if (info.grid) s = info.grid.find((g) => g >= s) ?? info.grid[info.grid.length - 1]
  } else s = Math.max(1, Math.ceil(s))
  return s
}

/** USD per generated second for a model at a resolution, or null when unpriced. */
export function priceOf(info, resolution, withAudio = false) {
  if (!info) return null
  const table = withAudio && info.audioPrices ? info.audioPrices : info.prices
  const v = table[resolution] ?? table[info.defaultResolution]
  return typeof v === 'number' ? v : null
}
