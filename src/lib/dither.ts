/**
 * The house chart language: ordered dithering.
 *
 * Charts are painted as cells through a 4x4 Bayer threshold matrix rather than
 * as flat fills. It reads as print, it survives video compression better than a
 * smooth gradient, and — the reason it is here — it is deterministic: the same
 * data paints the same pixels on every take, so two recordings can be compared
 * frame against frame.
 *
 * Colours are named rather than free-form so a trailer cannot invent a palette
 * halfway through; `accent` and `neutral` follow the project's own theme.
 */

/** Normalised 4x4 Bayer matrix (the classic ordered-dither thresholds). */
export const BAYER: number[][] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16))

/** Cell size in CSS px. Smaller reads finer and costs more fill per frame. */
export const CELL = 3

export type Rgb = [number, number, number]

export type DitherColor = 'accent' | 'positive' | 'negative' | 'neutral' | 'blue' | 'violet' | 'amber' | 'teal'

export const PALETTE: Record<DitherColor, Rgb> = {
  accent: [91, 69, 224],
  positive: [63, 191, 95],
  negative: [240, 101, 101],
  neutral: [148, 158, 173],
  blue: [33, 82, 212],
  violet: [136, 134, 247],
  amber: [255, 179, 71],
  teal: [12, 125, 112],
}

export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbOf = (c: DitherColor | string): Rgb =>
  typeof c === 'string' && c.startsWith('#') ? hexToRgb(c) : (PALETTE[c as DitherColor] ?? PALETTE.neutral)

/** Dark ink on light fills, light ink on dark ones. */
export function readableInk(color: string): string {
  const [r, g, b] = color.startsWith('#') ? hexToRgb(color) : rgbOf(color as DitherColor)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.62 ? '#171821' : '#F7F8FA'
}

/**
 * Paint one dithered rectangle. `density` grades along the block (dense at the
 * floor by default, which is what makes a bar read as weight rather than as a
 * flat slab); `onA`/`offA` are the lit and unlit cell alphas.
 */
export function ditherRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Rgb,
  denseAtTop = false,
  onA = 0.92,
  offA = 0.3,
): void {
  const [r, g, b] = fill
  for (let cy = 0; cy < h; cy += CELL) {
    let d = h <= CELL ? 1 : cy / (h - CELL)
    if (denseAtTop) d = 1 - d
    d = 0.35 + 0.65 * d
    for (let cx = 0; cx < w; cx += CELL) {
      const lit = d > BAYER[(((y + cy) / CELL) | 0) & 3][(((x + cx) / CELL) | 0) & 3]
      ctx.fillStyle = `rgba(${r},${g},${b},${lit ? onA : offA})`
      ctx.fillRect(x + cx, y + cy, CELL, CELL)
    }
  }
}

/** Size a canvas to its element box at device resolution, and clear it. */
export function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const W = globalThis.innerWidth
  const H = globalThis.innerHeight
  const dpr = globalThis.devicePixelRatio || 1
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  return ctx
}
