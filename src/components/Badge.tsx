import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone =
  | 'neutral'
  | 'navy'
  | 'ok'
  | 'warn'
  | 'crit'
  | 'info'
  | 'accent'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-600 border-ink-200',
  navy: 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  ok: 'bg-ok/10 text-ok border-ok/20',
  warn: 'bg-warn/10 text-warn border-warn/25',
  crit: 'bg-crit/10 text-crit border-crit/25',
  info: 'bg-info/10 text-info border-info/20',
  accent: 'bg-brand-accentSoft text-brand-accent border-brand-accent/20',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Maps Low/Medium/High to a tone (demand, difficulty, sensitivity). */
export function ratingTone(r: 'Low' | 'Medium' | 'High'): BadgeTone {
  return r === 'High' ? 'crit' : r === 'Medium' ? 'warn' : 'ok'
}

export function severityTone(s: 'Critical' | 'Major' | 'Minor'): BadgeTone {
  return s === 'Critical' ? 'crit' : s === 'Major' ? 'warn' : 'info'
}
