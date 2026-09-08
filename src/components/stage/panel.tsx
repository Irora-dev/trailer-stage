'use client'

/**
 * The card: the frame most trailers put their subject inside, and the header
 * that identifies it.
 *
 * The card is one size for the whole cut (a "middle-card law"): every chart that
 * draws inside it mirrors the same rect, so canvas geometry and DOM layout
 * cannot drift apart. Change it per piece if you must, but change both.
 *
 * ⚠️ Centring lives in the inline `transform` ONLY. Tailwind's translate
 * utilities compile to the native `translate` property, which COMPOSES with a
 * transform instead of replacing it — a card centred twice sits half a card off,
 * while a canvas computing the same rect from the viewport still draws it
 * centred.
 */

import type { ReactNode } from 'react'

export function StageCard({
  visible,
  width = '86vw',
  height = '76vh',
  leftVw = 50,
  topVh = 50,
  opacity = 1,
  children,
}: {
  visible: boolean
  width?: string
  height?: string
  /** 0..1: a ghosted panel (a translucent portfolio haunting the trees). Multiplies the visible fade. */
  opacity?: number
  /** The card's CENTRE, in viewport units (50/50 = the middle of the stage). A chart
   *  drawn inside it passes the same pair to `plotFor`, so both move together. */
  leftVw?: number
  topVh?: number
  children?: ReactNode
}) {
  return (
    <div
      className="fixed z-20 overflow-hidden rounded-3xl transition-all duration-700 ease-out"
      style={{
        left: `${leftVw}vw`,
        top: `${topVh}vh`,
        width,
        height,
        opacity: visible ? opacity : 0,
        transform: `translate(-50%,-50%) scale(${visible ? 1 : 0.965})`,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 70px rgba(0,0,0,0.28)',
      }}
    >
      {children}
    </div>
  )
}

/** A live reading published by a chart piece and consumed by the header. */
export type Readout = { value: number; pct: number; total: number }

export type CardStat = {
  label: string
  value?: string
  /** Shown instead of `value` once the card's `altAt` gate has fired. */
  altValue?: string
  /** 'accent' paints the theme's accent ink; 'plain' is the quiet default. */
  tone?: 'plain' | 'accent'
  /** Read from the bound chart instead of a fixed string. */
  readout?: 'total' | 'scaled'
  /** Multiplier for a 'scaled' readout. */
  factor?: number
}

const fmt = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(2)

/** A number that changes on camera should read as a change: significant digits
 *  stay stable and the value pops rather than swapping silently. */
function Value({ value, className }: { value: number; className?: string }) {
  const text = value >= 1 ? value.toFixed(2) : value.toPrecision(3)
  return (
    <span key={text} className={`stage-pop ${className ?? ''}`}>
      {text}
    </span>
  )
}

export function StageCardHeader({
  identity,
  identityOn,
  rightOn,
  statsOn,
  alt,
  headline,
  readout,
  stats,
  prefix = '',
}: {
  identity: { name: string; sub: string; iconSrc?: string; emoji?: string }
  /** undefined = always on, no transition; a boolean drives the fade-in. */
  identityOn?: boolean
  rightOn?: boolean
  statsOn?: boolean
  /** The card's second state (a fall, a result): flips every accent. */
  alt: boolean
  headline?: { text: string; altText?: string; color?: string; altColor?: string }
  /** When bound to a chart, the header reads live instead of showing a headline. */
  readout?: Readout
  stats: CardStat[]
  /** Prepended to live values (a currency symbol, say). */
  prefix?: string
}) {
  const pctText = readout ? `${readout.pct >= 0 ? '+' : ''}${Math.round(readout.pct)}%` : ''
  const statValue = (s: CardStat) => {
    if (s.readout === 'total' && readout) return prefix + fmt(readout.total)
    if (s.readout === 'scaled' && readout) return prefix + fmt(readout.total * (s.factor ?? 1))
    return alt && s.altValue !== undefined ? s.altValue : (s.value ?? '')
  }
  const statCells = (s: CardStat) => (
    <>
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: 'var(--ink-faint)' }}>
        {s.label}
      </span>
      <span
        className="font-mono text-sm"
        style={{ color: alt ? 'var(--negative)' : s.tone === 'accent' ? 'var(--positive)' : 'var(--ink-dim)' }}
      >
        {statValue(s)}
      </span>
    </>
  )

  return (
    <div className="flex items-start justify-between px-7 pt-6">
      <div
        className="flex items-center gap-4 transition-all duration-500"
        style={
          identityOn === undefined
            ? undefined
            : { opacity: identityOn ? 1 : 0, transform: identityOn ? 'none' : 'translateY(10px)' }
        }
      >
        {identity.iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={identity.iconSrc}
            alt=""
            data-stage-asset
            className="h-16 w-16 rounded-full"
            style={{ border: '1px solid var(--line)', boxShadow: '0 6px 24px rgba(0,0,0,0.28)' }}
          />
        ) : identity.emoji ? (
          <div
            className="grid h-16 w-16 place-items-center rounded-full text-4xl"
            style={{ border: '1px solid var(--line)', background: 'var(--panel-2)' }}
          >
            {identity.emoji}
          </div>
        ) : null}
        <div>
          <div className="text-4xl font-bold tracking-tight" style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            {identity.name}
          </div>
          <div className="mt-1 font-mono text-xs tracking-[0.18em] uppercase" style={{ color: 'var(--ink-faint)' }}>
            {identity.sub}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div
          className="transition-all duration-500"
          style={rightOn === undefined ? undefined : { opacity: rightOn ? 1 : 0, transform: rightOn ? 'none' : 'translateY(-8px)' }}
        >
          {readout ? (
            <>
              <Value
                value={readout.value}
                className="text-5xl font-semibold tracking-tight"
              />
              <span className="ml-3 align-middle text-base font-semibold" style={{ color: alt ? 'var(--negative)' : 'var(--positive)' }}>
                {pctText}
              </span>
            </>
          ) : headline ? (
            <span
              className="text-5xl font-semibold tracking-tight"
              style={{
                fontFamily: 'var(--font-display)',
                color: alt ? (headline.altColor ?? 'var(--negative)') : (headline.color ?? 'var(--positive)'),
              }}
            >
              {alt && headline.altText !== undefined ? headline.altText : headline.text}
            </span>
          ) : null}
        </div>
        {stats.length > 0 && (
          <div
            className={`flex items-baseline transition-opacity duration-500 ${stats.length > 1 ? 'gap-4' : 'gap-2'}`}
            style={statsOn === undefined ? undefined : { opacity: statsOn ? 1 : 0 }}
          >
            {stats.length === 1
              ? statCells(stats[0])
              : stats.map((s) => (
                  <span key={s.label} className="flex items-baseline gap-2">
                    {statCells(s)}
                  </span>
                ))}
          </div>
        )}
      </div>
    </div>
  )
}
