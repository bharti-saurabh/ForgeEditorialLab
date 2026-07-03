// Topic Intelligence scoring (Step 1).
// A transparent, deterministic "opportunity score" so the ranked backlog is
// explainable — the AI editorial read (a strategy model call) narrates it, but
// the number itself is auditable and never a black box.

import type { Rating, TopicOpportunity } from '@/types'
import { clamp } from '@/lib/format'
import { SEED_TOPIC_BACKLOG } from '@/seed/topicBacklog'

/**
 * Resolve a topic id against the seed backlog first, then any user-added topics.
 * Downstream steps use this so a topic the editor added in Step 1 still resolves
 * when taken forward.
 */
export function findTopic(
  id: string | null,
  userTopics: TopicOpportunity[] = [],
): TopicOpportunity | null {
  if (!id) return null
  return (
    SEED_TOPIC_BACKLOG.find((t) => t.id === id) ??
    userTopics.find((t) => t.id === id) ??
    null
  )
}

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

/**
 * User-tunable emphasis on each scoring dimension (a multiplier, neutral = 1.0).
 * Lets an editor bias the backlog toward reach, speed-to-publish, or low risk
 * without changing the transparent factor breakdown. Funnel boost and the
 * off-brand penalty are structural and stay fixed.
 */
export interface ScoreWeights {
  demand: number
  effort: number
  compliance: number
}

export const DEFAULT_WEIGHTS: ScoreWeights = { demand: 1, effort: 1, compliance: 1 }

/** Named "lenses" for the priority tuner — each answers a different question. */
export const SCORE_PRESETS: Record<'balanced' | 'reach' | 'speed' | 'risk', ScoreWeights> = {
  balanced: { demand: 1, effort: 1, compliance: 1 },
  reach: { demand: 1.4, effort: 0.6, compliance: 0.6 },
  speed: { demand: 1, effort: 1.6, compliance: 1 },
  risk: { demand: 0.9, effort: 1.2, compliance: 2 },
}

/** Explainable 0-100 opportunity score for a single topic. */
export function scoreTopic(t: TopicOpportunity, weights: ScoreWeights = DEFAULT_WEIGHTS): TopicScore {
  const factors: ScoreFactor[] = [
    { label: 'Search demand', delta: Math.round(t.demandScore * weights.demand) },
  ]

  const funnel = FUNNEL_BOOST[t.funnelStage]
  if (funnel) factors.push({ label: `Funnel: ${t.funnelStage}`, delta: funnel })

  const diff = Math.round(DIFFICULTY_PENALTY[t.difficulty] * weights.effort)
  if (diff) factors.push({ label: `Difficulty: ${t.difficulty}`, delta: -diff })

  const comp = Math.round(COMPLIANCE_PENALTY[t.complianceSensitivity] * weights.compliance)
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
export function rankTopics(
  topics: TopicOpportunity[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): RankedTopic[] {
  return topics
    .map((topic) => ({ topic, score: scoreTopic(topic, weights) }))
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
