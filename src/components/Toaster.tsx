import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/cn'
import { IconCheck, IconAlert, IconX } from './icons'

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)

  return (
    <div className="no-print pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-pop animate-fade-in',
            t.kind === 'success' && 'bg-white border-ok/30 text-ink-800',
            t.kind === 'error' && 'bg-white border-crit/30 text-ink-800',
            t.kind === 'info' && 'bg-white border-ink-200 text-ink-800',
          )}
        >
          <span
            className={cn(
              'mt-0.5 shrink-0',
              t.kind === 'success' && 'text-ok',
              t.kind === 'error' && 'text-crit',
              t.kind === 'info' && 'text-info',
            )}
          >
            {t.kind === 'error' ? <IconAlert size={16} /> : <IconCheck size={16} />}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-ink-400 hover:text-ink-700"
            aria-label="Dismiss"
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
