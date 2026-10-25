import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Dev only: let phones on the LAN load the dev server (see NEXT_PUBLIC_DEV_LAN_IP).
  allowedDevOrigins: process.env.NEXT_PUBLIC_DEV_LAN_IP
    ? [process.env.NEXT_PUBLIC_DEV_LAN_IP]
    : [],
  async headers() {
    return [
      {
        source: '/ready.mp3',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
}

export default nextConfig