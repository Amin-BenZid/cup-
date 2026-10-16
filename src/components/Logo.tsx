'use client'

type Props = {
  url: string | null
  name?: string
  size: number
  scale?: number | null
  offsetX?: number | null
  offsetY?: number | null
  radius?: number
  className?: string
}

export default function Logo({
  url,
  name = 'Coffee',
  size,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  radius = 12,
  className = '',
}: Props) {
  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  }

  if (!url) {
    const letter = (name || 'C').trim()[0]?.toUpperCase() ?? 'C'
    return (
      <div
        className={`flex items-center justify-center font-bold ${className}`}
        style={{
          ...wrapperStyle,
          background: 'var(--primary, #1c1917)',
          color: 'var(--primary-text, #fafaf9)',
          fontSize: size * 0.42,
        }}
      >
        {letter}
      </div>
    )
  }

  const innerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})`,
    transformOrigin: 'center center',
    objectFit: 'cover',
    display: 'block',
  }

  return (
    <div className={className} style={wrapperStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} style={innerStyle} draggable={false} />
    </div>
  )
}