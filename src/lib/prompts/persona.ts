// Prompts for Step 6 (Persona Lab) — the live focus group. Phase 1 covers
// participant generation; the moderator/discussion, summary, and recommendation
// prompts live alongside as the later phases land. Every prompt has a
// deterministic demo path in focusGroup.ts so the group runs with zero keys.
//
// FAIRNESS is enforced in the system prompt: participants differ by behavior,
// need, goal, and personality only — never protected-class attributes or proxies.

import type {
  AgendaItem,
  BrandProfile,
  ChannelKey,
  ContentRecommendation,
  DiscussionTurn,
  DraftVariant,
  FocusGroupStats,
  Participant,
  Segment,
  TopicOpportunity,
} from '@/types'

export const PERSONA_GEN_SYSTEM = `You are a qualitative-research recruiter for a regulated U.S. card issuer. You create believable, distinct individual focus-group participants from BEHAVIORAL, needs-based segments.

HARD RULE (Reg B / ECOA): never assign, state, or imply protected-class attributes — race, ethnicity, religion, national origin, sex or gender, marital status, age, disability, veteran status, or receipt of public assistance — or close proxies (ZIP code, neighborhood, specific ages). Participants differ ONLY by financial behavior, needs, goals, frustrations, interests, and personality. Names are neutral flavor, not a demographic basis.

Return ONLY a JSON array — one object per requested participant, in order — no prose, no fences.`

interface Slot {
  segment: Segment
}

const SCHEMA = `Each object:
{
  "name": "a neutral first name + last initial (e.g. \\"Jordan M.\\")",
  "archetype": "short behavioral archetype, e.g. \\"cautious first-time cardholder\\"",
  "personality": ["2-3 personality traits"],
  "likes": ["2-3 things they like, tied to the segment"],
  "dislikes": ["2-3 things that put them off"],
  "interests": ["2-3 everyday interests"],
  "goals": ["2-3 financial goals/motivations"],
  "frustrations": ["1-2 recurring frustrations"],
  "bio": "1-2 sentence first-person bio",
  "voice": "how they talk in a discussion, e.g. \\"blunt, asks pointed questions\\""
}`

export function buildPersonaGenPrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  slots: Slot[],
): string {
  const slotLines = slots
    .map(
      (s, i) =>
        `${i + 1}. Segment "${s.segment.name}" (${s.segment.lens}) — ${s.segment.description}\n   Motivations: ${s.segment.motivations.join(', ')}\n   Objections: ${s.segment.objections.join(', ')}`,
    )
    .join('\n')
  return `BRAND: ${profile.brandName} — a regulated U.S. card issuer.
TOPIC THE GROUP WILL REACT TO: ${topic.title}

Create ${slots.length} distinct focus-group participants, one for each numbered segment below, in the SAME ORDER. Ground each participant in that segment's motivations and objections, but make them a specific, believable individual with their own personality and voice. Keep them behavioral only — no protected-class attributes or proxies.

SEGMENTS:
${slotLines}

${SCHEMA}`
}

// ── Live discussion ──────────────────────────────────────────────────────────

export const DISCUSSION_SYSTEM = `You are simulating focus-group PARTICIPANTS reacting to marketing copy for a regulated U.S. card issuer. Each participant stays in character — their goals, frustrations, personality, and speaking voice — and reacts to the moderator's question AND to the actual copy on the page. Keep replies candid, specific, and conversational (1-3 sentences). Behavioral only — never reference protected-class attributes. Return ONLY a JSON array, one object per participant IN ORDER: {"text": "their reply", "sentiment": "positive|mixed|negative"}.`

function plainExcerpt(md: string, n: number): string {
  const plain = md
    .replace(/^#+\s*/gm, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_>`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length <= n ? plain : plain.slice(0, n - 1).trimEnd() + '…'
}

export function buildDiscussionPrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  draft: DraftVariant,
  participants: Participant[],
  item: AgendaItem,
): string {
  const roster = participants
    .map(
      (p, i) =>
        `${i + 1}. ${p.name} — ${p.archetype}. Goals: ${p.goals.join(', ')}. Frustrations: ${p.frustrations.join(', ')}. Voice: ${p.voice}.`,
    )
    .join('\n')
  return `BRAND: ${profile.brandName}. TOPIC: ${topic.title}

COPY ON THE PAGE:
"""
${draft.title}
${plainExcerpt(draft.body, 900)}
"""

PARTICIPANTS (reply in this exact order):
${roster}

MODERATOR ASKS: "${item.prompt}"

Each participant answers in character, reacting to the actual copy above. One object per participant, same order.`
}

// ── Wrap-up: summary + recommendations ───────────────────────────────────────

export const SUMMARY_SYSTEM = `You are a qualitative-research lead for a regulated U.S. card issuer. You read a focus-group transcript and produce a candid, decision-ready read for the marketing team, plus concrete, selectable content fixes. Frame everything as directional signal, not a representative survey. Never reference protected classes. Return ONLY JSON (no prose, no fences):
{
  "summary": "2 short paragraphs — what landed, what dragged, and the bottom line",
  "recommendations": [
    { "title": "imperative fix", "detail": "what to change and how", "rationale": "why, tied to the discussion", "addresses": "the theme/objection it fixes" }
  ]
}`

export function buildSummaryPrompt(
  topic: TopicOpportunity,
  transcript: DiscussionTurn[],
  stats: FocusGroupStats,
): string {
  const lines = transcript
    .filter((t) => t.kind === 'participant')
    .map((t) => `- [${t.sentiment}] ${t.speakerName}: "${t.text}"`)
    .join('\n')
  const { positive, mixed, negative } = stats.sentiment
  return `CONTENT UNDER TEST: ${topic.title}
SENTIMENT: ${positive} positive / ${mixed} mixed / ${negative} negative.

TRANSCRIPT (participant reactions):
${lines}

Synthesize the group into a decision-ready read, then 2-4 concrete recommendations to revamp the content. Keep them specific and actionable.`
}

export const REVISE_SYSTEM = `You are a senior copy editor for a regulated U.S. card issuer. You revise approved copy to apply a set of chosen recommendations WITHOUT dropping any disclosure or material term, and WITHOUT inventing figures — keep bracketed placeholders like [APR], [balance-transfer fee], [term] exactly as-is. Preserve the brand voice. Return ONLY JSON: { "title": "...", "body": "..." }.`

export function buildRevisePrompt(
  profile: BrandProfile,
  topic: TopicOpportunity,
  channel: ChannelKey,
  draft: DraftVariant,
  recs: ContentRecommendation[],
): string {
  const recLines = recs.map((r) => `- ${r.title}: ${r.detail}`).join('\n')
  return `BRAND: ${profile.brandName}. TOPIC: ${topic.title}. SURFACE: ${channel}.

APPROVED COPY:
"""
${draft.title}
${draft.body}
"""

APPLY THESE FOCUS-GROUP RECOMMENDATIONS:
${recLines}

Revise the copy to apply the recommendations. Keep every disclosure and bracketed placeholder intact; do not add real numbers. Return the full revised title + body as JSON.`
}
