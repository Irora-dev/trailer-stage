'use client'

/**
 * THE STAGE — the set, the clock, and the contract the recorder reads.
 *
 * Everything a trailer shows is composed inside this shell. It owns:
 *
 *  · THE CLOCK. One requestAnimationFrame loop, armed by `window.__stage.start()`.
 *    The recorder calls start() only after its first captured frame arrives, so
 *    footage time equals mix time by construction rather than by correction.
 *    Nothing moves before start(): a take can never open mid-animation.
 *
 *  · THE CUE MACHINE. Named cues become booleans. In PLAYBACK each flips once
 *    (a whole take costs a couple of dozen renders); in EDITOR mode (?editor=1)
 *    they DERIVE from t every frame, so scrubbing works in both directions.
 *
 *  · READINESS. Fonts, the scene's video, and every element marked
 *    `data-stage-asset` must be decoded before `readyFlag` goes true. The
 *    recorder waits for that flag, which is why a take never opens on a blank
 *    box where an image was still loading. A 20s race timeout keeps a missing
 *    asset from wedging a shoot.
 *
 *  · THE EDITOR BRIDGE. postMessage: seek / play / pause / rate / live cue
 *    retiming / offsets / canvas mode / reload. While playing in editor mode the
 *    MIX IS THE CLOCK (t = audio.currentTime), so narration and picture cannot
 *    drift apart while you scrub.
 *
 * DETERMINISM IS A HOUSE LAW: no Date.now, no Math.random anywhere in a
 * timeline. Seeded generators only. A retake must be the same take, or the
 * frame-by-frame comparison that proves an edit changed one thing is worthless.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type StageCameraMove = {
  at: number // mix seconds the move starts
  until: number // and completes (holds after, until the next move)
  from: number // zoom factor at `at` (>= 1)
  to: number // zoom factor at `until`
  cx?: number // zoom centre, viewport fraction (default 0.5)
  cy?: number
}

export type StageMeta = {
  /** The trailer's name; also the recorder's default output name. */
  name: string
  /** Absolute path to the finished mix the recorder muxes under the take — or
   *  NULL for a SILENT DRAFT (picture-only, no audio stream), so a cut can be
   *  shot and judged before any narration is rendered. */
  mix: string | null
  /** Mix seconds at which the take ends (the frame is fully faded by here). */
  end: number
  /**
   * Camera moves, applied by the RECORDER at mux time via zoompan — never as
   * DOM transforms, which would put a transform on an ancestor and kill any
   * backdrop-filter beneath it.
   */
  camera?: StageCameraMove[]
  /** The named cue map, exposed so the recorder can extract one labelled still
   *  per cue after the mux. Filled in by the shell; definitions never set it. */
  cues?: Record<string, number>
}

type FrameCb = (t: number) => void

type StageContextValue = {
  /** True once the named cue's time has passed. Unknown names are always false. */
  phase: (name: string) => boolean
  phases: Record<string, boolean>
  /** Register per-frame work (canvas paint, imperative positioning). */
  onFrame: (cb: FrameCb) => () => void
  /** Register a one-shot measurer, run after assets decode and before readyFlag. */
  onReady: (cb: () => void) => () => void
}

const StageContext = createContext<StageContextValue | null>(null)

export function useStage() {
  const ctx = use(StageContext)
  if (!ctx) throw new Error('Stage pieces must be composed inside <StageShell>.')
  return ctx
}

/** Typed phase shorthand: `const p = useStagePhases<keyof typeof CUES>()`, then
 *  `p.reveal`. A cue that has not fired reads undefined, which is falsy. */
export function useStagePhases<K extends string>() {
  return useStage().phases as Partial<Record<K, boolean>> as Record<K, boolean>
}

/** Per-frame registration for imperative work. */
export function useStageFrame(cb: FrameCb) {
  const { onFrame } = useStage()
  const ref = useRef(cb)
  // Latest-callback in an effect, never in render: the loop only reads it from
  // rAF, so effect-time freshness is exact enough and render stays pure.
  useEffect(() => {
    ref.current = cb
  })
  useEffect(() => onFrame((t) => ref.current(t)), [onFrame])
}

/** One-shot measurement, run once assets are decoded and before readyFlag. */
export function useStageReady(cb: () => void) {
  const { onReady } = useStage()
  const ref = useRef(cb)
  useEffect(() => {
    ref.current = cb
  })
  useEffect(() => onReady(() => ref.current()), [onReady])
}

