// Compliance derivation shared by Step 2 (brief disclosures + watch-list) and,
// later, the Step 4 gate. Deriving disclosures from the topic here keeps the
// brief honest: the copy is told up front what it must carry.

import type {
  BrandProfile,
  ComplianceRule,
  RuleBook,
  TopicOpportunity,
} from '@/types'

/** Mandatory disclosures for a topic — rulebook topic map + always-on brand lines. */
export function disclosuresForTopic(
  topic: TopicOpportunity,
  rulebook: RuleBook,
  profile: BrandProfile,
): string[] {
  const out: string[] = []
  for (const tag of topic.tags) {
    const list = rulebook.disclosuresByTopic[tag]
    if (list) out.push(...list)
  }
  // Any credit-product topic always carries the base approval + terms lines.
  const base = profile.compliance.recurringDisclosures.filter((d) =>
    /approval|terms/i.test(d),
  )
  out.push(...base)
  return dedupe(out)
}

/** Rules whose topic scope intersects the topic's tags — the Step 4 watch-list. */
export function rulesForTopic(
  topic: TopicOpportunity,
  rulebook: RuleBook,
): ComplianceRule[] {
  return rulebook.rules.filter(
    (r) => r.topics?.some((t) => topic.tags.includes(t)),
  )
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()))).filter(Boolean)
}
