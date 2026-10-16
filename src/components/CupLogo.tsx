type Props = {
  size?: number
  className?: string
  variant?: 'dark' | 'light'
}

export default function CupLogo({ size = 32, className = '' }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Cup"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
      }}
      draggable={false}
    />
  )
}