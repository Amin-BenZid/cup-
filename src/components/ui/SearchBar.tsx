'use client'

import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  /** Focus the input when pressing this key combo, e.g. "k" for ⌘K / Ctrl+K */
  hotkey?: string
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  autoFocus = false,
  hotkey,
}: Props) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (!hotkey) return
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === hotkey.toLowerCase()) {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey])

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && (
          <button
            onClick={() => {
              onChange('')
              ref.current?.focus()
            }}
            className="w-6 h-6 rounded-md hover:bg-stone-100 flex items-center justify-center transition"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5 text-stone-400" />
          </button>
        )}
        {hotkey && !value && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 text-[10px] font-mono text-stone-500">
            <span className="text-[11px]">⌘</span>
            {hotkey.toUpperCase()}
          </kbd>
        )}
      </div>
    </div>
  )
}