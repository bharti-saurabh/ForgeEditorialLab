// Prompts, seeded demos, and brand-safety heuristic for Step 3 (Visual Assets).
// Image prompts are auto-built from the brand VISUAL identity so every asset is
// on-palette and on-style. A text-model call writes the caption/alt text and an
// art-direction rationale; a deterministic heuristic backs the brand-safety note.

import type { BrandProfile, TopicOpportunity, VisualSafety } from '@/types'
import { buildVisualContext } from '@/lib/brand/grounding'
import { channelSpec, type ChannelSpec } from '@/lib/channels'

export type VisualRole = 'hero' | 'supporting'

export interface VisualSlot {
  role: VisualRole
  title: string
  intent: string
  /** image-generation size for this slot (from the channel's aspect ratio) */
  size: string
  /** square crop → drives the demo mock + preview framing */
  square: boolean
  /** display ratio, e.g. "1:1" */
  ratio: string
}

/**
 * The visual set for a piece — derived from the publish channel's aspect ratios.
 * Text-ad surfaces (SEM) return no slots. The first ratio becomes the hero.
 */
export function suggestedSlots(channel: ChannelSpec = channelSpec('blog')): VisualSlot[] {
  return channel.ratios.map((r, i) => ({
    role: i === 0 ? 'hero' : 'supporting',
    title: i === 0 ? `${channel.short} hero (${r.ratio})` : `${r.label}`,
    intent:
      i === 0
        ? `lead ${channel.label} image (${r.ratio})`
        : `supporting ${channel.label} variant (${r.ratio})`,
    size: r.size,
    square: r.square,
    ratio: r.ratio,
  }))
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
- ${slot.square ? 'Square 1:1 crop.' : `${slot.ratio} crop.`}`
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

// ── Vision-model brand-safety read (looks at the actual rendered image) ──────

const SAFETY_SCHEMA = `Return ONLY JSON (no fences):
{ "status": "pass" | "review", "notes": ["short, specific observations about net impression"] }`

export const SAFETY_VISION_SYSTEM = `You are a brand + marketing-compliance reviewer for a regulated U.S. card issuer. You look at a generated marketing image and judge its NET IMPRESSION — what an ordinary consumer would take away — not just its literal contents. Flag (status "review") anything that implies guaranteed wealth or outcomes, conspicuous luxury/opulence, exclusion of protected groups, baked-in text or logos, or off-brand styling; otherwise "pass". Be concrete and brief. This is decision support, not a legal ruling. ${SAFETY_SCHEMA}`

/** Instruction paired with the image for the vision-model safety read. */
export function buildSafetyVisionPrompt(profile: BrandProfile, caption: string): string {
  return `${buildVisualContext(profile)}

Assess this generated image for ${profile.brandName}. Consider net impression against UDAAP/brand concerns: does it imply guaranteed wealth or outcomes, show conspicuous luxury, exclude anyone, bake in text/logos, or drift off-brand? The intended caption is: "${caption}".
${SAFETY_SCHEMA}`
}

/** Accessibility check on alt text — deterministic, no model needed. */
export function assessAltText(altText: string, title: string): { ok: boolean; notes: string[] } {
  const t = altText.trim()
  const notes: string[] = []
  if (!t) return { ok: false, notes: ['Missing alt text — screen readers will skip this image.'] }
  if (t.length < 10) notes.push('Very short — describe the scene, not just a label.')
  if (t.length > 125) notes.push(`Long (${t.length} chars) — aim for ≤125 so screen readers aren’t verbose.`)
  if (/^(image|picture|photo|graphic) of/i.test(t))
    notes.push('Avoid "image of…" — screen readers already announce it as an image.')
  if (t.toLowerCase() === title.trim().toLowerCase())
    notes.push('Same as the title — alt text should describe the visual, not repeat the headline.')
  if (!notes.length) notes.push('Descriptive length and phrasing look good.')
  return { ok: notes.length === 1 && notes[0].startsWith('Descriptive'), notes }
}

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
