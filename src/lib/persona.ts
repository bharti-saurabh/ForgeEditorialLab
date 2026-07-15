// Persona Lab shared helpers (Step 6). Segment selection + the Reg B / ECOA
// fairness guardrail + deterministic hashing used by the focus-group engine
// (see focusGroup.ts). The live focus group itself is generated in focusGroup.ts
// (personas, moderated discussion, stats, recommendations) — this module holds
// only the pieces shared across setup and generation.
//
// FAIRNESS: segments are behavioral / needs-based only. checkFairness() blocks
// any custom segment that references protected classes or close proxies.

import type { PersonaSentiment, Segment, SegmentLens, TopicOpportunity } from '@/types'

export const LENS_ORDER: SegmentLens[] = [
  'Value & Rewards Orientation',
  'Credit Lifecycle Stage',
  'Life Stage',
  'Financial Mindset & Behavior',
]

/** How many participants a focus group may seat. */
export const PARTICIPANT_MIN = 3
export const PARTICIPANT_MAX = 8
/** At least one behavioral segment must be chosen. */
export const SEGMENT_MIN = 1

export const FAIRNESS_NOTE =
  'Panels use behavioral, needs-based segments only — never protected classes (race, color, religion, national origin, sex, marital status, age, receipt of public assistance) or close proxies. Generated participants are illustrative personas; their names and personalities are flavor, not a demographic basis. Custom segments are screened before they can join a panel.'

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic 0..1 from a seed string. */
export function unit(seed: string): number {
  return (hashStr(seed) % 10000) / 10000
}

/** Deterministic pick from a pool by seed. */
export function pick<T>(pool: T[], seed: string): T {
  return pool[Math.floor(unit(seed) * pool.length) % pool.length]
}

/** A sensible default segment selection: the topic's own audience + a lens spread. */
export function defaultPanel(topic: TopicOpportunity, segments: Segment[]): string[] {
  const ids: string[] = []
  const match = segments.find(
    (s) => s.name.toLowerCase() === topic.audienceSegment.toLowerCase(),
  )
  if (match) ids.push(match.id)
  for (const lens of LENS_ORDER) {
    const pickSeg = segments.find((s) => s.lens === lens && !ids.includes(s.id))
    if (pickSeg) ids.push(pickSeg.id)
  }
  const skeptic = segments.find((s) => /skeptic|anxious|averse/i.test(s.name) && !ids.includes(s.id))
  if (skeptic && ids.length < 5) ids.push(skeptic.id)
  return ids.slice(0, 4)
}

export const SENTIMENT_TONE: Record<PersonaSentiment, 'ok' | 'warn' | 'crit'> = {
  positive: 'ok',
  mixed: 'warn',
  negative: 'crit',
}

// ── Fairness guardrail ─────────────────────────────────────────────────────

// Word-boundary patterns per protected basis (+ close proxies). Boundaries avoid
// the false-positives a substring list hits ("management" ⊅ "men", "manage" ⊅ "age").
const PROTECTED_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(races?|racial|ethnic(ity)?|black|white|hispanic|latin[oax]|asian|african[- ]?american|caucasian|indigenous)\b/i, label: 'race / ethnicity' },
  { re: /\b(religio(n|us)|christian|catholic|muslim|islam(ic)?|jewish|hindu|buddhist|atheist)\b/i, label: 'religion' },
  { re: /\b(national origin|immigrants?|foreign[- ]?born|citizenship|undocumented)\b/i, label: 'national origin' },
  { re: /\b(sex|gender|males?|females?|man|men|woman|women|nonbinary|lgbtq?|transgender|trans)\b/i, label: 'sex / gender' },
  { re: /\b(marital|married|singles?|divorced|widow(ed|s)?|spouse)\b/i, label: 'marital status' },
  { re: /\b(pregnan(t|cy)|childbirth|maternity)\b/i, label: 'pregnancy' },
  { re: /\b(aged?|elderly|senior citizens?|retirees?|retired|younger|millennials?|boomers?|gen[- ]?z|over[- ]?\d{2})\b/i, label: 'age' },
  { re: /\b(disab(led|ility|ilities)|handicap(ped)?|wheelchair)\b/i, label: 'disability' },
  { re: /\b(veterans?|military service)\b/i, label: 'military / veteran status' },
  { re: /\b(public assistance|welfare|food stamps|snap benefits|section 8|medicaid)\b/i, label: 'receipt of public assistance' },
  { re: /\b(zip[- ]?code|postal code|neighborhood|inner[- ]?city|\d{5}(-\d{4})?)\b/i, label: 'geography proxy' },
]

export interface FairnessResult {
  blocked: boolean
  reason: string
  matched: string[]
}

/** Screen a custom segment description for protected-class content / proxies. */
export function checkFairness(text: string): FairnessResult {
  const matched = PROTECTED_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label)
  const unique = [...new Set(matched)]
  if (unique.length) {
    return {
      blocked: true,
      reason: `References a protected class or close proxy (${unique.join(', ')}). Under Reg B / ECOA, segment on behavior or need, not identity.`,
      matched: unique,
    }
  }
  return { blocked: false, reason: 'Behavioral / needs-based — cleared for use.', matched: [] }
}

/**
 * If an audience trips the screen, replace it with a neutral behavioral segment
 * and say why. Use on any model-produced audience (recommendations, personas) so
 * a protected-class audience never surfaces, in demo or live.
 */
export function sanitizeAudience(text: string): { value: string; note?: string } {
  const { blocked, matched } = checkFairness(text)
  if (!blocked) return { value: text }
  return {
    value: 'Consumers actively researching this need (behavioral intent)',
    note: `Rewritten to a needs-based segment — original referenced ${matched.join(', ')}.`,
  }
}
