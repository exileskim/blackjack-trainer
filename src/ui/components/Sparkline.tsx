import { useId } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showDots?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 200,
  height = 48,
  color = 'var(--color-gold-400)',
  showDots = false,
  className = '',
}: SparklineProps) {
  const gradientId = useId().replace(/:/g, '_')
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 4

  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (val - min) / range) * (height - padding * 2),
  }))

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  const areaPath = [
    `M ${points[0].x},${height}`,
    `L ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`,
    `L ${points[points.length - 1].x},${height}`,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3 : 2}
          fill={i === points.length - 1 ? color : 'transparent'}
          stroke={color}
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}
