'use client'

/**
 * Renders a subtle coffee-bean pattern behind the page content.
 * Only used when the active palette opts in via `pattern: 'beans'`.
 */
export default function CozyPattern({
  color = '#5c3a21',
  opacity = 0.05,
}: {
  color?: string
  opacity?: number
}) {
  // Small SVG tile that repeats. Each tile has one rotated coffee bean.
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'>
      <g fill='none' stroke='${color}' stroke-width='1.2' stroke-linecap='round'>
        <g transform='translate(20 20) rotate(-25)'>
          <ellipse cx='0' cy='0' rx='7' ry='10'/>
          <path d='M-3 -6 Q0 0 2 7'/>
        </g>
        <g transform='translate(60 60) rotate(30)'>
          <ellipse cx='0' cy='0' rx='7' ry='10'/>
          <path d='M-3 -6 Q0 0 2 7'/>
        </g>
      </g>
    </svg>
  `
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{
        backgroundImage: url,
        backgroundSize: '80px 80px',
        opacity,
        zIndex: 0,
      }}
    />
  )
}