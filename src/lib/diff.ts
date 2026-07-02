// Lightweight word-level diff (LCS) used by the compliance redline to show what
// was removed vs added between the original draft and the clean version.
// O(n·m) over word/space tokens — fine for article-length copy.

export type DiffType = 'equal' | 'del' | 'ins'
export interface DiffOp {
  type: DiffType
  text: string
}

/** Split into word + whitespace tokens so whitespace diffs cleanly and rejoins. */
function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? []
}

/** Coalesce a token onto the previous op when the type matches. */
function push(ops: DiffOp[], type: DiffType, text: string) {
  const last = ops[ops.length - 1]
  if (last && last.type === type) last.text += text
  else ops.push({ type, text })
}

export function wordDiff(before: string, after: string): DiffOp[] {
  const a = tokenize(before)
  const b = tokenize(after)
  const n = a.length
  const m = b.length

  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(ops, 'equal', a[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(ops, 'del', a[i])
      i++
    } else {
      push(ops, 'ins', b[j])
      j++
    }
  }
  while (i < n) push(ops, 'del', a[i++])
  while (j < m) push(ops, 'ins', b[j++])
  return ops
}

/** Strip common markdown markers so the redline reads as prose, not source. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/(^|[^\w])\*([^*]+)\*/g, '$1$2')
    .replace(/`/g, '')
    .trim()
}
