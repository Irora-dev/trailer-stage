/**
 * THE SCHEMA CHECK — a request is validated against the provider's own contract
 * before a dollar moves.
 *
 * fal publishes an OpenAPI document per endpoint, free and without a key:
 *   https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<endpoint>
 * It names every input field, its type, its enum, its limits and its default.
 * So the builder does not trust this repo's catalogue or its family mappings:
 * it loads the schema (cache → network → committed fixture, in that order of
 * freshness), CONFORMS the request to it (drops unknown fields, fixes enum case,
 * coerces "8" ↔ 8, fills a required field from its default, clamps a range) and
 * then VALIDATES what is left. Errors refuse the spend; notes are printed.
 *
 * An endpoint whose schema loaded counts as verified, whatever the catalogue
 * says. Gemini has no such document; its adapters keep their catalogue flags.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const schemaUrl = (endpoint) => `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${endpoint}`
export const schemaFile = (endpoint) => `${endpoint.replace(/\//g, '_')}.json`

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}
const ageDays = (p) => (Date.now() - statSync(p).mtimeMs) / 86400000

/**
 * The OpenAPI document for an endpoint: from the cache when fresh, else the
 * network (and re-cached), else a stale cache, else the committed fixture.
 * `source` says which, so a check can print "schema: network" or "fixture (may be stale)".
 */
export async function loadSchema(endpoint, { cacheDir, fixturesDir, maxAgeDays = 7, online = true, refresh = false, timeoutMs = 20000 } = {}) {
  const cached = cacheDir ? join(cacheDir, schemaFile(endpoint)) : null
  if (cached && existsSync(cached) && !refresh && ageDays(cached) <= maxAgeDays) {
    const doc = readJson(cached)
    if (doc?.paths) return { doc, source: 'cache', ageDays: ageDays(cached) }
  }
  if (online) {
    try {
      const res = await fetch(schemaUrl(endpoint), { signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok) {
        const text = await res.text()
        const doc = JSON.parse(text)
        if (doc?.paths) {
          if (cacheDir) {
            mkdirSync(cacheDir, { recursive: true })
            writeFileSync(cached, text)
          }
          return { doc, source: 'network', ageDays: 0 }
        }
      }
    } catch {
      /* offline, or fal is down: fall through to what is on disk */
    }
  }
  if (cached && existsSync(cached)) {
    const doc = readJson(cached)
    if (doc?.paths) return { doc, source: 'cache-stale', ageDays: ageDays(cached) }
  }
  const fx = fixturesDir ? join(fixturesDir, schemaFile(endpoint)) : null
  if (fx && existsSync(fx)) {
    const doc = readJson(fx)
    if (doc?.paths) return { doc, source: 'fixture', ageDays: ageDays(fx) }
  }
  return { doc: null, source: null, ageDays: null }
}

/** Follow `$ref`s inside a component schema, one level deep per property/items. */
function deref(s, doc) {
  if (!s || typeof s !== 'object') return s
  if (s.$ref) {
    const name = s.$ref.split('/').pop()
    return deref(doc.components?.schemas?.[name] ?? {}, doc)
  }
  if (s.anyOf) return { ...s, anyOf: s.anyOf.map((x) => deref(x, doc)) }
  if (s.items) return { ...s, items: deref(s.items, doc) }
  return s
}

/** The INPUT schema of the endpoint's submit operation, properties dereferenced. */
export function inputSchemaOf(doc) {
  const entry = Object.entries(doc?.paths ?? {}).find(([p, ops]) => ops.post && !p.includes('{request_id}'))
  const ref = entry?.[1]?.post?.requestBody?.content?.['application/json']?.schema?.$ref
  const name = ref?.split('/').pop()
  const s = name ? doc.components?.schemas?.[name] : null
  if (!s) return null
  const properties = Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, deref(v, doc)]))
  return { name, required: s.required ?? [], properties, additionalProperties: s.additionalProperties }
}

/** The types a property accepts, as a Set ('string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'). */
export function typesOf(prop) {
  const out = new Set()
  const add = (p) => {
    if (!p) return
    if (Array.isArray(p.type)) p.type.forEach((t) => out.add(t))
    else if (p.type) out.add(p.type)
    if (p.anyOf) p.anyOf.forEach(add)
    if (p.oneOf) p.oneOf.forEach(add)
  }
  add(prop)
  return out
}
const jsType = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v)
const typeOk = (types, v) => {
  const t = jsType(v)
  if (types.size === 0) return true
  if (types.has(t)) return true
  if (t === 'integer' && types.has('number')) return true
  return false
}
const enumOf = (prop) => prop?.enum ?? prop?.anyOf?.find((x) => x.enum)?.enum ?? null

