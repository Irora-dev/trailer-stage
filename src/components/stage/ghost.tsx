'use client'
import { useMemo, useRef } from 'react'
import { useStageFrame } from './stage-shell'

/**
 * A chart that lives IN the scene: a chrome-less falling line and a counting number, blended and
 * blurred into the footage behind it. Colby, 2026-09-08: "a chart design blended into the background
 * amongst the trees, a number and a line going down as he runs", never a UI panel in the foreground.
 * Deterministic: the line's jitter is a fixed table, no randomness. The line draws and the number
 * counts from `from` to `to` across the clip's own span on the stage clock.
 */
const JITTER = [0.02, -0.03, 0.05, -0.01, 0.04, -0.06, 0.03, -0.02, 0.06, -0.04, 0.02, -0.05, 0.04, -0.03, 0.05, -0.02, 0.03]
const W = 1000
const H = 600

export function StageGhostChart({
  visible,
  at,
  until,
  from,
  to,
  prefix = '$',
  decimals = 0,
  pct,
  color = '#ff6b6b',
  opacity = 0.32,
  blur = 1.2,
  blend = 'screen',
  leftVw = 74,
  topVh = 32,
  widthVw = 36,
  heightVh = 34,
  label,
}: {
  visible: boolean
  at: number
  until: number
  from: number
  to: number
  prefix?: string
  decimals?: number
  pct?: number
  color?: string
  opacity?: number
  blur?: number
  blend?: string
  leftVw?: number
  topVh?: number
  widthVw?: number
  heightVh?: number
  label?: string
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const numRef = useRef<HTMLDivElement>(null)
  const pctRef = useRef<HTMLDivElement>(null)
  const d = useMemo(() => {
    const n = JITTER.length
    return JITTER.map((j, i) => {
      const x = (i / (n - 1)) * W
      const base = i / (n - 1)
      const y = Math.max(24, Math.min(H - 24, 70 + base * base * (H - 140) + j * 170))
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }, [])
  useStageFrame((t) => {
    const span = Math.max(0.1, until - at)
    const u = Math.max(0, Math.min(1, (t - at) / span))
    const p = pathRef.current
    if (p) {
      const L = p.getTotalLength()
      p.style.strokeDasharray = `${L}`
      p.style.strokeDashoffset = `${L * (1 - u)}`
    }
    if (numRef.current) {
      const v = from + (to - from) * u
      numRef.current.textContent = prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }
    if (pctRef.current && pct !== undefined) {
      const pv = pct * u
      pctRef.current.textContent = `${pv < 0 ? '−' : '+'}${Math.abs(pv).toFixed(1)}%`
    }
  })
  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
  return (
    <div
      className="fixed z-10 pointer-events-none transition-opacity duration-700 ease-out"
      style={{
        left: `${leftVw}vw`,
        top: `${topVh}vh`,
        width: `${widthVw}vw`,
        height: `${heightVh}vh`,
        transform: 'translate(-50%,-50%)',
        opacity: visible ? opacity : 0,
        mixBlendMode: blend as never,
        filter: `blur(${blur}px)`,
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <path ref={pathRef} d={d} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 16px ${color})` }} />
      </svg>
      <div ref={numRef} style={{ position: 'absolute', left: 0, top: '-0.6em', fontFamily: mono, fontSize: '4.4vw', fontWeight: 300, color, letterSpacing: '-0.02em', textShadow: `0 0 28px ${color}`, whiteSpace: 'nowrap' }} />
      {pct !== undefined && (
        <div ref={pctRef} style={{ position: 'absolute', right: 0, bottom: '-0.2em', fontFamily: mono, fontSize: '3vw', fontWeight: 300, color, textShadow: `0 0 28px ${color}`, whiteSpace: 'nowrap' }} />
      )}
      {label && (
        <div style={{ position: 'absolute', left: 0, bottom: '-1.6em', fontFamily: mono, fontSize: '0.95vw', letterSpacing: '0.14em', textTransform: 'uppercase', color, opacity: 0.85, whiteSpace: 'nowrap' }}>{label}</div>
      )}
    </div>
  )
}
