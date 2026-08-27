'use client'

/**
 * THE GENERIC RENDERER — one component that plays any timeline.
 *
 * A trailer is a JSON file. Every clip whose params name a `piece` is rendered
 * here through the components in this folder, so a new trailer needs no code at
 * all: the studio edits the file, the recorder films it, and a compiler can
 * write one from a brief. The vocabulary is documented in lib/pieces.ts.
 *
 * Laws that hold this together:
 *  · A piece is ON while its clip is active. Every clip is a cue (its id), and a
 *    clip with `until` owns an end cue, so "visible while active" works in the
 *    latching playback machine AND under the editor's bidirectional scrub —
 *    both are just cues, and the shell never learns what a piece is.
 *  · A piece's booleans are SYNTHETIC CUES (`deriveCues`), so live retiming in
 *    the editor moves a reveal's stages exactly as it moves a plain beat.
 *  · Pieces never reach for each other's refs. A chart publishes its geometry
 *    and its live reading to a small store; a header, an actor or a marker
 *    subscribes. One direction, no cycles, no ordering assumptions.
 *  · Determinism: seeded series only, no clocks of its own.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { StageShell, useStageFrame, useStagePhases, useStageTyping } from './stage-shell'
import { StageCard, StageCardHeader, type CardStat, type Readout } from './panel'
import { StageMarketTape, StageLineChart, StagePin, plotFor, type ChartSeries, type TapeGeometry } from './charts'
import { StageBento, StageGroupFold, type BentoItem, type FoldGroup, type FoldStage } from './bento'
import { StageLogoReveal, StageEndCard } from './reveal'
import { StageText, StageCaptions, StageChipRow, type ChipItem, type TextStyle } from './text'
import { StageImage, StageVideoActor, StageSprite, StageChannelFlip } from './media'
import { StageBrowserFrame, type FrameDrive } from './browser-frame'
import type { DitherColor } from '@/lib/dither'
import { captionsOf, endCue, type ParamValue, type TimelineClip, type TrailerTimeline } from '@/lib/timeline'
import {
  arr,
  bool,
  buildTapeFromSpec,
  deriveStage,
  gateName,
  num,
  obj,
  optNum,
  optStr,
  pieceOf,
  resolveTime,
  str,
  timeRef,
  type BuiltTape,
  type DerivedStage,
  type Params,
} from '@/lib/pieces'

// ── the chart store: geometry and live readings, published by a chart ────────

type Snap = { value: number; pct: number; total: number; done: number; crash: number; head: number }
const EMPTY: Snap = { value: 0, pct: 0, total: 0, done: 0, crash: 0, head: 0 }

class ChartStore {
  geom: (() => TapeGeometry | null) | null = null
  tape: BuiltTape | null = null
  private snap: Snap = EMPTY
  private listeners = new Set<() => void>()
  attach = (tape: BuiltTape | null, geom: () => TapeGeometry | null) => {
    this.tape = tape
    this.geom = geom
    if (tape) this.set({ value: tape.base, pct: 0, total: tape.base * tape.supply, done: 0, crash: 0, head: 0 })
  }
  get = () => this.snap
  set = (next: Snap) => {
    this.snap = next
    for (const l of this.listeners) l()
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
}

const Stores = createContext<((id: string) => ChartStore) | null>(null)

function StoresProvider({ children }: { children: ReactNode }) {
  // A Map held in state and never replaced: stores are created lazily by
  // whoever asks first, so a header can subscribe before its chart has mounted.
  const [stores] = useState(() => new Map<string, ChartStore>())
  const ensure = useCallback(
    (id: string) => {
      let s = stores.get(id)
      if (!s) {
        s = new ChartStore()
        stores.set(id, s)
      }
      return s
    },
    [stores],
  )
  return <Stores value={ensure}>{children}</Stores>
}

function useChartStore(id: string): ChartStore {
  const ensure = use(Stores)
  if (!ensure) throw new Error('Pieces render inside <FromTimeline>.')
  return ensure(id)
}

function useReadout(id: string): Snap {
  const s = useChartStore(id)
  return useSyncExternalStore(s.subscribe, s.get, s.get)
}

// ── helpers ─────────────────────────────────────────────────────────────────

const COLORS = ['accent', 'positive', 'negative', 'neutral', 'blue', 'violet', 'amber', 'teal']
const asColor = (v: ParamValue | undefined, d: DitherColor | string): DitherColor | string =>
  typeof v === 'string' && (v.startsWith('#') || COLORS.includes(v)) ? v : d

type PieceProps = {
  tl: TrailerTimeline
  d: DerivedStage
  clip: TimelineClip
  /** The clip is active: its cue fired and its end cue has not. */
  on: boolean
  p: Record<string, boolean>
  basePath: string
  logo?: string
  wordmark: string
  plate: string
}

