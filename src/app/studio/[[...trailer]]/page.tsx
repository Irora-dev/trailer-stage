'use client'

/**
 * THE STUDIO — a video editor where every layer of the trailer is its own track.
 *
 * The real stage is the preview: it is embedded as an iframe in editor mode and
 * driven over postMessage (scrub, play, pause, live cue retiming), so what you
 * are editing is the thing that will be filmed, not a mock-up of it. Below it,
 * the timeline: visual clips you can drag against the LOCKED audio truth (the
 * measured narration segments), an inspector for times and params, snapping to
 * narration edges, undo, and Save writing the JSON back to disk.
 *
 * While playing, the mix is the clock — so a beat dragged against a word stays
 * against that word.
 *
 * Dev-only, like the stage.
 */

import { notFound, useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deriveCues } from '@/lib/pieces'
import { offsetsOf, type ParamValue, type TimelineClip, type TimelineTrack, type TrailerTimeline } from '@/lib/timeline'

const RULER_H = 26
const TRACK_H = 44

type Sel = { trackId: string; clipId: string } | null

export default function StudioPage() {
  const params = useParams<{ trailer?: string[] }>()
  if (process.env.NODE_ENV === 'production') notFound()
  const name = params.trailer?.[0] ?? ''
  if (!name) return <Missing>Open a trailer: /studio/&lt;name&gt;</Missing>
  return <Studio key={name} name={name} />
}

