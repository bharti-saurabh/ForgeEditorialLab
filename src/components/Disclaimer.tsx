import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { IconShield, IconAlert, IconBeaker } from './icons'

type Kind = 'legal' | 'synthetic' | 'illustrative'

const config: Record<
  Kind,
  { icon: ReactNode; label: string; cls: string; text: string }
> = {
  legal: {
    icon: <IconShield size={15} />,
    label: 'Decision support — not legal advice',
    cls: 'bg-amber-50 border-amber-200 text-amber-900',
    text: 'AI compliance output is decision support, not legal advice. A human reviewer approves every sign-off.',
  },
  synthetic: {
    icon: <IconBeaker size={15} />,
    label: 'Directional signal — not ground truth',
    cls: 'bg-cyan-50 border-cyan-200 text-cyan-900',
    text: 'Synthetic audience results are AI-simulated and directional only. Not a real survey; not statistically representative.',
  },
  illustrative: {
    icon: <IconAlert size={15} />,
    label: 'Illustrative / public-derived',
    cls: 'bg-ink-100 border-ink-200 text-ink-700',
    text: 'Brand data is illustrative and public-derived, for style reference only. Upload confirmed client collateral for production use.',
  },
}

export function Disclaimer({
  kind,
  className,
  compact,
  children,
}: {
  kind: Kind
  className?: string
  compact?: boolean
  children?: ReactNode
}) {
  const c = config[kind]
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs leading-relaxed',
        c.cls,
        className,
      )}
      role="note"
    >
      <span className="mt-0.5 shrink-0">{c.icon}</span>
      <span>
        <span className="font-semibold">{c.label}.</span>{' '}
        {!compact && <span className="opacity-90">{children ?? c.text}</span>}
      </span>
    </div>
  )
}
