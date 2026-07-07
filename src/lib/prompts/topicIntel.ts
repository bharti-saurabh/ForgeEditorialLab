// Prompt + seeded demo for Step 1's AI editorial read.
// The strategy model synthesizes demand, gaps, seasonality, product priorities,
// and regulatory sensitivity into a short executive read over the ranked
// backlog. Demo mode returns a grounded, deterministic narrative built from the
// same ranking the UI shows, so the story holds with zero keys.

import type { BrandProfile, FunnelStage, Rating, RecommendedFormat } from '@/types'
import { buildBrandContext } from '@/lib/brand/grounding'
import type { RankedTopic } from '@/lib/topics'

export const TOPIC_INTEL_SYSTEM =
  `You are the head of content strategy for a regulated U.S. card issuer. You review a ranked backlog of content opportunities and produce a concise executive read: what to prioritize and why, which themes cluster, what the seasonal/regulatory timing implies, and which topics to avoid as off-brand or high-risk. Ground every judgement in the brand. Be specific and decisive; no boilerplate.`

export function buildTopicIntelPrompt(
  profile: BrandProfile,
  ranked: RankedTopic[],
): string {
  const list = ranked
    .map(
      (r) =>
        `${r.rank}. [${r.score.score}] ${r.topic.title} — ${r.topic.funnelStage}/${r.topic.format}, demand ${r.topic.demand}, difficulty ${r.topic.difficulty}, compliance ${r.topic.complianceSensitivity}${r.topic.onBrand ? '' : ' [OFF-BRAND]'}`,
    )
    .join('\n')

  return `${buildBrandContext(profile)}

RANKED CONTENT BACKLOG (opportunity score in brackets, 0-100):
${list}

Write a 3-paragraph editorial read:
1. The top 3 priorities and the single reason each earns its rank.
2. Themes/clusters you see and the seasonal or regulatory timing to exploit.
3. What to deprioritize or avoid — call out any off-brand or high-compliance-risk topics explicitly.

Close with a one-line methodology note on how demand, difficulty, and compliance sensitivity were weighed.`
}

/** Deterministic seeded read — grounded in the actual ranking. */
export function demoTopicIntel(profile: BrandProfile, ranked: RankedTopic[]): string {
  const top = ranked.slice(0, 3)
  const offBrand = ranked.filter((r) => !r.topic.onBrand)
  const highRisk = ranked.filter(
    (r) => r.topic.onBrand && r.topic.complianceSensitivity === 'High',
  )
  const seasonal = ranked.filter((r) => r.topic.tags.includes('seasonal'))

  const p1 =
    `Top priorities: ${top
      .map((r, i) => `(${i + 1}) "${r.topic.title}" [${r.score.score}]`)
      .join(', ')}. ` +
    `${top[0].topic.title.split(':')[0]} leads on ${top[0].topic.demand.toLowerCase()} search demand (${top[0].topic.demandScore}) with a clean product tie-in to ${profile.brandName}'s ${top[0].topic.audienceSegment} audience. ` +
    `The next two pair strong demand with manageable production effort, so they convert backlog into shipped content fastest.`

  const p2 =
    `Two clusters stand out: a credit-education spine (scores, APR, first card) that reinforces the "you're in control" position and feeds every funnel stage, and a debt-relief cluster (balance transfer + payoff strategy) that is timely entering H2. ` +
    (seasonal.length
      ? `Seasonal windows — ${seasonal
          .slice(0, 3)
          .map((r) => `"${r.topic.title}"`)
          .join(', ')} — should be scheduled to their calendar peaks rather than run on demand.`
      : `Schedule any seasonal pieces to their calendar peaks.`)

  const p3 =
    (offBrand.length
      ? `Avoid: ${offBrand
          .map((r) => `"${r.topic.title}"`)
          .join(', ')} — flagged off-brand. ${offBrand[0].topic.offBrandReason ?? ''} `
      : `No off-brand topics in this cycle. `) +
    (highRisk.length
      ? `Proceed carefully on high-compliance-sensitivity pieces (${highRisk
          .map((r) => `"${r.topic.title}"`)
          .join(', ')}); they are worth doing but carry a heavier disclosure load, so budget extra time for the Step 4 gate.`
      : `Remaining topics carry a light disclosure load.`)

  const method =
    `Methodology: opportunity score = search demand, adjusted up for funnel proximity to conversion and down for production difficulty and compliance-review load; off-brand topics are penalized heavily. Scores are decision support, not a mandate — a human editor picks the topic to take forward.`

  return [p1, p2, p3, method].join('\n\n')
}

// ── Campaign search — turn a free-text query into one pointed recommendation ──

/** A generated campaign recommendation (ephemeral; convertible to a TopicOpportunity). */
export interface RawReco {
  title: string
  angle: string
  audienceSegment: string
  funnelStage: FunnelStage
  format: RecommendedFormat
  demand: Rating
  difficulty: Rating
  complianceSensitivity: Rating
  whyNow: string
  keyMessage: string
  rationale: string
  tags: string[]
  onBrand: boolean
  offBrandReason: string
}

