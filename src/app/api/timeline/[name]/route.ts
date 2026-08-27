import { NextResponse, type NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { NAME_RE, timelinePath, writeTimeline } from '@/lib/trailers'
import type { TrailerTimeline } from '@/lib/timeline'

/**
 * The studio's persistence: GET and POST a trailer's timeline.
 *
 * Writing is the whole point — the editor IS how these files change — but it is
 * dev-gated, name-whitelisted, and locked to the trailers directory, so this can
 * never become a write hole in a deployed copy.
 */

const DEV = process.env.NODE_ENV === 'development'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  if (!DEV) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { name } = await ctx.params
  const file = timelinePath(name)
  if (!file) return NextResponse.json({ error: 'bad name' }, { status: 400 })
  try {
    return NextResponse.json(JSON.parse(await readFile(file, 'utf8')))
  } catch {
    return NextResponse.json({ error: 'no timeline for this trailer' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  if (!DEV) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { name } = await ctx.params
  if (!NAME_RE.test(name)) return NextResponse.json({ error: 'bad name' }, { status: 400 })
  const body = (await req.json().catch(() => null)) as TrailerTimeline | null
  if (!body || typeof body !== 'object' || body.name !== name || !Array.isArray(body.tracks))
    return NextResponse.json({ error: 'not a timeline for this trailer' }, { status: 400 })
  const ok = await writeTimeline(name, body)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'write failed' }, { status: 500 })
}
