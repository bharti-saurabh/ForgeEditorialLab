import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-card">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-ink-700">{title}</h4>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionTitle({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A small key/value stat used in summary headers. */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'ok' | 'warn' | 'crit'
}) {
  const color =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'crit'
          ? 'text-crit'
          : 'text-ink-900'
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3.5 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}
