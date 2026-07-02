import { cn } from '@/lib/cn'

/** Circular score gauge (0-100). Color shifts with the score band. */
export function ScoreGauge({
  value,
  size = 92,
  label,
  className,
}: {
  value: number
  size?: number
  label?: string
  className?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const stroke = size < 70 ? 6 : 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (v / 100) * c
  const color = v >= 80 ? '#16794c' : v >= 60 ? '#b7791f' : '#c0362c'

  return (
    <div className={cn('inline-flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e9edf3"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold leading-none"
            style={{ color, fontSize: size * 0.28 }}
          >
            {Math.round(v)}
          </span>
          <span className="text-[10px] text-ink-400 font-medium">/100</span>
        </div>
      </div>
      {label && <span className="text-xs font-medium text-ink-500">{label}</span>}
    </div>
  )
}

/** Horizontal score bar for compact contexts. */
export function ScoreBar({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const color = v >= 80 ? 'bg-ok' : v >= 60 ? 'bg-warn' : 'bg-crit'
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink-500">{label}</span>
          <span className="font-semibold text-ink-700">{Math.round(v)}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}
