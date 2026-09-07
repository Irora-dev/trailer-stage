import { type NextRequest } from 'next/server'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { footageFilePath } from '@/lib/trailers'

/**
 * Streams one rendered footage file so the stage's `footage` piece can play it.
 *
 * Same posture as the mix route: dev-only, Range-capable (a <video> element
 * seeks, and the piece seeks it on purpose to hold the stage clock), and the
 * path never comes from the request as a path — the trailer name and file name
 * are both whitelisted and resolved inside `paths.footage/<name>/`, so nothing
 * outside that directory is reachable.
 */

const DEV = process.env.NODE_ENV === 'development'
const TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; file: string }> }) {
  if (!DEV) return new Response('not found', { status: 404 })
  const { name, file } = await ctx.params
  const path = footageFilePath(name, file)
  if (!path || !existsSync(path)) return new Response('no such footage for this trailer', { status: 404 })

  const { size } = statSync(path)
  const type = TYPES[(file.split('.').pop() ?? '').toLowerCase()] ?? 'application/octet-stream'
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '')
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end)
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
      },
    })
  }
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
  })
}
