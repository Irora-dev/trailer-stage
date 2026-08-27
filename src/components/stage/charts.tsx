'use client'

/**
 * Charts that draw themselves on the stage clock.
 *
 * Both of these are full-viewport canvases that mirror the card's rect, so what
 * the canvas paints and what the DOM lays out agree at any window size. They
 * paint through the ordered-dither language in lib/dither.ts, which is what
 * makes them survive video encoding and repeat exactly across takes.
 *
 * ⚠️ THE DOMAIN IS FIXED FROM THE WHOLE SERIES UP FRONT. Deriving it from the
 * points already on screen makes the opening values tower across the plot and
 * then shrink as later ones land — a rescale wobble instead of a climb. It reads
 * as a bug and it is invisible in the code; it only shows up in the frames.
 */

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { CELL, ditherRect, fitCanvas, rgbOf, type DitherColor } from '@/lib/dither'
import type { Candle } from '@/lib/tape'
import { useStageFrame } from './stage-shell'

export type PlotRect = { x: number; y: number; w: number; h: number }

/** The plot rect inside a centred card. `headerPx` is the band the card's own
 *  header occupies; a chart must leave it alone or it draws over the title. */
export const plotFor =
  (widthVw: number, heightVh: number, headerPx: number) =>
  (W: number, H: number): PlotRect => {
    const cardW = W * (widthVw / 100)
    const cardH = H * (heightVh / 100)
    const cardX = (W - cardW) / 2
    const cardY = (H - cardH) / 2
    return { x: cardX + 14, y: cardY + headerPx, w: cardW - 28, h: cardH - headerPx - 18 }
  }

export type TapeGeometry = {
  plot: PlotRect
  slotW: number
  slotX: (i: number) => number
  yOf: (v: number) => number
}

export type CrashSpec = {
  at: number
  stepSec: number
  count: number
  /** First body height in px; body k is heightPx * growthFactor^k. SCREEN space
   *  on purpose, so the cascade leaves the card and runs off frame regardless of
   *  what the value domain happens to be. */
  heightPx: number
  growthFactor: number
  slotStart: number
  fromValue: number
}

/**
 * The market tape: scripted candles growing left to right, with an optional
 * cascade that exits the frame. Geometry is exposed through a ref because other
 * pieces stand ON it — a marker or an actor positions from the same numbers the
 * canvas drew with, so they cannot drift apart.
 */
export const StageMarketTape = forwardRef<
  { geom: () => TapeGeometry },
  {
    candles: Candle[]
    crash?: CrashSpec
    slots: number
    /** Draw window in mix time; outside it the canvas is blank. */
    window: { from: number; until: number }
    plotOf: (W: number, H: number) => PlotRect
    colors?: { up: DitherColor | string; down: DitherColor | string }
    visible: boolean
    growSec?: number
  }
>(function StageMarketTape(
  { candles, crash, slots, window: win, plotOf, colors = { up: 'positive', down: 'negative' }, visible, growSec = 0.26 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const domain = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const c of candles) {
      if (c.low < lo) lo = c.low
      if (c.high > hi) hi = c.high
    }
    return { lo: lo * 0.98, hi: hi * 1.03 }
  }, [candles])

  const geom = (): TapeGeometry => {
    const plot = plotOf(globalThis.innerWidth, globalThis.innerHeight)
    const slotW = plot.w / slots
    return {
      plot,
      slotW,
      slotX: (i: number) => plot.x + slotW * (i + 0.5),
      yOf: (v: number) => plot.y + plot.h - ((v - domain.lo) / (domain.hi - domain.lo)) * plot.h,
    }
  }
  useImperativeHandle(ref, () => ({ geom }))

  useStageFrame((t) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = fitCanvas(canvas)
    if (!ctx) return
    if (t < win.from || t >= win.until) return

    const g = geom()
    const up = rgbOf(colors.up)
    const down = rgbOf(colors.down)

    // The quiet horizontals a chart needs to be readable at all.
    ctx.fillStyle = 'rgba(127,127,127,0.10)'
    for (let gy = g.plot.y + 18; gy < g.plot.y + g.plot.h; gy += 54)
      ctx.fillRect(g.plot.x, Math.round(gy), g.plot.w, 1)

    candles
      .filter((c) => t >= c.at)
      .forEach((c, i) => {
        const grow = Math.min(1, (t - c.at) / growSec)
        const fill = c.up ? up : down
        const bodyW = Math.max(4, Math.round(g.slotW * 0.62))
        const cx = g.slotX(i)
        const bx = Math.round(cx - bodyW / 2)
        const yO = g.yOf(c.open)
        const yC = g.yOf(c.close)
        const top = Math.min(yO, yC)
        const bot = Math.max(yO, yC)
        const fullH = Math.max(3, bot - top)
        // Grows from the open toward the close, like a print head laying it down.
        const h = Math.max(3, Math.round(fullH * grow))
        const y = c.up ? Math.round(bot - h) : Math.round(top)
        if (grow > 0.7) {
          ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},0.55)`
          ctx.fillRect(Math.round(cx) - 1, Math.round(g.yOf(c.high)), 2, Math.round(g.yOf(c.low) - g.yOf(c.high)))
        }
        ditherRect(ctx, bx, y, bodyW, h, fill, !c.up, c.up ? 0.92 : 0.4, c.up ? 0.3 : 0.12)
        // A soft solid cap at the close, so the body ends on a line.
        ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},0.85)`
        ctx.fillRect(bx, c.up ? y : y + h - 1, bodyW, 1)
      })

    if (crash && t >= crash.at) {
      let topPx = g.yOf(crash.fromValue)
      const H = globalThis.innerHeight
      for (let k = 0; k < crash.count; k++) {
        const at = crash.at + k * crash.stepSec
        if (t < at) break
        const grow = Math.min(1, (t - at) / 0.3)
        const hK = crash.heightPx * Math.pow(crash.growthFactor, k)
        const bodyH = Math.min(hK * grow, H + 60 - topPx)
        const cx = g.slotX(crash.slotStart + k)
        const bodyW = Math.max(4, Math.round(g.slotW * 0.62))
        ditherRect(ctx, Math.round(cx - bodyW / 2), Math.round(topPx), bodyW, Math.round(bodyH), down, true, 0.95, 0.3)
        topPx += hK
        if (topPx > H + 40) break
      }
    }
  })

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    />
  )
})

