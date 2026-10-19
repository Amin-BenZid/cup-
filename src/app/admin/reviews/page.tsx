'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Star,
  Frown,
  Smile,
  Heart,
  Store,
  Search,
} from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  shop_id: string
  shops: {
    name: string
    logo_url: string | null
  } | null
}

type RatingFilter = 'all' | '1' | '2' | '3'

export default function AdminReviewsPage() {
  const t = useT()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RatingFilter>('all')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/reviews', { cache: 'no-store' })
        if (res.status === 401) {
          router.replace('/admin/login')
          return
        }
        const json = await res.json()
        if (res.ok) setReviews(json.reviews)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  // Calculate counts for filters
  const counts = useMemo(() => {
    return {
      all: reviews.length,
      '3': reviews.filter((r) => r.rating === 3).length,
      '2': reviews.filter((r) => r.rating === 2).length,
      '1': reviews.filter((r) => r.rating === 1).length,
    }
  }, [reviews])

  // Apply search and filter
  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      // 1. Filter by rating
      if (filter !== 'all' && r.rating !== Number(filter)) return false

      // 2. Filter by search (shop name or comment)
      if (query.trim()) {
        const q = query.toLowerCase()
        const shopName = r.shops?.name?.toLowerCase() || ''
        const comment = r.comment?.toLowerCase() || ''
        if (!shopName.includes(q) && !comment.includes(q)) return false
      }

      return true
    })
  }, [reviews, filter, query])

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b border-zinc-200 bg-zinc-50 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition -ms-2 p-2 rounded-md hover:bg-zinc-100"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold">Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <CupLogo size={20} />
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-4">
        
        {/* SEARCH & FILTERS */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by shop name or comment..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-md text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ['all', 'All', Star],
                ['3', 'Excellent', Heart],
                ['2', 'Good', Smile],
                ['1', 'Bad', Frown],
              ] as const
            ).map(([id, label, Icon]) => {
              const active = filter === id
              const count = counts[id]
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition border ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${
                    active 
                      ? (id === '3' ? 'text-emerald-400' : id === '2' ? 'text-amber-400' : id === '1' ? 'text-red-400' : 'text-zinc-300')
                      : (id === '3' ? 'text-emerald-600' : id === '2' ? 'text-amber-600' : id === '1' ? 'text-red-500' : 'text-zinc-400')
                  }`} />
                  {label}
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                      active ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-300 rounded-lg bg-white">
            <Star className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No reviews match your filter.</p>
            {(query || filter !== 'all') && (
              <button
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
                className="mt-3 text-sm text-zinc-600 hover:text-zinc-900 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {filtered.map((r) => (
              <div key={r.id} className="p-4 flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  {r.rating === 1 ? (
                    <Frown className="w-5 h-5 text-red-500" strokeWidth={2} />
                  ) : r.rating === 2 ? (
                    <Smile className="w-5 h-5 text-amber-600" strokeWidth={2} />
                  ) : (
                    <Heart className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-900">
                    {r.comment || <span className="italic text-zinc-400">No comment</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    <Link
                      href={`/admin/shops/${r.shop_id}`}
                      className="flex items-center gap-1 hover:underline hover:text-zinc-900 transition"
                    >
                      {r.shops?.logo_url ? (
                        <img src={r.shops.logo_url} alt="" className="w-4 h-4 rounded object-cover" />
                      ) : (
                        <Store className="w-3 h-3" />
                      )}
                      {r.shops?.name || 'Unknown Shop'}
                    </Link>
                    <span className="text-zinc-300">•</span>
                    <span className="tabular-nums">
                      {new Date(r.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}