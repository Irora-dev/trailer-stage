/**
 * A trailer is DATA: tracks of clips, each clip a moment on the mix clock.
 *
 * Sound was always data (a mix spec: lines, gaps, a bed). This model makes the
 * PICTURE data too — a clip whose params carry `piece` names a stage component
 * and its knobs (the vocabulary lives in ./pieces.ts) — so a new trailer is a
 * JSON file, the editor can open any of them, and a compiler can write one.
 *
 * Two clocks meet here. `at` / `until` are seconds on the finished mix. `anchor`
 * / `anchorUntil` say where those seconds CAME FROM in the narration's own terms
 * ("line:hook.end+0.4"); scripts/resolve-cues.mjs rewrites the numbers from the
 * measured cue map after every mix build, so re-rendering a line moves every
 * beat that hangs off it and nothing is nudged by hand. The stage and the editor
 * read the numbers only — neither parses an anchor.
 *
 * Shapes stay small and JSON-stable: the editor round-trips this file through
 * its API and the diffs have to stay readable.
 */

export type ParamValue = string | number | boolean | null | ParamValue[] | { [key: string]: ParamValue }

export interface TimelineClip {
  id: string
  /** Seconds on the mix clock. */
  at: number
  /** Open-ended when omitted (runs to the end of the cut). */
  until?: number
  /** Where `at` comes from, in the narration's terms. See the header. */
  anchor?: string
  /** Same, for `until`. */
  anchorUntil?: string
  /** Piece-specific knobs (texts, labels, colours, numbers) — all editable. */
  params?: Record<string, ParamValue>
}

export type TrackKind = 'visual' | 'audio' | 'marker'

export interface TimelineTrack {
  id: string
  name: string
  kind: TrackKind
  /** Audio tracks are the measured truth of the mix: shown, never dragged. */
  locked?: boolean
  clips: TimelineClip[]
}

/** A camera move, applied by the recorder at mux time (never as a DOM
 *  transform — an ancestor transform kills a backdrop-filter underneath it).
 *  `at`/`until` accept anchors like a clip's. */
export interface TimelineCameraMove {
  at: number | string
  until: number | string
  from: number
  to: number
  cx?: number
  cy?: number
}

export interface TimelineScene {
  kind?: 'theme' | 'color' | 'image' | 'video'
  /** For 'color': a CSS colour or gradient. */
  color?: string
  /** For 'image' / 'video': a public path. */
  src?: string
  /** Playback rate for a video set. */
  rate?: number
  /** A film grade over everything: scanlines, grain, or neither. */
  overlay?: 'crt' | 'grain' | 'none'
}

export interface TrailerTimeline {
  name: string
  /** Absolute end of the cut (seconds). */
  end: number
  /** When the fade-out begins. */
  blackoutAt?: number
  /** Where those two come from in the narration (see the header). */
  endAnchor?: string
  blackoutAnchor?: string
  /** The finished mix the recorder muxes under the picture, or null for a
   *  SILENT DRAFT: picture-only takes, so a cut can be iterated before any
   *  narration is rendered and any money is spent. */
  mix: string | null
  camera?: TimelineCameraMove[]
  scene?: TimelineScene
  /** The colour the cut fades to (default black; a light set names its paper). */
  blackoutColor?: string
  tracks: TimelineTrack[]
}

/** Pure time queries — derivation, never latching, so an editor can scrub in
 *  both directions and land on exactly what playback would show. */
export function clipActive(c: TimelineClip, t: number): boolean {
  return t >= c.at && (c.until === undefined || t < c.until)
}

export function activeClip(track: TimelineTrack | undefined, t: number): TimelineClip | null {
  if (!track) return null
  // Last-starting active clip wins: two clips may overlap briefly during an
  // edit, and the newer beat should take the layer.
  let best: TimelineClip | null = null
  for (const c of track.clips) if (clipActive(c, t) && (!best || c.at >= best.at)) best = c
  return best
}

export function trackOf(tl: TrailerTimeline, id: string): TimelineTrack | undefined {
  return tl.tracks.find((tr) => tr.id === id)
}

export function firstAt(tl: TrailerTimeline, trackId: string, fallback = 0): number {
  return trackOf(tl, trackId)?.clips[0]?.at ?? fallback
}

/** The reserved track holding drag-on-the-preview offsets (never a cue). */
export const OFFSETS_TRACK = 'offsets'

/** The cue that fires when a clip's `until` passes. `__`-prefixed on purpose:
 *  the recorder skips `__` names when it extracts one still per cue, and an end
 *  only ever repeats a beat the author already named. */
export const endCue = (clipId: string) => `__end~${clipId}`

/**
 * Every clip on a non-audio track is a cue named by its id; a clip with `until`
 * also owns its end cue, so "visible while this clip is active" works in the
 * latching playback machine and under the editor's scrub alike. The shell's own
 * `__blackout` rides along.
 */
export function cuesOf(tl: TrailerTimeline): Record<string, number> {
  const cues: Record<string, number> = {}
  for (const tr of tl.tracks) {
    if (tr.kind === 'audio' || tr.id === OFFSETS_TRACK) continue
    for (const c of tr.clips) {
      cues[c.id] = c.at
      if (c.until !== undefined) cues[endCue(c.id)] = c.until
    }
  }
  cues.__blackout = tl.blackoutAt ?? tl.end - 1.4
  return cues
}

export function offsetsOf(tl: TrailerTimeline): Record<string, { dx: number; dy: number }> {
  const out: Record<string, { dx: number; dy: number }> = {}
  for (const c of trackOf(tl, OFFSETS_TRACK)?.clips ?? [])
    out[c.id] = { dx: Number(c.params?.dx ?? 0), dy: Number(c.params?.dy ?? 0) }
  return out
}

export type TimelineCaption = { at: number; until: number; text: string }

/** Caption lines: every clip on a `captions` track, plus any clip whose piece is
 *  `caption`. Timings are the mix builder's measured segments, never eyeballed. */
export function captionsOf(tl: TrailerTimeline): TimelineCaption[] {
  const lines: TimelineCaption[] = []
  for (const tr of tl.tracks) {
    if (tr.kind === 'audio') continue
    for (const c of tr.clips) {
      if (tr.id !== 'captions' && c.params?.piece !== 'caption') continue
      lines.push({ at: c.at, until: c.until ?? tl.end, text: String(c.params?.text ?? '') })
    }
  }
  return lines.sort((a, b) => a.at - b.at)
}
