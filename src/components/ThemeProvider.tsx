'use client'

import { useEffect } from 'react'
import {
  getFont,
  getPalette,
  paletteVars,
  type ShopTheme,
} from '@/lib/themes'

export default function ThemeProvider({
  theme,
  children,
}: {
  theme?: ShopTheme | null
  children: React.ReactNode
}) {
  const palette = getPalette(theme?.palette)
  const font = getFont(theme?.font)

  // Load the correct Google Font on demand
  useEffect(() => {
    const id = `font-${font.id}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${font.google}&display=swap`
    document.head.appendChild(link)
  }, [font])

  const style: React.CSSProperties = {
    ...paletteVars(palette),
    ...(theme?.primary ? { ['--primary' as string]: theme.primary } : {}),
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: font.body.includes('serif')
      ? 'ui-serif, Georgia, serif'
      : 'ui-sans-serif, system-ui, sans-serif',
  }

  return (
    <div style={style} className="min-h-screen">
      {children}
    </div>
  )
}