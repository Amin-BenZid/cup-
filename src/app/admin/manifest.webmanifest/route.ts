import { NextResponse } from 'next/server'

/** PWA manifest for the installable "Beep Admin" app (iPhone home screen). */
export function GET() {
  return NextResponse.json(
    {
      id: '/admin',
      name: 'Beep Admin',
      short_name: 'Beep Admin',
      description: 'Beep control panel',
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#fafafa',
      theme_color: '#ffffff',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
