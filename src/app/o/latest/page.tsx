'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Coffee, ArrowLeft, QrCode } from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

const STORAGE_KEY = 'cup-active-order'

export default function LatestOrderPage() {
  const t = useT()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasOrder, setHasOrder] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let orderId: string | null = null
      try {
        orderId = localStorage.getItem(STORAGE_KEY)
      } catch {}

      if (!orderId) {
        if (!cancelled) {
          setHasOrder(false)
          setChecking(false)
        }
        return
      }

      // Check if the order still exists and isn't done
      try {
const res = await fetch(`/api/orders/${orderId}/status`, {          cache: 'no-store',
        }).catch(() => null)

        // Fallback: try the shop-scoped status endpoint
        let status: string | null = null
        if (res && res.ok) {
          const json = await res.json().catch(() => ({}))
          status = json?.order?.status ?? null
        }

        if (cancelled) return

        if (status === 'done' || status === null) {
          // Order is gone or finished — clear and show "no order"
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {}
          setHasOrder(false)
          setChecking(false)
        } else {
          // Redirect to the actual order page
          router.replace(`/o/${orderId}`)
        }
      } catch {
        if (!cancelled) {
          setHasOrder(false)
          setChecking(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking) {
    return (
      <main className="min-h-screen bg-[#faf7f2] flex items-center justify-center">
        <CupLogo size={44} />
      </main>
    )
  }

  if (hasOrder) return null

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      <header className="px-6 pt-8 pb-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition -ms-1.5"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('common.back')}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 px-6 pb-10 flex items-center">
        <div className="max-w-md mx-auto w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center">
              <Coffee className="w-9 h-9 text-stone-500" strokeWidth={1.8} />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('noOrder.title')}
            </h1>
            <p className="text-stone-500 text-[15px] leading-relaxed max-w-xs mx-auto">
              {t('noOrder.body')}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-900 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4 text-amber-100" />
              </div>
              <div className="text-start">
                <div className="text-sm font-medium">
                  {t('noOrder.scanPrompt')}
                </div>
                <div className="text-xs text-stone-500">
                  {t('noOrder.scanHint')}
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-stone-300 text-sm font-medium hover:bg-white transition"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('pending.backHome')}
          </Link>
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <CupLogo size={14} />
          <span>Cup</span>
        </div>
      </footer>
    </main>
  )
}