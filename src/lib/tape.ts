/**
 * Pure maths for scripted data: candles a trailer can write down, and a
 * squarified treemap for weighted tiles. No React, no DOM — the stage pieces
 * render what these return.
 *
 * THE DETERMINISM LAW: nothing here reads a clock or Math.random. Every series
 * comes from a seeded generator, so a retake is the same take and two takes can
 * be compared frame against frame. A timeline that wants a different market
 * changes the seed, not the luck.
 */

/** Seeded PRNG (mulberry32): small, fast, and identical across runs. */
export function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Candle = {
  /** Mix time (s) the candle starts growing. */
  at: number
  open: number
  close: number
  high: number
  low: number
  up: boolean
}

/**
 * A leg of `count` candles stepping a value up from `start`, with the given
 * indices as shallow pullbacks so the series reads as a market rather than as a
 * ramp.
 */
export function buildLeg(opts: {
  rnd: () => number
  start: number
  count: number
  /** Mix time of the first candle. */
  from: number
  stepSec: number
  pullbacks?: number[]
}): Candle[] {
  const { rnd, start, count, from, stepSec, pullbacks = [] } = opts
  const leg: Candle[] = []
  let price = start
  for (let i = 0; i < count; i++) {
    const down = pullbacks.includes(i)
    const open = price
    const close = down ? open * (0.965 + rnd() * 0.01) : open * (1.045 + rnd() * 0.055)
    const high = Math.max(open, close) * (1 + 0.008 + rnd() * 0.014)
    const low = Math.min(open, close) * (1 - 0.006 - rnd() * 0.012)
    leg.push({ at: from + i * stepSec, open, close, high, low, up: close >= open })
    price = close
  }
  return leg
}

export const fmtUsd = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(2)}`

// ── squarified treemap ──────────────────────────────────────────────────────
// Weighted tiles laid out so each stays close to square: the readable way to
// show a composition, because comparing areas of similar aspect is easy and
// comparing angles (a pie) is not.

export type TreeItem = { id: string; weight: number }
export type TreeRect = { id: string; x: number; y: number; w: number; h: number }

export function squarify(items: TreeItem[], width: number, height: number): TreeRect[] {
  const total = items.reduce((s, it) => s + it.weight, 0)
  if (total <= 0 || width <= 0 || height <= 0 || items.length === 0) return []

  const nodes = [...items]
    .sort((a, b) => b.weight - a.weight)
    .map((it) => ({ id: it.id, area: (it.weight / total) * width * height }))

  const out: TreeRect[] = []
  let x = 0
  let y = 0
  let w = width
  let h = height

  const worst = (row: { area: number }[], side: number) => {
    let sum = 0
    let max = -Infinity
    let min = Infinity
    for (const r of row) {
      sum += r.area
      if (r.area > max) max = r.area
      if (r.area < min) min = r.area
    }
    const s2 = sum * sum
    const side2 = side * side
    return Math.max((side2 * max) / s2, s2 / (side2 * min))
  }

  const layout = (row: { id: string; area: number }[], side: number, horizontal: boolean) => {
    const sum = row.reduce((s, r) => s + r.area, 0)
    const thick = sum / side
    let pos = horizontal ? x : y
    for (const r of row) {
      const len = r.area / thick
      out.push(
        horizontal
          ? { id: r.id, x: pos, y, w: len, h: thick }
          : { id: r.id, x, y: pos, w: thick, h: len },
      )
      pos += len
    }
    if (horizontal) {
      y += thick
      h -= thick
    } else {
      x += thick
      w -= thick
    }
  }

  let row: { id: string; area: number }[] = []
  for (const node of nodes) {
    const horizontal = w >= h
    const side = horizontal ? w : h
    if (row.length === 0) {
      row.push(node)
      continue
    }
    if (worst([...row, node], side) <= worst(row, side)) {
      row.push(node)
    } else {
      layout(row, side, horizontal)
      row = [node]
    }
  }
  if (row.length) layout(row, w >= h ? w : h, w >= h)
  return out
}
