// Prompts + seeded demos for Step 2 (Brief & Draft).
// The brief is produced by the strategy model as JSON; the draft by the copy
// model as markdown. Demo generators are deterministic and grounded in the
// brand + topic so the story holds with zero keys, and vary by model so the
// bake-off shows a real side-by-side.

import type {
  BrandProfile,
  BriefInput,
  ContentBrief,
  TopicOpportunity,
  VoiceControls,
} from '@/types'
import { buildBrandContext } from '@/lib/brand/grounding'
import { friendlyModel } from '@/lib/router/roles'
import { channelSpec, type ChannelSpec } from '@/lib/channels'

const BLOG = channelSpec('blog')

/** Editor direction lines for the brief prompt (only non-empty parts). */
function briefDirection(input?: BriefInput): string {
  if (!input) return ''
  const must = input.mustInclude
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const parts: string[] = []
  if (input.workingTitle.trim()) parts.push(`- Working title to steer toward: ${input.workingTitle.trim()}`)
  if (input.anglePreference.trim()) parts.push(`- Preferred angle: ${input.anglePreference.trim()}`)
  if (must.length) parts.push(`- Must include:\n${must.map((m) => `  - ${m}`).join('\n')}`)
  if (!parts.length) return ''
  return `\n\nEDITOR DIRECTION (honor where sensible, without breaking compliance):\n${parts.join('\n')}`
}

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
  input?: BriefInput,
  channel: ChannelSpec = BLOG,
): string {
  return `${buildBrandContext(profile)}

APPROVED TOPIC: ${topic.title}
Rationale: ${topic.rationale}
Audience segment: ${topic.audienceSegment} · Funnel: ${topic.funnelStage} · Format: ${topic.format}

PUBLISH CHANNEL: ${channel.label} — ${channel.blurb}
Channel requirements: ${channel.briefGuidance}
Target length: ${channel.lengthTarget}. The "structure" outline must match this surface (not a generic article).

MANDATORY DISCLOSURES this content must accommodate:
${disclosures.map((d) => `- ${d}`).join('\n')}${briefDirection(input)}

Write the brief for this channel. ${BRIEF_SCHEMA}`
}

/** Channel-shaped default outline for the demo brief. */
function channelStructure(channel: ChannelSpec): string[] {
  switch (channel.preview) {
    case 'feed':
      return [
        'Scroll-stopping hook (first line)',
        'One core benefit, plainly stated',
        'One proof point',
        'Single CTA + a "see terms" cue for material disclosures',
      ]
    case 'serp':
      return [
        '3 headline options (≤30 characters each)',
        '2 description options (≤90 characters each)',
        'Keyword/intent match in the lead headline',
        'Material terms clear or linked ("see terms")',
      ]
    case 'inbox':
      return [
        'Subject line',
        'Preheader (one line)',
        'Hook + one core benefit',
        'Scannable body (2-3 short blocks)',
        'Single clear CTA',
        'Footer with legal lines',
      ]
    default:
      return [
        'Hook: the reader’s real question',
        'Plain-English definition',
        'How it works, step by step',
        'What to watch out for (fees / fine print)',
        'A simple decision framework',
        'Soft CTA to the relevant tool',
      ]
  }
}

