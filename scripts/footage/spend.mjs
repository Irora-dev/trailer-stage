/**
 * SPEND SAFETY beyond the per-run cap: a ledger, caps that outlive a run,
 * markers that survive a crash, and a lock that keeps two builders apart.
 *
 *  · THE LEDGER `.footage/SPEND.jsonl` — one row per paid render (estimated
 *    cost, because fal reports none): what, when, for which trailer and shot.
 *    Month-to-date is summed from it, so a cap can be monthly, not per run.
 *  · CAPS — `footage.budgetUsd` per run (the budget object), `footage.monthlyUsd`
 *    across runs, `footage.perShotUsd` for any single render (a mistyped duration
 *    cannot render a $40 shot), and `footage.priceMaxAgeDays`: a price table older
 *    than that refuses to spend unless the person accepts it explicitly.
 *  · PENDING MARKERS `<shot>.pending.json` — written at submit, removed at
 *    success. A crash between the two billed a render whose file was never
 *    fetched; a re-run finds the marker and fetches the result instead of paying
 *    again.
 *  · THE LOCK `.footage/<name>/.lock` — a live process id; a second builder on the
 *    same trailer refuses, a dead one's lock is taken over.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const ledgerPathOf = (footageRoot) => join(footageRoot, 'SPEND.jsonl')

export function appendSpend(path, row) {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
}

export function readSpend(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** Estimated dollars spent in the calendar month of `now` (UTC), mock rows excluded. */
export function monthToDate(path, now = new Date()) {
  const ym = now.toISOString().slice(0, 7)
  return readSpend(path)
    .filter((r) => !r.mock && typeof r.at === 'string' && r.at.startsWith(ym))
    .reduce((n, r) => n + (Number(r.usdEstimated) || 0), 0)
}

export const daysSince = (isoDate) => {
  const t = Date.parse(isoDate)
  return Number.isFinite(t) ? (Date.now() - t) / 86400000 : Infinity
}

/**
 * Every reason not to spend right now. `shots` are {label, usd} for the renders
 * this run would pay for. Empty when the run may proceed.
 */
export function capProblems({ shots, plannedUsd, monthSpent, pricesAsOf, cfg = {}, allowExpensive = false, acceptStale = false }) {
  const problems = []
  const perShot = Number(cfg.perShotUsd ?? 10)
  const monthly = Number(cfg.monthlyUsd ?? 200)
  const maxAge = Number(cfg.priceMaxAgeDays ?? 30)
  for (const s of shots ?? [])
    if (s.usd != null && s.usd > perShot && !allowExpensive)
      problems.push(`${s.label}: ≈ $${s.usd.toFixed(2)} for one render is above footage.perShotUsd ($${perShot}) — shorten it, pick a cheaper model, or pass --allow-expensive`)
  if (plannedUsd != null && monthSpent + plannedUsd > monthly)
    problems.push(`this run (≈ $${plannedUsd.toFixed(2)}) plus $${monthSpent.toFixed(2)} already spent this month would pass footage.monthlyUsd ($${monthly})`)
  const age = daysSince(pricesAsOf)
  if (age > maxAge && !acceptStale)
    problems.push(`the price table is ${Math.floor(age)} days old (footage.priceMaxAgeDays = ${maxAge}); re-verify the prices, or pass --accept-stale-prices`)
  return problems
}

// ── pending markers ─────────────────────────────────────────────────────────
export const pendingPathOf = (file) => file.replace(/(\.[a-z0-9]+)$/i, '.pending.json')
export function writePending(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(pendingPathOf(file), JSON.stringify({ at: new Date().toISOString(), file, ...data }, null, 2) + '\n')
}
export function readPending(file) {
  const p = pendingPathOf(file)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}
export function clearPending(file) {
  rmSync(pendingPathOf(file), { force: true })
}

// ── the lock ────────────────────────────────────────────────────────────────
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
/** Take the lock for a trailer's footage dir, or throw naming the live holder. Returns a release function. */
export function acquireLock(dir, { pid = process.pid } = {}) {
  mkdirSync(dir, { recursive: true })
  const p = join(dir, '.lock')
  if (existsSync(p)) {
    let held = null
    try {
      held = JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      /* unreadable: treat as stale */
    }
    if (held?.pid && held.pid !== pid && alive(held.pid)) throw new Error(`another footage builder (pid ${held.pid}, since ${held.at}) holds ${p}; wait for it, or remove the lock if that process is gone`)
  }
  writeFileSync(p, JSON.stringify({ pid, at: new Date().toISOString() }) + '\n')
  let released = false
  const release = () => {
    if (released) return
    released = true
    try {
      const cur = JSON.parse(readFileSync(p, 'utf8'))
      if (cur.pid === pid) rmSync(p, { force: true })
    } catch {
      rmSync(p, { force: true })
    }
  }
  return release
}
