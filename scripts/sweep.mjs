#!/usr/bin/env node
/**
 * THE SWEEP — read this repo the way a stranger would, before it becomes public.
 *
 *   node scripts/sweep.mjs [--all] [--quiet]
 *
 * A trailer project accumulates things that should not be published: absolute
 * paths from one laptop, a key pasted into a config "just to test", an internal
 * hostname, a colleague's name in a comment, or a take that filmed real customer
 * data. None of it looks dangerous while you are working; all of it is permanent
 * once pushed.
 *
 * This checks the files git would actually publish (or everything, with --all)
 * and reports file:line for each finding. It changes nothing: a sweep that
 * edited your source would be a worse problem than the one it solves.
 *
 * It is not a security scanner. It is a last look before a door closes.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { has, ROOT } from './lib.mjs'

const QUIET = has('quiet')
const TEXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx', '.css', '.html', '.yml', '.yaml', '.toml', '.txt', '.sh'])

function tracked() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch {
    return null
  }
}

function walk(dir, acc = [], depth = 0) {
  if (depth > 6) return acc
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', '.takes', '.audio', '.cache', 'dist', 'build'].includes(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, acc, depth + 1)
    else acc.push(p.replace(`${ROOT}/`, ''))
  }
  return acc
}

const files = (has('all') ? walk(ROOT) : (tracked() ?? walk(ROOT))).filter((f) => TEXT.has(extname(f)) || !extname(f))

/**
 * Each rule says what it is looking for and, more importantly, WHY it matters —
 * a finding you do not understand is a finding you will wave through.
 */
const RULES = [
  {
    id: 'home-path',
    why: 'an absolute path from one machine: it breaks for everyone else, and it publishes a username and a directory layout',
    re: /(\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|C:\\Users\\[A-Za-z0-9._-]+)/g,
    allow: (line) => /\/Users\/(you|your-name|someone)\b/.test(line),
  },
  {
    id: 'credential',
    why: 'this looks like a live credential; rotate it, then remove it',
    re: /\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g,
  },
  {
    id: 'private-key',
    why: 'a private key block must never be in a repository',
    re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: 'assigned-secret',
    why: 'a secret assigned inline: even a dead one teaches the next person the wrong habit',
    re: /\b(api[_-]?key|secret|password|passwd|token|bearer)\s*[:=]\s*["'`][^"'`\s]{12,}["'`]/gi,
    allow: (line) => /(process\.env|import\.meta\.env|["'`](your|my|the)[- ]|example|placeholder|redacted|\.\.\.|xxx|<[a-z-]+>)/i.test(line),
  },
  {
    id: 'email',
    why: 'a personal email address in a public repo attracts spam and identifies people who did not choose to be identified',
    re: /\b[A-Za-z0-9._%+-]+@(?!example\.|test\.|localhost)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    allow: (line) => /(noreply|no-reply|support@|hello@|@example|schema|\.png|\.jpg)/i.test(line),
  },
  {
    id: 'internal-host',
    why: 'an internal hostname or private endpoint tells outsiders about infrastructure they cannot reach and should not know about',
    re: /\bhttps?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|example\.|fonts\.googleapis|fonts\.gstatic|api\.elevenlabs|api\.anthropic|github\.com|nextjs\.org|platform\.claude)[a-z0-9.-]*\.(internal|local|corp|lan|test)\b[^\s"']*/gi,
  },
  {
    id: 'ip',
    why: 'a hard-coded public IP is either infrastructure you did not mean to name, or a value that will rot',
    re: /\b(?!0\.0\.0\.0|127\.0\.0\.1|255\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    allow: (line) => /(version|@|\bv?\d+\.\d+\.\d+\b)/i.test(line),
  },
  {
    id: 'incident-note',
    why: 'internal narrative — an incident, a person, a private decision. Keep the LAW it taught, drop the story: "a disabled button is not ready yet" is useful to a stranger; "this cost us take 5 on Tuesday" is not',
    re: /\b(take-\d+ (caught|lost|broke)|the owner (said|asked|wants|killed)|per (R|the boss)\b|incident \d|postmortem|our customer|internal only|do not share)\b/gi,
  },
  {
    id: 'tracked-output',
    why: 'recorded takes and rendered audio are outputs, they are large, and a take can contain whatever was on screen when it was filmed',
    test: (file) => /^(\.takes|\.audio)\//.test(file),
  },
]

const findings = []
for (const rel of files) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) continue
  for (const rule of RULES) {
    if (rule.test) {
      if (rule.test(rel)) findings.push({ rule, file: rel, line: 0, text: '(this file is published)' })
      continue
    }
  }
  try {
    if (statSync(abs).size > 2 * 1024 * 1024) continue
    const src = readFileSync(abs, 'utf8')
    const lines = src.split('\n')
    for (const [i, line] of lines.entries()) {
      for (const rule of RULES) {
        if (!rule.re) continue
        rule.re.lastIndex = 0
        if (!rule.re.test(line)) continue
        if (rule.allow?.(line)) continue
        // The sweep describes its own patterns; do not report itself.
        if (rel === 'scripts/sweep.mjs') continue
        findings.push({ rule, file: rel, line: i + 1, text: line.trim().slice(0, 120) })
      }
    }
  } catch {
    /* binary or unreadable: nothing to read */
  }
}

// Are the outputs actually ignored?
const gitignore = existsSync(join(ROOT, '.gitignore')) ? readFileSync(join(ROOT, '.gitignore'), 'utf8') : ''
for (const dir of ['.takes/', '.audio/', 'studio.config.local.json', '.env'])
  if (!gitignore.includes(dir))
    findings.push({ rule: { id: 'gitignore', why: `${dir} is not ignored, so it can be committed by accident` }, file: '.gitignore', line: 0, text: `missing: ${dir}` })

const byRule = new Map()
for (const f of findings) byRule.set(f.rule.id, [...(byRule.get(f.rule.id) ?? []), f])

console.log(`\n  sweep — ${files.length} files ${has('all') ? '(everything on disk)' : '(what git would publish)'}\n`)
if (!findings.length) {
  console.log('  nothing found: no machine paths, no credentials, no personal addresses, no internal narrative.\n')
  process.exit(0)
}
for (const [id, group] of byRule) {
  console.log(`  ${id.toUpperCase()} — ${group[0].rule.why}`)
  for (const f of group.slice(0, 12)) console.log(`    ${f.file}${f.line ? `:${f.line}` : ''}  ${QUIET ? '' : f.text}`)
  if (group.length > 12) console.log(`    … and ${group.length - 12} more`)
  console.log('')
}
console.log(`  ${findings.length} finding${findings.length === 1 ? '' : 's'}. Nothing was changed — fix them by hand, then run this again.\n`)
process.exit(1)
