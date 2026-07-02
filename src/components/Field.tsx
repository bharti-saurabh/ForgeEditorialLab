import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('input min-h-[90px] resize-y', props.className)} />
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn('input pr-8 appearance-none cursor-pointer', className)}>
      {children}
    </select>
  )
}

/** Labeled range slider used for brand-voice controls. */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  leftLabel,
  rightLabel,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  leftLabel?: string
  rightLabel?: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-700">{label}</span>
        <span className="text-xs font-mono text-ink-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-navy"
      />
      {(leftLabel || rightLabel) && (
        <div className="mt-0.5 flex justify-between text-[10px] text-ink-400">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  )
}