const P_OF = (clip: TimelineClip): Params => clip.params ?? {}

// ── the renderer ────────────────────────────────────────────────────────────

export function FromTimeline({
  tl,
  basePath = '/app',
  logo,
  wordmark = '',
  plate = '',
}: {
  tl: TrailerTimeline
  basePath?: string
  logo?: string
  wordmark?: string
  plate?: string
}) {
  const d = useMemo(() => deriveStage(tl), [tl])
  const sc = tl.scene ?? {}
  const scene =
    sc.kind === 'video' && sc.src ? (
      <div data-stage-scene className="fixed inset-0 z-0">
        <video
          src={sc.src}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
          ref={(el) => {
            if (el && sc.rate) el.playbackRate = sc.rate
          }}
        />
      </div>
    ) : sc.kind === 'image' && sc.src ? (
      <div data-stage-scene className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sc.src} alt="" data-stage-asset className="h-full w-full object-cover" />
      </div>
    ) : sc.kind === 'color' && sc.color ? (
      <div data-stage-scene className="fixed inset-0 z-0" style={{ background: sc.color }} />
    ) : undefined

  return (
    <StageShell
      meta={d.meta}
      cues={d.cues}
      blackoutAt={d.blackoutAt}
      blackoutColor={tl.blackoutColor}
      offsets={d.offsets}
      scene={scene}
      overlay={sc.overlay ?? 'none'}
    >
      <StoresProvider>
        <Scenes tl={tl} d={d} basePath={basePath} logo={logo} wordmark={wordmark} plate={plate} />
      </StoresProvider>
    </StageShell>
  )
}

function Scenes({
  tl,
  d,
  basePath,
  logo,
  wordmark,
  plate,
}: {
  tl: TrailerTimeline
  d: DerivedStage
  basePath: string
  logo?: string
  wordmark: string
  plate: string
}) {
  const p = useStagePhases<string>()
  const clips = useMemo(
    () =>
      tl.tracks
        .filter((tr) => tr.kind !== 'audio')
        .flatMap((tr) => tr.clips.filter((c) => pieceOf(c) !== undefined && pieceOf(c) !== 'caption')),
    [tl],
  )
  const captions = useMemo(() => captionsOf(tl), [tl])
  const active = (c: TimelineClip) => !!p[c.id] && !(c.until !== undefined && p[endCue(c.id)])
  return (
    <>
      {clips.map((clip) => (
        <Piece
          key={clip.id}
          tl={tl}
          d={d}
          clip={clip}
          on={active(clip)}
          p={p}
          basePath={basePath}
          logo={logo}
          wordmark={wordmark}
          plate={plate}
        />
      ))}
      <StageCaptions lines={captions} canvasId="captions" />
    </>
  )
}

function Piece(props: PieceProps) {
  switch (pieceOf(props.clip)) {
    case 'card':
      return <CardPiece {...props} />
    case 'marketTape':
      return <TapePiece {...props} />
    case 'lineChart':
      return <LineChartPiece {...props} />
    case 'bento':
      return <BentoPiece {...props} />
    case 'groupFold':
      return <GroupFoldPiece {...props} />
    case 'logoReveal':
      return <RevealPiece {...props} />
    case 'endCard':
      return <EndCardPiece {...props} />
    case 'text':
      return <TextPiece {...props} />
    case 'chipRow':
      return <ChipRowPiece {...props} />
    case 'image':
      return <ImagePiece {...props} />
    case 'videoActor':
      return <VideoActorPiece {...props} />
    case 'sprite':
      return <SpritePiece {...props} />
    case 'pin':
      return <PinPiece {...props} />
    case 'channelFlip':
      return <ChannelFlipPiece {...props} />
    case 'browserFrame':
      return <BrowserFramePiece {...props} />
    default:
      return null
  }
}