export function demoBrief(
  profile: BrandProfile,
  topic: TopicOpportunity,
  input?: BriefInput,
  channel: ChannelSpec = BLOG,
): Omit<ContentBrief, 'mandatoryDisclosures' | 'modelLabel' | 'mode' | 'generatedAt'> {
  const subject = topic.title.split(':')[0].split(' (')[0]
  const wt = input?.workingTitle.trim()
  const anglePref = input?.anglePreference.trim()
  const must = (input?.mustInclude ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const baseMessages = [
    `What "${subject.toLowerCase()}" actually means, in one sentence`,
    'The 2–3 decisions that matter most, with a simple rule of thumb for each',
    'The common mistake to avoid and why it costs money',
    `How ${profile.brandName} makes this simpler (transparent terms, no hidden fees)`,
  ]
  return {
    objective: `Grow ${topic.funnelStage}-stage engagement with ${topic.audienceSegment} by making "${subject.toLowerCase()}" clear and actionable, reinforcing ${profile.brandName}'s "in control, no surprises" positioning. Built for ${channel.label} (${channel.lengthTarget}).${wt ? ` Steer toward the working title "${wt}".` : ''}`,
    audience: `${topic.audienceSegment} — practical, a little skeptical of financial jargon, and looking for a straight answer they can act on today.`,
    angle:
      anglePref ||
      `Plain-English, no-hype explainer that treats the reader like a capable adult and ties back to ${profile.brandName} tools without a hard sell.`,
    keyMessages: dedupeList([...must, ...baseMessages]).slice(0, 5),
    seoKeywords: topicKeywords(topic),
    structure: channelStructure(channel),
    toneNotes: `Confident, warm, jargon-free. Grade ${profile.voice.readingLevel}. Frequent "you"; short sentences with one longer explanatory line. Shaped for ${channel.label}: ${channel.draftForm} Avoid: ${profile.voice.dontWords.slice(0, 4).join(', ')}.`,
  }
}

function dedupeList(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()))).filter(Boolean)
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
  channel: ChannelSpec = BLOG,
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

PUBLISH CHANNEL: ${channel.label}
- Form: ${channel.draftForm}
- Target length: ${channel.lengthTarget}
Write specifically for this surface — match its length and form, not a generic article.

VOICE DIALS
${voiceDirectives(voice)}

MANDATORY: leave placeholders like [APR], [balance-transfer fee], [term] where any specific rate/fee/offer belongs — do not invent numbers. Where a disclosure is required, add a short "*Disclosure:*" line.

Write the piece now as markdown (one # title line, then the body).`
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
  channel: ChannelSpec = BLOG,
): string {
  switch (channel.preview) {
    case 'feed':
      return demoFeedDraft(profile, brief, modelId)
    case 'serp':
      return demoSemDraft(profile, brief, topic, modelId)
    case 'inbox':
      return demoEmailDraft(profile, brief, topic, voice, modelId)
    default:
      return demoArticleDraft(profile, brief, topic, voice, modelId)
  }
}

/** Model-style footer note shared across demo variants. */
function styleNote(modelId: string): string {
  const family = friendlyModel(modelId).toLowerCase()
  const style = family.includes('gpt')
    ? 'concise, structured'
    : family.includes('gemini')
      ? 'punchy, list-forward'
      : 'warm, narrative'
  return `*Draft generated by ${friendlyModel(modelId)} · ${style} style. Synthetic illustrative copy — placeholders require compliance-approved figures.*`
}

function disc(brief: ContentBrief): string {
  return brief.mandatoryDisclosures[0] ?? 'See terms for rates, fees, and other costs and benefits.'
}

function demoArticleDraft(
  profile: BrandProfile,
  brief: ContentBrief,
  topic: TopicOpportunity,
  voice: VoiceControls,
  modelId: string,
): string {
  const subject = topic.title.split(':')[0]
  const seed = styleSeed(modelId) % 3
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
      ? `\n\n### The details that matter\nWhen you compare options, look past the headline number. Check the [APR] after any intro period, the [balance-transfer fee], and the [term] — those three decide whether a move actually saves you money.\n\n*Disclosure: ${disc(brief)}*`
      : `\n\n*Disclosure: ${disc(brief)}*`

  return (
    `# ${subject}: the plain-English guide\n\n` +
    `${opener}${brief.angle}\n\n` +
    `**${brief.keyMessages[0]}.** ${profile.brandName} believes ${profile.messaging.valueProps[0].toLowerCase()}, and that starts with understanding the basics — no jargon, no pressure.\n\n` +
    `### How it works\n` +
    `${brief.keyMessages[1] ?? 'A few simple decisions drive the outcome.'} Keep an eye on the fine print: rates and fees are where the real cost hides. That's why we spell out [APR], fees, and [term] clearly, so there are no surprises.\n\n` +
    `### The mistake to avoid\n` +
    `${brief.keyMessages[2] ?? 'Rushing the decision.'} Take a beat, compare the numbers, and pick the option that fits your plan.` +
    depthLine +
    `\n\n**${closer}** [${profile.messaging.ctas[0]}]\n\n` +
    styleNote(modelId)
  )
}

