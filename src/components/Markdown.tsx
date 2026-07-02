import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Minimal, safe markdown renderer for model-generated copy. Handles headings,
// bold/italic inline, bullet lists, and paragraphs — no HTML injection.

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // split on **bold** and *italic* while keeping delimiters
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  parts.forEach((p, i) => {
    if (!p) return
    if (p.startsWith('**') && p.endsWith('**')) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-ink-900">
          {p.slice(2, -2)}
        </strong>,
      )
    } else if (p.startsWith('*') && p.endsWith('*')) {
      nodes.push(
        <em key={`${keyBase}-i${i}`} className="text-ink-500">
          {p.slice(1, -1)}
        </em>,
      )
    } else {
      nodes.push(<span key={`${keyBase}-t${i}`}>{p}</span>)
    }
  })
  return nodes
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (!list.length) return
    const items = [...list]
    blocks.push(
      <ul key={`ul-${key++}`} className="my-2 list-disc space-y-1 pl-5 text-ink-700">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it, `li-${key}-${i}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushList()
      continue
    }
    if (line.startsWith('### ')) {
      flushList()
      blocks.push(
        <h4 key={`h4-${key++}`} className="mt-4 mb-1 text-sm font-bold text-ink-900">
          {renderInline(line.slice(4), `h4-${key}`)}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      flushList()
      blocks.push(
        <h3 key={`h3-${key++}`} className="mt-4 mb-1.5 text-base font-bold text-ink-900">
          {renderInline(line.slice(3), `h3-${key}`)}
        </h3>,
      )
    } else if (line.startsWith('# ')) {
      flushList()
      blocks.push(
        <h2 key={`h2-${key++}`} className="mb-2 text-lg font-extrabold text-ink-900">
          {renderInline(line.slice(2), `h2-${key}`)}
        </h2>,
      )
    } else if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ''))
    } else {
      flushList()
      blocks.push(
        <p key={`p-${key++}`} className="my-2 text-sm leading-relaxed text-ink-700">
          {renderInline(line, `p-${key}`)}
        </p>,
      )
    }
  }
  flushList()

  return <div className={cn('max-w-none', className)}>{blocks}</div>
}
