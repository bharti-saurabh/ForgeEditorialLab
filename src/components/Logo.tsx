import { cn } from '@/lib/cn'

/** Path to the Capital One brand mark (served from /public). */
export const CAPONE_LOGO = '/capone-logo.webp'

/**
 * Capital One brand chip — the official logo on a white tile so it stays
 * legible on the dark navy chrome. This is the client brand Forge works on.
 */
export function CapOneMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-white px-2 shadow-inner-top ring-1 ring-white/60',
        className,
      )}
      style={{ height: size }}
    >
      <img
        src={CAPONE_LOGO}
        alt="Capital One"
        className="w-auto object-contain"
        style={{ height: size * 0.6 }}
      />
    </span>
  )
}

/**
 * Full top-left lockup: Capital One brand mark + product name (Forge) with a
 * "by Straive" attribution. `onDark` switches type to white for navy chrome.
 */
export function ForgeLockup({
  onDark = true,
  className,
}: {
  onDark?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <CapOneMark size={34} />
      <span className={cn('h-7 w-px', onDark ? 'bg-white/20' : 'bg-ink-200')} />
      <div className="leading-none">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-[16px] font-extrabold tracking-tight',
              onDark ? 'text-white' : 'text-navy-900',
            )}
          >
            Forge
          </span>
          <span className="rounded bg-straive-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-straive-400 ring-1 ring-straive-500/25">
            Editorial Lab
          </span>
        </div>
        <div className={cn('mt-1 text-[10px] font-medium', onDark ? 'text-navy-300' : 'text-ink-400')}>
          by Straive
        </div>
      </div>
    </div>
  )
}
