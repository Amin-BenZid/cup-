/** Human text for shop_history actions and admin audit events. */

function d(details: unknown): Record<string, unknown> {
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : {}
}

function shortDate(v: unknown) {
  if (typeof v !== 'string') return '—'
  const dt = new Date(v)
  return Number.isFinite(dt.getTime())
    ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
}

export function describeHistory(action: string, details: unknown): string {
  const x = d(details)
  switch (action) {
    case 'created':
      return 'signed up'
    case 'approved':
      return 'was approved'
    case 'disabled':
      return 'was disabled'
    case 'set_pending':
      return 'was set back to pending'
    case 'renamed':
      return `renamed to “${x.new_name ?? '?'}”`
    case 'code_changed':
      return `café code changed to ${x.to ?? '?'}`
    case 'pin_reset':
      return 'PIN was reset'
    case 'unlocked':
      return 'login was unlocked'
    case 'billing_extended':
      return `subscription +${x.months ?? '?'} month(s), until ${shortDate(x.new_date)}`
    case 'billing_set':
      if ('trial_ends_at' in x) return `trial end set to ${x.trial_ends_at ? shortDate(x.trial_ends_at) : 'none'}`
      if ('subscription_ends_at' in x)
        return `subscription end set to ${x.subscription_ends_at ? shortDate(x.subscription_ends_at) : 'none'}`
      return 'billing dates changed'
    case 'edited':
      return `details edited (${Array.isArray(x.fields) ? x.fields.join(', ') : 'fields'})`
    default:
      return action.replace(/_/g, ' ')
  }
}

const AUDIT: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout_all_devices: 'Logged out all devices',
  '2fa_enabled': 'Turned on 2FA',
  '2fa_disabled': 'Turned off 2FA',
  push_device_added: 'Added a notification device',
  push_device_removed: 'Removed a notification device',
  support_contact_updated: 'Updated support contact',
  notify_prefs_updated: 'Changed notification settings',
  shop_updated: 'Updated a café',
  shop_deleted: 'Deleted a café',
  billing_extended: 'Extended a subscription',
  support_reply: 'Replied to support',
  broadcast_on: 'Published a broadcast',
  broadcast_off: 'Turned off the broadcast',
  errors_cleared: 'Cleared app errors',
  order_status: 'Changed an order status',
}

export function describeAudit(event: string, details?: Record<string, unknown>): string {
  const base = AUDIT[event] ?? event.replace(/_/g, ' ')
  if (!details) return base
  if (event === 'shop_updated' || event === 'shop_deleted') return `${base}: ${details.shop ?? ''}`
  if (event === 'login_failed') return `${base} (${details.reason === '2fa' ? 'wrong code' : 'wrong password'})`
  if (event === 'order_status') return `${base}: #${details.order ?? '?'} → ${details.status ?? '?'}`
  if (event === 'billing_extended') return `${base} by ${details.months ?? '?'} month(s)`
  return base
}
