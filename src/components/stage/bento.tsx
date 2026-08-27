'use client'

/**
 * Weighted tiles, and the fold.
 *
 * BENTO lays a composition out as a squarified treemap: area is weight, so a
 * viewer reads the shape of the thing in one glance. Comparing areas of roughly
 * square tiles is easy; comparing angles of a pie is not, which is why there is
 * no pie here.
 *
 * GROUP FOLD is the argument a lot of products need to make: many items, spread
 * across groups, become ONE thing per group. It plays in four acts on the stage
 * clock — the grid, the gather into columns, the fold into one card per group,
 * the settle under a single name — each a CSS transition off a cue, so a retake
 * is the same take.
 */

import { useMemo } from 'react'
import { readableInk } from '@/lib/dither'
import { squarify } from '@/lib/tape'

export type BentoItem = { label: string; weightPct: number; color: string; logo?: string }

/** A stable 0..1 from a string, for per-tile sheen phase (never Math.random:
 *  a glint that moves between takes breaks frame comparison). */
function hashUnit(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const darken = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  const f = 0.62
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`
}

const VW = 1000 // treemap's own coordinate space

export function StageBento({
  items,
  show,
  locked = false,
  scatter = false,
  aspect = 1.9,
  className = '',
  approxWidthPx = 900,
}: {
  items: BentoItem[]
  show: boolean
  /** Stamp each tile as settled. */
  locked?: boolean
  /** The tiles fly apart, away from the centre. */
  scatter?: boolean
  aspect?: number
  className?: string
  /** Approximate rendered width in px, for size-derived type and logos. */
  approxWidthPx?: number
}) {
  const VH = VW / aspect
  // Area follows weight^0.65 rather than weight: a raw-area treemap makes small
  // holdings unreadably thin, and the label stops fitting long before the tile
  // stops mattering.
  const rects = useMemo(
    () => squarify(items.map((a) => ({ id: a.label, weight: Math.pow(Math.max(a.weightPct, 0.0001), 0.65) })), VW, VH),
    [items, VH],
  )
  const byLabel = useMemo(() => new Map(items.map((a) => [a.label, a])), [items])
  const rank = useMemo(() => {
    const m = new Map<string, number>()
    ;[...items].sort((a, b) => b.weightPct - a.weightPct).forEach((a, i) => m.set(a.label, i))
    return m
  }, [items])

  const cW = approxWidthPx
  const cH = cW / aspect

  return (
    <div className={`relative w-full overflow-visible ${className}`} style={{ aspectRatio: String(aspect) }}>
      {rects.map((r) => {
        const a = byLabel.get(r.id)
        if (!a) return null
        const i = rank.get(r.id) ?? 0
        const ink = readableInk(a.color)
        const bW = (r.w / VW) * cW
        const bH = (r.h / VH) * cH
        const minDim = Math.min(bW, bH)
        const tickerFont = clamp(minDim * 0.15, 7, 16)
        const weightFont = clamp(minDim * 0.17, 8, 15)
        const logoSize = Math.round(clamp(minDim * 0.42, 14, 44))
        const showLogo = !!a.logo && minDim > 46 && bW > 50
        const seed = hashUnit(a.label)
        const sheenBand = clamp(4 + ((minDim - 30) / 170) * 6, 4, 10)
        const sheenDur = 9 + seed * 5
        // Scatter vector: straight out from the centre of the board.
        const cx = (r.x + r.w / 2) / VW - 0.5
        const cy = (r.y + r.h / 2) / VH - 0.5
        const mag = Math.hypot(cx, cy) || 0.3
        return (
          <div
            key={r.id}
            className="absolute p-0.5"
            style={{
              left: `${(r.x / VW) * 100}%`,
              top: `${(r.y / VH) * 100}%`,
              width: `${(r.w / VW) * 100}%`,
              height: `${(r.h / VH) * 100}%`,
              opacity: scatter ? 0 : show ? 1 : 0,
              transform: scatter
                ? `translate(${(cx / mag) * 80}vw, ${(cy / mag) * 60}vh) rotate(${cx * 30}deg) scale(0.9)`
                : show
                  ? 'scale(1)'
                  : 'scale(0.82)',
              transition: scatter
                ? `opacity 900ms ease ${i * 140}ms, transform 1100ms cubic-bezier(0.5,0,0.8,0.4) ${i * 140}ms`
                : `opacity 400ms ease ${i * 120}ms, transform 500ms cubic-bezier(0.34,1.56,0.64,1) ${i * 120}ms`,
            }}
          >
            <div
              className="relative h-full w-full overflow-hidden rounded-xl"
              style={{ background: a.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -3px 7px rgba(0,0,0,0.22)' }}
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 34%, rgba(0,0,0,0.16))' }}
              />
              <div
                aria-hidden
                className="stage-sheen absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(115deg, transparent ${(50 - sheenBand).toFixed(1)}%, rgba(255,255,255,0.14) 50%, transparent ${(50 + sheenBand).toFixed(1)}%)`,
                  animationDuration: `${sheenDur.toFixed(1)}s`,
                  animationDelay: `${(-seed * sheenDur).toFixed(2)}s`,
                }}
              />
              <div className="relative flex h-full flex-col justify-between p-2">
                <div className="flex items-start justify-between gap-1">
                  <span className="font-bold tracking-wide uppercase" style={{ color: ink, fontSize: tickerFont }}>
                    {a.label}
                  </span>
                  {showLogo && (
                    <span
                      className="grid shrink-0 place-items-center rounded-full"
                      style={{ width: logoSize, height: logoSize, background: darken(a.color), boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.logo} alt="" data-stage-asset className="rounded-full" style={{ width: logoSize * 0.74, height: logoSize * 0.74 }} />
                    </span>
                  )}
                </div>
                <span className="font-mono" style={{ color: ink, opacity: 0.85, fontSize: weightFont }}>
                  {a.weightPct}%{locked && !scatter && <span className="ml-1.5 align-middle opacity-70">●</span>}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── the fold ────────────────────────────────────────────────────────────────

export type FoldGroup = {
  id: string
  label: string
  color: string
  /** A public image path for the group's mark; falls back to the initial. */
  mark?: string
  /** What the folded card is called (defaults to the fold's own ticker). */
  ticker?: string
  items: BentoItem[]
}

export type FoldStage = 'hidden' | 'grid' | 'gather' | 'fold' | 'settle'

const ORDER: FoldStage[] = ['hidden', 'grid', 'gather', 'fold', 'settle']
const past = (stage: FoldStage, s: FoldStage) => ORDER.indexOf(stage) >= ORDER.indexOf(s)

// Board geometry, in viewport units.
const BOARD = { left: 7, top: 12, width: 86, height: 76 }
const GRID_COLS = 5
const GAP = 1.0
const COL_GAP = 2.4

function GroupMark({ group, size = 20 }: { group: FoldGroup; size?: number }) {
  if (group.mark)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={group.mark} alt="" data-stage-asset style={{ width: size, height: size }} className="rounded-full" />
  return (
    <span
      className="grid place-items-center rounded-full font-bold"
      style={{ width: size, height: size, background: group.color, color: readableInk(group.color), fontSize: size * 0.5 }}
    >
      {group.label.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function StageGroupFold({
  groups,
  stage,
  name,
  ticker,
  unit = 'token',
}: {
  groups: FoldGroup[]
  stage: FoldStage
  /** The name everything settles under. */
  name: string
  ticker: string
  /** What one folded thing is called ("token", "app", "endpoint"). */
  unit?: string
}) {
  const all = groups.flatMap((g) => g.items.map((a) => ({ ...a, group: g.id })))
  const n = all.length
  const rows = Math.ceil(n / GRID_COLS)
  const gridTileW = (BOARD.width - GAP * (GRID_COLS - 1)) / GRID_COLS
  const gridH = BOARD.height - 14
  const gridTileH = (gridH - GAP * 1.6 * (rows - 1)) / rows
  const colW = (BOARD.width - COL_GAP * (groups.length - 1)) / groups.length
  const maxPerCol = Math.max(1, ...groups.map((g) => g.items.length))
  const stackTop = BOARD.top + 12
  const stackTileH = (BOARD.height - 24 - 1.2 * (maxPerCol - 1)) / maxPerCol

  const visible = stage !== 'hidden'
  const gathered = past(stage, 'gather')
  const folded = past(stage, 'fold')
  const settled = past(stage, 'settle')

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0, fontFamily: 'var(--font-body)', color: 'var(--ink)' }}
    >
      <div className="fixed left-1/2 flex items-center gap-3 transition-all duration-700" style={{ top: '5.5vh', transform: 'translateX(-50%)' }}>
        <span
          className="rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.22em] uppercase"
          style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ink-dim)' }}
        >
          {settled
            ? `one ${name} · ${groups.length} ${unit}s · ${n} parts`
            : folded
              ? `${groups.length} ${unit}s`
              : gathered
                ? `${groups.length} groups`
                : `${n} parts`}
        </span>
      </div>

      {groups.map((g, ci) => {
        const colLeft = BOARD.left + ci * (colW + COL_GAP)
        const pct = g.items.reduce((s, a) => s + a.weightPct, 0)
        const cardStyle = folded
          ? {
              left: `${colLeft}vw`,
              top: settled ? `${BOARD.top + 24}vh` : `${stackTop}vh`,
              width: `${colW}vw`,
              height: settled ? '34vh' : '46vh',
              opacity: 1,
              transform: 'none',
            }
          : {
              left: `${colLeft}vw`,
              top: `${BOARD.top + 3}vh`,
              width: `${colW}vw`,
              height: '7vh',
              opacity: gathered ? 1 : 0,
              transform: gathered ? 'none' : 'translateY(-1vh)',
            }
        return (
          <div
            key={g.id}
            className="fixed overflow-hidden rounded-2xl transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              ...cardStyle,
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              boxShadow: folded ? '0 24px 70px rgba(0,0,0,0.16)' : '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex h-[7vh] items-center gap-2.5 px-4">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                style={{ background: `${g.color}1a`, border: `1px solid ${g.color}33` }}
              >
                <GroupMark group={g} size={17} />
              </span>
              <span className="text-[13px] font-semibold tracking-[0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
                {g.label}
              </span>
              <span className="ml-auto font-mono text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--ink-dim)' }}>
                {folded ? `1 ${unit}` : `${g.items.length} · ${Math.round(pct)}%`}
              </span>
            </div>
            <div
              className="flex flex-col items-center justify-center px-5 transition-all duration-700"
              style={{ height: 'calc(100% - 7vh)', opacity: folded ? 1 : 0, transform: folded ? 'none' : 'translateY(12px)' }}
            >
              <div
                className="grid place-items-center rounded-full"
                style={{
                  width: settled ? '11vh' : '15vh',
                  height: settled ? '11vh' : '15vh',
                  background: `linear-gradient(160deg, ${g.color}, ${g.color}99)`,
                  boxShadow: `0 14px 34px ${g.color}55, inset 0 2px 0 rgba(255,255,255,.55)`,
                  transition: 'all 700ms ease',
                }}
              >
                <span className="grid place-items-center rounded-full" style={{ width: '64%', height: '64%', background: 'var(--panel)' }}>
                  <GroupMark group={g} size={settled ? 34 : 46} />
                </span>
              </div>
              <div className="mt-3 text-[clamp(18px,2.4vw,30px)] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {g.ticker ?? ticker}
              </div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: 'var(--ink-dim)' }}>
                one {unit} on {g.label}
              </div>
              <div className="mt-4 flex h-2 w-[78%] overflow-hidden rounded-full" style={{ background: 'var(--panel-2)' }}>
                {g.items.map((a) => (
                  <span key={a.label} style={{ width: `${(a.weightPct / Math.max(pct, 0.001)) * 100}%`, background: a.color }} />
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {all.map((a, i) => {
        const ci = groups.findIndex((g) => g.id === a.group)
        const ri = groups[ci].items.findIndex((x) => x.label === a.label)
        const gx = BOARD.left + (i % GRID_COLS) * (gridTileW + GAP)
        const gy = BOARD.top + 6 + Math.floor(i / GRID_COLS) * (gridTileH + GAP * 1.6)
        const colLeft = BOARD.left + ci * (colW + COL_GAP)
        const sy = stackTop + 8 + ri * (stackTileH + 1.2)
        const ink = readableInk(a.color)
        const style = folded
          ? { left: `${colLeft + colW / 2}vw`, top: `${stackTop + 20}vh`, width: '2vw', height: '2vh', opacity: 0, transform: 'scale(0.4)' }
          : gathered
            ? { left: `${colLeft}vw`, top: `${sy}vh`, width: `${colW}vw`, height: `${stackTileH}vh`, opacity: 1, transform: 'none' }
            : {
                left: `${gx}vw`,
                top: `${gy}vh`,
                width: `${gridTileW}vw`,
                height: `${gridTileH}vh`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'scale(0.9)',
              }
        return (
          <div
            key={`${a.group}-${a.label}`}
            className="fixed overflow-hidden rounded-xl transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              ...style,
              transitionDelay: `${(i % GRID_COLS) * 40 + Math.floor(i / GRID_COLS) * 30}ms`,
              background: a.color,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -3px 7px rgba(0,0,0,0.22)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 34%, rgba(0,0,0,0.16))' }}
            />
            <div className={`relative flex h-full ${gathered ? 'flex-row items-center justify-between px-3' : 'flex-col justify-between p-2.5'}`}>
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide uppercase"
                style={{ background: 'rgba(255,255,255,0.92)', color: '#171821' }}
              >
                {a.label}
              </span>
              <span className="font-mono text-[12px] font-semibold" style={{ color: ink, opacity: 0.9 }}>
                {a.weightPct}%
              </span>
            </div>
          </div>
        )
      })}

      <div
        className="fixed left-1/2 flex flex-col items-center transition-all duration-700"
        style={{ top: `${BOARD.top + 6}vh`, transform: 'translateX(-50%)', opacity: settled ? 1 : 0, transitionDelay: settled ? '500ms' : '0ms' }}
      >
        <div className="text-[clamp(26px,3.6vw,46px)] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {name}
        </div>
        <div className="mt-1.5 font-mono text-[12px] tracking-[0.22em] uppercase" style={{ color: 'var(--ink-dim)' }}>
          {ticker} · {groups.length} groups · {n} parts · one flow
        </div>
      </div>
    </div>
  )
}
