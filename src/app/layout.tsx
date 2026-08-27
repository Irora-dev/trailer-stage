import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { loadConfig, themeVars } from '@/lib/config'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trailer Stage',
  description: 'Write a brief, get a trailer.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const cfg = loadConfig()
  const vars = themeVars(cfg.theme) as Record<string, string>
  return (
    <html lang="en" style={vars}>
      <head>
        {/* The theme's own type, so stage furniture matches the app it films. */}
        {cfg.theme.fontHref ? (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={cfg.theme.fontHref} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  )
}
