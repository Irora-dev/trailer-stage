// READING A PROJECT — how the compiler learns what it is making a trailer about.
//
// Point it at a directory or a git URL and it returns a compact digest: what the
// thing is called, what its README says it does, how it is built, what routes it
// has. That digest goes into the brief compiler's prompt, so the trailer talks
// about the actual product instead of generic software.
//
// PRIVACY POSTURE, because this reads someone's source:
//   · Nothing is uploaded except the digest, and the digest is capped and
//     printable — run with --print-digest and read exactly what would be sent.
//   · Files that commonly hold secrets are never read (.env*, keys, certs,
//     credentials), and any value that looks like a token is redacted anyway.
//   · Nothing is written into the project. A cloned repo lands in a temp dir.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', 'vendor', 'target',
  '__pycache__', '.venv', 'venv', '.cache', '.turbo', '.svelte-kit', 'Pods', '.gradle', '.idea', '.vscode',
])
// Never opened, whatever the flags say.
const SECRET_RE = /(^|\/)(\.env|\.env\..*|.*\.pem|.*\.key|.*\.p12|.*\.keystore|id_rsa.*|.*credentials.*|.*secret.*)$/i
const TEXT_RE = /\.(md|mdx|txt|json|ya?ml|toml)$/i

/** Redact anything that looks like a credential, wherever it came from. */
export function redact(s) {
  return String(s)
    .replace(/\b(sk|pk|ghp|gho|github_pat|xoxb|xoxp|AIza|AKIA|ASIA)[-_A-Za-z0-9]{8,}/g, '[redacted]')
    .replace(/\b[A-Fa-f0-9]{64}\b/g, '[redacted]')
    .replace(/(?<=(?:secret|token|password|api[_-]?key|authorization)["'\s:=]{1,8})[^\s"',}]{8,}/gi, '[redacted]')
    .replace(/\b0x[a-fA-F0-9]{40}\b/g, '0x[address]')
}

const clip = (s, n) => (s.length > n ? s.slice(0, n) + `\n… [truncated at ${n} characters]` : s)

function readIfText(file, max) {
  try {
    if (SECRET_RE.test(file)) return null
    if (statSync(file).size > 512 * 1024) return null
    return clip(redact(readFileSync(file, 'utf8')), max)
  } catch {
    return null
  }
}

/** Two levels of structure, directories first, noise filtered. */
function tree(dir, depth = 2, prefix = '') {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  const dirs = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')).slice(0, 24)
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.')).slice(0, 24)
  for (const f of files) out.push(`${prefix}${f.name}`)
  for (const d of dirs) {
    out.push(`${prefix}${d.name}/`)
    if (depth > 1) out.push(...tree(join(dir, d.name), depth - 1, `${prefix}  `))
  }
  return out
}

/** Best-effort route list for the common frameworks. */
function routesOf(root) {
  const routes = new Set()
  // File-routed frameworks: a directory tree under app/ or pages/ or routes/.
  for (const base of ['src/app', 'app', 'src/pages', 'pages', 'src/routes', 'routes']) {
    const dir = join(root, base)
    if (!existsSync(dir)) continue
    const walk = (d, rel) => {
      let entries
      try {
        entries = readdirSync(d, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (SKIP_DIRS.has(e.name)) continue
        if (e.isDirectory()) walk(join(d, e.name), `${rel}/${e.name}`)
        else if (/^(page|index|route|\+page)\.(t|j)sx?$/.test(e.name)) routes.add(rel || '/')
      }
    }
    walk(dir, '')
    if (routes.size) break
  }
  // Declarative routers: grep for path="…" in the source.
  if (!routes.size) {
    const grep = (d, depth) => {
      if (depth < 0) return
      let entries
      try {
        entries = readdirSync(d, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (SKIP_DIRS.has(e.name)) continue
        const p = join(d, e.name)
        if (e.isDirectory()) grep(p, depth - 1)
        else if (/\.(t|j)sx?$/.test(e.name) && statSync(p).size < 400 * 1024) {
          const src = readFileSync(p, 'utf8')
          for (const m of src.matchAll(/path[:=]\s*["'`](\/[^"'`]{0,60})["'`]/g)) routes.add(m[1])
        }
      }
    }
    grep(join(root, 'src'), 3)
  }
  return [...routes].sort().slice(0, 60)
}

function kindOf(root, pkg) {
  const dep = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  if (dep.next) return 'Next.js app'
  if (dep.vite && (dep.react || dep['react-dom'])) return 'Vite + React app'
  if (dep.vite) return 'Vite app'
  if (dep['@sveltejs/kit']) return 'SvelteKit app'
  if (dep.nuxt) return 'Nuxt app'
  if (dep.express || dep.fastify) return 'Node service'
  if (dep['react-native'] || dep.expo) return 'React Native app'
  if (existsSync(join(root, 'Cargo.toml'))) return 'Rust project'
  if (existsSync(join(root, 'go.mod'))) return 'Go project'
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'requirements.txt'))) return 'Python project'
  if (pkg) return 'Node project'
  return 'project'
}

/**
 * Read a project. `source` is a local path or a git URL (cloned shallow into a
 * temp directory — for a private repo, whatever credentials your git already
 * has are what it uses; this never asks for or stores any).
 */
export function readProject(source, { maxReadme = 6000 } = {}) {
  let root = source
  let cloned = null
  if (/^(https?:\/\/|git@|ssh:\/\/)/.test(source)) {
    cloned = mkdtempSync(join(tmpdir(), 'trailer-project-'))
    try {
      execFileSync('git', ['clone', '--depth', '1', '--quiet', source, cloned], { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (e) {
      throw new Error(`could not clone ${source}: ${String(e.stderr ?? e).slice(0, 200)}`)
    }
    root = cloned
  }
  root = resolve(root)
  if (!existsSync(root)) throw new Error(`no such project: ${root}`)

  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {
    /* not a Node project */
  }

  const readmeFile = ['README.md', 'readme.md', 'README.mdx', 'docs/README.md'].map((f) => join(root, f)).find(existsSync)
  const readme = readmeFile ? readIfText(readmeFile, maxReadme) : null

  const docs = []
  for (const d of ['docs', 'doc']) {
    const dir = join(root, d)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((f) => TEXT_RE.test(f)).slice(0, 12)) {
      const body = readIfText(join(dir, f), 1200)
      if (body) docs.push({ file: `${d}/${f}`, head: body.split('\n').slice(0, 12).join('\n') })
    }
  }

  return {
    source,
    root,
    name: pkg?.name ?? basename(root),
    description: pkg?.description ?? '',
    kind: kindOf(root, pkg),
    scripts: pkg?.scripts ? Object.keys(pkg.scripts).slice(0, 20) : [],
    dependencies: pkg ? Object.keys(pkg.dependencies ?? {}).slice(0, 30) : [],
    routes: routesOf(root),
    structure: tree(root, 2).slice(0, 120),
    readme,
    docs,
    cloned,
  }
}

/** The digest as the compiler will send it — print this before you trust it. */
export function digestText(p) {
  const lines = [
    `PROJECT: ${p.name}${p.description ? ` — ${p.description}` : ''}`,
    `KIND: ${p.kind}`,
    p.routes.length ? `ROUTES (${p.routes.length}): ${p.routes.join(' ')}` : '',
    p.scripts.length ? `SCRIPTS: ${p.scripts.join(' ')}` : '',
    p.dependencies.length ? `KEY DEPENDENCIES: ${p.dependencies.join(' ')}` : '',
    '',
    'STRUCTURE:',
    p.structure.join('\n'),
    '',
    p.readme ? `README:\n${p.readme}` : '(no README found)',
    ...(p.docs.length ? ['', 'DOCS:', ...p.docs.map((d) => `--- ${d.file}\n${d.head}`)] : []),
  ]
  return redact(lines.filter(Boolean).join('\n'))
}
