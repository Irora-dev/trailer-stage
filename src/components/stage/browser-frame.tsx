'use client'

/**
 * THE APP ON CAMERA — your own running product, in a browser card, driven like
 * a user.
 *
 * Take the actual thing; do not rebuild it. A recreated UI drifts from the
 * product the day after you film it, and viewers can tell. So the app is served
 * SAME-ORIGIN through this project's dev proxy (`target.basePath` in
 * studio.config.json), which is what makes it drivable at all: a browser lets a
 * page reach into an iframe only when the origins match.
 *
 * Two frames:
 *  · a WARMUP frame, mounted immediately and never shown. It gates readiness
 *    (`data-stage-asset`), warms the HTTP and compile caches so the on-camera
 *    load is instant, and is where any first-run state gets written.
 *  · the JOURNEY frame, mounted on its cue — the one being filmed.
 *
 * ⚠️ SOME LAWS PAID FOR IN FOOTAGE:
 *  · Events must be constructed with the CHILD window's constructor. A
 *    PopStateEvent built in the parent realm is a different class than the one
 *    the child's router listens for, so navigation silently does nothing.
 *  · A plain `.value =` write never reaches a controlled React input; use the
 *    native setter from the CHILD realm's prototype, then dispatch `input`.
 *  · The router fix must RETRY. An iframe's `load` can fire before the app has
 *    installed its listeners, so a single shot is a race.
 *  · A DISABLED button is "not there yet", not "not there": apps disable
 *    controls while they fetch. The caller polls; see `click` returning false.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface FrameDrive {
  /** Navigate the app to a route (SPA push + popstate, then scroll to top). */
  nav: (path: string) => void
  /** Smooth-scroll so the first heading containing `text` sits at `frac` of the frame. */
  scrollToHeading: (text: string, frac?: number) => void
  scrollTo: (y: number) => void
  /** Click the first ENABLED element matching a selector. False = try again. */
  click: (selector: string) => boolean
  /** Click the best visible, enabled control for `text`: exact beats prefix
   *  beats substring, so a stray card holding the same word cannot win.
   *  `within` scopes the search to a selector's subtree. */
  clickText: (text: string, within?: string) => boolean
  /** Type into a field the way a person does: focus, then a character per
   *  1/cps seconds through the child realm's native setter. */
  type: (selector: string, text: string, cps?: number, enter?: boolean) => Promise<void>
  /** Escape hatch against the journey frame's window (same-origin). */
  run: (fn: (w: Window) => void) => void
}

function fireRoute(w: Window, path: string, push: boolean) {
  const Ctor = (w as unknown as { PopStateEvent: typeof PopStateEvent }).PopStateEvent
  if (push) w.history.pushState({}, '', path)
  else w.history.replaceState({}, '', path)
  w.dispatchEvent(new Ctor('popstate', { state: {} }))
}

/** Re-route the document from the proxy path to the app's own path, and keep
 *  retrying until something the app renders actually appears. */
function fixRouter(w: Window, path: string, ready: string, tries = 14) {
  try {
    fireRoute(w, path, false)
    if (!w.document.querySelector(ready) && tries > 0) setTimeout(() => fixRouter(w, path, ready, tries - 1), 350)
  } catch {
    /* frame gone mid-drive: the take is already spoiled and will be retaken */
  }
}

