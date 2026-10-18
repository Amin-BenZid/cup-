import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cup',
    short_name: 'Cup',
    description: 'Your coffee, ready when you are.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#1c1917',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}