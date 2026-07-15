// Deterministic seeding utilities. NO Math.random / Date.now anywhere in the
// demo path — the same topic must always produce the same illustrative payload.

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small, fast, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeRng(seedStr: string): () => number {
  return mulberry32(hashStr(seedStr))
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Deterministically pick `n` distinct items. */
export function sample<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  const take = Math.min(n, pool.length)
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

/** Title-case a topic for display inside templates. */
export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
