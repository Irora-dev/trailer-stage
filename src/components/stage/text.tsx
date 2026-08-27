'use client'

/**
 * Words on the set: free text, burned-in captions, and rows of chips.
 *
 * Captions are the MEASURED speech segments paired with the spoken words, never
 * eyeballed timings — most feeds play muted, and a caption that drifts from the
 * audio is worse than none. They are off unless the recorder asks for them
 * (`--captions`, which loads the stage with ?captions=1), so the main cut stays
 * clean and a social cut carries them.
 */

import { useState, type CSSProperties } from 'react'
import { useStageFrame } from './stage-shell'

// ── free text ───────────────────────────────────────────────────────────────

export type TextStyle = 'display' | 'headline' | 'plate' | 'pill' | 'eyebrow' | 'mono'

export function StageText({
  visible,
  text,
  style = 'mono',
  leftVw = 50,
  topVh,
  bottomVh,
  maxWidthCh = 52,
  sizePx,
  color,
  bg,
  font,
  weight,
  letterSpacing,
  canvasId,
}: {
  visible: boolean
  text: string
  style?: TextStyle
  leftVw?: number
  topVh?: number
  bottomVh?: number
  maxWidthCh?: number
  sizePx?: number
  color?: string
  bg?: string
  font?: string
  weight?: number
  letterSpacing?: string
  canvasId?: string
}) {
  const cls =
    style === 'display'
      ? 'font-bold tracking-tight'
      : style === 'headline'
        ? 'text-4xl font-bold tracking-tight'
        : style === 'plate'
          ? 'px-3 py-1 font-mono text-[11px] font-medium tracking-[0.26em] uppercase'
          : style === 'pill'
            ? 'rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-[0.12em] uppercase'
            : style === 'eyebrow'
              ? 'text-[12px] tracking-[0.22em] uppercase'
              : 'px-3.5 py-1.5 font-mono text-sm tracking-[0.06em]'

  const inline: CSSProperties = { textWrap: 'balance' }
  inline.color = color ?? (style === 'plate' || style === 'pill' ? 'var(--accent-ink)' : 'var(--ink)')
  if (bg) inline.background = bg
  else if (style === 'plate') inline.background = 'var(--accent)'
  else if (style === 'pill') inline.background = 'var(--accent)'
  if (sizePx) inline.fontSize = sizePx
  inline.fontFamily = font ?? (style === 'display' || style === 'headline' ? 'var(--font-display)' : 'var(--font-mono)')
  if (weight) inline.fontWeight = weight
  if (letterSpacing) inline.letterSpacing = letterSpacing

  const pos: CSSProperties = { left: `${leftVw}vw`, transform: 'translateX(-50%)' }
  if (bottomVh !== undefined) pos.bottom = `${bottomVh}vh`
  else pos.top = `${topVh ?? 50}vh`

  return (
    <div
      data-canvas-id={canvasId}
      className="pointer-events-none fixed z-40 flex justify-center text-center transition-all duration-700"
      style={{ ...pos, opacity: visible ? 1 : 0, maxWidth: `${maxWidthCh}ch`, translate: visible ? '0 0' : '0 8px' }}
    >
      <span className={cls} style={inline}>
        {text}
      </span>
    </div>
  )
}

// ── captions ────────────────────────────────────────────────────────────────

export type CaptionLine = { at: number; until: number; text: string }

export function StageCaptions({ lines, force = false, canvasId }: { lines: CaptionLine[]; force?: boolean; canvasId?: string }) {
  // Lazy init rather than setState-in-effect: the flag never changes within a
  // page's life, and the first markup is null either way (idx starts at -1), so
  // reading location here cannot cause a hydration mismatch.
  const [enabled] = useState(
    () => force || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('captions') === '1'),
  )
  const [idx, setIdx] = useState(-1)

  useStageFrame((t) => {
    const i = lines.findIndex((l) => t >= l.at && t < l.until)
    setIdx((p) => (p === i ? p : i))
  })

  if (!enabled || idx < 0) return null
  return (
    <div data-canvas-id={canvasId} className="pointer-events-none fixed inset-x-0 bottom-[7vh] z-40 flex justify-center px-6">
      <span
        className="max-w-[52ch] px-3.5 py-1.5 text-center font-mono text-[15px] leading-snug tracking-[0.02em]"
        style={{ background: 'rgba(0,0,0,0.78)', color: '#fff', textWrap: 'balance' }}
      >
        {lines[idx].text}
      </span>
    </div>
  )
}

// ── chip rows ───────────────────────────────────────────────────────────────

export type ChipItem = { label: string; on: boolean }

export function StageChipRow({
  items,
  hidden,
  style = 'stamp',
  bottomVh,
  canvasId,
}: {
  items: ChipItem[]
  /** The whole row leaves. */
  hidden: boolean
  /** 'stamp' lights each chip on its own cue; 'row' lifts them together. */
  style?: 'stamp' | 'row'
  bottomVh?: number
  canvasId?: string
}) {
  const anyOn = items.some((i) => i.on)
  const row = style === 'row'
  return (
    <div
      data-canvas-id={canvasId}
      className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 transition-all duration-500"
      style={{ bottom: `${bottomVh ?? (row ? 18 : 15)}vh`, opacity: row ? (anyOn && !hidden ? 1 : 0) : 1 }}
    >
      {items.map((chip, i) => (
        <span
          key={`${i}-${chip.label}`}
          className="rounded-md px-3.5 py-1.5 font-mono text-[11px] tracking-[0.12em] transition-all duration-400"
          style={{
            border: `1px solid ${row ? 'var(--line)' : 'var(--negative)'}`,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            opacity: row ? 1 : chip.on && !hidden ? 1 : 0,
            transform: row || chip.on ? 'none' : 'translateY(10px)',
          }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}
