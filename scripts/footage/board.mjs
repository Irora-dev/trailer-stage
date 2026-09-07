/**
 * THE STYLE BOARD'S MATH — pure: prices, prompts and the contact-sheet grid.
 *
 * A style board tries a LOOK for cents before a shot costs dollars: one subject, N
 * styles, one still each from an image model, tiled into a labelled sheet. The
 * still a person picks becomes a reference for the video model (Seedance
 * reference-to-video follows a reference image's style closely), or frame one of
 * an image-to-video shot. Nothing here spends.
 */

export const IMAGE_PRICES_AS_OF = '2026-09-07'

/** USD per image, read on the providers' pages on IMAGE_PRICES_AS_OF. `verified`
 *  means the price was read that day; others carry the family's figure. */
export const IMAGE_MODELS = {
  'fal-ai/bytedance/seedream/v4/edit': { provider: 'fal', family: 'seedream', usd: 0.03, refs: 10, verified: true, note: 'reference images in, the same family as Seedance: the look carries over' },
  'fal-ai/bytedance/seedream/v4/text-to-image': { provider: 'fal', family: 'seedream', usd: 0.03, refs: 0, verified: true },
  'fal-ai/nano-banana': { provider: 'fal', family: 'nano-banana', usd: 0.039, refs: 0, verified: true, note: "Google's image model" },
  'fal-ai/nano-banana/edit': { provider: 'fal', family: 'nano-banana', usd: 0.039, refs: 10, verified: false },
  'fal-ai/recraft/v3/text-to-image': { provider: 'fal', family: 'recraft', usd: 0.04, refs: 0, verified: false, note: 'named illustration styles (style: digital_illustration/…)' },
  // Meshy's image API (docs read 2026-09-07) wraps Google's and OpenAI's image models and bills
  // prepaid CREDITS per image: text-to-image / image-to-image (1 to 5 reference images).
  // `credits` is the image-to-image figure where the two differ; usd is null until the board's
  // `meshyUsdPerCredit` says what a credit cost on Colby's plan.
  'meshy/nano-banana': { provider: 'meshy', family: 'meshy', usd: null, credits: 3, refs: 5, verified: true },
  'meshy/nano-banana-2': { provider: 'meshy', family: 'meshy', usd: null, credits: 6, refs: 5, verified: true },
  'meshy/nano-banana-pro': { provider: 'meshy', family: 'meshy', usd: null, credits: 9, refs: 5, verified: true },
  'meshy/gpt-image-2': { provider: 'meshy', family: 'meshy', usd: null, credits: 12, refs: 5, verified: true, note: '9 credits text-to-image, 12 image-to-image' },
}

export function imageModelInfo(id, overrides = {}) {
  const base = id ? IMAGE_MODELS[id] : undefined
  if (!base) return null
  const over = overrides?.[id]
  return over ? { ...base, ...over } : base
}

/** The prompt one style cell sends: the shared subject, then the style, then the shared don'ts. */
export function boardPrompt(subject, style, negative) {
  const parts = [String(subject ?? '').trim(), String(style ?? '').trim()].filter(Boolean)
  const p = parts.join(' STYLE: ')
  return negative ? `${p} Avoid: ${String(negative).trim()}.` : p
}

/** Columns and rows for n cells: as square as possible, wider rather than taller. */
export function layoutFor(n) {
  const count = Math.max(1, Math.round(Number(n) || 1))
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  return { cols, rows, cells: cols * rows }
}

/** What a board would spend NOW: only the styles whose still is missing. */
export function priceBoard(styles, info, { missing = () => true } = {}) {
  const owed = (styles ?? []).filter((s) => missing(s))
  const usd = info?.usd == null ? null : owed.length * info.usd
  const credits = info?.credits == null ? null : owed.length * info.credits
  return { owed: owed.length, usd, credits }
}

/** drawtext cannot take a raw label: colons, quotes and backslashes are filter syntax. */
export function safeLabel(s) {
  return String(s ?? '')
    .replace(/[\\:'"%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48)
}
