// Compliance engine (Step 4). Deterministic, rule-cited analysis of the draft
// copy + visuals against the merged rulebook, plus a disclosure checklist.
// Deterministic on purpose: every finding cites a rule and is auditable, and
// the AI narrative assessment sits alongside it as decision support — never the
// sole basis for a pass. A human signs off.

import type {
  BrandProfile,
  ComplianceIssue,
  ComplianceState,
  DisclosureCheck,
  DraftVariant,
  RuleBook,
  RuleSeverity,
  TopicOpportunity,
  VisualAsset,
} from '@/types'
import { disclosuresForTopic } from '@/lib/compliance'
import { uid, clamp } from '@/lib/format'

const SEVERITY_PENALTY: Record<RuleSeverity, number> = {
  Critical: 25,
  Major: 12,
  Minor: 5,
}
const MISSING_DISCLOSURE_PENALTY = 6
const MISSING_LEGAL_LINE_PENALTY = 4

/** Suggested rewrite per rule. Some are inline swaps; some are inserts. */
function suggestRewrite(ruleId: string, snippet: string): string {
  switch (ruleId) {
    case 'rule_guaranteed':
      return `Remove the guarantee. Replace "${snippet.trim()}" with outcome-neutral language, e.g. "could help you…" or "designed to…".`
    case 'rule_preapproved':
      return `Change "pre-approved" to "pre-qualified" and add: "Pre-qualification is not a guarantee of approval and not a firm offer of credit."`
    case 'rule_apr_disclosure':
      return `Add the required rate disclosure near the APR mention: intro APR, the promo duration, the go-to APR range, and a representative example.`
    case 'rule_bt_fee':
      return `Disclose the balance-transfer fee (e.g. "[X]% of the amount transferred") and the promotional period and post-promo rate.`
    case 'rule_best_superlative':
      return `Soften or substantiate the superlative. Replace "${snippet.trim()}" with a specific, cited claim or a neutral phrasing.`
    case 'rule_free':
      return `Qualify "free" — specify scope (e.g. "no annual fee") and disclose any other applicable fees.`
    case 'rule_creditscore_edu':
      return `Add the educational caveat: "CreditWise is free and for educational purposes; it is not a credit decision or a guarantee of approval."`
    case 'rule_rewards_caveat':
      return `Caveat the rewards claim with earn caps, eligible categories, and redemption terms.`
    case 'rule_fairlending_proxy':
      return `Remove protected-class targeting/proxy. Segment on behavior or needs only.`
    case 'rule_trademark':
      return `Ensure any competitor comparison is truthful, substantiated, and uses marks nominatively.`
    default:
      return `Review against ${ruleId} and revise the flagged element.`
  }
}

/** Rules whose fix is an inline text swap (used to build the clean version). */
const INLINE_SWAP: Record<string, (s: string) => string> = {
  rule_guaranteed: () => 'designed to help',
  rule_preapproved: () => 'pre-qualified',
  rule_best_superlative: () => 'a strong option',
  rule_free: (s) => (/no fees/i.test(s) ? 'no annual fee' : s),
}

function findContext(text: string, trigger: string): string | null {
  const idx = text.toLowerCase().indexOf(trigger.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 24)
  const end = Math.min(text.length, idx + trigger.length + 24)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export function scanText(
  text: string,
  rulebook: RuleBook,
  element: ComplianceIssue['element'],
  elementRef?: string,
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const lower = text.toLowerCase()
  for (const rule of rulebook.rules) {
    const trigger = rule.triggers?.find((t) => lower.includes(t.toLowerCase()))
    if (!trigger) continue
    const snippet = findContext(text, trigger) ?? trigger
    issues.push({
      id: uid('iss'),
      ruleId: rule.id,
      citation: rule.citation,
      category: rule.category,
      title: rule.title,
      severity: rule.defaultSeverity,
      element,
      elementRef,
      snippet,
      rationale: rule.description,
      suggestedRewrite: suggestRewrite(rule.id, snippet),
      decision: 'open',
    })
  }
  return issues
}

/** Presence heuristic — does the copy already carry this disclosure? */
function disclosurePresent(body: string, disclosure: string): boolean {
  const b = body.toLowerCase()
  // distinctive keyphrase = first 4 meaningful words
  const key = disclosure
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4)
    .join(' ')
  return key ? b.includes(key.split(' ')[0]) && key.split(' ').filter((w) => b.includes(w)).length >= 2 : false
}

