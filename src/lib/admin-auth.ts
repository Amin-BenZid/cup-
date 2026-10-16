import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'admin_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  const s = process.env.ADMIN_SECRET
  if (!s) throw new Error('ADMIN_SECRET not set')
  return s
}

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex')
}

export function createSessionToken(): string {
  const issued = Date.now().toString()
  const sig = sign(issued)
  return `${issued}.${sig}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [issued, sig] = parts
  const expected = sign(issued)
  // timing-safe compare
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    if (!crypto.timingSafeEqual(a, b)) return false
  } catch {
    return false
  }
  // expiry
  const issuedAt = Number(issued)
  if (!Number.isFinite(issuedAt)) return false
  const ageSeconds = (Date.now() - issuedAt) / 1000
  return ageSeconds < MAX_AGE_SECONDS
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  return verifySessionToken(token)
}

export const ADMIN_COOKIE = COOKIE_NAME
export const ADMIN_MAX_AGE = MAX_AGE_SECONDS