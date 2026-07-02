import { cn } from '@/lib/cn'

export interface TabItem {
  id: string
  label: string
  count?: number
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-ink-200', className)}>
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px px-3.5 py-2.5 text-sm font-medium transition',
              on
                ? 'text-brand-navy'
                : 'text-ink-500 hover:text-ink-700',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    on ? 'bg-brand-navy/10 text-brand-navy' : 'bg-ink-100 text-ink-500',
                  )}
                >
                  {t.count}
                </span>
              )}
            </span>
            {on && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-navy" />
            )}
          </button>
        )
      })}
    </div>
  )
}
