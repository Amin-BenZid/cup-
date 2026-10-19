'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Image as ImageIcon, Plus, X, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

type ShopData = {
  logo_url: string | null
  has_created_order: boolean
}

export default function OnboardingChecklist({ shopId, onDismiss }: { shopId: string; onDismiss: () => void }) {
  const t = useT()
  const [shop, setShop] = useState<ShopData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shops/${shopId}/onboarding`)
        if (res.ok) {
          const json = await res.json()
          setShop(json.shop)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [shopId])

  if (loading || !shop) return null

  const steps = [
    {
      id: 'logo',
      title: t('onboarding.logo'),
      description: t('onboarding.logoDesc'),
      done: !!shop.logo_url,
      href: '/barista/customize?tab=branding',
      icon: ImageIcon,
    },
    {
      id: 'order',
      title: t('onboarding.order'),
      description: t('onboarding.orderDesc'),
      done: !!shop.has_created_order,
      href: '#',
      icon: Plus,
      action: true,
    },
  ]

  const completedCount = steps.filter((s) => s.done).length
  const progress = (completedCount / steps.length) * 100

  if (completedCount === steps.length) return null

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm mb-6 relative overflow-hidden">
      {/* Close button */}
      <button 
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-stone-400 hover:bg-stone-100 transition"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center justify-between mb-4 pr-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-stone-900">{t('onboarding.title')}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{t('onboarding.subtitle')}</p>
          </div>
        </div>
        <div className="text-xs font-bold text-stone-400 tabular-nums">
          {completedCount}/{steps.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-stone-100 rounded-full mb-5 overflow-hidden">
        <div 
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-4">
        {steps.map((step) => {
          return (
            <div key={step.id} className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 mt-0.5">
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-stone-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${step.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                    {step.title}
                  </div>
                  {!step.done && (
                    <div className="text-xs text-stone-500 mt-0.5">{step.description}</div>
                  )}
                </div>
              </div>
              
              {/* ACTION BUTTONS */}
              {!step.done && (
                step.action ? (
                  <span className="shrink-0 px-3 py-1.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                    {t('onboarding.tryIt')}
                  </span>
                ) : (
                  <Link 
                    href={step.href}
                    className="shrink-0 px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition"
                  >
                    {t('onboarding.go')}
                  </Link>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}