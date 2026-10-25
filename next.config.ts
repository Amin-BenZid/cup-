import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Dev only: let phones on the LAN load the dev server (see NEXT_PUBLIC_DEV_LAN_IP).
  allowedDevOrigins: process.env.NEXT_PUBLIC_DEV_LAN_IP
    ? [process.env.NEXT_PUBLIC_DEV_LAN_IP]
    : [],
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      // Camera is needed by the QR scanner on /o/latest.
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
    ]
    return [
      { source: '/:path*', headers: security },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
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