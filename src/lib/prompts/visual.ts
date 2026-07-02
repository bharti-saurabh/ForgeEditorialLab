// Prompts, seeded demos, and brand-safety heuristic for Step 3 (Visual Assets).
// Image prompts are auto-built from the brand VISUAL identity so every asset is
// on-palette and on-style. A text-model call writes the caption/alt text and an
// art-direction rationale; a deterministic heuristic backs the brand-safety note.

import type { BrandProfile, TopicOpportunity, VisualSafety } from '@/types'
import { buildVisualContext } from '@/lib/brand/grounding'

export type VisualRole = 'hero' | 'supporting'

export interface VisualSlot {
  role: VisualRole
  title: string
  intent: string
}

/** The default visual set suggested for a piece of content. */
export function suggestedSlots(): VisualSlot[] {
  return [
    { role: 'hero', title: 'Hero image', intent: 'lead editorial image at the top of the piece' },
    { role: 'supporting', title: 'Supporting visual', intent: 'inline concept illustration for a key section' },
    { role: 'supporting', title: 'Social cutdown', intent: 'square social-promo variant' },
  ]
}

/** Auto-build an on-brand image prompt from the visual identity + content. */
export function buildImagePrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  headline: string,
  slot: VisualSlot,
): string {
  return `${buildVisualContext(profile)}

TASK: Create a ${slot.intent} for "${headline}" (${topic.format}, audience: ${topic.audienceSegment}).
Requirements:
- ${slot.role === 'hero' ? 'Editorial hero framing with room for a headline; ' : ''}on-palette, clean composition with strong focal hierarchy.
- Real, diverse people in a candid, authentic everyday moment; warm natural light; aspirational but attainable.
- No text baked into the image, no logos, no depiction of guaranteed wealth or unrealistic outcomes.
${slot.title === 'Social cutdown' ? '- Square 1:1 crop.' : '- Landscape crop.'}`
}

const TEXT_SCHEMA = `Return ONLY JSON (no fences):
{ "caption": "editorial caption for the image", "altText": "accessible alt text", "artDirection": "one line on why this framing is on-brand" }`

export const VISUAL_TEXT_SYSTEM = `You are an art director + accessibility writer for a regulated card issuer. Given an on-brand image concept, you write a short caption, accessible alt text, and a one-line art-direction rationale. Warm, plain-spoken, on-brand. ${TEXT_SCHEMA}`

export function buildVisualTextPrompt(
  profile: BrandProfile,
  headline: string,
  slot: VisualSlot,
): string {
  return `${buildVisualContext(profile)}

The image is a ${slot.intent} for "${headline}". Write the caption, alt text, and art-direction note. ${TEXT_SCHEMA}`
}

export function demoVisualText(
  profile: BrandProfile,
  headline: string,
  slot: VisualSlot,
): { caption: string; altText: string; artDirection: string } {
  const subject = headline.split(':')[0]
  return {
    caption:
      slot.role === 'hero'
        ? `Real people, real moments — ${subject.toLowerCase()} made simple with ${profile.brandName}.`
        : `A clear, human take on ${subject.toLowerCase()}.`,
    altText: `A diverse ${slot.role === 'hero' ? 'group' : 'person'} in a warm, candid everyday moment, in ${profile.brandName}'s navy-and-light palette, illustrating ${subject.toLowerCase()}.`,
    artDirection: `Candid lifestyle framing in-palette with generous whitespace — attainable, not staged; keeps focal hierarchy clean.`,
  }
}

// Risky visual concepts to flag for human review (net-impression / UDAAP).
const RISKY_TERMS = [
  'guaranteed',
  'get rich',
  'wealth',
  'luxury',
  'mansion',
  'cash pile',
  'lottery',
  'stacks of cash',
  'unrealistic',
]

/** Deterministic brand-safety read on an image prompt/caption. */
export function assessBrandSafety(text: string, profile: BrandProfile): VisualSafety {
  const lower = text.toLowerCase()
  const notes: string[] = []
  const hits = RISKY_TERMS.filter((t) => lower.includes(t))
  if (hits.length) {
    notes.push(`Contains risk terms (${hits.join(', ')}) — may imply guaranteed wealth/outcomes.`)
  }
  // positive alignments
  if (/diverse|candid|authentic|real people|everyday/.test(lower)) {
    notes.push('Aligns with "diverse, relatable people in authentic moments".')
  }
  if (/no text|no logo/.test(lower)) {
    notes.push('No baked-in text/logo — keeps lockup usage compliant.')
  }
  notes.push(`On-palette check: uses ${profile.brandName} colors; verify final render before publish.`)
  return { status: hits.length ? 'review' : 'pass', notes }
}
