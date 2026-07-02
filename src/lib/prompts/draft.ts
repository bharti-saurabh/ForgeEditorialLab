// Prompts + seeded demos for Step 2 (Brief & Draft).
// The brief is produced by the strategy model as JSON; the draft by the copy
// model as markdown. Demo generators are deterministic and grounded in the
// brand + topic so the story holds with zero keys, and vary by model so the
// bake-off shows a real side-by-side.

import type {
  BrandProfile,
  ContentBrief,
  TopicOpportunity,
  VoiceControls,
} from '@/types'
import { buildBrandContext } from '@/lib/brand/grounding'
import { friendlyModel } from '@/lib/router/roles'

// ── Brief ────────────────────────────────────────────────────────────────

const BRIEF_SCHEMA = `Return ONLY a JSON object (no prose, no fences):
{
  "objective": "the business goal this content serves",
  "audience": "who this is for and their mindset",
  "angle": "the single distinctive angle/hook",
  "keyMessages": ["3-5 points the piece must land"],
  "seoKeywords": ["4-6 target search terms"],
  "structure": ["ordered outline sections"],
  "toneNotes": "how to sound, grounded in the brand voice"
}`

export const BRIEF_SYSTEM = `You are a content strategist for a regulated U.S. card issuer. You turn one approved topic into a tight creative brief that a copywriter can execute directly. Ground everything in the brand. ${BRIEF_SCHEMA}`

export function buildBriefPrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  disclosures: string[],
): string {
  return `${buildBrandContext(profile)}

APPROVED TOPIC: ${topic.title}
Rationale: ${topic.rationale}
Audience segment: ${topic.audienceSegment} · Funnel: ${topic.funnelStage} · Format: ${topic.format}

MANDATORY DISCLOSURES this content must accommodate:
${disclosures.map((d) => `- ${d}`).join('\n')}

Write the brief. ${BRIEF_SCHEMA}`
}

export function demoBrief(
  profile: BrandProfile,
  topic: TopicOpportunity,
): Omit<ContentBrief, 'mandatoryDisclosures' | 'modelLabel' | 'mode' | 'generatedAt'> {
  const subject = topic.title.split(':')[0].split(' (')[0]
  return {
    objective: `Grow ${topic.funnelStage}-stage engagement with ${topic.audienceSegment} by making "${subject.toLowerCase()}" clear and actionable, reinforcing ${profile.brandName}'s "in control, no surprises" positioning.`,
    audience: `${topic.audienceSegment} — practical, a little skeptical of financial jargon, and looking for a straight answer they can act on today.`,
    angle: `Plain-English, no-hype explainer that treats the reader like a capable adult and ties back to ${profile.brandName} tools without a hard sell.`,
    keyMessages: [
      `What "${subject.toLowerCase()}" actually means, in one sentence`,
      'The 2–3 decisions that matter most, with a simple rule of thumb for each',
      'The common mistake to avoid and why it costs money',
      `How ${profile.brandName} makes this simpler (transparent terms, no hidden fees)`,
    ],
    seoKeywords: topicKeywords(topic),
    structure: [
      'Hook: the reader’s real question',
      'Plain-English definition',
      'How it works, step by step',
      'What to watch out for (fees / fine print)',
      'A simple decision framework',
      'Soft CTA to the relevant tool',
    ],
    toneNotes: `Confident, warm, jargon-free. Grade ${profile.voice.readingLevel}. Frequent "you"; short sentences with one longer explanatory line. Avoid: ${profile.voice.dontWords.slice(0, 4).join(', ')}.`,
  }
}

function topicKeywords(topic: TopicOpportunity): string[] {
  const base = topic.tags.map((t) => t.replace(/-/g, ' '))
  const extra = topic.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter((w) => w.length > 4)
    .slice(0, 3)
  return Array.from(new Set([...base, ...extra])).slice(0, 6)
}

// ── Draft ────────────────────────────────────────────────────────────────

export const DRAFT_SYSTEM = `You are a senior brand copywriter for a regulated U.S. card issuer. You write original, on-brand, publish-quality copy that follows the brand voice profile exactly and executes the brief. Do not fabricate specific rates, fees, or offers — leave clearly marked placeholders like [APR], [fee], [term] where a disclosed figure belongs. Output markdown: a single # title line, then the body.`

