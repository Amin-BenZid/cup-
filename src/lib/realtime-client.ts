'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser side of live updates. Only subscribes to Broadcast channels (no
 * table access), so the public anon key is all it needs. Returns whether the
 * socket is connected; callers keep a slower polling fallback either way.
 */

let client: SupabaseClient | null = null

function realtime(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  client ??= createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}

export function useLiveTopic(topic: string | null | undefined, onChange: () => void): boolean {
  const cb = useRef(onChange)
  useEffect(() => {
    cb.current = onChange
  }, [onChange])

  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!topic) return
    const rt = realtime()
    if (!rt) return
    const channel = rt
      .channel(topic, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'change' }, () => cb.current())
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
        // Catch up on anything missed while (re)connecting.
        if (status === 'SUBSCRIBED') cb.current()
      })
    return () => {
      setConnected(false)
      void rt.removeChannel(channel)
    }
  }, [topic])

  return connected
}
