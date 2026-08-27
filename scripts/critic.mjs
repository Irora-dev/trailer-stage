#!/usr/bin/env node
/**
 * THE CRITIC — the read-the-frames pass, as a tool.
 *
 *   node scripts/critic.mjs <name> [--take take-003] [--stills 24] [--dry-run]
 *
 * The single most valuable habit in this whole system is looking at the frames
 * instead of the log: a log cannot see a caption sitting on a logo, an actor
 * clipped by the card edge, or a loading state that never resolved. This hands
 * the labelled cue stills and the storyboard to a model and gets back a ranked
 * list of what is actually wrong, tied to the still that shows it.
 *
 * It writes <take>.critic.json beside the take and prints the list. It approves
 * nothing — that is a person, on the review board.
 */

import Anthropic from '@anthropic-ai/sdk'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { arg, ffmpegPath, has, storyboardPath, takesDir, timelinePath } from './lib.mjs'

const name = process.argv[2]
if (!name || name.startsWith('--')) {
  console.error('Usage: node scripts/critic.mjs <name> [--take take-NNN] [--stills 24] [--dry-run]')
  process.exit(1)
}
const MODEL = arg('model', 'claude-opus-5')
const EFFORT = arg('effort', 'high')

const dir = takesDir(name)
if (!existsSync(dir)) {
  console.error(`No takes for ${name}. Record one first.`)
  process.exit(1)
}
const frameDirs = readdirSync(dir).filter((f) => /^take-\d+.*\.frames$/.test(f)).sort()
const takeArg = arg('take')
const chosen = takeArg ? `${takeArg.replace(/\.frames$|\.mp4$/, '')}.frames` : frameDirs[frameDirs.length - 1]
if (!chosen || !existsSync(join(dir, chosen))) {
  console.error(`No cue stills at ${join(dir, chosen ?? '(none)')}`)
  process.exit(1)
}
const all = readdirSync(join(dir, chosen)).filter((f) => f.endsWith('.png')).sort()
const want = Math.max(1, Number(arg('stills', 24)))
const step = Math.max(1, Math.ceil(all.length / want))
const stills = all.filter((_, i) => i % step === 0)

const storyboard = existsSync(storyboardPath(name)) ? readFileSync(storyboardPath(name), 'utf8') : null
const timeline = existsSync(timelinePath(name)) ? readFileSync(timelinePath(name), 'utf8') : null

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'findings', 'praise'],
  properties: {
    verdict: { type: 'string', enum: ['ship', 'fix', 'redo'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'still', 'cue', 'what', 'evidence', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'defect', 'nit'] },
          still: { type: 'string' },
          cue: { type: 'string' },
          what: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    praise: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = `You are the frame critic for a trailer stage. You receive the cue stills of ONE take (each
filename is <mix seconds>s-<cue name>.png, extracted 0.6s after its cue so entrances have landed)
plus the storyboard and timeline describing what SHOULD be on screen at each beat. Return a ranked
list of concrete visual defects, each tied to the still that shows it.

THE CHECKS THAT MATTER (every one of these has shipped in somebody's trailer):
- a subject clipped by the frame or a card edge, or floating where it should be standing on something
- an element centred twice, so it sits offset from what it should align with
- a reveal or a title landing OVER content that has not left yet — the set should empty first
- a loading state, a spinner, an error, or an empty state visible on a product surface
- overlapping labels; a caption over a logo, a plate, or a button
- a card that grew mid-take because text was typed into it without reserving its height
- invented data or placeholder text presented as real, with no label saying it is an example
- a typo, a truncated line, text cut off by an edge
- an empty frame where the storyboard promises a beat, or a beat that never appears
- the camera cropping the thing the narration is talking about

Severity: blocker = must fix before anyone sees it; defect = fix in the next round; nit = taste.
Be specific and short, and cite the still. If the take is clean, say so plainly: a false positive
costs more than a miss, because it sends someone hunting for a problem that is not there.`

let ffmpegBin = null
async function upload(path) {
  if (ffmpegBin === null) ffmpegBin = (await ffmpegPath({ required: false })) ?? false
  if (ffmpegBin) {
    const r = spawnSync(ffmpegBin, ['-v', 'error', '-i', path, '-vf', 'scale=1024:-2', '-q:v', '4', '-f', 'mjpeg', 'pipe:1'], { maxBuffer: 1 << 26 })
    if (r.status === 0 && r.stdout?.length) return { media_type: 'image/jpeg', data: r.stdout.toString('base64'), bytes: r.stdout.length }
  }
  const buf = readFileSync(path)
  return { media_type: 'image/png', data: buf.toString('base64'), bytes: buf.length }
}

const uploads = []
for (const f of stills) uploads.push({ f, ...(await upload(join(dir, chosen, f))) })

const content = [
  {
    type: 'text',
    text: `TAKE: ${name}/${chosen} (${stills.length} of ${all.length} cue stills, evenly thinned).\n\n${storyboard ? `STORYBOARD:\n${storyboard}` : 'No storyboard on disk; judge against the timeline and the checks above.'}\n\n${timeline ? `TIMELINE:\n${timeline}` : ''}`,
  },
  ...uploads.flatMap((u) => [
    { type: 'text', text: `Still ${u.f}:` },
    { type: 'image', source: { type: 'base64', media_type: u.media_type, data: u.data } },
  ]),
]

const bytes = uploads.reduce((n, u) => n + u.bytes, 0)
console.log(`\n  critic — ${name}/${chosen}: ${stills.length} stills (${(bytes / 1048576).toFixed(1)} MB) · ${MODEL} effort ${EFFORT}`)
if (has('dry-run')) {
  console.log('  dry run: nothing called.\n')
  process.exit(0)
}

const client = new Anthropic()
const stream = client.messages.stream({
  model: MODEL,
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
  system: SYSTEM,
  messages: [{ role: 'user', content }],
})
const res = await stream.finalMessage()
if (res.stop_reason === 'refusal') {
  console.error(`  the model declined: ${res.stop_details?.category ?? 'unspecified'}`)
  process.exit(3)
}
const report = JSON.parse(res.content.find((b) => b.type === 'text')?.text ?? '{}')
const order = { blocker: 0, defect: 1, nit: 2 }
report.findings.sort((a, b) => order[a.severity] - order[b.severity])
report.take = `${name}/${chosen}`
report.model = MODEL
report.stills = stills

const out = join(dir, `${chosen.replace(/\.frames$/, '')}.critic.json`)
writeFileSync(out, JSON.stringify(report, null, 2) + '\n')

console.log(`\n  VERDICT: ${report.verdict.toUpperCase()} — ${report.summary}\n`)
for (const f of report.findings)
  console.log(`  ${f.severity.padEnd(7)} ${f.still.padEnd(28)} ${f.what}\n          evidence: ${f.evidence}\n          fix: ${f.fix}`)
if (report.praise?.length) console.log(`\n  worked: ${report.praise.join(' · ')}`)
console.log(`\n  written: ${out}\n  tokens: in ${res.usage.input_tokens} · out ${res.usage.output_tokens}\n`)
