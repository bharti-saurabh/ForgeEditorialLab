import { useState } from 'react'
import { Button } from './Button'
import { IconDownload, IconChevronDown } from './icons'
import { exportJSON, exportMarkdown, printView } from '@/lib/export'
import { cn } from '@/lib/cn'

interface ExportButtonProps {
  name: string
  /** JSON-serializable data; omit to hide JSON option */
  json?: unknown
  /** markdown string; omit to hide Markdown option */
  markdown?: string
  /** show a print-to-PDF option */
  print?: boolean
  size?: 'sm' | 'md'
  label?: string
}

/** Dropdown export control — powers "export on every output". */
export function ExportButton({
  name,
  json,
  markdown,
  print,
  size = 'sm',
  label = 'Export',
}: ExportButtonProps) {
  const [open, setOpen] = useState(false)

  const options: Array<{ label: string; run: () => void }> = []
  if (markdown !== undefined)
    options.push({ label: 'Markdown (.md)', run: () => exportMarkdown(name, markdown) })
  if (json !== undefined)
    options.push({ label: 'JSON (.json)', run: () => exportJSON(name, json) })
  if (print) options.push({ label: 'Print / PDF', run: () => printView() })

  if (options.length === 1) {
    return (
      <Button
        size={size}
        variant="secondary"
        icon={<IconDownload size={15} />}
        onClick={options[0].run}
      >
        {label}
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button
        size={size}
        variant="secondary"
        icon={<IconDownload size={15} />}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <IconChevronDown size={13} className={cn('transition', open && 'rotate-180')} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-pop animate-fade-in">
            {options.map((o) => (
              <button
                key={o.label}
                onClick={() => {
                  o.run()
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
