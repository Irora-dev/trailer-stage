/**
 * THE LAWS OF GENERATED VIDEO — pure checks the compiler and the footage builder enforce.
 * Colby, 2026-09-08 ("enforce all of these"), after three rounds of the basement-bull trailer.
 *
 * Enforced by the tooling:
 *   1. one generator and one look paragraph across every shot of a film       (footageLawProblems)
 *   2. a standard negative list on every shot, appended automatically          (completeNegative)
 *   3. at most one beat every two seconds of a shot                            (beatsWarning)
 *   4. no chained shot renders before the previous shot's contact sheet exists (build-footage)
 *   5. effects and beats anchor to measured events in the rendered file        (`events` → cues)
 *   6. a 480p probe before any 1080p render of a shot                          (build-footage --probe)
 * Stated by the brief, insisted on by the compiler:
 *   7. the handoff frame: every shot but the last ends with the character fully in frame, holding
 *      still for a beat, the action keeping its pace to the last frame        (footage.handoff)
 *   8. a physics paragraph in every prompt                                     (footage.physics)
 *   9. the camera sentence first, one behaviour                                (cameraProblem)
 *  10. no speech, no lips                                                      (speechProblem)
 * Nothing here spends or renders.
 */

export const STANDARD_NEGATIVES = [
  'text',
  'logos',
  'real people',
  'celebrity likeness',
  'duplicate props',
  'floating objects',
  'extra limbs',
  'warped hands',
  'morphing',
  'scaling',
  'appearing',
  'jump cuts',
]

