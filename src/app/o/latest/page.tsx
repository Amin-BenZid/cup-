'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Coffee, QrCode } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

const QrScanner = dynamic(() => import('@/components/QrScanner'), {
  ssr: false,
})

const STORAGE_KEY = 'cup-active-order'

function extractOrderId(text: string): string | null {
  const uuid =
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  const inUrl = text.match(new RegExp(`/o/(${uuid})`, 'i'))
  if (inUrl) return inUrl[1]
  if (new RegExp(`^${uuid}$`, 'i').test(text.trim())) return text.trim()
  return null
}

export default function LatestOrderPage() {
  const t = useT()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      let orderId: string | null = null
      try {
        orderId = localStorage.getItem(STORAGE_KEY)
      } catch {}

      if (!orderId) {
        if (!cancelled) setChecking(false)
        return
      }

      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          cache: 'no-store',
        }).catch(() => null)

        let status: string | null = null
        if (res && res.ok) {
          const json = await res.json().catch(() => ({}))
          status = json?.order?.status ?? null
        }

        if (cancelled) return

        if (status === 'done' || status === null) {
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {}
          setChecking(false)
        } else {
          router.replace(`/o/${orderId}`)
        }
      } catch {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleScan = useCallback(
    (text: string) => {
      const id = extractOrderId(text)
      if (!id) {
        setScanError(t('scan.invalid'))
        setScanning(false)
        return
      }
      setScanning(false)
      router.replace(`/o/${id}`)
    },
    [router, t],
  )

  if (checking) {
    return (
      <main className="min-h-screen bg-[#faf7f2] flex items-center justify-center">
        <BrandLogo size={44} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      <header className="px-6 pt-8 pb-2">
        <div className="max-w-md mx-auto flex items-center justify-end">
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

          <button
            onClick={() => {
              setScanError('')
              setScanning(true)
            }}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 active:scale-[0.99] transition"
          >
            <QrCode className="w-5 h-5" />
            {t('scan.button')}
          </button>

          {scanError && (
            <p className="text-xs text-red-600">{scanError}</p>
          )}

          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4 text-stone-500" />
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
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <BrandLogo size={14} />
          <span>beep</span>
        </div>
      </footer>

      {scanning && (
        <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />
      )}
    </main>
  )
}