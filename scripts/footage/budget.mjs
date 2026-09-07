/**
 * The spend budget — a hard cap the footage builder runs every paid call under.
 *
 * Copied from the Irora OS art module (`colby-os/modules/art/lib/budget.mjs`,
 * registered there as a consumer); the same object guards Leonardo and Ludo
 * calls elsewhere, and it is copied rather than imported so this repo stays
 * self-contained. Semantics: `check(label)` BEFORE a paid request throws once the
 * cap is reached; `add(cost, label)` AFTER records what it cost. Units here are
 * US dollars (estimated from the catalogue's per-second price when a provider
 * reports no cost of its own).
 */
export function createBudget({ cap, warnAt, onWarn } = {}) {
  if (typeof cap !== 'number' || !(cap >= 0)) throw new Error('createBudget: cap (number ≥ 0) is required')
  let spent = 0
  let calls = 0
  let warned = false
  return {
    cap,
    spent: () => spent,
    calls: () => calls,
    /** Call BEFORE a paid request — throws once the cap is reached. */
    check(label = 'paid call') {
      if (spent >= cap)
        throw new Error(
          `footage budget exhausted ($${spent.toFixed(2)} of $${cap} over ${calls} calls) — refusing ${label}; raise footage.budgetUsd in studio.config.json deliberately if this run should continue`,
        )
    },
    /** Call AFTER a paid request with the cost (null/undefined counts as 0). */
    add(cost, label = 'paid call') {
      calls++
      const n = typeof cost === 'number' ? cost : cost && typeof cost === 'object' && cost.amount != null ? parseFloat(cost.amount) : 0
      spent += Number.isFinite(n) && n > 0 ? n : 0
      if (!warned && warnAt != null && spent >= warnAt) {
        warned = true
        ;(onWarn ?? ((m) => console.warn(m)))(`footage budget warning: $${spent.toFixed(2)} of $${cap} spent after ${label}`)
      }
    },
  }
}
