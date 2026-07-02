import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'navy' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-straive-500 text-white hover:bg-straive-600 active:bg-straive-700 shadow-sm border border-transparent',
  navy:
    'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 shadow-sm border border-transparent',
  secondary:
    'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 border border-transparent',
  danger:
    'bg-crit text-white hover:bg-crit/90 active:bg-crit border border-transparent shadow-sm',
  subtle:
    'bg-ink-100 text-ink-700 hover:bg-ink-200 border border-transparent',
}

const sizes: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-md',
  md: 'text-sm px-3.5 py-2 gap-2 rounded-lg',
  lg: 'text-sm px-5 py-2.5 gap-2 rounded-lg font-semibold',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-straive-500/35',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
