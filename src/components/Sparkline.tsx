import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Tiny inline-SVG sparkline for demand-trend mini-viz. Deliberately dependency-free
 * (no Recharts) so it stays in the main bundle without weight. Renders a smooth
 * area + line with a dot on the latest point.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  color = '#2a7fd0',
  strokeWidth = 1.75,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
  color?: string
  strokeWidth?: number
}) {
  const gid = useId()
  if (!data || data.length < 2) return null

  const pad = strokeWidth + 1
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const stepX = (width - pad * 2) / (data.length - 1)

  const pts = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${pad},${height - pad} ${line} ${(width - pad).toFixed(1)},${height - pad}`
  const [lastX, lastY] = pts[pts.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0 overflow-visible', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={strokeWidth + 0.6} fill={color} />
    </svg>
  )
}
