import type { Metadata, Viewport } from 'next'
import AdminShell from '@/components/admin/AdminShell'

// Own manifest so "Add to Home Screen" from /admin installs a separate
// "Cup Admin" app that opens on /admin (needed for iPhone push notifications).
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Cup Admin' },
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Cup Admin', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
