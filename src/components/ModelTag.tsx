import { cn } from '@/lib/cn'
import type { CallMode, ModelRole } from '@/types'
import { ROLE_META } from '@/lib/router/roles'

const familyColor: Record<string, string> = {
  reasoning: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  copywriting: 'bg-violet-50 text-violet-700 border-violet-200',
  vision: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  image: 'bg-amber-50 text-amber-700 border-amber-200',
}

/** Chip that shows which model handled a step + the call mode. */
export function ModelTag({
  role,
  modelLabel,
  mode,
  className,
}: {
  role: ModelRole
  modelLabel: string
  mode?: CallMode
  className?: string
}) {
  const meta = ROLE_META[role]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        familyColor[meta.family] ?? 'bg-ink-100 text-ink-700 border-ink-200',
        className,
      )}
      title={meta.defaultReason}
    >
      <span className="font-semibold">{modelLabel}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{meta.label}</span>
      {mode && <ModeDot mode={mode} />}
    </span>
  )
}

export function ModeDot({ mode }: { mode: CallMode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1 text-[10px] font-bold uppercase',
        mode === 'live'
          ? 'bg-ok/15 text-ok'
          : 'bg-ink-200 text-ink-600',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          mode === 'live' ? 'bg-ok animate-pulse' : 'bg-ink-400',
        )}
      />
      {mode}
    </span>
  )
}
