// Persona Lab engine (Step 6). Deterministic synthetic-audience simulation over
// the behavioral segment library. Everything here is DIRECTIONAL SIGNAL, not a
// real survey — the UI labels this on every view. Scores are derived
// deterministically from the draft's brand-match, the compliance score, and a
// per-segment hash so the demo is stable and reproducible with zero keys.
//
// FAIRNESS: segments are behavioral / needs-based only. checkFairness() blocks
// any custom segment that references protected classes or close proxies
// (Reg B / ECOA) and the event is logged to the Persona Lab's fairness trail.

import type {
  FocusComment,
  PersonaRecommendation,
  PersonaSentiment,
  Segment,
  SegmentLens,
  SurveyMetric,
  SurveyRow,
  TopicOpportunity,
} from '@/types'
import { clamp } from '@/lib/format'

export const LENS_ORDER: SegmentLens[] = [
  'Value & Rewards Orientation',
  'Credit Lifecycle Stage',
  'Life Stage',
  'Financial Mindset & Behavior',
]

export const PANEL_MIN = 3
export const PANEL_MAX = 10

export const FAIRNESS_NOTE =
  'Panels use behavioral, needs-based segments only — never protected classes (race, color, religion, national origin, sex, marital status, age, receipt of public assistance) or close proxies. Custom segments are screened before they can join a panel.'

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic 0..1 from a seed string. */
function unit(seed: string): number {
  return (hashStr(seed) % 10000) / 10000
}

/** A sensible default panel: the topic's own audience + a spread across lenses. */
export function defaultPanel(topic: TopicOpportunity, segments: Segment[]): string[] {
  const ids: string[] = []
  const match = segments.find(
    (s) => s.name.toLowerCase() === topic.audienceSegment.toLowerCase(),
  )
  if (match) ids.push(match.id)
  for (const lens of LENS_ORDER) {
    const pick = segments.find((s) => s.lens === lens && !ids.includes(s.id))
    if (pick) ids.push(pick.id)
  }
  // add one skeptical voice if room
  const skeptic = segments.find((s) => /skeptic|anxious|averse/i.test(s.name) && !ids.includes(s.id))
  if (skeptic && ids.length < 6) ids.push(skeptic.id)
  return ids.slice(0, 6)
}

/** How well the segment's motivations line up with the topic — 0..3 overlaps. */
function alignment(segment: Segment, topic: TopicOpportunity): number {
  const hay = `${topic.title} ${topic.rationale} ${topic.tags.join(' ')}`.toLowerCase()
  let hits = 0
  for (const m of segment.motivations) {
    const key = m.toLowerCase().split(/\s+/).filter((w) => w.length > 4)[0]
    if (key && hay.includes(key)) hits++
  }
  // topic audience match is a strong signal
  if (segment.name.toLowerCase() === topic.audienceSegment.toLowerCase()) hits += 2
  return Math.min(3, hits)
}

export interface SimInputs {
  brandMatch: number
  complianceScore: number
}

/** Per-segment synthetic survey scores (0-100). Deterministic. */
export function simulateSurvey(
  segment: Segment,
  topic: TopicOpportunity,
  inputs: SimInputs,
): SurveyRow {
  const brand = inputs.brandMatch
  const comp = inputs.complianceScore
  const align = alignment(segment, topic)
  const funnelBoost =
    topic.funnelStage === 'decision' ? 10 : topic.funnelStage === 'consideration' ? 5 : 0

  const jit = (metric: string, spread: number) =>
    (unit(`${segment.id}:${metric}`) - 0.5) * spread

  const clarity = clamp(Math.round(0.55 * brand + 34 + jit('clarity', 16)), 8, 98)
  const trust = clamp(
    Math.round(0.45 * comp + 0.3 * brand + 12 + jit('trust', 14)),
    8,
    98,
  )
  const appeal = clamp(
    Math.round(52 + align * 9 + 0.15 * brand + jit('appeal', 18)),
    8,
    98,
  )
  const intent = clamp(
    Math.round(0.4 * appeal + 0.25 * trust + funnelBoost + 10 + jit('intent', 16)),
    5,
    98,
  )

  return {
    segmentId: segment.id,
    segmentName: segment.name,
    lens: segment.lens,
    clarity,
    trust,
    appeal,
    intent,
  }
}

function rowAverage(r: SurveyRow): number {
  return Math.round((r.clarity + r.trust + r.appeal + r.intent) / 4)
}

function sentimentFrom(avg: number): PersonaSentiment {
  return avg >= 72 ? 'positive' : avg >= 55 ? 'mixed' : 'negative'
}

/** A simulated focus-group reaction, grounded in the segment's own drivers. */
export function simulateComment(
  segment: Segment,
  topic: TopicOpportunity,
  row: SurveyRow,
): FocusComment {
  const avg = rowAverage(row)
  const sentiment = sentimentFrom(avg)
  const subject = topic.title.split(':')[0].toLowerCase()
  const motive = segment.motivations[0] ?? 'a clear, fair deal'
  const objection = segment.objections[0] ?? 'anything that feels like fine print'

  const quote =
    sentiment === 'positive'
      ? `Finally, ${subject} explained without the runaround. It speaks to ${motive.toLowerCase()}, and I trust it enough to look closer.`
      : sentiment === 'mixed'
        ? `The piece is clear and I like that it's upfront, but as someone who cares about ${motive.toLowerCase()}, I'd want the specifics before I act — right now "${objection.toLowerCase()}" still nags at me.`
        : `It reads fine, but it doesn't win me over. I keep catching on ${objection.toLowerCase()}, and nothing here really addresses ${motive.toLowerCase()}.`

  return {
    segmentId: segment.id,
    segmentName: segment.name,
    lens: segment.lens,
    sentiment,
    quote,
    objection,
  }
}

