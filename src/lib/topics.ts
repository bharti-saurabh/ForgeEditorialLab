// Topic Intelligence scoring (Step 1).
// A transparent, deterministic "opportunity score" so the ranked backlog is
// explainable — the AI editorial read (a strategy model call) narrates it, but
// the number itself is auditable and never a black box.

import type { Rating, TopicOpportunity } from '@/types'
import { clamp } from '@/lib/format'

export interface ScoreFactor {
  label: string
  delta: number
}

export interface TopicScore {
  score: number
  factors: ScoreFactor[]
}

const DIFFICULTY_PENALTY: Record<Rating, number> = { Low: 0, Medium: 8, High: 18 }
// Compliance-first: heavier sensitivity means more review effort + risk, so it
// nudges priority down — but never disqualifies (that's the gate's job, Step 4).
const COMPLIANCE_PENALTY: Record<Rating, number> = { Low: 0, Medium: 4, High: 10 }
const FUNNEL_BOOST = { awareness: 0, consideration: 4, decision: 6 } as const
const OFF_BRAND_PENALTY = 45

/** Explainable 0-100 opportunity score for a single topic. */
export function scoreTopic(t: TopicOpportunity): TopicScore {
  const factors: ScoreFactor[] = [{ label: 'Search demand', delta: t.demandScore }]

  const funnel = FUNNEL_BOOST[t.funnelStage]
  if (funnel) factors.push({ label: `Funnel: ${t.funnelStage}`, delta: funnel })

  const diff = DIFFICULTY_PENALTY[t.difficulty]
  if (diff) factors.push({ label: `Difficulty: ${t.difficulty}`, delta: -diff })

  const comp = COMPLIANCE_PENALTY[t.complianceSensitivity]
  if (comp) factors.push({ label: `Compliance load: ${t.complianceSensitivity}`, delta: -comp })

  if (!t.onBrand) factors.push({ label: 'Off-brand', delta: -OFF_BRAND_PENALTY })

  const raw = factors.reduce((sum, f) => sum + f.delta, 0)
  return { score: clamp(Math.round(raw), 0, 100), factors }
}

export interface RankedTopic {
  topic: TopicOpportunity
  score: TopicScore
  rank: number
}

/** Attach scores and rank the backlog high→low by opportunity score. */
export function rankTopics(topics: TopicOpportunity[]): RankedTopic[] {
  return topics
    .map((topic) => ({ topic, score: scoreTopic(topic) }))
    .sort((a, b) => b.score.score - a.score.score)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

export type SortKey = 'priority' | 'demand' | 'difficulty' | 'compliance' | 'title'

const RATING_ORDER: Record<Rating, number> = { Low: 0, Medium: 1, High: 2 }

/** Sort ranked topics by a chosen column (rank is always priority order). */
export function sortRanked(rows: RankedTopic[], key: SortKey): RankedTopic[] {
  const copy = [...rows]
  switch (key) {
    case 'demand':
      return copy.sort((a, b) => b.topic.demandScore - a.topic.demandScore)
    case 'difficulty':
      return copy.sort(
        (a, b) => RATING_ORDER[a.topic.difficulty] - RATING_ORDER[b.topic.difficulty],
      )
    case 'compliance':
      return copy.sort(
        (a, b) =>
          RATING_ORDER[b.topic.complianceSensitivity] -
          RATING_ORDER[a.topic.complianceSensitivity],
      )
    case 'title':
      return copy.sort((a, b) => a.topic.title.localeCompare(b.topic.title))
    default:
      return copy.sort((a, b) => a.rank - b.rank)
  }
}
