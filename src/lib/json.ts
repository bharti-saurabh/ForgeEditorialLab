// Tolerant JSON extraction from model output (handles ```json fences and
// surrounding prose). Returns null on failure so callers can fall back.

export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null
  let s = text.trim()

  // strip code fences
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()

  // try direct
  try {
    return JSON.parse(s) as T
  } catch {
    /* fall through */
  }

  // try to find the first balanced object/array
  const start = s.search(/[[{]/)
  if (start === -1) return null
  const open = s[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++
    else if (s[i] === close) {
      depth--
      if (depth === 0) {
        const candidate = s.slice(start, i + 1)
        try {
          return JSON.parse(candidate) as T
        } catch {
          return null
        }
      }
    }
  }
  return null
}
