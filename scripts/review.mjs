#!/usr/bin/env node
/**
 * THE REVIEW BOARD — every trailer on one page, newest take playing, with the
 * per-cue contact sheet under it.
 *
 *   node scripts/review.mjs [port]        (default 4600)
 *
 * The contact sheet is the point: a note can then say "at the reveal" instead of
 * "at about nineteen seconds", and whoever fixes it knows exactly which beat is
 * meant.
 *
 * APPROVAL IS A BUTTON HERE, and it is a human's. It writes a marker file next
 * to the takes; from then on every new recording of that trailer is compared
 * against that golden automatically and prints the ranked difference. No script
 * ever approves anything.
 *
 * It also serves the audition board (/auditions) when AUDITIONS_DIR points at a
 * casting round.
 */

import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { paths } from './lib.mjs'

const ROOT_TAKES = paths().takes
const PORT = Number(process.argv[2] || 4600)
const AUDITIONS_DIR = process.env.AUDITIONS_DIR ? resolve(process.env.AUDITIONS_DIR) : null

const TYPES = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json' }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function takesFor(trailer) {
  const dir = join(ROOT_TAKES, trailer)
  try {
    return readdirSync(dir)
      .filter((f) => /^take-\d+.*\.mp4$/.test(f))
      .sort()
      .reverse()
  } catch {
    return []
  }
}

function approvedOf(trailer) {
  try {
    return readFileSync(join(ROOT_TAKES, trailer, 'APPROVED'), 'utf8').trim() || null
  } catch {
    return null
  }
}

function stillsFor(trailer, take) {
  const dir = join(ROOT_TAKES, trailer, `${take.replace(/\.mp4$/, '')}.frames`)
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => `${trailer}/${take.replace(/\.mp4$/, '')}.frames/${f}`)
  } catch {
    return []
  }
}

const STYLE = `
  :root { color-scheme: dark; }
  * { margin: 0; box-sizing: border-box; }
  body { background: #0c0d10; color: #d6dae2; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 28px; max-width: 1100px; margin-inline: auto; }
  h1 { font-size: 15px; letter-spacing: .18em; color: #8b7bff; text-transform: uppercase; margin-bottom: 6px; }
  h2 { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; margin: 30px 0 8px; }
  .lede { color: rgba(214,218,226,.5); font-size: 12px; margin-bottom: 8px; }
  .dim { color: rgba(214,218,226,.45); font-weight: 400; font-size: 12px; }
  video { width: 100%; border-radius: 8px; background: #000; }
  .sheet { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 10px; }
  .sheet figure { margin: 0; }
  .sheet img { width: 100%; border-radius: 4px; border: 1px solid rgba(255,255,255,.08); }
  .sheet figcaption { font-size: 10px; color: rgba(214,218,226,.45); margin-top: 3px; }
  .row { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  .badge { color: #3fbf5f; font-size: 12px; letter-spacing: .1em; }
  button { background: transparent; border: 1px solid rgba(139,123,255,.5); color: #8b7bff; font: inherit; font-size: 11px; padding: 2px 10px; cursor: pointer; }
  button:hover { background: rgba(139,123,255,.12); }
  details { margin-top: 8px; }
  a { color: #8b7bff; }
`

