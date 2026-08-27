import type { NextConfig } from 'next'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Two things this config exists for:
 *
 * 1. THE TARGET PROXY. To drive an app like a user — click its buttons, type
 *    into its inputs — the stage must reach into the iframe, and a browser only
 *    allows that same-origin. So the app you are filming is proxied under
 *    `target.basePath` instead of being framed at its own origin.
 *
 * 2. THE FRAMING CARVE-OUT. Everything here answers with `X-Frame-Options:
 *    DENY` by default; the stage and the proxied target are excluded IN DEV
 *    ONLY, because the studio frames the stage and the stage frames the target.
 *    Production keeps the deny, so a deployed copy cannot be framed by anyone.
 */

function config() {
  for (const f of ['studio.config.local.json', 'studio.config.json']) {
    try {
      if (existsSync(f)) {
        const c = JSON.parse(readFileSync(f, 'utf8'))
        if (c?.target?.url) return c
      }
    } catch {
      /* a malformed config must not break the build; the app reports it */
    }
  }
  return null
}

const DEV = process.env.NODE_ENV !== 'production'
const cfg = config()
const targetUrl: string = cfg?.target?.url?.replace(/\/+$/, '') ?? ''
const basePath: string = (cfg?.target?.basePath ?? '/app').replace(/\/+$/, '')

const nextConfig: NextConfig = {
  async rewrites() {
    if (!DEV || !targetUrl) return []
    // Both forms: the bare path (a trailing-slash redirect would otherwise
    // bounce the frame out of the proxy) and everything under it.
    return [
      { source: basePath, destination: targetUrl },
      { source: `${basePath}/:path*`, destination: `${targetUrl}/:path*` },
    ]
  },
  async headers() {
    const baseline = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]
    const carved = ['stage', ...(basePath ? [basePath.replace(/^\//, '')] : [])].join('|')
    return [{ source: DEV ? `/((?!${carved}).*)` : '/(.*)', headers: baseline }]
  },
}

export default nextConfig
