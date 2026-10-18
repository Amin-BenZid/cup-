'use client'

import { useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useT } from '@/lib/i18n/context'

export default function BroadcastBanner() {
  const t = useT()
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/broadcast', { cache: 'no-store' })
      const json = await res.json()
      const broadcast = json.broadcast
      
      console.log('[Banner] Fetched broadcast:', broadcast)

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
    } catch (e) {
      console.error('[Banner] Fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    // Listen for realtime changes
    const channel = supabase
      .channel('broadcast-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.broadcast' },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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