/**
 * Make the request fit the schema, noting every change. Unknown fields are
 * dropped (a provider that ignores them silently is worse than a note), enum
 * case is fixed ("768p" → "768P"), numbers and numeric strings are coerced to
 * the declared type ("8" → 8, 8 → "8"), a missing required field takes the
 * schema's default, and a number outside its range is clamped.
 */
export function conformInput(input, schema) {
  const notes = []
  if (!schema) return { input: { ...input }, notes }
  const out = {}
  for (const [k, v] of Object.entries(input ?? {})) {
    const prop = schema.properties[k]
    if (!prop) {
      if (schema.additionalProperties === false || schema.additionalProperties === undefined) {
        notes.push(`dropped "${k}": not a field of this endpoint`)
        continue
      }
      out[k] = v
      continue
    }
    if (v === undefined) continue
    let val = v
    const types = typesOf(prop)
    const en = enumOf(prop)
    if (typeof val === 'number' && types.has('string') && !types.has('number') && !types.has('integer')) {
      val = String(val)
      notes.push(`"${k}": ${v} → "${val}" (the endpoint wants a string)`)
    } else if (typeof val === 'string' && (types.has('integer') || types.has('number')) && !types.has('string') && val.trim() !== '' && Number.isFinite(Number(val))) {
      val = types.has('integer') ? Math.round(Number(val)) : Number(val)
      notes.push(`"${k}": "${v}" → ${val} (the endpoint wants a number)`)
    }
    if (en && typeof val === 'string' && !en.includes(val)) {
      const ci = en.find((e) => String(e).toLowerCase() === val.toLowerCase())
      if (ci !== undefined) {
        notes.push(`"${k}": "${val}" → "${ci}" (enum case)`)
        val = ci
      }
    }
    if (typeof val === 'number') {
      if (prop.minimum !== undefined && val < prop.minimum) {
        notes.push(`"${k}": ${val} → ${prop.minimum} (minimum)`)
        val = prop.minimum
      }
      if (prop.maximum !== undefined && val > prop.maximum) {
        notes.push(`"${k}": ${val} → ${prop.maximum} (maximum)`)
        val = prop.maximum
      }
    }
    out[k] = val
  }
  for (const req of schema.required ?? []) {
    if (out[req] === undefined || out[req] === null) {
      const d = schema.properties[req]?.default
      if (d !== undefined) {
        out[req] = d
        notes.push(`"${req}" is required: filled with its default ${JSON.stringify(d)}`)
      }
    }
  }
  return { input: out, notes }
}

/** What is still wrong after conforming. Errors refuse a spend; warnings print. */
export function validateInput(input, schema) {
  const errors = []
  const warnings = []
  if (!schema) return { errors, warnings: ['no schema to validate against'] }
  for (const req of schema.required ?? []) if (input[req] === undefined || input[req] === null) errors.push(`missing required field "${req}"`)
  for (const [k, v] of Object.entries(input ?? {})) {
    const prop = schema.properties[k]
    if (!prop) {
      warnings.push(`unknown field "${k}"`)
      continue
    }
    if (v === null) {
      if (!typesOf(prop).has('null')) errors.push(`"${k}" may not be null`)
      continue
    }
    if (!typeOk(typesOf(prop), v)) errors.push(`"${k}": ${jsType(v)} given, ${[...typesOf(prop)].join('|')} expected`)
    const en = enumOf(prop)
    if (en && !en.includes(v)) errors.push(`"${k}": ${JSON.stringify(v)} is not one of ${JSON.stringify(en)}`)
    if (Array.isArray(v)) {
      if (prop.maxItems !== undefined && v.length > prop.maxItems) errors.push(`"${k}": ${v.length} items, at most ${prop.maxItems}`)
      if (prop.minItems !== undefined && v.length < prop.minItems) errors.push(`"${k}": ${v.length} items, at least ${prop.minItems}`)
    }
    if (typeof v === 'number') {
      if (prop.minimum !== undefined && v < prop.minimum) errors.push(`"${k}": ${v} below the minimum ${prop.minimum}`)
      if (prop.maximum !== undefined && v > prop.maximum) errors.push(`"${k}": ${v} above the maximum ${prop.maximum}`)
    }
  }
  return { errors, warnings }
}
