import { notFound } from 'next/navigation'
import { FromTimeline } from '@/components/stage/from-timeline'
import { loadConfig } from '@/lib/config'
import { listTrailers, readTimeline } from '@/lib/trailers'

/**
 * THE SET. The recorder points a headless browser at /stage/<name> and captures
 * one continuous take of whatever plays here.
 *
 * Dev-only: a stage is a production surface, not a product page, and a deployed
 * copy has no business serving one. Recording always happens against a local
 * dev server anyway.
 */
export default async function StagePage({ params }: { params: Promise<{ trailer?: string[] }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { trailer } = await params
  const name = trailer?.[0] ?? listTrailers()[0]
  if (!name) notFound()
  const tl = readTimeline(name)
  if (!tl) notFound()
  const cfg = loadConfig()
  return (
    <FromTimeline
      tl={tl}
      basePath={cfg.target.basePath}
      logo={cfg.theme.logo || undefined}
      wordmark={cfg.theme.wordmark}
      plate={cfg.theme.plate}
    />
  )
}