export function buildChecklist(
  topic: TopicOpportunity,
  profile: BrandProfile,
  rulebook: RuleBook,
  copy: string,
): DisclosureCheck[] {
  const checks: DisclosureCheck[] = []
  for (const d of disclosuresForTopic(topic, rulebook, profile)) {
    checks.push({
      id: uid('chk'),
      text: d,
      present: disclosurePresent(copy, d),
      source: 'rulebook',
    })
  }
  for (const line of profile.compliance.legalLines) {
    checks.push({
      id: uid('chk'),
      text: line,
      present: copy.toLowerCase().includes(line.toLowerCase()),
      source: 'legal-line',
    })
  }
  return checks
}

export interface AnalysisResult {
  issues: ComplianceIssue[]
  checklist: DisclosureCheck[]
  initialScore: number
}

export function analyzeContent(
  draft: DraftVariant,
  visuals: VisualAsset[],
  topic: TopicOpportunity,
  rulebook: RuleBook,
  profile: BrandProfile,
): AnalysisResult {
  const copy = `${draft.title}\n${draft.body}`
  const issues = scanText(copy, rulebook, 'copy')

  for (const v of visuals) {
    issues.push(...scanText(`${v.caption} ${v.altText} ${v.prompt}`, rulebook, 'visual', v.title))
    if (v.safety.status === 'review') {
      issues.push({
        id: uid('iss'),
        ruleId: 'rule_guaranteed',
        citation: 'Dodd-Frank §1031/§1036 (UDAAP) — net impression',
        category: 'UDAAP — Visual Net Impression',
        title: 'Visual may imply guaranteed / unrealistic outcomes',
        severity: 'Major',
        element: 'visual',
        elementRef: v.title,
        snippet: v.caption || v.title,
        rationale:
          'The brand-safety pass flagged this visual for net-impression risk (e.g. implied guaranteed wealth or unrealistic outcomes).',
        suggestedRewrite: 'Re-brief the image toward attainable, everyday moments; avoid wealth/luxury cues.',
        decision: 'open',
      })
    }
  }

  const checklist = buildChecklist(topic, profile, rulebook, copy)
  return { issues, checklist, initialScore: computeScore(issues, checklist, false) }
}

/** Score from a set of issues + checklist. `cleanApplied` waives disclosure gaps. */
export function computeScore(
  issues: ComplianceIssue[],
  checklist: DisclosureCheck[],
  cleanApplied: boolean,
): number {
  let penalty = 0
  for (const i of issues) {
    if (i.decision === 'open') penalty += SEVERITY_PENALTY[i.severity]
  }
  if (!cleanApplied) {
    for (const c of checklist) {
      if (!c.present)
        penalty += c.source === 'legal-line' ? MISSING_LEGAL_LINE_PENALTY : MISSING_DISCLOSURE_PENALTY
    }
  }
  return clamp(Math.round(100 - penalty), 0, 100)
}

export function currentScore(state: ComplianceState): number {
  return computeScore(state.issues, state.checklist, state.cleanApplied)
}

export interface IssueCounts {
  open: number
  resolved: number
  critical: number
  major: number
  minor: number
}

export function issueCounts(issues: ComplianceIssue[]): IssueCounts {
  const open = issues.filter((i) => i.decision === 'open')
  return {
    open: open.length,
    resolved: issues.length - open.length,
    critical: open.filter((i) => i.severity === 'Critical').length,
    major: open.filter((i) => i.severity === 'Major').length,
    minor: open.filter((i) => i.severity === 'Minor').length,
  }
}

/** Build the suggested clean version: apply resolutions + append disclosures. */
export function buildCleanVersion(
  draft: DraftVariant,
  state: ComplianceState,
): string {
  let body = draft.body
  for (const issue of state.issues) {
    if (issue.element !== 'copy') continue
    if (issue.decision === 'edited' && issue.editText) {
      body = body.replace(issue.snippet.replace(/^…|…$/g, ''), issue.editText)
    } else if (issue.decision === 'accepted') {
      const swap = INLINE_SWAP[issue.ruleId]
      if (swap) {
        // best-effort inline swap of the triggering word
        const trig = issue.snippet.replace(/^…|…$/g, '')
        body = body.replace(trig, swap(trig))
      }
    }
  }
  // Append any missing disclosures / legal lines.
  const missing = state.checklist.filter((c) => !c.present)
  if (missing.length) {
    body +=
      '\n\n### Required disclosures\n' +
      missing.map((m) => `*${m.text}*`).join('\n\n')
  }
  return `# ${draft.title}\n\n${body}`
}

/** Recommendation string from the current score + open criticals. */
export function recommendation(score: number, criticalOpen: number): string {
  if (criticalOpen > 0) return 'Do not publish — unresolved Critical issue(s).'
  if (score >= 90) return 'Ready to publish once signed off.'
  if (score >= 75) return 'Revise — apply the remaining rewrites, then ship.'
  return 'Significant revision needed before publish.'
}
