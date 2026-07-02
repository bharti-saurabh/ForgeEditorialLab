// AI compliance assessment (Step 4). The structured, rule-cited findings come
// from the deterministic engine; this call produces the narrative reviewer's
// read that sits alongside them. Demo output is grounded in the engine result.

import type {
  BrandProfile,
  ComplianceIssue,
  DisclosureCheck,
  TopicOpportunity,
} from '@/types'

export const COMPLIANCE_SYSTEM = `You are a senior marketing-compliance reviewer at a regulated U.S. card issuer (advertising review / UDAAP, Reg Z/TILA, Reg B/ECOA, FTC). You review content and produce a concise professional assessment: the net impression, the most material risks, and what must change before publish. You are decision support — a human reviewer signs off. Cite regulations by name. Be direct; no boilerplate.`

export function buildAssessmentPrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  copy: string,
  issues: ComplianceIssue[],
  checklist: DisclosureCheck[],
): string {
  const findings = issues
    .map((i) => `- [${i.severity}] ${i.title} (${i.citation}) — "${i.snippet}"`)
    .join('\n')
  const missing = checklist.filter((c) => !c.present).map((c) => `- ${c.text}`).join('\n')
  return `BRAND: ${profile.brandName}. TOPIC: ${topic.title}.

CONTENT UNDER REVIEW:
"""
${copy.slice(0, 2400)}
"""

RULE-BASED FINDINGS (from the compliance engine):
${findings || '- none'}

MISSING DISCLOSURES / LEGAL LINES:
${missing || '- none'}

Write a 2-paragraph reviewer assessment: (1) the overall net impression and whether it is publishable as-is; (2) the most material risks and the specific changes required. End with a one-line recommendation.`
}

export function demoAssessment(
  topic: TopicOpportunity,
  issues: ComplianceIssue[],
  checklist: DisclosureCheck[],
): string {
  const crit = issues.filter((i) => i.severity === 'Critical')
  const major = issues.filter((i) => i.severity === 'Major')
  const missing = checklist.filter((c) => !c.present)
  const p1 =
    `Net impression: the piece is on-brand and readable, and it stays in the "you're in control, no surprises" lane. ` +
    (crit.length
      ? `It is not publishable as-is — ${crit.length} Critical issue${crit.length > 1 ? 's' : ''} create${crit.length > 1 ? '' : 's'} a deceptive or unsubstantiated net impression that must be resolved first.`
      : issues.length
        ? `It is close, but ${issues.length} issue${issues.length > 1 ? 's' : ''} should be addressed before publish.`
        : `No rule triggers fired, but confirm disclosures below before publish.`)
  const p2 =
    `Most material risks: ` +
    (issues.length
      ? `${[...crit, ...major]
          .slice(0, 3)
          .map((i) => `${i.title} (${i.citation})`)
          .join('; ')}. `
      : `primarily missing disclosures. `) +
    (missing.length
      ? `The copy is also missing ${missing.length} required disclosure/legal line${missing.length > 1 ? 's' : ''} (e.g. ${missing
          .slice(0, 2)
          .map((m) => `"${m.text}"`)
          .join(', ')}) — add these near the relevant claims. `
      : `Required disclosures appear present. `) +
    `Apply the suggested rewrites, add the disclosures, then route for human sign-off.`
  const rec = crit.length
    ? 'Recommendation: Do not publish — resolve Critical issues, then re-review.'
    : `Recommendation: Revise (${topic.complianceSensitivity.toLowerCase()} sensitivity topic) and sign off.`
  return [p1, p2, rec].join('\n\n')
}
