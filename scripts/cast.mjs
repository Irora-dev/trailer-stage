#!/usr/bin/env node
/**
 * CASTING A NARRATOR — design voices, audition them, pick one.
 *
 *   node scripts/cast.mjs --line "the opening of your trailer, tags and all" \
 *                         --describe "a warm British narrator in his fifties…" \
 *                         [--describe "…another candidate…"] [--slug partner] [--go]
 *   node scripts/cast.mjs --measure                 # rank the previews by dynamic range
 *   node scripts/cast.mjs --create <slug> --name "My Narrator"
 *
 * Voice design returns three previews per description, and the previews ALREADY
 * READ YOUR LINE — so the audition is the real thing, not a sample of unrelated
 * speech.
 *
 * TWO RULES LEARNED THE EXPENSIVE WAY:
 *   1. AUDITION ON THE LINE AS IT WILL BE PERFORMED — with the bracketed
 *      directions, the pauses, the stressed words. A candidate auditioned on
 *      plain text is a different performer once you direct them, and you find
 *      that out after paying for the whole cut.
 *   2. BRIEF FOR RANGE IF YOU WANT RANGE. "Calm, measured, unhurried" gets you
 *      exactly that: flat. `--measure` scores each preview's loudness range,
 *      which is a decent proxy for whether a read moves at all.
 *
 * Previews land in <audio>/auditions/. Put them on the board:
 *   AUDITIONS_DIR=.audio/auditions npm run review
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { arg, config, ensureDir, ffmpegPath, has, paths } from './lib.mjs'
import { apiKey, designVoice, saveVoice } from './voice.mjs'

const DIR = ensureDir(join(paths().audio, 'auditions'))
const MANIFEST = join(DIR, 'audition-manifest.json')
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { cast: [] }

// ── measure: dynamic range per preview ──────────────────────────────────────
if (has('measure')) {
  const FF = await ffmpegPath()
  const rows = []
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.audition.mp3')).sort()) {
    const r = spawnSync(FF, ['-hide_banner', '-nostats', '-i', join(DIR, f), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' })
    const out = `${r.stderr}${r.stdout}`
    // The LAST match: ebur128 prints a running summary on every progress line.
    const last = (re) => [...out.matchAll(re)].pop()?.[1]
    const lra = Number(last(/LRA:\s*([-\d.]+)\s*LU/g))
    const I = Number(last(/I:\s*([-\d.]+)\s*LUFS/g))
    const dur = [...out.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop()
    const secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 0
    const entry = manifest.cast?.find((c) => `${c.slug}.audition.mp3` === f)
    rows.push({ f, lra, I, secs, round: entry?.round ?? '-' })
  }
  rows.sort((a, b) => b.lra - a.lra)
  console.log('\n  preview                        round   range(LU)   level(LUFS)   seconds')
  for (const r of rows)
    console.log(`  ${r.f.padEnd(30)} ${String(r.round).padStart(5)}   ${String(r.lra).padStart(9)}   ${String(r.I).padStart(11)}   ${r.secs.toFixed(1)}`)
  console.log('\n  wider range = a read that moves. It is a proxy, not a judge: listen to the top few.\n')
  process.exit(0)
}

// ── create the saved voice from a picked preview ────────────────────────────
const createSlug = arg('create')
if (createSlug) {
  const entry = (manifest.cast ?? []).find((c) => c.slug === createSlug)
  if (!entry?.generated_voice_id) {
    console.error(`no preview "${createSlug}" in ${MANIFEST}`)
    process.exit(1)
  }
  const voiceName = arg('name', `Narrator (${entry.name})`)
  const out = await saveVoice({ name: voiceName, description: entry.voice_description, generatedVoiceId: entry.generated_voice_id })
  entry.voice_id = out.voice_id
  manifest.pick = { slug: createSlug, voice_id: out.voice_id, voice_name: voiceName }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
  console.log(`
  created voice ${out.voice_id} ("${voiceName}")

  Put it in studio.config.json so every trailer uses it:
      "voice": { "id": "${out.voice_id}", "name": ${JSON.stringify(voiceName)} }
`)
  process.exit(0)
}

// ── design a round ──────────────────────────────────────────────────────────
const line = arg('line') ?? manifest.line
const describes = process.argv.reduce((acc, a, i) => (a === '--describe' && process.argv[i + 1] ? [...acc, process.argv[i + 1]] : acc), [])
if (!line || !describes.length) {
  console.error(`
Usage:
  node scripts/cast.mjs --line "<the opening line, with its direction tags>" \\
                        --describe "<a voice, in a sentence or three>" [--describe "…"] [--slug name] [--go]

  Then: AUDITIONS_DIR=${paths().audio}/auditions npm run review   → cast one
  Then: node scripts/cast.mjs --create <slug> --name "My Narrator"
`)
  process.exit(1)
}
if (line.length < 100)
  console.log('  ⚠ a short audition line tells you little. 150 to 400 characters, with the direction tags, is a real test.\n')

const round = (Math.max(0, ...(manifest.cast ?? []).map((c) => c.round ?? 1)) || 0) + 1
const slugBase = arg('slug', `round${round}`)

if (!has('go')) {
  console.log(`\nDRY RUN — ${describes.length} voice design(s) × 3 previews each, ${line.length} characters read per preview.`)
  describes.forEach((d, i) => console.log(`  ${slugBase}${describes.length > 1 ? i + 1 : ''}-{1,2,3}  ${d.slice(0, 90)}…`))
  console.log('\n  Add --go to spend.\n')
  process.exit(0)
}

const key = apiKey()
const entries = []
for (const [i, description] of describes.entries()) {
  const slug = `${slugBase}${describes.length > 1 ? i + 1 : ''}`
  process.stdout.write(`  designing ${slug} … `)
  const out = await designVoice({ description, text: line, key })
  const previews = out?.previews ?? []
  previews.slice(0, 3).forEach((p, k) => {
    const file = `${slug}-${k + 1}.audition.mp3`
    mkdirSync(DIR, { recursive: true })
    writeFileSync(join(DIR, file), Buffer.from(p.audio_base_64, 'base64'))
    entries.push({
      slug: `${slug}-${k + 1}`,
      name: `${slug} · take ${k + 1}`,
      why: description.slice(0, 90),
      ok: true,
      round,
      line,
      generated_voice_id: p.generated_voice_id,
      voice_description: description,
    })
  })
  console.log(`${previews.length} previews`)
}

manifest.title = manifest.title ?? `Voice auditions — ${config().project?.name ?? 'this project'}`
manifest.line = line
manifest[`round${round}`] = { line }
manifest.cast = [...entries, ...(manifest.cast ?? []).filter((c) => !entries.some((e) => e.slug === c.slug))]
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))

console.log(`
  ${entries.length} previews → ${DIR}

  Listen and cast:  AUDITIONS_DIR=${DIR} npm run review   → http://localhost:4600/auditions
  Rank by range:    node scripts/cast.mjs --measure
`)
