// Publish package (Step 5). Channel definitions + a lightweight, deterministic
// per-channel compliance re-check. The re-check reuses the same rule engine as
// the Step 4 gate (scanText) so adapting copy to a new channel can never quietly
// drop a disclosure or reintroduce a flagged phrase.

import type {
  ChannelKey,
  ChannelRecheck,
  ComplianceIssue,
  RuleBook,
} from '@/types'
import { scanText } from '@/lib/complianceEngine'

export interface ChannelMeta {
  key: ChannelKey
  label: string
  /** soft character budget for the primary body */
  charLimit: number
  /** how the copy should be shaped for this surface */
  guidance: string
  /** whether short-form disclosures may be linked rather than inline */
  allowsLinkedDisclosure: boolean
}

export const CHANNELS: ChannelMeta[] = [
  {
    key: 'blog',
    label: 'Blog / Web',
    charLimit: 5000,
    guidance:
      'Full long-form article. Keep the complete disclosure block inline at the foot of the piece.',
    allowsLinkedDisclosure: false,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    charLimit: 1300,
    guidance:
      'Professional, insight-led post. Hook in the first two lines; 3-5 short paragraphs; a few hashtags.',
    allowsLinkedDisclosure: true,
  },
  {
    key: 'email',
    label: 'Email',
    charLimit: 1200,
    guidance:
      'Subject line + preheader + scannable body with one clear CTA. Footer carries legal lines.',
    allowsLinkedDisclosure: false,
  },
  {
    key: 'paid-social',
    label: 'Paid social',
    charLimit: 280,
    guidance:
      'Tight, high-contrast hook + single CTA. Material terms must still be present or clearly linked.',
    allowsLinkedDisclosure: true,
  },
]

export function channelMeta(key: ChannelKey): ChannelMeta {
  return CHANNELS.find((c) => c.key === key) ?? CHANNELS[0]
}

/** Distinctive keyphrase test — does the adapted copy still carry a disclosure? */
function disclosurePresent(text: string, disclosure: string): boolean {
  const b = text.toLowerCase()
  const words = disclosure
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4)
  if (!words.length) return false
  return words.filter((w) => b.includes(w)).length >= 2
}

/**
 * Re-scan one channel's adapted copy against the rulebook + required disclosures.
 * Short-form channels that allow a linked disclosure treat a missing inline
 * disclosure as a note rather than a hard miss (a "see terms" link is expected).
 */
export function recheckChannel(
  adaptedText: string,
  disclosures: string[],
  rulebook: RuleBook,
  meta: ChannelMeta,
): ChannelRecheck {
  const issues: ComplianceIssue[] = scanText(adaptedText, rulebook, 'copy')
  const criticals = issues.filter((i) => i.severity === 'Critical').length

  const missingInline = disclosures.filter((d) => !disclosurePresent(adaptedText, d))
  // On surfaces that allow a linked disclosure, only the absence of an explicit
  // "see terms / link" cue is a real miss.
  const hasLinkCue = /see terms|full terms|link in|learn more|details at|terms apply/i.test(
    adaptedText,
  )
  const missingDisclosures =
    meta.allowsLinkedDisclosure && hasLinkCue ? 0 : missingInline.length

  const notes: string[] = []
  if (issues.length)
    notes.push(
      `${issues.length} rule trigger(s) in the adapted copy: ${[...new Set(issues.map((i) => i.title))].join('; ')}.`,
    )
  if (missingInline.length && missingDisclosures === 0)
    notes.push(
      `${missingInline.length} disclosure(s) not inline — acceptable via a "see terms" link on this surface.`,
    )
  if (missingDisclosures > 0)
    notes.push(`${missingDisclosures} required disclosure(s) missing and not linked.`)
  if (adaptedText.length > meta.charLimit)
    notes.push(
      `Over the ${meta.charLimit.toLocaleString()}-char budget (${adaptedText.length.toLocaleString()}).`,
    )
  if (!notes.length) notes.push('No new triggers; disclosures carried through.')

  const status: ChannelRecheck['status'] =
    criticals > 0 || missingDisclosures > 0 ? 'review' : 'pass'

  return {
    status,
    issues: issues.length,
    criticals,
    missingDisclosures,
    notes,
  }
}
