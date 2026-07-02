import { cn } from '@/lib/cn'
import { IconCheck } from '@/components/icons'

export interface RailStep {
  step: number
  short: string
}

export const PIPELINE_STEPS: RailStep[] = [
  { step: 1, short: 'Topic Intel' },
  { step: 2, short: 'Brief & Draft' },
  { step: 3, short: 'Visuals' },
  { step: 4, short: 'Compliance' },
  { step: 5, short: 'Package' },
  { step: 6, short: 'Persona Lab' },
]

/**
 * Horizontal numbered progress rail for the 6-step pipeline.
 * `current` highlights the active step (orange); earlier steps render as "done".
 */
export function StepRail({
  current,
  onPick,
  done = [],
}: {
  current: number
  onPick?: (step: number) => void
  done?: number[]
}) {
  return (
    <div className="flex w-full items-center">
      {PIPELINE_STEPS.map((s, i) => {
        const isActive = s.step === current
        const isDone = done.includes(s.step) || s.step < current
        const state: 'active' | 'done' | 'todo' = isActive ? 'active' : isDone ? 'done' : 'todo'
        return (
          <div key={s.step} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onPick?.(s.step)}
              className="group flex shrink-0 flex-col items-center gap-1.5 outline-none"
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition',
                  state === 'active' &&
                    'border-straive-500 bg-straive-500 text-white shadow-glow',
                  state === 'done' && 'border-ok bg-ok/10 text-ok',
                  state === 'todo' &&
                    'border-ink-200 bg-white text-ink-400 group-hover:border-ink-300',
                )}
              >
                {state === 'done' ? <IconCheck size={16} /> : s.step}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[11px] font-semibold transition',
                  state === 'active' && 'text-straive-600',
                  state === 'done' && 'text-ink-600',
                  state === 'todo' && 'text-ink-400 group-hover:text-ink-600',
                )}
              >
                {s.short}
              </span>
            </button>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className="mx-2 mb-5 h-0.5 flex-1 rounded-full bg-ink-200">
                <span
                  className={cn(
                    'block h-full rounded-full bg-ok transition-all',
                    s.step < current ? 'w-full' : 'w-0',
                  )}
                />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