// ── the line chart ──────────────────────────────────────────────────────────

export type LinePoint = { at: number; v: number }

export type ChartSeries = {
  label: string
  color: DitherColor | string
  points: LinePoint[]
  /** An AREA series gets the dense-at-the-floor fill; a DOTTED one gets no fill,
   *  because two solid fills muddy each other and the back one stops reading. */
  kind: 'area' | 'dotted'
  /** Points at or after this mix time draw in `altColor`. */
  altAt?: number
  altColor?: DitherColor | string
  format?: (v: number) => string
}

/**
 * Two or more series against time, drawn progressively — x IS mix time, which
 * is what makes "time it to the narration" literal. Optional annotations: a
 * measure bracket between the two series' current ends (when the GAP is the
 * story), and a marker pinned to a series.
 */
export const StageLineChart = forwardRef<
  { geom: () => { plot: PlotRect; xOf: (t: number) => number; yOf: (v: number) => number } },
  {
    series: ChartSeries[]
    window: { from: number; until: number }
    plotOf: (W: number, H: number) => PlotRect
    visible: boolean
    gap?: { at: number; until?: number; label: string }
    pin?: { at: number; label: string; seriesIdx: number }
  }
>(function StageLineChart({ series, window: win, plotOf, visible, gap, pin }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const domain = useMemo(() => {
    let tLo = Infinity
    let tHi = -Infinity
    let vHi = -Infinity
    for (const s of series)
      for (const p of s.points) {
        if (p.at < tLo) tLo = p.at
        if (p.at > tHi) tHi = p.at
        if (p.v > vHi) vHi = p.v
      }
    return { tLo, tHi, vLo: 0, vHi: vHi * 1.08 }
  }, [series])

  const geom = () => {
    const plot = plotOf(globalThis.innerWidth, globalThis.innerHeight)
    return {
      plot,
      xOf: (t: number) => plot.x + ((t - domain.tLo) / (domain.tHi - domain.tLo)) * plot.w,
      yOf: (v: number) => plot.y + plot.h - ((v - domain.vLo) / (domain.vHi - domain.vLo)) * plot.h,
    }
  }
  useImperativeHandle(ref, () => ({ geom }))

  /** The series' value at time t, linearly between its points. */
  const valueAt = (s: ChartSeries, t: number): number | null => {
    const pts = s.points
    if (!pts.length || t < pts[0].at) return null
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].at) {
        const a = pts[i - 1]
        const b = pts[i]
        const f = (t - a.at) / Math.max(0.0001, b.at - a.at)
        return a.v + (b.v - a.v) * f
      }
    }
    return pts[pts.length - 1].v
  }

  useStageFrame((t) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = fitCanvas(canvas)
    if (!ctx) return
    if (t < win.from || t >= win.until) return
    const g = geom()

    ctx.fillStyle = 'rgba(127,127,127,0.10)'
    for (let gy = g.plot.y + 18; gy < g.plot.y + g.plot.h; gy += 54)
      ctx.fillRect(g.plot.x, Math.round(gy), g.plot.w, 1)

    for (const s of series) {
      const drawn = s.points.filter((p) => p.at <= t)
      if (drawn.length < 1) continue
      const head = valueAt(s, t)
      const pts = [...drawn, ...(head !== null ? [{ at: t, v: head }] : [])]
      const past = s.altAt !== undefined && t >= s.altAt
      const fill = rgbOf(past && s.altColor ? s.altColor : s.color)

      if (s.kind === 'area') {
        // Column by column, so the fill grades from the floor like the bars do.
        for (let x = g.plot.x; x < g.xOf(pts[pts.length - 1].at); x += CELL) {
          const tt = domain.tLo + ((x - g.plot.x) / g.plot.w) * (domain.tHi - domain.tLo)
          const v = valueAt(s, Math.min(tt, t))
          if (v === null) continue
          const y = g.yOf(v)
          ditherRect(ctx, x, Math.round(y), CELL, Math.round(g.plot.y + g.plot.h - y), fill, true, 0.85, 0.16)
        }
      }

      // The line itself: solid for an area series, dotted for the front one.
      ctx.strokeStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},0.95)`
      ctx.lineWidth = 2
      if (s.kind === 'dotted') ctx.setLineDash([5, 5])
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = g.xOf(p.at)
        const y = g.yOf(p.v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setLineDash([])

      // The label rides the head of its own line: area above, dotted below, so
      // two labels cannot sit on top of each other while the lines are close.
      const last = pts[pts.length - 1]
      ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},1)`
      ctx.font = '600 12px ui-monospace, monospace'
      const lx = Math.min(g.xOf(last.at) + 8, g.plot.x + g.plot.w - 150)
      const ly = g.yOf(last.v) + (s.kind === 'area' ? -10 : 18)
      ctx.fillText(`${s.label}${s.format ? '  ' + s.format(last.v) : ''}`, lx, ly)
    }

    // The bracket: when the DISTANCE between two series is the point.
    if (gap && t >= gap.at && (gap.until === undefined || t < gap.until) && series.length >= 2) {
      const a = valueAt(series[0], t)
      const b = valueAt(series[1], t)
      if (a !== null && b !== null) {
        const x = Math.min(g.xOf(t), g.plot.x + g.plot.w - 8)
        const yA = g.yOf(a)
        const yB = g.yOf(b)
        ctx.strokeStyle = 'rgba(160,160,170,0.9)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x, yA)
        ctx.lineTo(x, yB)
        ctx.moveTo(x - 6, yA)
        ctx.lineTo(x + 6, yA)
        ctx.moveTo(x - 6, yB)
        ctx.lineTo(x + 6, yB)
        ctx.stroke()
        ctx.fillStyle = 'rgba(200,200,210,1)'
        ctx.font = '600 11px ui-monospace, monospace'
        ctx.fillText(gap.label, x - ctx.measureText(gap.label).width - 12, (yA + yB) / 2)
      }
    }

    if (pin && t >= pin.at) {
      const s = series[pin.seriesIdx] ?? series[0]
      const v = valueAt(s, pin.at)
      if (v !== null) {
        const x = g.xOf(pin.at)
        const y = g.yOf(v)
        ctx.fillStyle = 'rgba(230,230,240,1)'
        ctx.font = '700 12px ui-monospace, monospace'
        const w = ctx.measureText(pin.label).width
        ctx.fillText(pin.label, x - w / 2, y - 14)
      }
    }
  })

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    />
  )
})

/** A small marker that stands on a chart, positioned per frame from the same
 *  geometry the canvas drew with. */
export function StagePin({
  on,
  label,
  arrow = '▲',
  color = 'var(--positive)',
  borderColor,
  position,
}: {
  on: boolean
  label: string
  arrow?: string
  color?: string
  borderColor?: string
  /** Per-frame placement in viewport px; null leaves it where it was. */
  position: (t: number) => { left: number; top: number } | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  useStageFrame((t) => {
    const el = ref.current
    const pos = position(t)
    if (!el || !pos) return
    el.style.left = `${pos.left}px`
    el.style.top = `${pos.top}px`
  })
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-40 transition-all duration-300"
      style={{ opacity: on ? 1 : 0, transform: `translateX(-50%) scale(${on ? 1 : 0.6})` }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase"
        style={{ border: `1px solid ${borderColor ?? color}`, background: 'rgba(0,0,0,0.75)', color }}
      >
        <span className="text-[11px] leading-none">{arrow}</span> {label}
      </div>
    </div>
  )
}