/** The negative with every standard term present; `added` lists what was appended. */
export function completeNegative(negative) {
  const have = String(negative ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const added = STANDARD_NEGATIVES.filter((n) => !have.includes(n.toLowerCase()))
  const base = String(negative ?? '').trim().replace(/,\s*$/, '')
  const out = added.length ? (base ? `${base}, ${added.join(', ')}` : added.join(', ')) : base
  return { negative: out, added }
}

export const SPEECH_RE =
  /\b(says?|said|saying|shout(?:s|ed|ing)?|speak(?:s|ing)?|spoke|talk(?:s|ed|ing)?|whisper(?:s|ed|ing)?|scream(?:s|ed|ing)?|yell(?:s|ed|ing)?|dialogue|lip[- ]?sync|lips move|mouth(?:s|ed|ing)? (?:the )?words)\b/i

/** Law 10: characters never talk or mouth words in a generated shot. */
export function speechProblem(prompt) {
  const m = SPEECH_RE.exec(String(prompt ?? ''))
  return m ? `speech in the prompt ("${m[0]}"): characters never talk or mouth words in a generated shot; the narrator carries every word` : null
}

/** Camera behaviours; "handheld" is a modifier, not a behaviour. */
export const CAMERA_BEHAVIOURS = {
  locked: /\b(locked[- ]off|static camera|camera does not move|no camera move(?:ment)?)\b/i,
  push: /\b(slow push|push(?:es)? in|dolly in|pushes toward)\b/i,
  track: /\b(lateral track|tracking shot|tracks? alongside|camera (?:swings|follows|pans to follow)|following shot|follow(?:s|ing) (?:him|her|them|the))\b/i,
  pan: /\b(pans? (?:left|right)|whip pan)\b/i,
  zoom: /\b(zoom(?:s|ing)? (?:in|out)|slow zoom)\b/i,
}

const sentencesOf = (text) =>
  String(text ?? '')
    .split(/(?<=[.!?])\s+|:\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)

/** Law 9: the camera sentence comes first (a continuity preamble may precede it) and names one behaviour. */
export function cameraProblem(prompt) {
  const text = String(prompt ?? '')
  const found = Object.entries(CAMERA_BEHAVIOURS).filter(([, re]) => re.test(text)).map(([k]) => k)
  if (!found.length) return 'no camera sentence: open the prompt with one behaviour (locked off, a slow push, a lateral track, a handheld follow)'
  if (found.length > 1) return `two camera behaviours in one shot (${found.join(' + ')}): one per shot`
  const head = sentencesOf(text).slice(0, 3).join(' ')
  if (!Object.values(CAMERA_BEHAVIOURS).some((re) => re.test(head))) return 'the camera sentence must come first (within the first three sentences, after any continuity preamble), before the action'
  return null
}

/** Law 3: beats per second. A "beat" is an action sentence; the shared paragraphs are not counted. */
export function beatsWarning(prompt, seconds, shared = []) {
  let text = String(prompt ?? '')
  for (const s of shared) if (s) text = text.split(String(s).trim()).join(' ')
  const beats = sentencesOf(text).filter((s) => s.split(/\s+/).length >= 4).length
  const secs = Number(seconds) || 0
  if (!secs) return null
  const max = Math.floor(secs / 2) + 1
  return beats > max ? `${beats} action sentences for ${secs} s (Seedance swallows beats past one every two seconds; ${max} would fit): cut or lengthen` : null
}

/** The generator behind an endpoint id: "bytedance/seedance-2.0/image-to-video" → "bytedance/seedance-2.0". */
export const generatorOf = (model) => String(model ?? '').replace(/\/(text|image|reference)-to-video$/i, '')

/** A chained reference (the previous shot's last frame) names the previous clip; null otherwise. */
export function chainPrevOf(ref) {
  const m = /refs\/chain\/([A-Za-z0-9_-]+)-last\.png$/.exec(String(ref ?? ''))
  return m ? m[1] : null
}

/**
 * Laws 1, 7, 8, 9, 10 over a film's footage shots, in film order.
 * shots: [{ where, model, prompt, negative, seconds }] · footage: { look, physics, handoff } (the
 * timeline's shared paragraphs). Returns { problems, warnings }.
 */
export function footageLawProblems(shots, footage) {
  const problems = []
  const warnings = []
  const list = (shots ?? []).filter((s) => s && typeof s.prompt === 'string')
  if (!list.length) return { problems, warnings }
  const models = [...new Set(list.map((s) => generatorOf(s.model)).filter(Boolean))]
  if (models.length > 1) problems.push(`one generator per film: this timeline uses ${models.join(' and ')}`)
  const look = String(footage?.look ?? '').trim()
  const physics = String(footage?.physics ?? '').trim()
  const handoff = String(footage?.handoff ?? '').trim()
  if (!look) problems.push('footage.look is missing: declare the shared look paragraph once and copy it verbatim into every shot prompt')
  if (!physics) problems.push('footage.physics is missing: declare the physics paragraph once (feet on the ground, hands close on props before they move, nothing floats, nothing changes size) and copy it into every shot prompt')
  if (list.length > 1 && !handoff) problems.push('footage.handoff is missing: declare the handoff sentence (the character fully in frame at the end, holding still for a beat, the action keeping its pace to the last frame) and copy it into every shot but the last')
  list.forEach((s, i) => {
    const where = s.where ?? `shot ${i + 1}`
    const p = s.prompt
    if (look && !p.includes(look)) problems.push(`${where}: the look paragraph is not in the prompt verbatim`)
    if (physics && !p.includes(physics)) problems.push(`${where}: the physics paragraph is not in the prompt verbatim`)
    if (handoff && i < list.length - 1 && !p.includes(handoff)) problems.push(`${where}: the handoff sentence is not in the prompt (every shot but the last)`)
    const sp = speechProblem(p)
    if (sp) problems.push(`${where}: ${sp}`)
    const cp = cameraProblem(p)
    if (cp) problems.push(`${where}: ${cp}`)
    const bw = beatsWarning(p, s.seconds, [look, physics, handoff])
    if (bw) warnings.push(`${where}: ${bw}`)
    const { added } = completeNegative(s.negative)
    if (added.length) warnings.push(`${where}: the builder will complete the negative with: ${added.join(', ')}`)
  })
  return { problems, warnings }
}
