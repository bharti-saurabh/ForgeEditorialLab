// Small formatting + id helpers used across the app.

let _counter = 0
/** Monotonic, collision-resistant id without relying on crypto in older envs. */
export function uid(prefix = 'id'): string {
  _counter += 1
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`
}

export function fmtNum(n: number | undefined): string {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('en-US')
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtDate(d?: string): string {
  if (!d) return '—'
  return d
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Rough token estimate when the gateway returns no usage (≈4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

export function pluralize(n: number, word: string, plural?: string): string {
  return `${n} ${n === 1 ? word : plural ?? word + 's'}`
}
