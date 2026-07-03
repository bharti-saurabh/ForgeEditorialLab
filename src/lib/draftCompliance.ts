// Per-draft compliance PREVIEW for the Step 2 bake-off. Reuses the Step 4
// engine (scanText + buildChecklist) so "which draft is closest to clearing the
// gate?" is visible while comparing models — but this is decision support only.
// The real gate, redlines, and human sign-off live in Step 4.

import type { BrandProfile, DraftVariant, RuleBook, TopicOpportunity } from '@/types'
import { scanText, buildChecklist } from '@/lib/complianceEngine'

export interface DraftComplianceSummary {
  /** rule-cited issues found in the copy */
  issues: ReturnType<typeof scanText>
  disclosuresPresent: number
  disclosuresTotal: number
  /** required disclosure texts the copy does not yet carry */
  missingDisclosures: string[]
  critical: number
  major: number
  minor: number
  /** no critical/major issues AND every required disclosure is present */
  cleared: boolean
}

export function draftComplianceSummary(
  draft: DraftVariant,
  topic: TopicOpportunity,
  profile: BrandProfile,
  rulebook: RuleBook,
): DraftComplianceSummary {
  const copy = `${draft.title}\n${draft.body}`
  const issues = scanText(copy, rulebook, 'copy')
  const checklist = buildChecklist(topic, profile, rulebook, copy)

  const disclosuresPresent = checklist.filter((c) => c.present).length
  const disclosuresTotal = checklist.length
  const missingDisclosures = checklist.filter((c) => !c.present).map((c) => c.text)
  const critical = issues.filter((i) => i.severity === 'Critical').length
  const major = issues.filter((i) => i.severity === 'Major').length
  const minor = issues.filter((i) => i.severity === 'Minor').length

  return {
    issues,
    disclosuresPresent,
    disclosuresTotal,
    missingDisclosures,
    critical,
    major,
    minor,
    cleared: critical === 0 && major === 0 && disclosuresPresent === disclosuresTotal,
  }
}