function Missing({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio grid min-h-screen place-items-center bg-[#0c0d10] p-8 text-center font-mono text-sm text-[#c8ccd4]">
      <p>{children}</p>
    </div>
  )
}

/** Move an anchor's offset: "seg:12.start+0.17" dragged 0.4s later becomes
 *  "+0.57". The base never changes here — only the resolver picks bases. */
function shiftAnchor(anchor: string, delta: number): string {
  const m = /^(.*?\.(?:start|end))\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*$/.exec(anchor)
  if (!m) return anchor
  const cur = m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0
  const next = Math.round((cur + delta) * 100) / 100
  if (Math.abs(next) < 0.005) return m[1]
  return `${m[1]}${next < 0 ? '-' : '+'}${Math.abs(next)}`
}

function Studio({ name }: { name: string }) {
  const [tl, setTl] = useState<TrailerTimeline | null>(null)
  const [missing, setMissing] = useState(false)
  const [pxPerSec, setPxPerSec] = useState(24)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [sel, setSel] = useState<Sel>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canvasMode, setCanvasMode] = useState(false)
  const [rate, setRate] = useState(1)
  // The preview is the recorder's exact frame, floated with a gap and zoomable.
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panDrag = useRef<{ x0: number; y0: number; px: number; py: number } | null>(null)
  const [panel, setPanel] = useState({ w: 0, h: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const undoStack = useRef<string[]>([])
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    document.documentElement.dataset.stage = '1'
    return () => {
      delete document.documentElement.dataset.stage
    }
  }, [])

  useEffect(() => {
    fetch(`/api/timeline/${name}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then(setTl)
      .catch(() => setMissing(true))
  }, [name])

  // The panel div only exists once the timeline loads, so re-attach then.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPanel({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setPanel({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [tl])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(3, Math.max(0.35, z * Math.exp(-e.deltaY * 0.0016))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [tl])

  // The playhead follows the stage's own clock reports.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string; t?: number; playing?: boolean }
      if (m?.type === 'stage:time' && typeof m.t === 'number') {
        setT(m.t)
        setPlaying(!!m.playing)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const post = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  // The SAME derivation the renderer uses, so a live drag moves a piece's
  // internal stages exactly as it moves a plain cue.
  const cuesOf = useCallback((timeline: TrailerTimeline) => deriveCues(timeline), [])

  /** Every mutation flows through here: undo snapshot plus live retime. */
  const mutate = useCallback(
    (fn: (draft: TrailerTimeline) => void, snapshot = true) => {
      setTl((prev) => {
        if (!prev) return prev
        if (snapshot) {
          undoStack.current.push(JSON.stringify(prev))
          if (undoStack.current.length > 100) undoStack.current.shift()
        }
        const draft = JSON.parse(JSON.stringify(prev)) as TrailerTimeline
        fn(draft)
        post({ type: 'stage:cues', cues: cuesOf(draft) })
        post({ type: 'stage:offsets', offsets: offsetsOf(draft) })
        setDirty(true)
        return draft
      })
    },
    [post, cuesOf],
  )

  // Canvas-mode drops land in the timeline as the offsets track.
  useEffect(() => {
    const onMoved = (e: MessageEvent) => {
      const cm = e.data as { type?: string; id?: string; dx?: number; dy?: number }
      if (cm?.type !== 'canvas:moved' || !cm.id) return
      const id = cm.id
      mutate((draft) => {
        let tr = draft.tracks.find((x) => x.id === 'offsets')
        if (!tr) {
          tr = { id: 'offsets', name: 'Canvas offsets', kind: 'marker', clips: [] }
          draft.tracks.push(tr)
        }
        const existing = tr.clips.find((c) => c.id === id)
        if (existing) existing.params = { dx: cm.dx ?? 0, dy: cm.dy ?? 0 }
        else tr.clips.push({ id, at: 0, params: { dx: cm.dx ?? 0, dy: cm.dy ?? 0 } })
      })
    }
    window.addEventListener('message', onMoved)
    return () => window.removeEventListener('message', onMoved)
  }, [mutate])

  const undo = useCallback(() => {
    const last = undoStack.current.pop()
    if (!last) return
    const restored = JSON.parse(last) as TrailerTimeline
    setTl(restored)
    post({ type: 'stage:cues', cues: cuesOf(restored) })
    setDirty(true)
  }, [post, cuesOf])

  const save = useCallback(async () => {
    if (!tl) return
    setSaving(true)
    const r = await fetch(`/api/timeline/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tl),
    })
    setSaving(false)
    if (r.ok) {
      setDirty(false)
      // Full-fidelity reload: frame maths (a seeded series, a freeze) rebuilds
      // from the saved file. Live retiming covered the drag itself.
      post({ type: 'stage:reload' })
    }
  }, [tl, name, post])

  // Snap targets: the audio's own edges, then half seconds.
  const snaps = useMemo(() => {
    if (!tl) return [] as number[]
    const out: number[] = []
    for (const tr of tl.tracks) if (tr.kind === 'audio') for (const c of tr.clips) out.push(c.at, c.until ?? c.at)
    return out
  }, [tl])
  const snap = useCallback(
    (v: number) => {
      for (const s of snaps) if (Math.abs(v - s) < 0.12) return s
      const half = Math.round(v * 2) / 2
      if (Math.abs(v - half) < 0.06) return half
      return Math.round(v * 100) / 100
    },
    [snaps],
  )

  // Transport and editing keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        post({ type: playing ? 'stage:pause' : 'stage:play' })
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        undo()
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && sel) {
        e.preventDefault()
        const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.5 : 0.05)
        mutate((draft) => {
          const c = draft.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
          if (!c) return
          const nextAt = Math.max(0, Math.round((c.at + d) * 100) / 100)
          if (c.anchor) c.anchor = shiftAnchor(c.anchor, nextAt - c.at)
          c.at = nextAt
          if (c.until !== undefined) {
            const nextUntil = Math.max(c.at + 0.05, Math.round((c.until + d) * 100) / 100)
            if (c.anchorUntil) c.anchorUntil = shiftAnchor(c.anchorUntil, nextUntil - c.until)
            c.until = nextUntil
          }
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, sel, post, mutate, undo])

  if (missing)
    return (
      <Missing>
        No timeline for “{name}”. Compile one with <code>npm run draft -- brief.md --name {name}</code>, or copy an
        existing <code>trailers/*.timeline.json</code>.
      </Missing>
    )
  if (!tl) return <Missing>loading…</Missing>

  const W = Math.max(900, tl.end * pxPerSec + 120)
  const selClip = sel ? (tl.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId) ?? null) : null

  return (
    <div className="studio flex h-screen flex-col bg-[#0c0d10] font-mono text-[13px] text-[#c8ccd4]">
      {/* ── Preview: the real stage, in editor mode ── */}
      <div className="relative flex min-h-0 flex-1">
        <div ref={panelRef} className="relative flex-1 overflow-hidden bg-[#050607]">
          {(() => {
            const fit = Math.min((panel.w - 56) / 1280, (panel.h - 56) / 720)
            const k = Math.max(0.05, fit) * zoom
            return (
              <div
                className="absolute top-1/2 left-1/2"
                style={{ width: 1280, height: 720, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${k})` }}
              >
                <div className="absolute -inset-px rounded border border-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.7)]" />
                <iframe
                  ref={frameRef}
                  src={`/stage/${tl.name}?editor=1`}
                  title="stage preview"
                  className="h-full w-full border-0"
                  onLoad={() => {
                    // The stage reads the saved file itself; a just-edited,
                    // unsaved state has to win, so push it once it is up.
                    setTimeout(() => {
                      post({ type: 'stage:cues', cues: cuesOf(tl) })
                      post({ type: 'stage:offsets', offsets: offsetsOf(tl) })
                      if (canvasMode) post({ type: 'stage:canvas', on: true })
                    }, 600)
                  }}
                />
              </div>
            )
          })()}
          {/* Drag-to-pan. Above the iframe while canvas mode is OFF (the stage
              needs no pointer then); it stands down when canvas mode is on so
              element drags reach the preview. */}
          <div
            className={canvasMode ? 'absolute inset-0' : 'absolute inset-0 z-10 cursor-grab active:cursor-grabbing'}
            style={canvasMode ? { pointerEvents: 'none' } : undefined}
            onPointerDown={(e) => {
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              panDrag.current = { x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y }
            }}
            onPointerMove={(e) => {
              const d = panDrag.current
              if (d) setPan({ x: d.px + (e.clientX - d.x0), y: d.py + (e.clientY - d.y0) })
            }}
            onPointerUp={() => (panDrag.current = null)}
          />
          <div className="pointer-events-none absolute right-3 bottom-2 flex items-center gap-3 text-[10px] tracking-[0.12em] text-white/40">
            <span>1280 × 720 · recorded frame</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
              className="absolute top-2 right-3 z-20 rounded border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
            >
              fit
            </button>
          )}
        </div>

        {/* ── Inspector ── */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-[#111318] p-4">
          <div className="mb-3 text-[11px] tracking-[0.2em] text-[var(--accent)] uppercase">Inspector</div>
          {selClip && sel ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold text-white">{selClip.id}</span>
                  <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] tracking-[0.14em] text-white/50 uppercase">
                    {sel.trackId}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-white/45">
                  {selClip.at.toFixed(2)}s
                  {selClip.until !== undefined && (
                    <>
                      {' '}
                      → {selClip.until.toFixed(2)}s
                      <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                        {(selClip.until - selClip.at).toFixed(2)}s
                      </span>
                    </>
                  )}
                </div>
                {(selClip.anchor || selClip.anchorUntil) && (
                  // Where the time comes from. A drag keeps the anchor and
                  // shifts its offset; ✕ cuts the clip loose.
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8a7bff]">
                    <span>⚓</span>
                    {selClip.anchor && <span>at = {selClip.anchor}</span>}
                    {selClip.anchorUntil && <span>until = {selClip.anchorUntil}</span>}
                    <button
                      title="Drop the anchor: keep these times as plain numbers"
                      onClick={() =>
                        mutate((d) => {
                          const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                          if (!c) return
                          delete c.anchor
                          delete c.anchorUntil
                        })
                      }
                      className="rounded border border-white/15 px-1 text-white/50 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <NumberField
                label="at (s)"
                value={selClip.at}
                onChange={(v) =>
                  mutate((d) => {
                    const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                    if (c) c.at = Math.max(0, v)
                  })
                }
              />
              {selClip.until !== undefined && (
                <NumberField
                  label="until (s)"
                  value={selClip.until}
                  onChange={(v) =>
                    mutate((d) => {
                      const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                      if (c) c.until = Math.max(c.at + 0.05, v)
                    })
                  }
                />
              )}

              {selClip.params &&
                Object.entries(selClip.params).map(([k, v]) => (
                  <label key={k} className="block">
                    <span className="text-[11px] text-white/45">{k}</span>
                    {typeof v === 'object' && v !== null ? (
                      <JsonParam
                        value={v}
                        onCommit={(next) =>
                          mutate((d) => {
                            const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                            if (c?.params) c.params[k] = next
                          })
                        }
                      />
                    ) : typeof v === 'string' && v.length > 40 ? (
                      <textarea
                        value={v}
                        rows={4}
                        onChange={(e) =>
                          mutate((d) => {
                            const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                            if (c?.params) c.params[k] = e.target.value
                          })
                        }
                        className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2.5 py-1.5 text-white focus:border-[var(--accent)] focus:outline-none"
                      />
                    ) : (
                      <input
                        value={String(v)}
                        onChange={(e) =>
                          mutate((d) => {
                            const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                            if (!c?.params) return
                            c.params[k] = typeof v === 'number' ? Number(e.target.value) : e.target.value
                          })
                        }
                        className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2.5 py-1.5 text-white focus:border-[var(--accent)] focus:outline-none"
                      />
                    )}
                  </label>
                ))}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => post({ type: 'stage:seek', t: selClip.at })}
                  className="col-span-2 rounded-md border border-[var(--accent)]/50 px-3 py-2 text-[12px] text-[var(--accent)] hover:bg-[var(--accent)]/10"
                >
                  ⤓ Playhead to clip
                </button>
                {selClip.until !== undefined && (
                  <>
                    <button
                      onClick={() =>
                        mutate((d) => {
                          const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                          if (c?.until !== undefined) c.until = c.at + (c.until - c.at) / 1.5
                        })
                      }
                      className="rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:border-white/30"
                    >
                      ◂▸ Shorter
                    </button>
                    <button
                      onClick={() =>
                        mutate((d) => {
                          const c = d.tracks.find((x) => x.id === sel.trackId)?.clips.find((x) => x.id === sel.clipId)
                          if (c?.until !== undefined) c.until = c.at + (c.until - c.at) * 1.5
                        })
                      }
                      className="rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:border-white/30"
                    >
                      ◂ ▸ Longer
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    mutate((d) => {
                      const tr = d.tracks.find((x) => x.id === sel.trackId)
                      const c = tr?.clips.find((x) => x.id === sel.clipId)
                      if (!tr || !c) return
                      const copy = JSON.parse(JSON.stringify(c)) as TimelineClip
                      copy.id = `${c.id}-copy${tr.clips.length}`
                      copy.at = c.at + 1
                      if (copy.until !== undefined) copy.until += 1
                      delete copy.anchor
                      delete copy.anchorUntil
                      tr.clips.push(copy)
                    })
                  }
                  className="rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:border-white/30"
                >
                  ⧉ Duplicate
                </button>
                <button
                  onClick={() => {
                    mutate((d) => {
                      const tr = d.tracks.find((x) => x.id === sel.trackId)
                      if (tr) tr.clips = tr.clips.filter((x) => x.id !== sel.clipId)
                    })
                    setSel(null)
                  }}
                  className="rounded-md border border-[#f06565]/40 px-3 py-2 text-[12px] text-[#f06565] hover:border-[#f06565]/70"
                >
                  ✕ Delete
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-white/35">
                Text and timing retime the live preview. Save rebuilds frame-exact maths from the file and reloads the
                stage. Canvas mode (in the transport bar) drags elements on the preview itself.
              </p>
            </div>
          ) : (
            <p className="text-white/40">
              Click a clip to edit it. Drag clips on the timeline; arrows nudge (shift = 0.5s); ⌘Z undoes; space plays.
            </p>
          )}
        </aside>
      </div>

      {/* ── Transport ── */}
      <div className="flex items-center gap-3 border-t border-white/10 bg-[#111318] px-4 py-2">
        <button
          onClick={() => post({ type: playing ? 'stage:pause' : 'stage:play' })}
          className="rounded border border-[var(--accent)]/50 px-4 py-1 text-[var(--accent)] hover:bg-[var(--accent)]/10"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => post({ type: 'stage:seek', t: 0 })} className="rounded border border-white/20 px-3 py-1 text-white/70 hover:bg-white/5">
          ⏮
        </button>
        <button
          onClick={() => {
            const next = !canvasMode
            setCanvasMode(next)
            post({ type: 'stage:canvas', on: next })
          }}
          title="Drag elements on the preview; click again to lock them in place"
          className={`rounded border px-3 py-1 ${canvasMode ? 'border-[#3fbf5f] bg-[#3fbf5f]/15 text-[#3fbf5f]' : 'border-white/20 text-white/70 hover:bg-white/5'}`}
        >
          {canvasMode ? '⬒ canvas: editing' : '⬒ canvas'}
        </button>
        <select
          value={rate}
          onChange={(e) => {
            const r = Number(e.target.value)
            setRate(r)
            post({ type: 'stage:rate', rate: r })
          }}
          className="rounded border border-white/20 bg-black/40 px-2 py-1 text-white/70"
          title="Playback speed"
        >
          {[0.5, 0.75, 1, 1.5, 2].map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
        <span className="tabular-nums text-white/85">{t.toFixed(2)}s</span>
        <span className="text-white/30">/ {tl.end.toFixed(1)}s</span>
        <div className="mx-4 flex items-center gap-2 text-white/45">
          <span className="text-[11px]">zoom</span>
          <input type="range" min={8} max={80} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} />
        </div>
        <span className="ml-auto text-[11px] text-white/40">{tl.name}</span>
        <button onClick={undo} className="rounded border border-white/20 px-3 py-1 text-white/70 hover:bg-white/5">
          undo
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={`rounded border px-4 py-1 ${dirty ? 'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10' : 'border-white/15 text-white/30'}`}
        >
          {saving ? 'saving…' : dirty ? 'save' : 'saved'}
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className="h-[38vh] overflow-auto border-t border-white/10 bg-[#08090b]">
        <div className="relative" style={{ width: W, height: RULER_H + tl.tracks.length * TRACK_H + 8 }}>
          <Ruler end={tl.end} pxPerSec={pxPerSec} onSeek={(sec) => post({ type: 'stage:seek', t: sec })} />
          {tl.tracks.map((tr, i) => (
            <TrackRow
              key={tr.id}
              track={tr}
              top={RULER_H + i * TRACK_H}
              pxPerSec={pxPerSec}
              sel={sel}
              onSelect={setSel}
              onDrag={(clipId, at, until) =>
                mutate(
                  (d) => {
                    const c = d.tracks.find((x) => x.id === tr.id)?.clips.find((x) => x.id === clipId)
                    if (!c) return
                    const nextAt = snap(at)
                    // An anchored clip stays anchored: the drag becomes an
                    // offset from its narration boundary, so a re-rendered line
                    // still carries the author's nudge along.
                    if (c.anchor) c.anchor = shiftAnchor(c.anchor, nextAt - c.at)
                    c.at = nextAt
                    if (until !== undefined && c.until !== undefined) {
                      const nextUntil = Math.max(c.at + 0.05, snap(until))
                      if (c.anchorUntil) c.anchorUntil = shiftAnchor(c.anchorUntil, nextUntil - c.until)
                      c.until = nextUntil
                    }
                  },
                  false, // a drag snapshots once, on pointer-down
                )
              }
              onDragStart={() => {
                if (tl) undoStack.current.push(JSON.stringify(tl))
              }}
            />
          ))}
          <TimeFlag label="blackout" sec={tl.blackoutAt ?? tl.end - 1.4} pxPerSec={pxPerSec} color="#f06565" />
          <TimeFlag label="end" sec={tl.end} pxPerSec={pxPerSec} color="#ffffff55" />
          <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--accent)]" style={{ left: t * pxPerSec + 0.5 }} />
        </div>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-white/45">{label}</span>
      <input
        type="number"
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2.5 py-1.5 text-white focus:border-[var(--accent)] focus:outline-none"
      />
    </label>
  )
}

/**
 * A nested param (a header spec, a series, a list of actions) as editable JSON.
 * It commits on BLUR and refuses invalid JSON, so half-typed text never reaches
 * the timeline; the draft follows outside changes (undo, a reload) by resetting
 * from derived state.
 */
function JsonParam({ value, onCommit }: { value: ParamValue; onCommit: (next: ParamValue) => void }) {
  const json = JSON.stringify(value, null, 1)
  const [draft, setDraft] = useState(json)
  const [seen, setSeen] = useState(json)
  const [bad, setBad] = useState(false)
  if (seen !== json) {
    setSeen(json)
    setDraft(json)
    setBad(false)
  }
  return (
    <textarea
      value={draft}
      rows={Math.min(16, Math.max(3, draft.split('\n').length))}
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value)
        setBad(false)
      }}
      onBlur={() => {
        try {
          const next = JSON.parse(draft) as ParamValue
          setBad(false)
          if (JSON.stringify(next, null, 1) !== json) onCommit(next)
        } catch {
          setBad(true)
        }
      }}
      className={`mt-1 w-full rounded-md border bg-black/50 px-2.5 py-1.5 text-[11px] leading-snug text-white focus:outline-none ${
        bad ? 'border-[#f06565]/70' : 'border-white/15 focus:border-[var(--accent)]'
      }`}
    />
  )
}

function Ruler({ end, pxPerSec, onSeek }: { end: number; pxPerSec: number; onSeek: (sec: number) => void }) {
  const marks: number[] = []
  const step = pxPerSec < 16 ? 10 : pxPerSec < 40 ? 5 : 1
  for (let s = 0; s <= end + 5; s += step) marks.push(s)
  const scrubbing = useRef(false)
  const seekAt = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onSeek(Math.max(0, (e.clientX - rect.left) / pxPerSec))
  }
  return (
    <div
      className="absolute top-0 right-0 left-0 cursor-crosshair border-b border-white/10"
      style={{ height: RULER_H }}
      onPointerDown={(e) => {
        scrubbing.current = true
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        seekAt(e)
      }}
      onPointerMove={(e) => {
        if (scrubbing.current) seekAt(e)
      }}
      onPointerUp={() => (scrubbing.current = false)}
    >
      {marks.map((s) => (
        <span key={s} className="absolute top-1 text-[9px] text-white/35" style={{ left: s * pxPerSec + 3 }}>
          {s}s
        </span>
      ))}
    </div>
  )
}

function TimeFlag({ label, sec, pxPerSec, color }: { label: string; sec: number; pxPerSec: number; color: string }) {
  return (
    <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: sec * pxPerSec }}>
      <div className="h-full w-px" style={{ background: color }} />
      <span className="absolute top-0 left-1 text-[9px]" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

function TrackRow({
  track,
  top,
  pxPerSec,
  sel,
  onSelect,
  onDrag,
  onDragStart,
}: {
  track: TimelineTrack
  top: number
  pxPerSec: number
  sel: Sel
  onSelect: (s: Sel) => void
  onDrag: (clipId: string, at: number, until?: number) => void
  onDragStart: () => void
}) {
  const color = track.kind === 'visual' ? '#3fbf5f' : track.kind === 'marker' ? '#8a7bff' : '#6a92c9'
  return (
    <div className="absolute right-0 left-0 border-b border-white/[0.06]" style={{ top, height: TRACK_H }}>
      <span className="absolute top-1 left-2 z-10 text-[10px] tracking-[0.12em] text-white/40 uppercase">
        {track.name}
        {track.locked ? ' 🔒' : ''}
      </span>
      {track.clips.map((c) => (
        <ClipBlock
          key={c.id}
          clip={c}
          color={color}
          locked={!!track.locked}
          pxPerSec={pxPerSec}
          selected={sel?.trackId === track.id && sel?.clipId === c.id}
          onSelect={() => onSelect({ trackId: track.id, clipId: c.id })}
          onDrag={(at, until) => onDrag(c.id, at, until)}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  )
}

function ClipBlock({
  clip,
  color,
  locked,
  pxPerSec,
  selected,
  onSelect,
  onDrag,
  onDragStart,
}: {
  clip: TimelineClip
  color: string
  locked: boolean
  pxPerSec: number
  selected: boolean
  onSelect: () => void
  onDrag: (at: number, until?: number) => void
  onDragStart: () => void
}) {
  const w = clip.until !== undefined ? Math.max(30, (clip.until - clip.at) * pxPerSec) : 12
  const drag = useRef<{ x0: number; at0: number; until0?: number; edge: 'move' | 'l' | 'r' } | null>(null)
  const piece = typeof clip.params?.piece === 'string' ? clip.params.piece : null
  const label = String(clip.params?.label ?? clip.params?.text ?? (piece ? `${clip.id} · ${piece}` : clip.id)).slice(0, 40)
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={() => {}}
      onPointerDown={(e) => {
        onSelect()
        if (locked) return
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        // 8-14px edge zones trim; the middle moves.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const x = e.clientX - rect.left
        const zone = Math.min(14, rect.width * 0.35)
        const edge: 'move' | 'l' | 'r' =
          clip.until !== undefined && x < zone ? 'l' : clip.until !== undefined && x > rect.width - zone ? 'r' : 'move'
        drag.current = { x0: e.clientX, at0: clip.at, until0: clip.until, edge }
        onDragStart()
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dt = (e.clientX - drag.current.x0) / pxPerSec
        const d = drag.current
        if (d.edge === 'l') onDrag(Math.min(Math.max(0, d.at0 + dt), (d.until0 ?? Infinity) - 0.05), d.until0)
        else if (d.edge === 'r') onDrag(d.at0, Math.max(d.at0 + 0.05, (d.until0 ?? d.at0) + dt))
        else onDrag(Math.max(0, d.at0 + dt), d.until0 !== undefined ? d.until0 + dt : undefined)
      }}
      onPointerUp={() => (drag.current = null)}
      className={`absolute top-[18px] flex h-[20px] items-center overflow-hidden rounded-sm px-1.5 text-[9px] whitespace-nowrap select-none ${
        locked ? 'cursor-default opacity-55' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        left: clip.at * pxPerSec,
        width: w,
        background: `${color}22`,
        border: `1px solid ${selected ? 'var(--accent)' : `${color}88`}`,
        color: selected ? '#fff' : '#c8ccd4cc',
      }}
      title={`${clip.id} · ${clip.at}s${clip.until !== undefined ? ` → ${clip.until}s` : ''}`}
    >
      <span className="pointer-events-none relative z-0">{label}</span>
    </div>
  )
}
