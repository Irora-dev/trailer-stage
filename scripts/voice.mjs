// Rendering narration, effects and music.
//
// THE THREE SPEND LAWS, and they are not negotiable:
//   1. Dry run is the default everywhere. Rendering costs money, so a script
//      prints what it WOULD spend and stops; `--go` is a human saying yes.
//   2. A file that exists is NEVER re-rendered. The artifact on disk may be the
//      one somebody approved; a bug in a later step must cost a re-measure, not
//      a re-spend.
//   3. Nothing schedules itself. No cron, no watcher, no "while we're here".
//
// The key is read from ELEVENLABS_API_KEY or ~/.config/elevenlabs/api-key. It is
// never written into this repo, and never printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'

const API = 'https://api.elevenlabs.io/v1'

export function apiKey({ required = true } = {}) {
  const env = process.env.ELEVENLABS_API_KEY
  if (env) return env.trim()
  const file = `${homedir()}/.config/elevenlabs/api-key`
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  if (!required) return null
  console.error(`
  No voice API key. Either:
    export ELEVENLABS_API_KEY=…
    or put it in ~/.config/elevenlabs/api-key (chmod 600)

  Everything except rendering works without one: the stage, the studio, the
  recorder, and any trailer whose audio already exists on disk.
`)
  process.exit(1)
}

function write(file, buf) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, buf)
  return file
}

async function post(path, key, body, accept = 'audio/mpeg') {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${path}: ${res.status} ${detail.slice(0, 300)}`)
  }
  return res
}

/**
 * One narration line. `text` may carry the model's performance tags — bracketed
 * directions like [warmly], stress, and ellipses for a pause. A model that
 * accepts direction and is given none reads flat; that is the single most
 * common reason a trailer's voice sounds dead.
 */
export async function renderVoice(file, { text, voiceId, model = 'eleven_v3', settings, key }) {
  if (existsSync(file)) return { file, spent: false }
  const res = await post(
    `/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    key ?? apiKey(),
    { text, model_id: model, ...(settings ? { voice_settings: settings } : {}) },
  )
  write(file, Buffer.from(await res.arrayBuffer()))
  return { file, spent: true, chars: text.length }
}

/** A sound effect from a prompt. Keep these sparse: a wall of foley buries a
 *  narrator, and one effect landing on a beat is worth ten spread around it. */
export async function renderSfx(file, { prompt, seconds = 2, influence, key }) {
  if (existsSync(file)) return { file, spent: false }
  const res = await post(
    '/sound-generation',
    key ?? apiKey(),
    { text: prompt, duration_seconds: seconds, ...(influence !== undefined ? { prompt_influence: influence } : {}) },
  )
  write(file, Buffer.from(await res.arrayBuffer()))
  return { file, spent: true, seconds }
}

/** A music bed from a prompt, or from lyrics when you want it sung. */
export async function renderMusic(file, { prompt, lyrics, seconds = 60, key }) {
  if (existsSync(file)) return { file, spent: false }
  const res = await post(
    '/music',
    key ?? apiKey(),
    { prompt: lyrics ? `Song with these exact lyrics: ${lyrics}` : prompt, music_length_ms: Math.round(seconds * 1000) },
  )
  write(file, Buffer.from(await res.arrayBuffer()))
  return { file, spent: true, seconds }
}

/**
 * Voice design: describe a narrator, get three previews that ALREADY READ YOUR
 * OWN LINES. The previews are the audition — there is no second render to hear
 * the candidate say the actual words.
 *
 * Audition on the line as it will really be performed, tags and all. A candidate
 * auditioned on plain text and then given a directed script is a different
 * performer, and you find that out after you have paid for the whole cut.
 */
export async function designVoice({ description, text, model = 'eleven_ttv_v3', key }) {
  const k = key ?? apiKey()
  for (const path of ['/text-to-voice/design', '/text-to-voice/create-previews']) {
    try {
      const res = await post(path, k, { voice_description: description, text, model_id: model }, 'application/json')
      return await res.json()
    } catch (e) {
      if (path.endsWith('create-previews')) throw e
    }
  }
  return null
}

/** Turn a chosen preview into a saved voice you can render with. */
export async function saveVoice({ name, description, generatedVoiceId, key }) {
  const k = key ?? apiKey()
  for (const path of ['/text-to-voice', '/text-to-voice/create-voice-from-preview']) {
    try {
      const res = await post(
        path,
        k,
        { voice_name: name, voice_description: description, generated_voice_id: generatedVoiceId },
        'application/json',
      )
      return await res.json()
    } catch (e) {
      if (path.endsWith('create-voice-from-preview')) throw e
    }
  }
  return null
}

export { write as writeAudio }