export const TOPIC_SEARCH_SYSTEM = `You are the head of content strategy for a regulated U.S. card issuer. A marketer gives you a free-text theme or campaign idea. You return ONE pointed, on-brand campaign recommendation they can take straight into production. Ground it in the brand. Be specific and decisive.

Rules: audiences are behavioral / needs-based only — NEVER protected classes or proxies (age, race, sex, marital status, ZIP, etc.). Flag the idea off-brand if it needs hype, guarantees, or claims the brand can't make. Do not invent APRs/fees; refer to them as material terms to disclose.

Return ONLY JSON (no prose, no fences):
{
  "title": "sharp campaign headline",
  "angle": "the campaign angle in one line",
  "audienceSegment": "behavioral audience",
  "funnelStage": "awareness | consideration | decision",
  "format": "blog | explainer | email | social | landing-page",
  "demand": "High | Medium | Low",
  "difficulty": "High | Medium | Low",
  "complianceSensitivity": "High | Medium | Low",
  "whyNow": "why this is timely",
  "keyMessage": "the single core message",
  "rationale": "why it fits the brand + audience",
  "tags": ["3-5 short tags"],
  "onBrand": true,
  "offBrandReason": "if off-brand, why; else empty string"
}`

export function buildTopicSearchPrompt(profile: BrandProfile, query: string): string {
  return `${buildBrandContext(profile)}

MARKETER'S SEARCH / CAMPAIGN IDEA:
"""
${query}
"""

Turn this into ONE pointed campaign recommendation for ${profile.brandName}, using the JSON shape from the system message. Make the title publishable, the audience behavioral, and the compliance sensitivity honest.`
}

const FUNNELS: FunnelStage[] = ['awareness', 'consideration', 'decision']
const FORMATS: RecommendedFormat[] = ['blog', 'explainer', 'email', 'social', 'landing-page']
const RATINGS: Rating[] = ['High', 'Medium', 'Low']

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/** Deterministic, brand-grounded demo recommendation from a free-text query. */
export function demoTopicSearch(profile: BrandProfile, query: string): RawReco {
  const q = query.trim().replace(/\s+/g, ' ')
  const lower = q.toLowerCase()
  const clean = titleCase(q.replace(/[.?!]+$/, ''))

  const funnelStage: FunnelStage = /\b(apply|open|get|switch|best|compare|vs)\b/.test(lower)
    ? 'decision'
    : /\b(how|what|why|guide|explain|basics|101)\b/.test(lower)
      ? 'awareness'
      : 'consideration'
  const format: RecommendedFormat = /email|newsletter/.test(lower)
    ? 'email'
    : /social|post|reel|ad/.test(lower)
      ? 'social'
      : /landing|offer page/.test(lower)
        ? 'landing-page'
        : 'blog'
  const highRisk = /\b(apr|rate|approval|guarantee|credit limit|balance transfer|interest|reward|cash ?back|apy)\b/.test(lower)
  const offBrand = /\b(guarantee|guaranteed|instant approval|no credit check|get rich|crypto|100%)\b/.test(lower)

  const audienceSegment = /balance transfer|debt|payoff|interest/.test(lower)
    ? 'Balance-carrying cardholders'
    : /credit score|build credit|first card|new to credit/.test(lower)
      ? 'Credit builders'
      : /travel|miles|points/.test(lower)
        ? 'Aspirational travelers'
        : /cash ?back|everyday|grocery/.test(lower)
          ? 'Everyday cash-back users'
          : `Consumers researching ${lower.split(' ').slice(0, 3).join(' ')}`

  return {
    title: `${clean}: the no-surprises guide`,
    angle: `A plain-English take on ${lower} that leads with transparency, not hype.`,
    audienceSegment,
    funnelStage,
    format,
    demand: 'Medium',
    difficulty: 'Medium',
    complianceSensitivity: offBrand ? 'High' : highRisk ? 'High' : 'Medium',
    whyNow: `"${clean}" is an active search theme for ${audienceSegment.toLowerCase()}, and ${profile.brandName}'s transparency angle is under-served by competitors here.`,
    keyMessage: `${profile.brandName} explains ${lower} clearly — material terms up front, no fine-print surprises.`,
    rationale: `Fits ${profile.brandName}'s "you're in control" position: a ${funnelStage}-stage ${format} that turns a common question into a trust-building moment, with the required disclosures handled at the compliance gate.`,
    tags: [...new Set(lower.split(/\W+/).filter((w) => w.length > 3))].slice(0, 4),
    onBrand: !offBrand,
    offBrandReason: offBrand
      ? 'The phrasing implies a guarantee or claim a regulated issuer cannot make — reframe away from absolute promises before producing.'
      : '',
  }
}

const str = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? v.trim() : fb)
function pickEnum<T extends string>(v: unknown, allowed: T[], fb: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fb
}

/** Fill/validate a model-produced recommendation against the deterministic base. */
export function coerceReco(base: RawReco, parsed: Partial<RawReco> | null): RawReco {
  if (!parsed || typeof parsed !== 'object') return base
  return {
    title: str(parsed.title, base.title),
    angle: str(parsed.angle, base.angle),
    audienceSegment: str(parsed.audienceSegment, base.audienceSegment),
    funnelStage: pickEnum(parsed.funnelStage, FUNNELS, base.funnelStage),
    format: pickEnum(parsed.format, FORMATS, base.format),
    demand: pickEnum(parsed.demand, RATINGS, base.demand),
    difficulty: pickEnum(parsed.difficulty, RATINGS, base.difficulty),
    complianceSensitivity: pickEnum(parsed.complianceSensitivity, RATINGS, base.complianceSensitivity),
    whyNow: str(parsed.whyNow, base.whyNow),
    keyMessage: str(parsed.keyMessage, base.keyMessage),
    rationale: str(parsed.rationale, base.rationale),
    tags: Array.isArray(parsed.tags) && parsed.tags.length
      ? (parsed.tags.filter((t) => typeof t === 'string') as string[]).slice(0, 5)
      : base.tags,
    onBrand: typeof parsed.onBrand === 'boolean' ? parsed.onBrand : base.onBrand,
    offBrandReason: str(parsed.offBrandReason, base.offBrandReason),
  }
}