function demoFeedDraft(
  profile: BrandProfile,
  brief: ContentBrief,
  modelId: string,
): string {
  const seed = styleSeed(modelId) % 3
  const hook =
    seed === 0
      ? `Stop overpaying on interest.`
      : seed === 1
        ? `Your balance — minus the surprises.`
        : `A smarter move on your balance.`
  const cta = profile.messaging.ctas[0] ?? 'Learn more'
  return (
    `# ${hook}\n\n` +
    `${brief.angle}\n\n` +
    `✓ ${brief.keyMessages[0]}\n` +
    `✓ ${brief.keyMessages[1] ?? `Transparent [APR], [balance-transfer fee], and [term] — no hidden costs.`}\n\n` +
    `[${cta}] · *See terms — rates & fees apply.*\n\n` +
    `*Disclosure: ${disc(brief)}*\n\n` +
    styleNote(modelId)
  )
}

function demoSemDraft(
  profile: BrandProfile,
  brief: ContentBrief,
  topic: TopicOpportunity,
  modelId: string,
): string {
  const subject = topic.title.split(':')[0].split(' (')[0]
  const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…')
  const brand = profile.brandName
  const h1 = clip(subject, 30)
  const h2 = clip(`${brand} — No Surprises`, 30)
  const h3 = clip(`Transparent Rates & Fees`, 30)
  const d1 = clip(`See how ${brand} keeps [APR], fees, and terms clear. No hidden costs.`, 90)
  const d2 = clip(`${brief.keyMessages[0] ?? 'Compare your options and decide with confidence.'} See terms.`, 90)
  return (
    `# ${h1}\n\n` +
    `**Headlines**\n- ${h1}\n- ${h2}\n- ${h3}\n\n` +
    `**Descriptions**\n- ${d1}\n- ${d2}\n\n` +
    `**Display path:** ${brand.toLowerCase().replace(/\s+/g, '')}.com/${(topic.tags[0] ?? 'cards').replace(/[^a-z0-9]/gi, '')}\n\n` +
    `*Disclosure: ${disc(brief)}*\n\n` +
    styleNote(modelId)
  )
}

function demoEmailDraft(
  profile: BrandProfile,
  brief: ContentBrief,
  topic: TopicOpportunity,
  voice: VoiceControls,
  modelId: string,
): string {
  const subject = topic.title.split(':')[0]
  const cta = profile.messaging.ctas[0] ?? 'Learn more'
  const closer =
    voice.warmth > 60
      ? `You've got this — and we're here to make it simpler.`
      : `We keep the terms transparent so you can decide with confidence.`
  return (
    `# ${subject}: a clearer way to decide\n\n` +
    `**Preheader:** ${brief.angle}\n\n` +
    `Hi there,\n\n` +
    `${brief.keyMessages[0]}. ${profile.brandName} believes ${profile.messaging.valueProps[0].toLowerCase()}, so here's the straight version:\n\n` +
    `- ${brief.keyMessages[1] ?? 'Check the [APR] after any intro period.'}\n` +
    `- ${brief.keyMessages[2] ?? 'Watch the [balance-transfer fee] and [term].'}\n\n` +
    `${closer}\n\n` +
    `[${cta}]\n\n` +
    `---\n*Disclosure: ${disc(brief)}*\n\n` +
    styleNote(modelId)
  )
}