function indexHtml() {
  let trailers = []
  try {
    trailers = readdirSync(ROOT_TAKES).filter((d) => takesFor(d).length > 0).sort()
  } catch {
    /* no takes yet */
  }
  const body = trailers
    .map((t) => {
      const takes = takesFor(t)
      const newest = takes[0]
      const approved = approvedOf(t)
      const stills = stillsFor(t, newest)
      return `
      <h2>${esc(t)} <span class="dim">· ${takes.length} take${takes.length === 1 ? '' : 's'}</span></h2>
      <div class="row">
        <strong>${esc(newest)}</strong>
        ${approved === newest.replace(/\.mp4$/, '') ? '<span class="badge">★ approved</span>' : `<button onclick="approve('${esc(t)}','${esc(newest.replace(/\.mp4$/, ''))}')">approve this take</button>`}
        ${approved ? `<span class="dim">approved: ${esc(approved)}</span>` : ''}
      </div>
      <video src="/f/${esc(t)}/${esc(newest)}" controls preload="metadata"></video>
      ${
        stills.length
          ? `<div class="sheet">${stills
              .map((s) => `<figure><a href="/f/${esc(s)}" target="_blank"><img loading="lazy" src="/f/${esc(s)}" alt=""></a><figcaption>${esc(s.split('/').pop().replace(/\.png$/, ''))}</figcaption></figure>`)
              .join('')}</div>`
          : '<p class="dim">no cue stills for this take</p>'
      }
      ${
        takes.length > 1
          ? `<details><summary class="dim">${takes.length - 1} earlier take${takes.length === 2 ? '' : 's'}</summary>${takes
              .slice(1)
              .map((k) => `<p class="dim" style="margin-top:8px">${esc(k)}</p><video src="/f/${esc(t)}/${esc(k)}" controls preload="none"></video>`)
              .join('')}</details>`
          : ''
      }`
    })
    .join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Takes</title><style>${STYLE}</style>
<script>
  async function approve(trailer, take) {
    await fetch('/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trailer, take }) })
    location.reload()
  }
</script>
</head><body>
<h1>Takes</h1>
<p class="lede">Newest take per trailer, with one still per cue underneath — so a note can name a beat instead of a timestamp.${AUDITIONS_DIR ? ' · <a href="/auditions">voice auditions →</a>' : ''}</p>
${body || '<p class="dim">No takes yet. Record one: npm run trailer -- &lt;name&gt; --go</p>'}
</body></html>`
}

function auditionsHtml() {
  if (!AUDITIONS_DIR) return '<p>Set AUDITIONS_DIR to a casting round.</p>'
  let manifest = { cast: [] }
  try {
    manifest = JSON.parse(readFileSync(join(AUDITIONS_DIR, 'audition-manifest.json'), 'utf8'))
  } catch {
    /* empty board until a casting round has run */
  }
  let picked = null
  try {
    picked = readFileSync(join(AUDITIONS_DIR, 'PICK'), 'utf8').trim() || null
  } catch {
    /* nothing cast yet */
  }
  const entries = (manifest.cast || []).filter((c) => c.ok !== false && existsSync(join(AUDITIONS_DIR, `${c.slug}.audition.mp3`)))
  // Rounds come from the entries themselves — a board that hard-codes round
  // numbers silently drops a later casting round's work.
  const rounds = [...new Set(entries.map((c) => (typeof c.round === 'number' ? c.round : 1)))].sort((a, b) => b - a)
  const rows = rounds
    .map((r) => {
      const group = entries.filter((c) => (typeof c.round === 'number' ? c.round : 1) === r)
      const line = manifest[`round${r}`]?.line || group[0]?.line || manifest.line || ''
      return `<h2>Round ${r} <span class="dim">· ${group.length} preview${group.length === 1 ? '' : 's'} · every candidate reads the same line</span></h2>
        <p class="dim" style="border-left:2px solid rgba(139,123,255,.4);padding:6px 12px;margin:10px 0 14px">${esc(line)}</p>
        ${group
          .map(
            (c, i) => `<div class="row" style="border-top:1px solid rgba(255,255,255,.08);padding-top:12px;margin-top:12px">
              <span class="dim">${String(i + 1).padStart(2, '0')}</span>
              <strong>${esc(c.name)}</strong>
              <span class="dim">${esc(c.why || '')}</span>
              ${picked === c.slug ? '<span class="badge">★ cast</span>' : `<button onclick="pick('${esc(c.slug)}')">cast this one</button>`}
            </div>
            <audio style="width:100%;margin-top:6px" src="/a/${esc(c.slug)}.audition.mp3" controls preload="none"></audio>`,
          )
          .join('')}`
    })
    .join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Voice auditions</title><style>${STYLE}</style>
<script>
  async function pick(slug) {
    await fetch('/auditions/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug }) })
    location.reload()
  }
</script>
</head><body>
<h1>${esc(manifest.title || 'Voice auditions')}</h1>
<p class="lede"><a href="/">← takes</a> · candidates in a round read the SAME line, tags and all — the only variable is the voice. Cast one and the next build renders with it.</p>
${rows || '<p class="dim">No auditions rendered yet.</p>'}
</body></html>`
}

function serveFile(res, file, req) {
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404)
    return res.end('not found')
  }
  const { size } = statSync(file)
  const type = TYPES[extname(file)] ?? 'application/octet-stream'
  // Range support is not optional: some media stacks refuse a source without it.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
    })
    return createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' })
  createReadStream(file).pipe(res)
}

const readBody = (req) =>
  new Promise((res) => {
    let b = ''
    req.on('data', (d) => (b += d))
    req.on('end', () => res(b))
  })

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  res.setHeader('Cache-Control', 'no-store')

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': TYPES['.html'] })
    return res.end(indexHtml())
  }
  if (url.pathname === '/auditions') {
    res.writeHead(200, { 'Content-Type': TYPES['.html'] })
    return res.end(auditionsHtml())
  }
  if (url.pathname === '/approve' && req.method === 'POST') {
    const { trailer, take } = JSON.parse((await readBody(req)) || '{}')
    if (!/^[\w-]+$/.test(trailer ?? '') || !/^[\w.-]+$/.test(take ?? '')) {
      res.writeHead(400)
      return res.end('bad request')
    }
    writeFileSync(join(ROOT_TAKES, trailer, 'APPROVED'), `${take}\n`)
    res.writeHead(200, { 'Content-Type': TYPES['.json'] })
    return res.end('{"ok":true}')
  }
  if (url.pathname === '/auditions/pick' && req.method === 'POST' && AUDITIONS_DIR) {
    const { slug } = JSON.parse((await readBody(req)) || '{}')
    if (!/^[\w-]+$/.test(slug ?? '') || !existsSync(join(AUDITIONS_DIR, `${slug}.audition.mp3`))) {
      res.writeHead(400)
      return res.end('bad request')
    }
    writeFileSync(join(AUDITIONS_DIR, 'PICK'), `${slug}\n`)
    res.writeHead(200, { 'Content-Type': TYPES['.json'] })
    return res.end('{"ok":true}')
  }
  if (url.pathname.startsWith('/f/')) {
    const rel = decodeURIComponent(url.pathname.slice(3))
    const file = join(ROOT_TAKES, rel)
    // Never serve outside the takes directory, whatever the path claims.
    if (!resolve(file).startsWith(resolve(ROOT_TAKES))) {
      res.writeHead(403)
      return res.end('no')
    }
    return serveFile(res, file, req)
  }
  if (url.pathname.startsWith('/a/') && AUDITIONS_DIR) {
    const file = join(AUDITIONS_DIR, decodeURIComponent(url.pathname.slice(3)))
    if (!resolve(file).startsWith(AUDITIONS_DIR) || !file.endsWith('.mp3')) {
      res.writeHead(403)
      return res.end('no')
    }
    return serveFile(res, file, req)
  }
  res.writeHead(404)
  res.end('not found')
}).listen(PORT, () => {
  console.log(`review board: http://localhost:${PORT}  (serving ${ROOT_TAKES})`)
  if (AUDITIONS_DIR) console.log(`auditions:    http://localhost:${PORT}/auditions  (${AUDITIONS_DIR})`)
})
