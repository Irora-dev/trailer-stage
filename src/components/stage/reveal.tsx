'use client'

/**
 * The brand's arrival, and the card the cut ends on.
 *
 * The reveal is staged rather than dropped: the mark flies in at the centre of
 * frame and rises to its resting place, then the wordmark, the plate, the
 * credit line, and an optional input bar that types a question. Each stage is
 * its own cue, so the whole thing is timed to the narration rather than to a
 * guessed duration.
 *
 * ⚠️ The fly-in distance is MEASURED at ready-time from the laid-out stack (the
 * `--mark-fly` custom property) with a 0px fallback, never a guessed number:
 * scaling about the default centre origin keeps the element's centre where
 * layout put it, so the measurement reads the resting position even while the
 * element carries the transform that will animate it.
 */

import { useRef } from 'react'
import { useStageReady } from './stage-shell'

export function StageLogoReveal({
  mark,
  markUp,
  wordmark,
  plate,
  powered,
  extra,
  bar,
  entered,
  morphOut,
  logoSrc,
  wordmarkText,
  plateText,
  poweredText,
  extraText,
  query = '',
  typedQuery = 0,
  placeholder = '',
}: {
  mark: boolean
  markUp: boolean
  wordmark: boolean
  plate: boolean
  powered: boolean
  extra?: boolean
  bar: boolean
  entered: boolean
  morphOut: boolean
  logoSrc?: string
  wordmarkText: string
  plateText?: string
  poweredText?: string
  extraText?: string
  query?: string
  typedQuery?: number
  placeholder?: string
}) {
  const markWrapRef = useRef<HTMLDivElement>(null)

  useStageReady(() => {
    const wrap = markWrapRef.current
    if (!wrap) return
    const r = wrap.getBoundingClientRect()
    const dy = globalThis.innerHeight / 2 - (r.top + r.height / 2)
    wrap.style.setProperty('--mark-fly', `${Math.round(dy)}px`)
  })

  const rise = (on: boolean) => ({ opacity: on ? 1 : 0, transform: on ? 'none' : 'translateY(10px)' })

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center px-4 transition-opacity duration-700"
      style={{ opacity: morphOut ? 0 : 1 }}
    >
      <div
        ref={markWrapRef}
        className="transition-all duration-[900ms] ease-out"
        style={{
          opacity: mark ? 1 : 0,
          transform: markUp ? 'none' : `translateY(var(--mark-fly, 0px)) scale(1.6)`,
        }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" data-stage-asset className="h-20 w-20 md:h-24 md:w-24" style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,.35))' }} />
        ) : (
          <div
            className="grid h-20 w-20 place-items-center rounded-2xl md:h-24 md:w-24"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700 }}
          >
            {wordmarkText.slice(0, 1)}
          </div>
        )}
      </div>

      <h1
        className="mt-5 mb-3 text-5xl font-bold tracking-tight transition-all duration-700 md:text-7xl"
        style={{ ...rise(wordmark), fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
      >
        {wordmarkText}
      </h1>

      {plateText ? (
        <span
          className="inline-block px-3 py-1 font-mono text-[11px] font-medium tracking-[0.26em] uppercase transition-all duration-500 sm:text-xs sm:tracking-[0.34em]"
          style={{ ...rise(plate), background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {plateText}
        </span>
      ) : null}

      {poweredText ? (
        <p className="mt-4 text-sm transition-all duration-500" style={{ ...rise(powered), color: 'var(--ink-dim)' }}>
          {poweredText}
        </p>
      ) : null}

      {extraText ? (
        <p
          className="mt-4 max-w-[46ch] text-center text-base transition-all duration-500"
          style={{ ...rise(!!extra), color: 'var(--ink-dim)', textWrap: 'balance' }}
        >
          {extraText}
        </p>
      ) : null}

      {query || placeholder ? (
        <div
          className="mt-7 flex w-[min(560px,86vw)] items-center gap-3 rounded-full px-5 py-3 transition-all duration-500"
          style={{
            ...rise(bar),
            background: 'var(--panel)',
            border: `1px solid ${entered ? 'var(--accent)' : 'var(--line)'}`,
            boxShadow: entered ? '0 10px 30px rgba(0,0,0,0.18)' : 'none',
          }}
        >
          <span className="font-mono text-sm" style={{ color: query ? 'var(--ink)' : 'var(--ink-faint)' }}>
            {query ? query.slice(0, typedQuery) : placeholder}
            {query && typedQuery < query.length ? <span style={{ opacity: 0.6 }}>|</span> : null}
          </span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The end card. `url` is optional and OFF by default: a trailer that bakes in an
 * address outlives the mistake if the address changes, so a cut ships without
 * one until somebody decides.
 */
export function StageEndCard({
  visible,
  logoSrc,
  wordmarkText,
  plateText,
  url,
  chips = [],
  note = '',
  canvasId,
}: {
  visible: boolean
  logoSrc?: string
  wordmarkText: string
  plateText?: string
  url?: string
  chips?: string[]
  note?: string
  canvasId?: string
}) {
  return (
    <div
      data-canvas-id={canvasId}
      className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-4 transition-all duration-700 ease-out"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(14px) scale(0.99)' }}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" data-stage-asset className="h-16 w-16 md:h-20 md:w-20" />
      ) : null}
      <h1 className="mt-5 mb-3 text-5xl font-bold tracking-tight md:text-7xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        {wordmarkText}
      </h1>
      {plateText ? (
        <span
          className="inline-block px-3 py-1 font-mono text-[11px] font-medium tracking-[0.26em] uppercase sm:text-xs sm:tracking-[0.34em]"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {plateText}
        </span>
      ) : null}
      {note ? (
        <p className="mt-5 font-mono text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--ink-dim)' }}>
          {note}
        </p>
      ) : null}
      {chips.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="px-3.5 py-1.5 font-mono text-[11px] tracking-[0.16em] uppercase"
              style={{ border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink-dim)' }}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      {url ? (
        <p className="mt-4 font-mono text-sm tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
          {url}
        </p>
      ) : null}
    </div>
  )
}
