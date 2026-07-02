// Prompts + seeded demos for Step 5 (Publish Package). Each channel adaptation
// is produced by the copy model as JSON; the demo generators are deterministic
// and grounded in the approved master copy + brand so the package assembles with
// zero keys. Adaptations must PRESERVE material terms — the demos keep the
// disclosure block on long-form surfaces and add an explicit "see terms" link
// cue on short-form ones so the per-channel re-check stays honest.

import type { BrandProfile, ChannelKey, TopicOpportunity } from '@/types'
import type { ChannelMeta } from '@/lib/publish'
import { buildBrandContext } from '@/lib/brand/grounding'

export interface AdaptationDraft {
  headline: string
  body: string
  cta: string
  hashtags: string[]
}

const SCHEMA = `Return ONLY a JSON object (no prose, no fences):
{
  "headline": "channel-appropriate headline or subject line",
  "body": "the adapted copy for this channel",
  "cta": "a single call to action",
  "hashtags": ["0-4 hashtags, empty for blog/email"]
}`

export const PUBLISH_SYSTEM = `You are a channel editor for a regulated U.S. card issuer. You adapt one approved, compliance-cleared master article into a specific channel WITHOUT changing its meaning, adding claims, or dropping any material term or disclosure. On short surfaces, compress but keep a clear "see terms" link cue. Keep the brand voice. ${SCHEMA}`

export function buildAdaptationPrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  meta: ChannelMeta,
  masterCopy: string,
  disclosures: string[],
): string {
  return `${buildBrandContext(profile)}

TOPIC: ${topic.title}
CHANNEL: ${meta.label} — ${meta.guidance}
Soft length budget: ${meta.charLimit} characters.

APPROVED MASTER COPY (already compliance-cleared — do not weaken or contradict):
"""
${masterCopy}
"""

MATERIAL DISCLOSURES that must survive (inline, or clearly linked where the channel allows):
${disclosures.map((d) => `- ${d}`).join('\n') || '- (none specific to this topic)'}

Adapt the master copy for ${meta.label}. ${SCHEMA}`
}

function firstSentence(markdown: string): string {
  const plain = markdown
    .replace(/^#.*$/m, '')
    .replace(/[#*_>`]/g, '')
    .replace(/\[(.*?)\]/g, '$1')
    .trim()
  const m = plain.match(/[^.!?]+[.!?]/)
  return (m ? m[0] : plain.slice(0, 160)).trim()
}

function topicHashtags(topic: TopicOpportunity, brand: string): string[] {
  const tags = topic.tags.map(
    (t) => '#' + t.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/-/g, ''),
  )
  return [...tags.slice(0, 3), '#' + brand.replace(/[^A-Za-z0-9]/g, '')].slice(0, 4)
}

/** Deterministic, disclosure-preserving demo adaptation per channel. */
export function demoAdaptation(
  profile: BrandProfile,
  topic: TopicOpportunity,
  channel: ChannelKey,
  masterCopy: string,
  disclosures: string[],
): AdaptationDraft {
  const cta = profile.messaging.ctas[0] ?? 'Learn more'
  const hook = firstSentence(masterCopy)
  const disclosureBlock = disclosures.length
    ? '\n\n—\n' + disclosures.map((d) => `${d}`).join(' ')
    : ''
  const legal = profile.compliance.legalLines.join(' · ')

  switch (channel) {
    case 'blog':
      // Long-form: the master copy already carries the full disclosure block.
      return {
        headline: topic.title,
        body: masterCopy,
        cta,
        hashtags: [],
      }
    case 'email':
      return {
        headline: `${topic.title.split(':')[0]} — a clear, no-surprises guide`,
        body:
          `Preheader: ${hook}\n\n` +
          `Hi there,\n\n${hook} Here's the short version, in plain English — no jargon, no pressure.\n\n` +
          `• ${topic.rationale}\n` +
          `• What to watch for: the [APR], any fees, and the [term].\n` +
          `• How ${profile.brandName} keeps it transparent so you can decide with confidence.\n\n` +
          `${cta} →` +
          disclosureBlock +
          `\n\n${legal}`,
        cta,
        hashtags: [],
      }
    case 'linkedin':
      return {
        headline: `${topic.title.split(':')[0]}: what actually matters`,
        body:
          `${hook}\n\n` +
          `A few things we tell ${topic.audienceSegment.toLowerCase()} to look at:\n` +
          `→ The [APR] after any intro period\n→ The fees that hide in the fine print\n→ Whether the [term] fits your plan\n\n` +
          `We spell these out on purpose — ${profile.messaging.valueProps[0]?.toLowerCase() ?? 'no hidden fees'}.\n\n` +
          `Full terms and details — see the link in comments. ${cta}.`,
        cta,
        hashtags: topicHashtags(topic, profile.brandName),
      }
    case 'paid-social':
    default:
      return {
        headline: `${topic.title.split(':')[0]}, minus the jargon.`,
        body: `${hook.slice(0, 150)} ${cta} → Terms apply; see full terms.`,
        cta,
        hashtags: topicHashtags(topic, profile.brandName).slice(0, 2),
      }
  }
}

/** Compose the JSON fields into a single re-checkable text blob. */
export function adaptationText(a: AdaptationDraft): string {
  return [a.headline, a.body, a.cta, a.hashtags.join(' ')].filter(Boolean).join('\n')
}
