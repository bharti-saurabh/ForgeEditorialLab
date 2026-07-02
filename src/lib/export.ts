// Export utilities — powers the "export on every output" requirement.
// Everything stays client-side: we build a Blob and trigger a download.

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

function stamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function exportJSON(name: string, data: unknown) {
  download(
    `forge-${slugify(name)}-${stamp()}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  )
}

export function exportMarkdown(name: string, markdown: string) {
  download(`forge-${slugify(name)}-${stamp()}.md`, markdown, 'text/markdown')
}

export function exportText(name: string, text: string, ext = 'txt') {
  download(`forge-${slugify(name)}-${stamp()}.${ext}`, text, 'text/plain')
}

/** Print the current view (browser print-to-PDF) using @media print rules. */
export function printView() {
  window.print()
}

/** Copy text to clipboard, returning success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
