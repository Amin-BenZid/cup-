/**
 * Beep brand mark, logo option 2 ("Ping"): a light sending one signal.
 * Geometry measured from the brand PDF, on a 100 × 100 grid:
 *   dot  r 9.8 at (40.2, 57.7)
 *   arc  quarter circle around the dot, r 25.05, stroke 7.7, round caps
 *   tile corner radius 28
 */

export const BRAND_INK = '#1d1916'
export const BRAND_CREAM = '#faf7f2'

function Mark({ color }: { color: string }) {
  return (
    <>
      <circle cx="40.2" cy="57.7" r="9.8" fill={color} />
      <path
        d="M40.2 32.65A25.05 25.05 0 0 1 65.25 57.7"
        fill="none"
        stroke={color}
        strokeWidth="7.7"
        strokeLinecap="round"
      />
    </>
  )
}

/** App tile: cream signal on an ink rounded square (or the reverse). */
export default function BrandLogo({
  size = 32,
  className = '',
  variant = 'dark',
}: {
  size?: number
  className?: string
  variant?: 'dark' | 'light'
}) {
  const bg = variant === 'dark' ? BRAND_INK : BRAND_CREAM
  const fg = variant === 'dark' ? BRAND_CREAM : BRAND_INK
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Beep"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="100" height="100" rx="28" fill={bg} />
      <Mark color={fg} />
    </svg>
  )
}

/** The bare signal, no tile (for the wordmark lockup). */
export function BrandMark({ size = 32, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) {
  // Cropped to the mark's own bounds so it lines up with text.
  return (
    <svg
      viewBox="29 27.5 41.5 41.5"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <Mark color={color} />
    </svg>
  )
}

/** Full lockup: signal + "beep" wordmark. */
export function BrandWordmark({ height = 24, className = '' }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: height * 0.45 }} aria-label="Beep">
      <BrandMark size={height * 0.9} />
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: height,
          letterSpacing: '-0.045em',
          lineHeight: 1,
        }}
      >
        beep
      </span>
    </span>
  )
}
