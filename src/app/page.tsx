import { loadConfig } from '@/lib/config'
import { listTrailers, readTimeline } from '@/lib/trailers'

/** The index: what is in this project, and where to go next. Dev-facing. */
export default function Home() {
  const cfg = loadConfig()
  const names = listTrailers()
  const rows = names.map((n) => {
    const tl = readTimeline(n)
    return { name: n, end: tl?.end ?? 0, silent: !tl?.mix, tracks: tl?.tracks.length ?? 0 }
  })
  const dev = process.env.NODE_ENV !== 'production'

  return (
    <main className="mx-auto max-w-3xl px-6 py-16" style={{ fontFamily: 'var(--font-body)' }}>
      <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
        {cfg.project.name}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink-dim)' }}>
        {cfg.project.tagline}
      </p>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: 'var(--ink-faint)' }}>
          Trailers
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--ink-dim)' }}>
            None yet. Write a brief and compile it:{' '}
            <code className="font-mono">npm run draft -- brief.md --name my-trailer</code>
          </p>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
            {rows.map((r) => (
              <li key={r.name} className="flex items-center gap-4 py-3">
                <span className="font-mono text-sm" style={{ color: 'var(--ink)' }}>
                  {r.name}
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                  {r.end.toFixed(1)}s · {r.tracks} tracks{r.silent ? ' · silent draft' : ''}
                </span>
                {dev && (
                  <span className="ml-auto flex gap-3 font-mono text-[12px]">
                    <a href={`/stage/${r.name}?autostart`} style={{ color: 'var(--accent)' }}>
                      stage →
                    </a>
                    <a href={`/studio/${r.name}`} style={{ color: 'var(--accent)' }}>
                      studio →
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: 'var(--ink-faint)' }}>
          The loop
        </h2>
        <ol className="mt-3 space-y-2 text-sm" style={{ color: 'var(--ink-dim)' }}>
          <li>
            1 · <code className="font-mono">npm run draft -- brief.md --name my-trailer --project ../my-app</code> —
            compiles a brief into a timeline, a mix spec and a storyboard. Text only; nothing renders, nothing spends.
          </li>
          <li>2 · Read the storyboard. Open the studio if the picture wants moving.</li>
          <li>
            3 · <code className="font-mono">npm run trailer -- my-trailer</code> — a dry run: it prints every render it
            would pay for, and stops.
          </li>
          <li>
            4 · <code className="font-mono">npm run trailer -- my-trailer --go</code> — renders the narration, builds the
            mix, re-times every anchored beat from the measured audio, records, and compares against your approved take.
          </li>
          <li>
            5 · <code className="font-mono">npm run review</code> — watch it, approve it.
          </li>
        </ol>
      </section>
    </main>
  )
}