// ── pieces ──────────────────────────────────────────────────────────────────

function CardPiece({ clip, on, p }: PieceProps) {
  const P = P_OF(clip)
  const header = obj(P.header)
  const identity = obj(header.identity)
  const right = obj(header.right)
  const headline = obj(header.headline)
  const chartId = str(header.tape, '')
  const snap = useReadout(chartId || '__none__')
  const g = (key: string) => !!p[gateName(clip.id, key)]
  const stats: CardStat[] = arr(header.stats).map((s) => {
    const o = obj(s)
    return {
      label: str(o.label),
      value: optStr(o.value),
      altValue: optStr(o.altValue),
      tone: o.tone === 'accent' ? 'accent' : 'plain',
      readout: o.readout === 'total' || o.readout === 'scaled' ? o.readout : undefined,
      factor: optNum(o.factor, 1),
    }
  })
  const readout: Readout | undefined = chartId ? { value: snap.value, pct: snap.pct, total: snap.total } : undefined
  return (
    <StageCard visible={on} width={str(P.width, '86vw')} height={str(P.height, '76vh')}>
      {Object.keys(header).length > 0 && (
        <StageCardHeader
          identity={{
            name: str(identity.name),
            sub: str(identity.sub),
            iconSrc: optStr(identity.iconSrc),
            emoji: optStr(identity.emoji),
          }}
          identityOn={identity.at === undefined ? undefined : g('identityAt')}
          rightOn={right.at === undefined ? undefined : g('rightAt')}
          statsOn={right.statsAt === undefined ? undefined : g('statsAt')}
          alt={header.altAt === undefined ? false : g('alt')}
          headline={
            Object.keys(headline).length
              ? {
                  text: str(headline.text),
                  altText: optStr(headline.altText),
                  color: optStr(headline.color),
                  altColor: optStr(headline.altColor),
                }
              : undefined
          }
          readout={readout}
          stats={stats}
          prefix={str(header.prefix, '')}
        />
      )}
    </StageCard>
  )
}

function TapePiece({ clip, d, on }: PieceProps) {
  const P = P_OF(clip)
  const built = useMemo(() => buildTapeFromSpec(P, d.cues, d.end), [P, d])
  const store = useChartStore(clip.id)
  const tapeRef = useRef<{ geom: () => TapeGeometry } | null>(null)
  const headerPx = num(P.plotHeaderPx, 118)
  const plotOf = useMemo(() => plotFor(num(P.cardWidthVw, 86), num(P.cardHeightVh, 76), headerPx), [P, headerPx])

  useEffect(() => {
    store.attach(built, () => tapeRef.current?.geom() ?? null)
  }, [built, store])

  // Readings tick on closes, not per frame; a freeze caps the close clock only,
  // so a cascade still runs while the numbers hold.
  const counts = useRef({ done: -1, crash: -1 })
  useStageFrame((t) => {
    if (!built) return
    const tc = built.freezeAt !== null ? Math.min(t, built.freezeAt) : t
    const done = built.all.filter((c) => tc >= c.at + built.growSec).length
    const crash = Math.min(
      built.crashCount,
      Math.max(0, Math.floor((t - built.crashAt) / built.crashStepSec) + (t >= built.crashAt ? 1 : 0)),
    )
    if (done === counts.current.done && crash === counts.current.crash) return
    counts.current = { done, crash }
    let value = done > 0 ? built.all[done - 1].close : built.base
    if (crash > 0) value = built.crashPrices[crash - 1]
    store.set({
      value,
      pct: (value / built.base - 1) * 100,
      total: value * built.supply,
      done,
      crash,
      head: Math.max(0, done - 1),
    })
  })

  if (!built) return null
  const colors = obj(P.colors)
  return (
    <StageMarketTape
      ref={tapeRef}
      candles={built.all}
      crash={
        built.crashCount > 0
          ? {
              at: built.crashAt,
              stepSec: built.crashStepSec,
              count: built.crashCount,
              heightPx: built.crashHeightPx,
              growthFactor: built.crashGrowth,
              slotStart: built.crashSlotStart,
              fromValue: built.all[built.all.length - 1].close,
            }
          : undefined
      }
      slots={built.slots}
      window={built.window}
      plotOf={plotOf}
      visible={on}
      colors={
        colors.up !== undefined || colors.down !== undefined
          ? { up: asColor(colors.up, 'positive'), down: asColor(colors.down, 'negative') }
          : undefined
      }
      growSec={built.growSec}
    />
  )
}