// ── Refine (AI-assist on the chosen draft) ─────────────────────────────────

export type RefineAction = 'tighten' | 'warm' | 'disclosures' | 'derisk' | 'simplify'

export const REFINE_SYSTEM = `You are a senior brand copywriter for a regulated U.S. card issuer. Revise the provided passage exactly as instructed while preserving its meaning, markdown structure, and brand voice. Never invent specific rates, fees, or offers — keep every placeholder like [APR], [balance-transfer fee], [term] intact. Return ONLY the revised passage as markdown, with no preamble or commentary.`

export const REFINE_META: Record<RefineAction, { label: string; instruction: string }> = {
  tighten: {
    label: 'Tighten',
    instruction: 'Tighten this passage: cut filler and redundancy, shorten sentences, keep every key point and all placeholders. Aim for ~20% shorter.',
  },
  warm: {
    label: 'Warm up',
    instruction: 'Make the tone warmer and more encouraging while staying professional and on-brand. Do not add hype or promises.',
  },
  disclosures: {
    label: 'Add disclosures',
    instruction: 'Weave in the required disclosures naturally, adding short "*Disclosure:*" lines where appropriate. Do not remove existing content.',
  },
  derisk: {
    label: 'De-risk terms',
    instruction: 'Remove or soften risky/absolute claims — guarantees, superlatives like "best", unqualified "free", "pre-approved" — replacing them with compliant, outcome-neutral phrasing. Keep all placeholders.',
  },
  simplify: {
    label: 'Simplify',
    instruction: 'Simplify to plain English: shorter words, one idea per sentence, no jargon. Preserve meaning and placeholders.',
  },
}

export function buildRefinePrompt(opts: {
  action: RefineAction
  profile: BrandProfile
  voice: VoiceControls
  text: string
  missingDisclosures?: string[]
}): string {
  const meta = REFINE_META[opts.action]
  const discBlock =
    opts.action === 'disclosures' && opts.missingDisclosures?.length
      ? `\n\nDISCLOSURES TO INCLUDE:\n${opts.missingDisclosures.map((d) => `- ${d}`).join('\n')}`
      : ''
  return `${buildBrandContext(opts.profile)}

TASK: ${meta.instruction}${discBlock}

VOICE DIALS:
${voiceDirectives(opts.voice)}

PASSAGE:
${opts.text}

Return only the revised passage as markdown.`
}

/** Deterministic, zero-key refinement so AI-assist works in demo mode. */
export function demoRefine(
  action: RefineAction,
  text: string,
  missingDisclosures: string[] = [],
): string {
  switch (action) {
    case 'tighten':
      return text
        .replace(/\b(really|very|just|actually|simply|in order to|that )\b/gi, (m) =>
          /in order to/i.test(m) ? 'to ' : '',
        )
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    case 'warm': {
      const line = "You've got this — and we're here to make it simpler."
      return text.includes(line) ? text : `${text.trim()}\n\n${line}`
    }
    case 'disclosures': {
      if (!missingDisclosures.length) return text
      return `${text.trim()}\n\n${missingDisclosures.map((d) => `*Disclosure: ${d}*`).join('\n\n')}`
    }
    case 'derisk':
      return text
        .replace(/guarantee(d|s)?/gi, 'designed to help')
        .replace(/pre-?approved/gi, 'pre-qualified')
        .replace(/\bthe best\b/gi, 'a strong option')
        .replace(/\bbest[- ]in[- ]class\b/gi, 'a strong option')
        .replace(/\bfor free\b/gi, 'with no annual fee')
        .trim()
    case 'simplify':
      return text
        .replace(/\butilize\b/gi, 'use')
        .replace(/\bin order to\b/gi, 'to')
        .replace(/\bAdditionally,/g, 'Also,')
        .replace(/\bhowever\b/gi, 'but')
        .replace(/\bapproximately\b/gi, 'about')
        .trim()
    default:
      return text
  }
}
