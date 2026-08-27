'use client'

/**
 * Pictures that move: a still, an actor standing on a chart, a sprite stepped by
 * the stage clock, and the cut between acts.
 *
 * ⚠️ A SPRITE IS DETERMINISTIC AND A VIDEO IS NOT. Video playback rides wall
 * time, so two takes of the same trailer differ slightly wherever a video is on
 * screen — which is exactly the noise that makes a frame comparison useless. If
 * a thing must be identical across takes, make it a sprite: it steps frames off
 * the stage clock and lands on the same cell every time.
 */

import { useRef, useState, type CSSProperties } from 'react'
import { mulberry32 } from '@/lib/tape'
import { useStageFrame } from './stage-shell'

/** A still, placed and sized in viewport units. */
export function StageImage({
  visible,
  src,
  widthVw = 40,
  leftVw = 50,
  topVh = 50,
  rounded = 16,
  shadow = true,
  canvasId,
}: {
  visible: boolean
  src: string
  widthVw?: number
  leftVw?: number
  topVh?: number
  rounded?: number
  shadow?: boolean
  canvasId?: string
}) {
  return (
    <div
      data-canvas-id={canvasId}
      className="pointer-events-none fixed z-30 transition-all duration-700"
      style={{
        left: `${leftVw}vw`,
        top: `${topVh}vh`,
        width: `${widthVw}vw`,
        transform: `translate(-50%,-50%) scale(${visible ? 1 : 0.97})`,
        opacity: visible ? 1 : 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        data-stage-asset
        className="w-full"
        style={{ borderRadius: rounded, boxShadow: shadow ? '0 24px 70px rgba(0,0,0,0.28)' : 'none' }}
      />
    </div>
  )
}

/**
 * An alpha-keyed video positioned imperatively per frame — actors stand ON
 * things (a candle, a card edge), so their position comes from the same
 * geometry the canvas drew with, not from CSS that only approximates it.
 *
 * Encode the clip with a crop taken from the union of bright pixels across ALL
 * frames, never a single frame: an arm that swings outside frame one gets
 * amputated by a one-frame crop, and it is only visible in the footage.
 */
export function StageVideoActor({
  src,
  visible,
  playAt,
  pauseAt,
  position,
}: {
  src: string
  visible: boolean
  playAt: number
  pauseAt?: number
  /** Per-frame placement in viewport px; null leaves it where it was. */
  position: (t: number) => { left: number; top: number; width: number; height: number } | null
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const started = useRef(false)

  useStageFrame((t) => {
    const el = ref.current
    if (!el) return
    if (!started.current && t >= playAt) {
      started.current = true
      void el.play().catch(() => {})
    }
    if (pauseAt !== undefined && t >= pauseAt && !el.paused) el.pause()
    const pos = position(t)
    if (pos) {
      el.style.left = `${pos.left}px`
      el.style.top = `${pos.top}px`
      el.style.width = `${pos.width}px`
      el.style.height = `${pos.height}px`
    }
  })

  return (
    <video
      ref={ref}
      src={src}
      data-stage-asset
      muted
      playsInline
      loop
      preload="auto"
      className="pointer-events-none fixed z-40 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0, maxWidth: 'none' }}
    />
  )
}

/**
 * A sprite stepped off the STAGE CLOCK, from a horizontal strip atlas: `frames`
 * cells of frameW x frameH, left to right. Pixel-true (no smoothing), readiness
 * gated through a hidden probe image so the recorder waits for the sheet like
 * any other asset.
 */
export function StageSprite({
  src,
  frames,
  frameW,
  frameH,
  fps = 10,
  from = 0,
  until,
  loop = true,
  scale = 1,
  className = '',
  style,
}: {
  src: string
  frames: number
  frameW: number
  frameH: number
  fps?: number
  from?: number
  until?: number
  loop?: boolean
  scale?: number
  className?: string
  style?: CSSProperties
}) {
  const [idx, setIdx] = useState(0)

  // One state change per FRAME CHANGE, never per rAF tick: at 10fps that is ten
  // renders a second rather than sixty.
  useStageFrame((t) => {
    const end = until ?? Number.POSITIVE_INFINITY
    const tt = Math.min(t, end)
    if (tt < from) return setIdx((p) => (p === 0 ? p : 0))
    const step = Math.floor((tt - from) * fps)
    const next = loop ? step % frames : Math.min(step, frames - 1)
    setIdx((p) => (p === next ? p : next))
  })

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" data-stage-asset aria-hidden className="pointer-events-none absolute h-px w-px opacity-0" />
      <div
        className={className}
        style={{
          width: frameW * scale,
          height: frameH * scale,
          backgroundImage: `url(${src})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${frames * frameW * scale}px ${frameH * scale}px`,
          backgroundPosition: `${-idx * frameW * scale}px 0`,
          imageRendering: 'pixelated',
          ...style,
        }}
      />
    </>
  )
}

/**
 * The cut between acts: a short burst of static, a scanline jump, a flash that
 * decays. Deterministic — the noise field is seeded per (burst, frame), because
 * Math.random would make every retake a different take.
 */
export function StageChannelFlip({ at, durationMs = 400 }: { at: number[]; durationMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useStageFrame((t) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dur = durationMs / 1000
    const i = at.findIndex((a) => t >= a && t < a + dur)
    const W = globalThis.innerWidth
    const H = globalThis.innerHeight
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    ctx.clearRect(0, 0, W, H)
    if (i < 0) {
      canvas.style.opacity = '0'
      return
    }
    const f = (t - at[i]) / dur // 0..1 through the burst
    canvas.style.opacity = String(1 - f * f)
    const rnd = mulberry32(1000 * (i + 1) + Math.floor(f * 24))
    // Bands of noise rather than per-pixel: cheaper, and it reads as a signal
    // dropping out rather than as sand.
    const bands = 90
    for (let b = 0; b < bands; b++) {
      const y = (b / bands) * H + rnd() * 6
      const h = 2 + rnd() * 7
      const a = 0.05 + rnd() * 0.35
      ctx.fillStyle = `rgba(${200 + Math.floor(rnd() * 55)},${200 + Math.floor(rnd() * 55)},${210 + Math.floor(rnd() * 45)},${a})`
      ctx.fillRect(rnd() * W * 0.2 - W * 0.1, y, W * (0.9 + rnd() * 0.3), h)
    }
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - f)})`
    ctx.fillRect(0, 0, W, H)
  })

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[45]" style={{ opacity: 0 }} />
}
