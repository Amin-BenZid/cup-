'use client'

import { useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'

export default function BroadcastBanner() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/broadcast', { cache: 'no-store' })
      const json = await res.json()
      const broadcast = json.broadcast

      if (broadcast?.active && broadcast?.message) {
        // Only show if they haven't dismissed this specific message
        const dismissed = localStorage.getItem('dismissed-broadcast')
        if (dismissed !== broadcast.message) {
          setMessage(broadcast.message)
          setVisible(true)
        }
      } else {
        setVisible(false)
      }
    } catch {
      // Banner is non-critical; keep whatever is showing.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // First check right away, then poll while visible.
    const first = setTimeout(load, 0)

    // Poll while visible (Supabase realtime was removed for security).
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(first)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('dismissed-broadcast', message)
    setVisible(false)
  }

  if (loading || !visible) return null

  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-amber-900 text-sm sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0 max-w-3xl mx-auto w-full">
        <Megaphone className="w-4 h-4 shrink-0" />
        <p className="font-medium truncate">{message}</p>
      </div>
      <button onClick={dismiss} className="p-1 hover:bg-amber-200 rounded-md transition shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}