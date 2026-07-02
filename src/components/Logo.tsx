import { cn } from '@/lib/cn'

/**
 * Base-aware asset URL. In dev BASE_URL is "/", on GitHub Pages it is
 * "/ForgeEditorialLab/" — so an absolute "/logo.webp" would 404 there.
 * Prefixing with BASE_URL keeps public assets resolving in both places.
 */
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

export const CAPONE_LOGO = asset('capone-logo.webp')
export const STRAIVE_LOGO = asset('straive-logo.webp')

/**
 * Straive platform mark on a white tile so the orange wordmark stays legible
 * on the dark navy chrome. Straive is the company that makes Forge.
 */
export function StraiveMark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-white px-2 shadow-inner-top ring-1 ring-white/50',
        className,
      )}
      style={{ height: height + 10 }}
    >
      <img src={STRAIVE_LOGO} alt="Straive" className="w-auto object-contain" style={{ height }} />
    </span>
  )
}

/**
 * Capital One brand mark on a white tile — the client brand Forge works on.
 */
export function CapOneMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-white shadow-inner-top ring-1 ring-black/5',
        className,
      )}
      style={{ height: size, width: size }}
    >
      <img
        src={CAPONE_LOGO}
        alt="Capital One"
        className="object-contain"
        style={{ height: size * 0.62, width: size * 0.62 }}
      />
    </span>
  )
}

/**
 * Top-left product lockup: Straive platform mark → Forge product name with the
 * "Editorial Lab" family tag. This is the strong brand anchor of the app.
 */
export function ForgeLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <StraiveMark height={26} />
      <span className="h-10 w-px bg-white/15" />
      <div className="leading-none">
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-black tracking-tight text-white">Forge</span>
          <span className="rounded-md bg-straive-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-straive-300 ring-1 ring-straive-500/30">
            Editorial Lab
          </span>
        </div>
        <div className="mt-1.5 text-[11px] font-medium tracking-wide text-navy-300">
          Compliance-first content engine
        </div>
      </div>
    </div>
  )
}

/**
 * Client-brand indicator: the Capital One logo on a white tile, shown in the
 * top bar to signal which brand Forge is currently working on.
 */
export function ClientChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 shadow-card ring-1 ring-black/5',
        className,
      )}
      style={{ height: 38 }}
    >
      <img src={CAPONE_LOGO} alt="Capital One" className="w-auto object-contain" style={{ height: 22 }} />
      <span className="whitespace-nowrap text-[14px] font-semibold text-ink-900">Capital One</span>
    </span>
  )
}
