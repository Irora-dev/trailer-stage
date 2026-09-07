/**
 * studio.config.json — the one place a project describes itself to the stage.
 *
 * Everything that used to be hard-coded into a trailer (the brand's colours and
 * type, the narrator, the app being filmed, where takes land) is configuration,
 * so the same stage films any project. `studio.config.local.json` sits beside it
 * for machine-local overrides (a target URL, an output path) and is gitignored.
 *
 * Read it with `loadConfig()` on the server. The theme travels to the browser as
 * CSS custom properties, so a stage piece never imports this file.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface StudioTheme {
  ground: string
  panel: string
  panel2: string
  line: string
  ink: string
  inkDim: string
  inkFaint: string
  accent: string
  accentInk: string
  positive: string
  negative: string
  fontDisplay: string
  fontBody: string
  fontMono: string
  /** A stylesheet the stage loads for the fonts above (a Google Fonts href, or ''). */
  fontHref: string
  /** Public path to a logo image used by the reveal and the end card ('' = none). */
  logo: string
  wordmark: string
  plate: string
}

export interface StudioConfig {
  project: { name: string; tagline: string; about: string; url: string }
  /** The app to film. `url` is its dev server; `basePath` is where this app
   *  proxies it, so the stage can drive it same-origin. Empty url = no proxy. */
  target: { url: string; basePath: string; storage: Record<string, string> }
  theme: StudioTheme
  voice: { id: string; name: string; model: string; stability: number; brief: string }
  mix: { prerollSec: number; tailSec: number; bedGainDb: number; duckDb: number }
  record: { width: number; height: number; fps: number; lufs: number }
  paths: { trailers: string; takes: string; audio: string; footage: string }
  /** Generated footage (the `footage` piece): the hard spend cap per builder run,
   *  and per-second price overrides keyed by model id then resolution. Prices
   *  move monthly; `pricesAsOf` is printed with every dry run so a stale table
   *  is visible. */
  footage: {
    budgetUsd: number
    /** Across runs: the ledger `.footage/SPEND.jsonl` is summed for the calendar month. */
    monthlyUsd: number
    /** Any single render above this refuses without --allow-expensive. */
    perShotUsd: number
    /** A price table older than this refuses without --accept-stale-prices. */
    priceMaxAgeDays: number
    /** A cached endpoint schema older than this is re-fetched before a spend. */
    schemaMaxAgeDays: number
    pricesAsOf: string
    prices: Record<string, Record<string, number>>
  }
}

const DEFAULTS: StudioConfig = {
  project: { name: 'Untitled', tagline: '', about: '', url: '' },
  target: { url: '', basePath: '/app', storage: {} },
  theme: {
    ground: '#0b0d10',
    panel: '#14181d',
    panel2: '#1b2027',
    line: '#272d36',
    ink: '#f2f4f7',
    inkDim: '#aeb6c2',
    inkFaint: '#7d8695',
    accent: '#5b45e0',
    accentInk: '#ffffff',
    positive: '#3fbf5f',
    negative: '#f06565',
    fontDisplay: 'ui-sans-serif, system-ui, sans-serif',
    fontBody: 'ui-sans-serif, system-ui, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontHref: '',
    logo: '',
    wordmark: '',
    plate: '',
  },
  voice: { id: '', name: 'narrator', model: 'eleven_v3', stability: 0.4, brief: '' },
  mix: { prerollSec: 4, tailSec: 3, bedGainDb: 1.5, duckDb: 4 },
  record: { width: 1280, height: 720, fps: 30, lufs: -23 },
  paths: { trailers: 'trailers', takes: '.takes', audio: '.audio', footage: '.footage' },
  footage: { budgetUsd: 100, monthlyUsd: 200, perShotUsd: 10, priceMaxAgeDays: 30, schemaMaxAgeDays: 7, pricesAsOf: '', prices: {} },
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** One level of section merge: `{theme: {ink}}` overrides ink and keeps the rest. */
function merge<T>(base: T, over: Record<string, unknown> | null): T {
  if (!over) return base
  const out = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('$')) continue
    out[k] = isObj(v) && isObj(out[k]) ? { ...(out[k] as Record<string, unknown>), ...v } : v
  }
  return out as T
}

export function loadConfig(root = process.cwd()): StudioConfig {
  const base = merge(DEFAULTS, readJson(join(root, 'studio.config.json')))
  return merge(base, readJson(join(root, 'studio.config.local.json')))
}

/** The theme as CSS custom properties, for the stage's root element. */
export function themeVars(t: StudioTheme): Record<string, string> {
  return {
    '--ground': t.ground,
    '--panel': t.panel,
    '--panel-2': t.panel2,
    '--line': t.line,
    '--ink': t.ink,
    '--ink-dim': t.inkDim,
    '--ink-faint': t.inkFaint,
    '--accent': t.accent,
    '--accent-ink': t.accentInk,
    '--positive': t.positive,
    '--negative': t.negative,
    '--font-display': t.fontDisplay,
    '--font-body': t.fontBody,
    '--font-mono': t.fontMono,
  }
}