function setNativeValue(w: Window, input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    input instanceof (w as unknown as { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement
      ? (w as unknown as { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement.prototype
      : (w as unknown as { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value)
  input.dispatchEvent(new (w as unknown as { Event: typeof Event }).Event('input', { bubbles: true }))
}

export function StageBrowserFrame({
  basePath,
  mounted,
  visible,
  dimmed,
  path,
  onDrive,
  light = false,
  storage,
  clearStorage,
  startPath = '/',
  readySelector = 'nav, header, main',
  width = '86vw',
  height = '76vh',
  chromePx = 32,
}: {
  /** Where this project proxies the target app (studio.config.json). */
  basePath: string
  /** Mount the journey frame — the on-camera load. */
  mounted: boolean
  visible: boolean
  /** The app recedes under stage furniture for a closing beat. */
  dimmed?: boolean
  /** The route shown in the chrome bar. */
  path: string
  onDrive?: (drive: FrameDrive) => void
  /** Light chrome for a light app. */
  light?: boolean
  /** localStorage written before the journey mounts: a theme, a feature flag,
   *  a "you have seen the intro" stamp. Same origin, so this page owns it. */
  storage?: Record<string, string>
  /** Keys REMOVED before the journey mounts — the way to make a first run look
   *  like a first run (an intro that only plays once, a dismissed banner). */
  clearStorage?: string[]
  startPath?: string
  /** A selector that only exists once the app has rendered. */
  readySelector?: string
  width?: string
  height?: string
  /** Chrome bar height; 0 removes the bar and gives the frame the whole card. */
  chromePx?: number
}) {
  const journeyRef = useRef<HTMLIFrameElement | null>(null)
  const [booted, setBooted] = useState(false)
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`

  useEffect(() => {
    if (!mounted) return
    try {
      for (const k of clearStorage ?? []) window.localStorage.removeItem(k)
      for (const [k, v] of Object.entries(storage ?? {})) window.localStorage.setItem(k, v)
    } catch {
      /* storage unavailable: the app just opens in whatever state it had */
    }
  }, [mounted, storage, clearStorage])

  const handleLoad = useCallback(() => {
    const w = journeyRef.current?.contentWindow
    if (!w) return
    fixRouter(w, startPath, readySelector)
    setBooted(true)
  }, [startPath, readySelector])

  useEffect(() => {
    if (!booted || !onDrive) return
    const win = () => journeyRef.current?.contentWindow ?? null
    const drive: FrameDrive = {
      nav: (p) => {
        const w = win()
        if (!w) return
        try {
          fireRoute(w, p, true)
          w.scrollTo({ top: 0 })
        } catch {
          /* see fixRouter */
        }
      },
      scrollToHeading: (text, frac = 0.3) => {
        const w = win()
        if (!w) return
        try {
          const h = [...w.document.querySelectorAll('h1, h2, h3')].find((el) =>
            (el.textContent || '').toLowerCase().includes(text.toLowerCase()),
          )
          if (!h) return
          const top = h.getBoundingClientRect().top + w.scrollY - w.innerHeight * frac
          w.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
        } catch {
          /* see fixRouter */
        }
      },
      scrollTo: (y) => {
        try {
          win()?.scrollTo({ top: y, behavior: 'smooth' })
        } catch {
          /* see fixRouter */
        }
      },
      click: (selector) => {
        const w = win()
        if (!w) return false
        try {
          const el = w.document.querySelector<HTMLElement>(selector)
          if (!el || (el as HTMLButtonElement).disabled) return false
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          el.click()
          return true
        } catch {
          return false
        }
      },
      clickText: (text, within) => {
        const w = win()
        if (!w) return false
        try {
          const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
          const needle = norm(text)
          const root: ParentNode = (within && w.document.querySelector(within)) || w.document
          let best: HTMLElement | null = null
          let bestScore = 0
          for (const el of root.querySelectorAll<HTMLElement>('button, a, [role="button"]')) {
            if (el.getClientRects().length === 0) continue // hidden duplicates never win
            if ((el as HTMLButtonElement).disabled) continue // busy now, enabled soon
            const t = norm(el.textContent || '')
            const score = t === needle ? 3 : t.startsWith(needle) ? 2 : t.includes(needle) ? 1 : 0
            if (score > bestScore) {
              best = el
              bestScore = score
              if (score === 3) break
            }
          }
          if (!best) return false
          best.scrollIntoView({ block: 'center', behavior: 'smooth' })
          best.click()
          return true
        } catch {
          return false
        }
      },
      type: (selector, text, cps = 14, enter = false) =>
        new Promise<void>((resolve) => {
          const w = win()
          const input = w?.document.querySelector<HTMLInputElement>(selector)
          if (!w || !input) return resolve()
          try {
            input.focus()
            setNativeValue(w, input, '')
          } catch {
            return resolve()
          }
          let i = 0
          const step = () => {
            const ww = win()
            if (!ww) return resolve()
            i++
            try {
              setNativeValue(ww, input, text.slice(0, i))
            } catch {
              return resolve()
            }
            if (i < text.length) return setTimeout(step, 1000 / cps)
            if (enter) {
              try {
                const KB = (ww as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent
                input.dispatchEvent(new KB('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
              } catch {
                /* the field keeps the text; a click on the result still works */
              }
            }
            resolve()
          }
          setTimeout(step, 1000 / cps)
        }),
      run: (fn) => {
        const w = win()
        if (!w) return
        try {
          fn(w)
        } catch {
          /* see fixRouter */
        }
      },
    }
    onDrive(drive)
  }, [booted, onDrive])

  return (
    <>
      {/* Warmup: readiness gate and cache warmer. Never shown. */}
      <iframe
        src={base}
        data-stage-asset
        aria-hidden
        tabIndex={-1}
        className="fixed top-0 left-0 -z-50"
        style={{ width, height, visibility: 'hidden', pointerEvents: 'none', border: 0 }}
      />

      <div
        className="fixed top-1/2 left-1/2 z-20 overflow-hidden rounded-2xl transition-all duration-700"
        style={{
          width,
          height,
          transform: 'translate(-50%,-50%)',
          opacity: visible ? 1 : 0,
          background: light ? '#ffffff' : '#0a0c10',
          border: `1px solid ${light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)'}`,
          boxShadow: light
            ? '0 2px 4px rgba(20,22,30,0.04), 0 12px 28px rgba(20,22,30,0.08), 0 40px 90px rgba(20,22,30,0.12)'
            : '0 34px 110px rgba(0,0,0,0.65)',
        }}
      >
        {chromePx > 0 && (
          <div
            className="flex items-center gap-2 px-3.5"
            style={{
              height: chromePx,
              borderBottom: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)'}`,
              background: light ? '#f6f7f9' : 'rgba(255,255,255,0.04)',
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57cc' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2ecc' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840cc' }} />
            <span
              className="ml-3 rounded-md px-3 py-0.5 font-mono text-[11px] tracking-[0.08em]"
              style={{
                background: light ? '#fff' : 'rgba(0,0,0,0.4)',
                color: light ? '#4b4e5f' : 'rgba(255,255,255,0.6)',
                boxShadow: light ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {path}
            </span>
          </div>
        )}
        {mounted && (
          <iframe
            ref={journeyRef}
            src={base}
            title="the app"
            onLoad={handleLoad}
            className="block w-full"
            style={{
              height: `calc(100% - ${chromePx}px)`,
              border: 0,
              background: light ? '#f6f7f9' : '#07090c',
              colorScheme: light ? 'light' : 'dark',
            }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{ background: light ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)', opacity: dimmed ? 1 : 0 }}
        />
      </div>
    </>
  )
}
