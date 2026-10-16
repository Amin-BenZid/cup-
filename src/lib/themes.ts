export type PaletteId =
  | 'stone'
  | 'espresso'
  | 'olive'
  | 'clay'
  | 'ink'
  | 'cream'

export type Palette = {
  id: PaletteId
  name: string
  bg: string
  surface: string
  surfaceMuted: string
  border: string
  text: string
  textMuted: string
  primary: string
  primaryText: string
  accent: string
  accentSoft: string
}

export const PALETTES: Record<PaletteId, Palette> = {
  stone: {
    id: 'stone',
    name: 'Stone',
    bg: '#faf7f2',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f4',
    border: '#e7e5e4',
    text: '#1c1917',
    textMuted: '#78716c',
    primary: '#1c1917',
    primaryText: '#fafaf9',
    accent: '#b45309',
    accentSoft: '#fef3c7',
  },
  espresso: {
    id: 'espresso',
    name: 'Espresso',
    bg: '#f5efe6',
    surface: '#fffdf9',
    surfaceMuted: '#ede4d6',
    border: '#d9cdb8',
    text: '#2d1f14',
    textMuted: '#7a6a55',
    primary: '#2d1f14',
    primaryText: '#fdf8ef',
    accent: '#8a3f1c',
    accentSoft: '#f3ddc8',
  },
  olive: {
    id: 'olive',
    name: 'Olive',
    bg: '#f6f7f2',
    surface: '#ffffff',
    surfaceMuted: '#eef0e6',
    border: '#d8dcc9',
    text: '#1f2417',
    textMuted: '#6d7563',
    primary: '#2c3418',
    primaryText: '#f7f8f0',
    accent: '#5a6a2e',
    accentSoft: '#e5eccf',
  },
  clay: {
    id: 'clay',
    name: 'Clay',
    bg: '#faf3f0',
    surface: '#fffdfc',
    surfaceMuted: '#f5e6e0',
    border: '#e8d2cb',
    text: '#2b1a16',
    textMuted: '#8a6b62',
    primary: '#3c1f19',
    primaryText: '#fdf6f3',
    accent: '#a54b32',
    accentSoft: '#f1d6cd',
  },
  ink: {
    id: 'ink',
    name: 'Ink',
    bg: '#f4f5f8',
    surface: '#ffffff',
    surfaceMuted: '#e9ebf0',
    border: '#d3d7df',
    text: '#15181f',
    textMuted: '#6a7080',
    primary: '#15181f',
    primaryText: '#f8f9fb',
    accent: '#3557a4',
    accentSoft: '#dbe2f3',
  },
  cream: {
    id: 'cream',
    name: 'Cream',
    bg: '#fdfaf3',
    surface: '#ffffff',
    surfaceMuted: '#f6efe0',
    border: '#e7ddc7',
    text: '#28200f',
    textMuted: '#8a7a5a',
    primary: '#3b2f18',
    primaryText: '#fdfaf3',
    accent: '#a67c2e',
    accentSoft: '#f2e4c2',
  },
}

export type FontId = 'sans' | 'serif' | 'display'

export type FontChoice = {
  id: FontId
  name: string
  description: string
  heading: string
  body: string
  google: string
}

export const FONTS: Record<FontId, FontChoice> = {
  sans: {
    id: 'sans',
    name: 'Modern',
    description: 'Clean sans-serif',
    heading: 'font-sans',
    body: 'font-sans',
    google: 'family=Inter:wght@400;500;600;700',
  },
  serif: {
    id: 'serif',
    name: 'Editorial',
    description: 'Classic serif',
    heading: 'font-serif',
    body: 'font-sans',
    google:
      'family=Playfair+Display:wght@600;700&family=Inter:wght@400;500',
  },
  display: {
    id: 'display',
    name: 'Distinct',
    description: 'Rounded, warm',
    heading: 'font-sans',
    body: 'font-sans',
    google:
      'family=DM+Sans:wght@500;600;700&family=Inter:wght@400;500',
  },
}

export type ShopTheme = {
  palette: PaletteId
  font: FontId
  primary?: string
}

export type ShopMessages = {
  preparing?: string
  ready?: string
}

export type Shop = {
  id: string
  name: string
  tagline?: string | null
  logo_url?: string | null
  logo_scale?: number | null
  logo_offset_x?: number | null
  logo_offset_y?: number | null
  theme?: ShopTheme
  game?: string | null
  messages?: ShopMessages
}

export const DEFAULT_THEME: ShopTheme = {
  palette: 'stone',
  font: 'sans',
}

export function getPalette(id: PaletteId | undefined): Palette {
  return PALETTES[id ?? 'stone'] ?? PALETTES.stone
}

export function getFont(id: FontId | undefined): FontChoice {
  return FONTS[id ?? 'sans'] ?? FONTS.sans
}

export function paletteVars(p: Palette): React.CSSProperties {
  return {
    ['--bg' as string]: p.bg,
    ['--surface' as string]: p.surface,
    ['--surface-muted' as string]: p.surfaceMuted,
    ['--border' as string]: p.border,
    ['--text' as string]: p.text,
    ['--text-muted' as string]: p.textMuted,
    ['--primary' as string]: p.primary,
    ['--primary-text' as string]: p.primaryText,
    ['--accent' as string]: p.accent,
    ['--accent-soft' as string]: p.accentSoft,
  } as React.CSSProperties
}