function LineChartPiece({ clip, d, on }: PieceProps) {
  const P = P_OF(clip)
  const { series, from, until, gap, pin } = useMemo(() => {
    const t = (v: ParamValue | undefined) => resolveTime(timeRef(v), d.cues, d.end)
    const series: ChartSeries[] = arr(P.series).map((s) => {
      const o = obj(s)
      const f = obj(o.format)
      const altAt = t(o.altAt)
      const out: ChartSeries = {
        label: str(o.label),
        color: asColor(o.color, 'accent'),
        kind: o.kind === 'dotted' ? 'dotted' : 'area',
        points: arr(o.points)
          .map((pt) => {
            const q = obj(pt)
            return { at: t(q.at), v: num(q.v, 0) }
          })
          .filter((pt): pt is { at: number; v: number } => pt.at !== null),
      }
      if (altAt !== null) out.altAt = altAt
      if (o.altColor !== undefined) out.altColor = asColor(o.altColor, 'negative')
      if (Object.keys(f).length) {
        const prefix = str(f.prefix)
        const suffix = str(f.suffix)
        const decimals = num(f.decimals, 1)
        out.format = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`
      }
      return out
    })
    const win = obj(P.window)
    const gapO = obj(P.gap)
    const gapAt = t(gapO.at)
    const pinO = obj(P.pin)
    const pinAt = t(pinO.at)
    return {
      series,
      from: t(win.from) ?? clip.at,
      until: t(win.until) ?? clip.until ?? d.end,
      gap: gapAt !== null ? { at: gapAt, until: t(gapO.until) ?? undefined, label: str(gapO.label) } : undefined,
      pin: pinAt !== null ? { at: pinAt, label: str(pinO.label), seriesIdx: Math.round(num(pinO.seriesIdx, 0)) } : undefined,
    }
  }, [P, d, clip.at, clip.until])
  const headerPx = num(P.plotHeaderPx, 118)
  const plotOf = useMemo(() => plotFor(num(P.cardWidthVw, 86), num(P.cardHeightVh, 76), headerPx), [P, headerPx])
  return <StageLineChart series={series} window={{ from, until }} plotOf={plotOf} visible={on} gap={gap} pin={pin} />
}

const itemsOf = (v: ParamValue | undefined): BentoItem[] =>
  arr(v).map((a) => {
    const o = obj(a)
    return { label: str(o.label), weightPct: num(o.weightPct, 0), color: str(o.color, '#7b5cff'), logo: optStr(o.logo) }
  })

function BentoPiece({ clip, on, p }: PieceProps) {
  const P = P_OF(clip)
  const items = useMemo(() => itemsOf(P.items), [P])
  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        left: `${num(P.leftVw, 50)}vw`,
        top: `${num(P.topVh, 50)}vh`,
        width: `${num(P.widthVw, 70)}vw`,
        transform: 'translate(-50%,-50%)',
      }}
    >
      <StageBento
        items={items}
        show={on}
        locked={bool(P.locked, false)}
        scatter={P.scatter === undefined ? false : !!p[gateName(clip.id, 'scatter')]}
        aspect={num(P.aspect, 1.9)}
        approxWidthPx={Math.round((num(P.widthVw, 70) / 100) * 1280)}
      />
    </div>
  )
}

function GroupFoldPiece({ clip, on, p }: PieceProps) {
  const P = P_OF(clip)
  const g = (key: string) => !!p[gateName(clip.id, key)]
  const groups = useMemo<FoldGroup[]>(() => {
    const out: FoldGroup[] = []
    for (const c of arr(P.groups)) {
      const o = obj(c)
      const group: FoldGroup = {
        id: str(o.id, str(o.label)),
        label: str(o.label),
        color: str(o.color, '#7b5cff'),
        items: itemsOf(o.items),
      }
      const mark = optStr(o.mark)
      if (mark) group.mark = mark
      const ticker = optStr(o.ticker)
      if (ticker) group.ticker = ticker
      out.push(group)
    }
    return out
  }, [P])
  const stage: FoldStage = !on ? 'hidden' : g('settle') ? 'settle' : g('fold') ? 'fold' : g('gather') ? 'gather' : 'grid'
  return <StageGroupFold groups={groups} stage={stage} name={str(P.name, 'One thing')} ticker={str(P.ticker, '')} unit={str(P.unit, 'token')} />
}

function RevealPiece({ clip, d, p, logo, wordmark, plate }: PieceProps) {
  const P = P_OF(clip)
  const g = (key: string) => !!p[gateName(clip.id, key)]
  const typing = obj(P.typing)
  const typeAt = resolveTime(timeRef(typing.at), d.cues, d.end)
  const query = str(P.query, '')
  const typedQuery = useStageTyping(query, typeAt ?? Number.POSITIVE_INFINITY, num(typing.secPerChar, 0.07))
  return (
    <StageLogoReveal
      mark={g('mark')}
      markUp={g('markUp')}
      wordmark={g('wordmark')}
      plate={g('plate')}
      powered={g('powered')}
      extra={g('extra')}
      bar={g('bar')}
      entered={g('entered')}
      morphOut={g('morphOut')}
      logoSrc={optStr(P.logo) ?? logo}
      wordmarkText={str(P.wordmark, wordmark)}
      plateText={optStr(P.plateText) ?? plate}
      poweredText={optStr(P.poweredText)}
      extraText={optStr(P.extraText)}
      query={query}
      typedQuery={typedQuery}
      placeholder={optStr(P.placeholder)}
    />
  )
}

function EndCardPiece({ clip, on, logo, wordmark, plate }: PieceProps) {
  const P = P_OF(clip)
  const chips = arr(P.chips).map((c) => str(c))
  return (
    <StageEndCard
      visible={on}
      logoSrc={optStr(P.logo) ?? logo}
      wordmarkText={str(P.wordmark, wordmark)}
      plateText={optStr(P.plate) ?? plate}
      url={optStr(P.url)}
      chips={chips}
      note={str(P.note, '')}
      canvasId={optStr(P.canvasId)}
    />
  )
}

function TextPiece({ clip, d, on }: PieceProps) {
  const P = P_OF(clip)
  const text = str(P.text)
  const typing = obj(P.typing)
  const typeAt = resolveTime(timeRef(typing.at), d.cues, d.end)
  const n = useStageTyping(text, typeAt ?? Number.POSITIVE_INFINITY, num(typing.secPerChar, 0.03))
  return (
    <StageText
      visible={on}
      text={typeAt === null ? text : text.slice(0, n)}
      style={str(P.style, 'mono') as TextStyle}
      leftVw={num(P.leftVw, 50)}
      topVh={optNum(P.topVh, 50)}
      bottomVh={optNum(P.bottomVh, 10)}
      maxWidthCh={num(P.maxWidthCh, 52)}
      sizePx={optNum(P.sizePx, 16)}
      color={optStr(P.color)}
      bg={optStr(P.bg)}
      font={optStr(P.font)}
      weight={optNum(P.weight, 700)}
      letterSpacing={optStr(P.letterSpacing)}
      canvasId={optStr(P.canvasId)}
    />
  )
}

function ChipRowPiece({ tl, clip, on, p }: PieceProps) {
  const P = P_OF(clip)
  const trackId = str(P.track, '')
  const items: ChipItem[] = trackId
    ? (tl.tracks.find((tr) => tr.id === trackId)?.clips ?? [])
        .filter((c) => c.id !== clip.id)
        .map((c) => ({ label: str(c.params?.label, c.id), on: !!p[c.id] }))
    : arr(P.items).map((it, i) => {
        const o = typeof it === 'string' ? { label: it } : obj(it)
        return { label: str(o.label), on: o.at === undefined ? on : !!p[gateName(clip.id, `item${i}`)] }
      })
  return (
    <StageChipRow
      items={items}
      hidden={!on}
      style={P.style === 'row' ? 'row' : 'stamp'}
      bottomVh={optNum(P.bottomVh, 15)}
      canvasId={optStr(P.canvasId)}
    />
  )
}

function ImagePiece({ clip, on }: PieceProps) {
  const P = P_OF(clip)
  return (
    <StageImage
      visible={on}
      src={str(P.src)}
      widthVw={num(P.widthVw, 40)}
      leftVw={num(P.leftVw, 50)}
      topVh={num(P.topVh, 50)}
      rounded={num(P.rounded, 16)}
      shadow={bool(P.shadow, true)}
      canvasId={optStr(P.canvasId)}
    />
  )
}

function VideoActorPiece({ clip, d, on }: PieceProps) {
  const P = P_OF(clip)
  const anchor = obj(P.anchor)
  const store = useChartStore(str(anchor.tape, '__none__'))
  const playAt = resolveTime(timeRef(P.playAt), d.cues, d.end) ?? clip.at
  const pauseAt = resolveTime(timeRef(P.pauseAt), d.cues, d.end)
  const h = num(anchor.height, 150)
  const aspect = num(anchor.aspect, 1.4)
  const dy = num(anchor.dy, 4)
  const slotSpec = anchor.slot
  const position = () => {
    const g = store.geom?.()
    const tape = store.tape
    if (!g || !tape) return null
    // 'latest' rides the newest completed step; a number stands on that slot.
    const i =
      slotSpec === 'latest'
        ? Math.min(store.get().head, tape.leg.length - 1)
        : Math.min(Math.max(0, Math.round(num(slotSpec, 0))), tape.all.length - 1)
    const c = tape.all[i]
    const w = aspect * h
    return { left: g.slotX(i) - w / 2, top: g.yOf(Math.max(c.open, c.close)) - h + dy, width: w, height: h }
  }
  return <StageVideoActor src={str(P.src)} visible={on} playAt={playAt} pauseAt={pauseAt ?? undefined} position={position} />
}

function SpritePiece({ clip, d, on }: PieceProps) {
  const P = P_OF(clip)
  const from = resolveTime(timeRef(P.from), d.cues, d.end) ?? clip.at
  const until = resolveTime(timeRef(P.until), d.cues, d.end) ?? clip.until
  return (
    <div
      data-canvas-id={optStr(P.canvasId)}
      className="pointer-events-none fixed z-40 transition-opacity duration-300"
      style={{ left: `${num(P.leftVw, 50)}vw`, top: `${num(P.topVh, 50)}vh`, transform: 'translate(-50%, -50%)', opacity: on ? 1 : 0 }}
    >
      <StageSprite
        src={str(P.src)}
        frames={Math.max(1, Math.round(num(P.frames, 1)))}
        frameW={Math.max(1, Math.round(num(P.frameW, 64)))}
        frameH={Math.max(1, Math.round(num(P.frameH, 64)))}
        fps={num(P.fps, 10)}
        from={from}
        until={until}
        loop={bool(P.loop, true)}
        scale={num(P.scale, 1)}
      />
    </div>
  )
}

function PinPiece({ clip, d, on }: PieceProps) {
  const P = P_OF(clip)
  const anchor = obj(P.anchor)
  const store = useChartStore(str(anchor.tape, '__none__'))
  const slot = Math.max(0, Math.round(num(anchor.slot, 0)))
  const dy = num(anchor.dy, -30)
  const untilT = clip.until ?? d.end
  const position = (t: number) => {
    if (t < clip.at || t >= untilT + 1) return null
    const g = store.geom?.()
    const tape = store.tape
    if (!g || !tape) return null
    const c = tape.all[Math.min(slot, tape.all.length - 1)]
    const v =
      typeof anchor.value === 'number'
        ? anchor.value
        : anchor.value === 'close'
          ? c.close
          : anchor.value === 'open'
            ? c.open
            : anchor.value === 'low'
              ? c.low
              : c.high
    return { left: g.slotX(slot), top: g.yOf(v) + dy }
  }
  return (
    <StagePin
      on={on}
      label={str(P.label, 'here')}
      arrow={optStr(P.arrow)}
      color={optStr(P.color)}
      borderColor={optStr(P.borderColor)}
      position={position}
    />
  )
}

function ChannelFlipPiece({ clip, d }: PieceProps) {
  const P = P_OF(clip)
  const times = arr(P.times)
    .map((v) => resolveTime(timeRef(v), d.cues, d.end))
    .filter((x): x is number => x !== null)
  return <StageChannelFlip at={times.length ? times : [clip.at]} durationMs={num(P.durationMs, 400)} />
}

/** The app on camera, driven by an ORDERED action list. */
function BrowserFramePiece({ clip, d, on, p, basePath }: PieceProps) {
  const P = P_OF(clip)
  const g = (key: string) => !!p[gateName(clip.id, key)]
  const driveRef = useRef<FrameDrive | null>(null)
  const [path, setPath] = useState(str(P.startPath, '/'))
  const onDrive = useCallback((drive: FrameDrive) => {
    driveRef.current = drive
  }, [])

  const actions = useMemo(
    () =>
      arr(P.actions)
        .map((a) => {
          const o = obj(a)
          return {
            at: resolveTime(timeRef(o.at), d.cues, d.end),
            do: str(o.do),
            path: optStr(o.path),
            selector: optStr(o.selector),
            text: optStr(o.text),
            within: optStr(o.within),
            cps: optNum(o.cps, 14),
            enter: bool(o.enter, false),
            y: optNum(o.y, 0),
            frac: optNum(o.frac, 0.3),
            ms: num(o.ms, 500),
            waitFor: num(o.waitFor, 4),
          }
        })
        .filter((a): a is typeof a & { at: number } => a.at !== null)
        .sort((a, b) => a.at - b.at),
    [P, d],
  )
  type Action = (typeof actions)[number]

  /**
   * Actions run IN ORDER, each after the previous settled, and a click POLLS for
   * its target: the app answers on the network's clock, not the stage's. `at` is
   * the earliest an action may start, never a deadline — a fixed schedule fires
   * clicks into a page that is still fetching, and the take looks broken while
   * the log looks fine.
   */
  const perform = useCallback((drive: FrameDrive, a: Action): Promise<void> => {
    const until = (fn: () => boolean, sec: number) =>
      new Promise<void>((res) => {
        const t0 = performance.now()
        const tick = () => {
          if (fn() || performance.now() - t0 > sec * 1000) return res()
          setTimeout(tick, 150)
        }
        tick()
      })
    switch (a.do) {
      case 'nav':
        if (a.path) {
          drive.nav(a.path)
          setPath(a.path)
        }
        return Promise.resolve()
      case 'click': {
        const sel = a.selector
        return sel ? until(() => drive.click(sel), a.waitFor) : Promise.resolve()
      }
      case 'clickText': {
        const text = a.text
        return text ? until(() => drive.clickText(text, a.within), a.waitFor) : Promise.resolve()
      }
      case 'type':
        return a.selector && a.text !== undefined ? drive.type(a.selector, a.text, a.cps, a.enter) : Promise.resolve()
      case 'scrollTo':
        drive.scrollTo(a.y ?? 0)
        return Promise.resolve()
      case 'scrollToHeading':
        if (a.text) drive.scrollToHeading(a.text, a.frac)
        return Promise.resolve()
      case 'wait':
        return new Promise((res) => setTimeout(res, a.ms))
      default:
        return Promise.resolve()
    }
  }, [])

  const fired = useRef(new Set<number>())
  const queue = useRef<Promise<void>>(Promise.resolve())
  useStageFrame((t) => {
    const drive = driveRef.current
    if (!drive) return
    actions.forEach((a, i) => {
      if (t < a.at || fired.current.has(i)) return
      fired.current.add(i)
      queue.current = queue.current.then(() => perform(drive, a))
    })
  })

  const storage = obj(P.storage)
  return (
    <StageBrowserFrame
      basePath={basePath}
      mounted={g('mount') || on}
      visible={on}
      dimmed={P.dimAt === undefined ? false : g('dim')}
      path={path}
      onDrive={onDrive}
      light={bool(P.light, false)}
      storage={Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, str(v)]))}
      clearStorage={arr(P.clearStorage).map((k) => str(k))}
      startPath={str(P.startPath, '/')}
      readySelector={str(P.readySelector, 'nav, header, main')}
      width={str(P.width, '86vw')}
      height={str(P.height, '76vh')}
      chromePx={num(P.chromePx, 32)}
    />
  )
}