export function voiceDirectives(v: VoiceControls): string {
  const dial = (n: number, lo: string, hi: string) =>
    n < 34 ? lo : n > 66 ? hi : `balanced ${lo}/${hi}`
  const len =
    v.length === 'short' ? '~250 words' : v.length === 'long' ? '~700 words' : '~450 words'
  return [
    `- Formality: ${dial(v.formality, 'casual/conversational', 'polished/formal')}`,
    `- Warmth: ${dial(v.warmth, 'neutral/matter-of-fact', 'warm/encouraging')}`,
    `- Depth: ${dial(v.depth, 'skimmable/high-level', 'thorough/detailed')}`,
    `- Length: ${len}`,
  ].join('\n')
}

export function buildDraftPrompt(
  profile: BrandProfile,
  brief: ContentBrief,
  voice: VoiceControls,
): string {
  return `${buildBrandContext(profile)}

BRIEF
- Objective: ${brief.objective}
- Audience: ${brief.audience}
- Angle: ${brief.angle}
- Key messages: ${brief.keyMessages.join('; ')}
- Structure: ${brief.structure.join(' → ')}
- SEO keywords to work in naturally: ${brief.seoKeywords.join(', ')}
- Tone notes: ${brief.toneNotes}

VOICE DIALS
${voiceDirectives(voice)}

MANDATORY: leave placeholders like [APR], [balance-transfer fee], [term] where any specific rate/fee/offer belongs — do not invent numbers. Where a disclosure is required, add a short "*Disclosure:*" line.

Write the piece now as markdown (one # title, then the body).`
}

// A tiny deterministic style shift per model so bake-off variants read
// distinctly in demo mode — no randomness, keyed to the model id.
function styleSeed(modelId: string): number {
  let h = 0
  for (const c of modelId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function demoDraft(
  profile: BrandProfile,
  brief: ContentBrief,
  topic: TopicOpportunity,
  voice: VoiceControls,
  modelId: string,
): string {
  const subject = topic.title.split(':')[0]
  const seed = styleSeed(modelId) % 3
  const family = friendlyModel(modelId).toLowerCase()
  const opener =
    seed === 0
      ? `Let's clear something up. `
      : seed === 1
        ? `Here's the short version. `
        : `You've probably wondered about this. `
  const closer =
    voice.warmth > 60
      ? `You've got this — and ${profile.brandName} is built to make it simpler.`
      : `${profile.brandName} keeps the terms transparent so you can decide with confidence.`

  const depthLine =
    voice.depth > 66
      ? `\n\n### The details that matter\nWhen you compare options, look past the headline number. Check the [APR] after any intro period, the [balance-transfer fee], and the [term] — those three decide whether a move actually saves you money.\n\n*Disclosure: ${brief.mandatoryDisclosures[0] ?? 'See terms for rates, fees, and other costs and benefits.'}*`
      : `\n\n*Disclosure: ${brief.mandatoryDisclosures[0] ?? 'See terms for rates, fees, and other costs and benefits.'}*`

  const body =
    `# ${subject}: the plain-English guide\n\n` +
    `${opener}${brief.angle}\n\n` +
    `**${brief.keyMessages[0]}.** ${profile.brandName} believes ${profile.messaging.valueProps[0].toLowerCase()}, and that starts with understanding the basics — no jargon, no pressure.\n\n` +
    `### How it works\n` +
    `${brief.keyMessages[1] ?? 'A few simple decisions drive the outcome.'} Keep an eye on the fine print: rates and fees are where the real cost hides. That's why we spell out [APR], fees, and [term] clearly, so there are no surprises.\n\n` +
    `### The mistake to avoid\n` +
    `${brief.keyMessages[2] ?? 'Rushing the decision.'} Take a beat, compare the numbers, and pick the option that fits your plan.` +
    depthLine +
    `\n\n**${closer}** [${profile.messaging.ctas[0]}]\n\n` +
    `*Draft generated by ${friendlyModel(modelId)} · ${family.includes('gpt') ? 'concise, structured' : family.includes('gemini') ? 'punchy, list-forward' : 'warm, narrative'} style. Synthetic illustrative copy — placeholders require compliance-approved figures.*`

  return body
}
