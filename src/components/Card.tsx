import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('card', className)}>{children}</div>
}

export function CardHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-4',
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="mt-0.5 text-brand-navy shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-[13px] text-ink-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function CardBody({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('p-5', className)}>{children}</div>
}