export function aggregateMetrics(rows: SurveyRow[]): SurveyMetric[] {
  const avg = (k: keyof Pick<SurveyRow, 'clarity' | 'trust' | 'appeal' | 'intent'>) =>
    rows.length ? Math.round(rows.reduce((a, r) => a + r[k], 0) / rows.length) : 0
  return [
    { key: 'clarity', label: 'Clarity', average: avg('clarity') },
    { key: 'trust', label: 'Trust', average: avg('trust') },
    { key: 'appeal', label: 'Appeal', average: avg('appeal') },
    { key: 'intent', label: 'Intent', average: avg('intent') },
  ]
}

export function overallScore(metrics: SurveyMetric[]): number {
  return metrics.length
    ? Math.round(metrics.reduce((a, m) => a + m.average, 0) / metrics.length)
    : 0
}

export function buildRecommendation(
  metrics: SurveyMetric[],
  rows: SurveyRow[],
  comments: FocusComment[],
): PersonaRecommendation {
  const overall = overallScore(metrics)
  const intent = metrics.find((m) => m.key === 'intent')?.average ?? 0
  const negatives = comments.filter((c) => c.sentiment === 'negative')
  const weakest = [...metrics].sort((a, b) => a.average - b.average)[0]
  const lowSegs = [...rows]
    .sort((a, b) => rowAverage(a) - rowAverage(b))
    .slice(0, 2)
    .map((r) => r.segmentName)

  let verdict: PersonaRecommendation['verdict']
  let headline: string
  if (overall >= 74 && intent >= 65 && negatives.length === 0) {
    verdict = 'ship'
    headline = 'Ship it — strong, consistent resonance across the panel.'
  } else if (overall >= 60) {
    verdict = 'ab-test'
    headline = 'A/B test — solid overall, but worth optimizing the weak spot before full rollout.'
  } else {
    verdict = 'revise'
    headline = 'Revise — the panel signals the piece is not ready to ship.'
  }

  const abPlan = [
    `Primary metric: ${verdict === 'revise' ? 'clarity + intent' : 'click-through → intent'}; guardrail: unsubscribe / negative sentiment.`,
    `Variant A (control): the current approved copy. Variant B: strengthen "${weakest.label.toLowerCase()}" — ${weakest.key === 'trust' ? 'lead with the transparency/no-surprises proof point' : weakest.key === 'clarity' ? 'tighten the opening and add a one-line definition' : weakest.key === 'appeal' ? 'sharpen the hook toward the top segment’s motivation' : 'add a more concrete, low-friction CTA'}.`,
    `Watch under-indexing segments: ${lowSegs.join(', ')}.`,
    `Suggested split: 50/50, ~2 weeks or until a decisive read; treat results as directional, confirm with real audience data.`,
  ]

  const rationale =
    verdict === 'ship'
      ? `Overall ${overall}/100 with intent at ${intent}. No segment rejected the piece; the message lands across lenses.`
      : verdict === 'ab-test'
        ? `Overall ${overall}/100. "${weakest.label}" (${weakest.average}) is the drag; an A/B test can lift it without risking the approved baseline.`
        : `Overall ${overall}/100 with ${negatives.length} segment(s) unconvinced. Address "${weakest.label}" (${weakest.average}) and the recurring objections before spending media.`

  return { verdict, headline, rationale, abPlan }
}

// ── Fairness guardrail ─────────────────────────────────────────────────────

const PROTECTED_TERMS = [
  'race',
  'racial',
  'ethnic',
  'ethnicity',
  'black',
  'white',
  'hispanic',
  'latino',
  'asian',
  'religion',
  'religious',
  'christian',
  'muslim',
  'jewish',
  'national origin',
  'immigrant',
  'sex',
  'gender',
  'male',
  'female',
  'women',
  'men ',
  'marital',
  'married',
  'single ',
  'divorced',
  'pregnan',
  'age ',
  'elderly',
  'senior citizen',
  'young ',
  'disab',
  'public assistance',
  'welfare',
  'food stamps',
  'zip code',
  'zipcode',
  'neighborhood',
]

export interface FairnessResult {
  blocked: boolean
  reason: string
  matched: string[]
}

/** Screen a custom segment description for protected-class content / proxies. */
export function checkFairness(text: string): FairnessResult {
  const lower = ` ${text.toLowerCase()} `
  const matched = PROTECTED_TERMS.filter((t) => lower.includes(t)).map((t) => t.trim())
  if (matched.length) {
    return {
      blocked: true,
      reason: `References a protected class or close proxy (${[...new Set(matched)].join(', ')}). Under Reg B / ECOA, segment on behavior or need, not identity.`,
      matched: [...new Set(matched)],
    }
  }
  return { blocked: false, reason: 'Behavioral / needs-based — cleared for use.', matched: [] }
}

export const SENTIMENT_TONE: Record<PersonaSentiment, 'ok' | 'warn' | 'crit'> = {
  positive: 'ok',
  mixed: 'warn',
  negative: 'crit',
}

export { rowAverage }
