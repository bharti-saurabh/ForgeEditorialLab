import { cn } from '@/lib/cn'
import {
  IconSparkles,
  IconDoc,
  IconImage,
  IconShield,
  IconPackage,
  IconUsers,
  type IconType,
} from '@/components/icons'

export interface RailStep {
  step: number
  short: string
  icon: IconType
}

export const PIPELINE_STEPS: RailStep[] = [
  { step: 1, short: 'Topic Intel', icon: IconSparkles },
  { step: 2, short: 'Brief & Draft', icon: IconDoc },
  { step: 3, short: 'Visuals', icon: IconImage },
  { step: 4, short: 'Compliance', icon: IconShield },
  { step: 5, short: 'Package', icon: IconPackage },
  { step: 6, short: 'Persona Lab', icon: IconUsers },
]

/**
 * Floating pill navigation for the 6-step pipeline. Inactive steps show only
 * their icon; the active step expands into a glowing Straive-orange pill with
 * its label. Widths animate on change so the pill appears to slide between
 * steps. Completed steps tint green; upcoming steps stay dim.
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
    <div className="flex items-center gap-1.5">
      {PIPELINE_STEPS.map((s) => {
        const isActive = s.step === current
        const isDone = done.includes(s.step) || s.step < current
        const Icon = s.icon
        return (
          <button
            key={s.step}
            type="button"
            onClick={() => onPick?.(s.step)}
            title={s.short}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'group flex items-center rounded-xl px-3.5 py-3 outline-none transition-all duration-300 ease-out',
              isActive
                ? 'bg-gradient-to-b from-straive-400 to-straive-600 text-white shadow-brand-glow'
                : 'hover:bg-white/10',
            )}
          >
            <Icon
              size={24}
              className={cn(
                'shrink-0 transition-colors duration-300',
                isActive
                  ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]'
                  : isDone
                    ? 'text-emerald-400'
                    : 'text-navy-300 group-hover:text-white',
              )}
            />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap text-[14px] font-semibold transition-all duration-300 ease-out',
                isActive ? 'ml-2 max-w-[150px] opacity-100' : 'ml-0 max-w-0 opacity-0',
              )}
            >
              {s.short}
            </span>
          </button>
        )
      })}
    </div>
  )
}
