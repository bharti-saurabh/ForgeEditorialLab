// Prompt + seeded demo for Step 1's AI editorial read.
// The strategy model synthesizes demand, gaps, seasonality, product priorities,
// and regulatory sensitivity into a short executive read over the ranked
// backlog. Demo mode returns a grounded, deterministic narrative built from the
// same ranking the UI shows, so the story holds with zero keys.

import type { BrandProfile } from '@/types'
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
