/**
 * Beep brand mark, logo option 2 ("Ping"): a light sending one signal.
 * Geometry measured from the brand PDF, on a 100 × 100 grid:
 *   dot  r 9.8 at (40.2, 57.7)
 *   arc  quarter circle around the dot, r 25.05, stroke 7.7, round caps
 *   tile corner radius 28
 */

const BRAND_INK = '#1d1916'
const BRAND_CREAM = '#faf7f2'

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