/** Clock-driven typing: how many characters of `text` are visible at time t.
 *  One state change per character, off the shared frame loop. */
export function useStageTyping(text: string, startAt: number, secPerChar = 0.07) {
  const [n, setN] = useState(0)
  useStageFrame((t) => {
    if (t < startAt) return
    const next = Math.min(text.length, Math.floor((t - startAt) / secPerChar))
    setN((p) => (p === next ? p : next))
  })
  return n
}

declare global {
  interface Window {
    __stage?: { readyFlag: boolean; start: () => void; meta: StageMeta }
  }
}

export function StageShell({
  meta,
  cues,
  blackoutAt,
  blackoutColor = '#000',
  scene,
  overlay = 'none',
  offsets,
  children,
}: {
  meta: StageMeta
  /** Named cue -> mix seconds. Names become `phase(name)` booleans. */
  cues: Record<string, number>
  /** When the shell's fade begins. The page owns the fade; the recorder only
   *  fades the audio with it. */
  blackoutAt: number
  /** What the cut fades to. */
  blackoutColor?: string
  /** The set behind everything (a colour, an image, a video). */
  scene?: ReactNode
  /** A film grade over the whole frame. */
  overlay?: 'crt' | 'grain' | 'none'
  /**
   * Saved canvas-mode offsets (vw/vh) per `data-canvas-id` element — the
   * studio's drag-on-the-preview edits. Applied through the CSS `translate`
   * property, which COMPOSES with `transform` instead of fighting whatever
   * transform a piece already owns.
   */
  offsets?: Record<string, { dx: number; dy: number }>
  children: ReactNode
}) {
  // One state object; each cue flips exactly once in playback, so React hears
  // about a whole take in a couple of dozen renders rather than per frame.
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const frameCbs = useRef(new Set<FrameCb>())
  const readyCbs = useRef(new Set<() => void>())
  const rootRef = useRef<HTMLElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)

  const phase = useCallback((name: string) => flags[name] === true, [flags])
  const onFrame = useCallback((cb: FrameCb) => {
    frameCbs.current.add(cb)
    return () => frameCbs.current.delete(cb)
  }, [])
  const onReady = useCallback((cb: () => void) => {
    readyCbs.current.add(cb)
    return () => readyCbs.current.delete(cb)
  }, [])

  // Cues and meta are per-trailer constants; hold the mount's copy so the effect
  // below genuinely runs once. The blackout is a shell-owned cue under a
  // reserved name, so every trailer gets the same fade for free.
  const cuesRef = useRef({ ...cues, __blackout: blackoutAt })
  const metaRef = useRef(meta)
  const offsetsRef = useRef<Record<string, { dx: number; dy: number }>>({ ...(offsets ?? {}) })

  const applyOffsets = useCallback(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-canvas-id]')) {
      const o = offsetsRef.current[el.dataset.canvasId ?? '']
      el.style.translate = o ? `${o.dx}vw ${o.dy}vh` : ''
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.stage = '1'
    // Mutable so the editor can retime cues live; the run of show recomputes
    // next frame without a remount.
    let cueEntries = Object.entries(cuesRef.current)

    const params = new URLSearchParams(location.search)
    const editor = params.get('editor') === '1'
    // ?loop=1 with ?autostart: ambient playback for a preview surface — the
    // take restarts after the fade instead of sitting on black.
    const loop = params.get('loop') === '1'

    // In editor mode the MIX IS THE CLOCK while playing, so voice and picture
    // cannot drift apart; paused or scrubbing keeps the held clock.
    let mixAudio: HTMLAudioElement | null = null
    if (editor && metaRef.current.mix) {
      mixAudio = new Audio(`/api/mix/${metaRef.current.name}`)
      mixAudio.preload = 'auto'
    }

    let raf = 0
    let t0: number | null = null
    let held: number | null = editor ? 0 : null // the editor boots paused at 0
    const flipped = new Set<string>()
    let lastKey = ''
    let lastPost = 0

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (t0 === null && held === null) return
      const t =
        editor && mixAudio && held === null
          ? mixAudio.currentTime
          : held !== null
            ? held
            : (now - (t0 as number)) / 1000

      if (!editor && loop && t > metaRef.current.end + 0.8) {
        t0 = now
        flipped.clear()
        setFlags({})
        for (const cb of frameCbs.current) cb(0)
        return
      }
      if (editor) {
        let key = ''
        for (const [name, at] of cueEntries) if (t >= at) key += name + '|'
        if (key !== lastKey) {
          lastKey = key
          const next: Record<string, boolean> = {}
          for (const [name, at] of cueEntries) next[name] = t >= at
          setFlags(next)
        }
        if (now - lastPost > 100) {
          lastPost = now
          window.parent?.postMessage({ type: 'stage:time', t, playing: held === null }, '*')
        }
      } else {
        let dirty = false
        for (const [name, at] of cueEntries) {
          if (!flipped.has(name) && t >= at) {
            flipped.add(name)
            dirty = true
          }
        }
        if (dirty)
          setFlags((prev) => {
            const next = { ...prev }
            for (const name of flipped) next[name] = true
            return next
          })
      }

      for (const cb of frameCbs.current) cb(t)
    }
    raf = requestAnimationFrame(tick)

    // First paint of saved offsets — playback included, so a recording keeps
    // whatever the studio placed by hand.
    const offsetsTimer = setTimeout(applyOffsets, 50)

    // ── canvas mode: drag any [data-canvas-id] element on the preview ──────
    let canvasOn = false
    let dragEl: HTMLElement | null = null
    let dragStart = { x: 0, y: 0, dx: 0, dy: 0 }
    const onCanvasDown = (e: PointerEvent) => {
      if (!canvasOn) return
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-canvas-id]')
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      const o = offsetsRef.current[el.dataset.canvasId ?? ''] ?? { dx: 0, dy: 0 }
      dragEl = el
      dragStart = { x: e.clientX, y: e.clientY, dx: o.dx, dy: o.dy }
    }
    const onCanvasMove = (e: PointerEvent) => {
      if (!canvasOn || !dragEl) return
      const id = dragEl.dataset.canvasId ?? ''
      const dx = dragStart.dx + ((e.clientX - dragStart.x) / window.innerWidth) * 100
      const dy = dragStart.dy + ((e.clientY - dragStart.y) / window.innerHeight) * 100
      offsetsRef.current[id] = { dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 }
      dragEl.style.translate = `${offsetsRef.current[id].dx}vw ${offsetsRef.current[id].dy}vh`
    }
    const onCanvasUp = () => {
      if (!dragEl) return
      const id = dragEl.dataset.canvasId ?? ''
      window.parent?.postMessage({ type: 'canvas:moved', id, ...offsetsRef.current[id] }, '*')
      dragEl = null
    }
    if (editor) {
      window.addEventListener('pointerdown', onCanvasDown, true)
      window.addEventListener('pointermove', onCanvasMove, true)
      window.addEventListener('pointerup', onCanvasUp, true)
    }

    const onMsg = (e: MessageEvent) => {
      if (!editor || typeof e.data !== 'object' || !e.data) return
      const m = e.data as {
        type?: string
        t?: number
        rate?: number
        cues?: Record<string, number>
        on?: boolean
        offsets?: Record<string, { dx: number; dy: number }>
      }
      if (m.type === 'stage:canvas') {
        canvasOn = !!m.on
        document.documentElement.dataset.stageCanvas = canvasOn ? '1' : ''
        return
      }
      if (m.type === 'stage:offsets' && m.offsets) {
        offsetsRef.current = { ...m.offsets }
        applyOffsets()
        return
      }
      if (m.type === 'stage:seek' && typeof m.t === 'number') {
        held = Math.max(0, m.t)
        t0 = null
        if (mixAudio) {
          mixAudio.pause()
          mixAudio.currentTime = held
        }
      } else if (m.type === 'stage:play') {
        t0 = performance.now() - (held ?? 0) * 1000
        if (mixAudio) {
          mixAudio.currentTime = held ?? 0
          void mixAudio.play().catch(() => {})
        }
        held = null
      } else if (m.type === 'stage:pause') {
        held = editor && mixAudio ? mixAudio.currentTime : t0 !== null ? (performance.now() - t0) / 1000 : (held ?? 0)
        t0 = null
        mixAudio?.pause()
      } else if (m.type === 'stage:rate' && typeof m.rate === 'number') {
        if (mixAudio) mixAudio.playbackRate = m.rate
      } else if (m.type === 'stage:cues' && m.cues) {
        cueEntries = Object.entries({ ...m.cues, __blackout: m.cues.__blackout ?? cuesRef.current.__blackout })
        lastKey = '*' // force a phase recompute next frame
      } else if (m.type === 'stage:reload') {
        location.reload()
      }
    }
    window.addEventListener('message', onMsg)

    // ── readiness ─────────────────────────────────────────────────────────
    let cancelled = false
    const poll = (check: () => boolean) =>
      new Promise<void>((res) => {
        const loopUntil = () => {
          if (cancelled || check()) return res()
          setTimeout(loopUntil, 120)
        }
        loopUntil()
      })
    // A scene container without a video (a colour or an image set) has nothing
    // to wait on — treat it ready rather than spinning to the timeout.
    const sceneReady = poll(() => {
      const container = rootRef.current?.querySelector('[data-stage-scene]')
      if (!container) return true
      const v = container.querySelector('video')
      return !v || v.readyState >= 2
    })
    const assetsReady = async () => {
      const root = rootRef.current
      if (!root) return
      const videos = [...root.querySelectorAll<HTMLVideoElement>('video[data-stage-asset]')]
      const images = [...root.querySelectorAll<HTMLImageElement>('img[data-stage-asset]')]
      // Same-origin frames (the app being filmed): ready when their document has
      // loaded. A cross-origin frame cannot be inspected — count it ready
      // instead of spinning to the timeout.
      const frames = [...root.querySelectorAll<HTMLIFrameElement>('iframe[data-stage-asset]')]
      await Promise.all([
        ...videos.map((v) => poll(() => v.readyState >= 3)),
        ...images.map((i) => i.decode().catch(() => {})),
        ...frames.map((f) =>
          poll(() => {
            try {
              const doc = f.contentDocument
              return !doc || doc.readyState === 'complete'
            } catch {
              return true
            }
          }),
        ),
      ])
    }

    const api = {
      readyFlag: false,
      start: () => (t0 = performance.now()),
      meta: { ...metaRef.current, cues: cuesRef.current },
    }
    window.__stage = api
    void Promise.race([
      Promise.all([document.fonts.ready, sceneReady, assetsReady()]),
      new Promise((res) => setTimeout(res, 20000)),
    ]).then(() => {
      for (const cb of readyCbs.current) cb()
      api.readyFlag = true

      /**
       * Authoring convenience, dev only: `?autostart` arms the clock as soon as
       * the set is ready, and `?autostart=<seconds>` starts mid-take (t0
       * backdated), so iterating on the last beat does not cost a full wait.
       * The recorder never uses this — it arms start() itself, after the first
       * captured frame.
       */
      const auto = params.get('autostart')
      if (auto !== null) t0 = performance.now() - Math.max(0, Number(auto) || 0) * 1000
    })

    // The authoring HUD (?debug=1): running clock + the last cue that fired.
    if (params.get('debug') === '1') {
      const hud = hudRef.current
      if (hud) {
        hud.style.display = 'block'
        const byTime = [...cueEntries].sort((a, b) => a[1] - b[1])
        frameCbs.current.add((t) => {
          let last = '—'
          for (const [name, at] of byTime) {
            if (t >= at) last = `${name} (${at}s)`
            else break
          }
          hud.textContent = `t=${t.toFixed(2)}s · ${last}`
        })
      }
    }

    const frames = frameCbs.current
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(offsetsTimer)
      window.removeEventListener('message', onMsg)
      window.removeEventListener('pointerdown', onCanvasDown, true)
      window.removeEventListener('pointermove', onCanvasMove, true)
      window.removeEventListener('pointerup', onCanvasUp, true)
      mixAudio?.pause()
      mixAudio = null
      frames.clear()
      delete document.documentElement.dataset.stage
      delete window.__stage
    }
  }, [applyOffsets])

  const grade = overlay === 'crt' ? 'stage-crt' : overlay === 'grain' ? 'stage-grain' : ''

  return (
    <StageContext value={{ phase, phases: flags, onFrame, onReady }}>
      <main ref={rootRef} className={`relative min-h-screen w-full overflow-hidden ${grade}`}>
        {scene ?? <div data-stage-scene className="fixed inset-0 z-0" style={{ background: 'var(--ground)' }} />}

        {children}

        {/* The round-out. */}
        <div
          className="pointer-events-none fixed inset-0 z-50 transition-opacity duration-[1700ms] ease-in"
          style={{ background: blackoutColor, opacity: phase('__blackout') ? 1 : 0 }}
        />

        {/* The authoring HUD. Written imperatively: HUD state in React would
            re-render the shell, and through context every piece, at 60Hz.
            Always mounted so hydration sees one tree; display flips in the effect. */}
        <div
          ref={hudRef}
          className="pointer-events-none fixed top-2 left-2 z-[60] bg-black/80 px-2 py-1 font-mono text-[11px] tracking-wide text-white"
          style={{ display: 'none' }}
        />
      </main>
    </StageContext>
  )
}
