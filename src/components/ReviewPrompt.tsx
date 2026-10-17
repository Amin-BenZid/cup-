'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

type Rating = 1 | 2 | 3

const STORAGE_KEY = 'cup-review-'

const EMOJIS: Record<Rating, string> = {
  1: '😐',
  2: '🙂',
  3: '🤩',
}

export default function ReviewPrompt({ orderId }: { orderId: string }) {
  const t = useT()
  const [rating, setRating] = useState<Rating | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Remember if the customer already reviewed this order
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(STORAGE_KEY + orderId) === '1') {
        setSubmitted(true)
      }
    } catch {}
  }, [orderId])

  async function submit() {
    if (!rating) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, rating, comment }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Failed to save review')
        return
      }
      try {
        localStorage.setItem(STORAGE_KEY + orderId, '1')
      } catch {}
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl border p-4 flex items-center gap-3"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: '#d1fae5', color: '#059669' }}
        >
          <Check className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          {t('review.thanks')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div>
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text)' }}
        >
          {t('review.title')}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('review.subtitle')}
        </p>
      </div>

      {/* Rating — 3 big emoji buttons */}
      <div className="flex items-center justify-center gap-3">
        {([1, 2, 3] as Rating[]).map((r) => {
          const active = rating === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={`w-16 h-16 rounded-2xl text-3xl transition active:scale-95 ${
                active
                  ? 'ring-2 ring-stone-900 bg-stone-100 scale-105'
                  : 'bg-stone-50 hover:bg-stone-100'
              }`}
              aria-label={
                r === 1
                  ? t('review.ratingLow')
                  : r === 2
                  ? t('review.ratingOk')
                  : t('review.ratingGreat')
              }
            >
              {EMOJIS[r]}
            </button>
          )
        })}
      </div>

      {/* Optional comment */}
      {rating !== null && (
        <div className="space-y-2 pt-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 200))}
            placeholder={t('review.commentPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-stone-900/10 resize-none"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              {comment.length}/200
            </span>
            <button
              onClick={submit}
              disabled={submitting || !rating}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 inline-flex items-center gap-2"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-text)',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('review.sending')}
                </>
              ) : (
                t('review.send')
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}