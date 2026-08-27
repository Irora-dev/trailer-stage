import { type NextRequest } from 'next/server'
import { createReadStream, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { mixFileOf } from '@/lib/trailers'

/**
 * Streams a trailer's finished mix so the studio can play it.
 *
 * In editor mode the MIX IS THE CLOCK: the stage attaches this as an <audio>
 * element and slaves picture time to `audio.currentTime`, so narration and
 * picture cannot drift apart while you scrub. Range support is not optional —
 * some browsers' media stacks refuse a source that ignores Range.
 *
 * Dev-only, and the path never comes from the request: it is read out of the
 * trailer's own timeline, so only a registered mix is reachable.
 */

const DEV = process.env.NODE_ENV === 'development'

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  if (!DEV) return new Response('not found', { status: 404 })
  const { name } = await ctx.params
  const mix = mixFileOf(name)
  if (!mix) return new Response('no mix on disk for this trailer', { status: 404 })

  const { size } = statSync(mix)
  const type = mix.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '')
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end)
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    return new Response(Readable.toWeb(createReadStream(mix, { start, end })) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
      },
    })
  }
  return new Response(Readable.toWeb(createReadStream(mix)) as ReadableStream, {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
  })
}
