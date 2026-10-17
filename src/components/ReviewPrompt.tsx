'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Frown, Smile, Heart } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

type Rating = 1 | 2 | 3

const STORAGE_KEY = 'cup-review-'

export default function ReviewPrompt({ orderId }: { orderId: string }) {
  const t = useT()
  const [rating, setRating] = useState<Rating | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

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
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('review.title')}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('review.subtitle')}
        </p>
      </div>

      {/* Rating — icons instead of emojis */}
      <div className="flex items-center justify-center gap-3">
        <RatingButton
          active={rating === 1}
          onClick={() => setRating(1)}
          icon={<Frown className="w-6 h-6" strokeWidth={1.8} />}
          label={t('review.ratingLow')}
        />
        <RatingButton
          active={rating === 2}
          onClick={() => setRating(2)}
          icon={<Smile className="w-6 h-6" strokeWidth={1.8} />}
          label={t('review.ratingOk')}
        />
        <RatingButton
          active={rating === 3}
          onClick={() => setRating(3)}
          icon={<Heart className="w-6 h-6" strokeWidth={1.8} />}
          label={t('review.ratingGreat')}
        />
      </div>

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

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

function RatingButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition active:scale-95 ${
        active ? 'ring-2 ring-stone-900 scale-105' : 'hover:scale-105'
      }`}
      style={{
        background: active ? 'var(--primary)' : 'var(--surface-muted)',
        color: active ? 'var(--primary-text)' : 'var(--text)',
      }}
    >
      {icon}
    </button>
  )
}