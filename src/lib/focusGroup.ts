// Persona Lab focus-group engine (Step 6). Generates believable individual
// participants from the chosen behavioral segments, the moderator's agenda, the
// live discussion, its stats, and the content recommendations. Every generator
// has a deterministic demo path so the whole focus group runs with zero keys.
//
// FAIRNESS: participants are instantiated from behavioral/needs-based segments
// only. Names + personalities are illustrative flavor — never a demographic
// basis. See persona.ts checkFairness() + FAIRNESS_NOTE.

import type {
  AgendaItem,
  ChannelKey,
  ContentRecommendation,
  DiscussionTurn,
  DraftVariant,
  FocusGroupStats,
  Participant,
  PersonaSentiment,
  Segment,
  ThemeStat,
  TopicOpportunity,
} from '@/types'
import { channelSpec } from '@/lib/channels'
import { unit, pick } from '@/lib/persona'

// Deliberately gender-neutral names — believable, but not a demographic signal.
const NAME_POOL = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Jamie',
  'Avery', 'Quinn', 'Drew', 'Reese', 'Skyler', 'Cameron', 'Rowan', 'Emerson',
  'Parker', 'Hayden', 'Charlie', 'Finley',
]
const LAST_INITIALS = 'BCDFGHKLMNPRSTW'.split('')

const PERSONALITY_POOL = [
  'analytical', 'skeptical', 'easygoing', 'detail-oriented', 'impatient',
  'optimistic', 'pragmatic', 'cautious', 'curious', 'value-driven', 'no-nonsense',
  'budget-conscious',
]
const VOICE_POOL = [
  'blunt and to the point', 'warm but probing', 'asks a lot of questions',
  'tells stories from experience', 'measured and precise', 'quick to push back',
  'thinks out loud',
]
const INTEREST_POOL = [
  'personal-finance podcasts', 'travel deals', 'home budgeting apps', 'side hustles',
  'cooking on a budget', 'tech gadgets', 'weekend sports', 'local dining',
  'saving toward a goal', 'credit-building tips', 'DIY projects', 'streaming shows',
]

/** 6-slot palette index for participant avatars (paired with initials in the UI). */
export const AVATAR_PALETTE = 6

function two<T>(pool: T[], seed: string): T[] {
  const a = pick(pool, seed + ':a')
  let b = pick(pool, seed + ':b')
  if (b === a) b = pool[(pool.indexOf(a) + 1) % pool.length]
  return [a, b]
}

function three<T>(pool: T[], seed: string): T[] {
  const out: T[] = []
  for (let i = 0; i < pool.length && out.length < 3; i++) {
    const c = pick(pool, `${seed}:${i}`)
    if (!out.includes(c)) out.push(c)
  }
  return out
}

/** Round-robin the participant slots across the chosen segments. */
export function distributeSegments(segmentIds: string[], count: number): string[] {
  if (!segmentIds.length) return []
  return Array.from({ length: count }, (_, i) => segmentIds[i % segmentIds.length])
}

function avatarSeed(name: string, i: number): string {
  const initials = (name.replace(/[^A-Za-z ]/g, '').split(/\s+/).map((w) => w[0]).join('') || 'P').slice(0, 2).toUpperCase()
  return `${initials}:${i % AVATAR_PALETTE}`
}

/** Deterministic demo participant, grounded in its segment's drivers. */
function demoParticipant(segment: Segment, i: number, seed: number): Participant {
  const s = `${seed}:${segment.id}:${i}`
  const first = pick(NAME_POOL, s + ':first')
  const last = pick(LAST_INITIALS, s + ':last')
  const name = `${first} ${last}.`
  const personality = two(PERSONALITY_POOL, s + ':pers')
  const archetype = `${personality[0]} ${segment.name.replace(/s$/, '').toLowerCase()}`
  const goals = segment.motivations.slice(0, 3)
  const frustrations = segment.objections.slice(0, 2)
  const likes = segment.motivations.slice(0, 2)
  const dislikes = segment.objections.slice(0, 2)
  const interests = three(INTEREST_POOL, s + ':int')
  const voice = pick(VOICE_POOL, s + ':voice')
  const bio =
    `I'm ${first}. ${segment.description} ` +
    `What I really want is ${(goals[0] ?? 'a fair, clear deal').toLowerCase()}, ` +
    `and I get put off by ${(frustrations[0] ?? 'anything that hides the details').toLowerCase()}.`

  return {
    id: `part_${seed}_${i}`,
    name,
    segmentId: segment.id,
    segmentName: segment.name,
    lens: segment.lens,
    archetype,
    personality,
    likes,
    dislikes,
    interests,
    goals,
    frustrations,
    bio,
    voice,
    avatarSeed: avatarSeed(name, i),
  }
}

/** Build the full demo roster across the selected segments. */
export function demoParticipants(segments: Segment[], count: number, seed: number): Participant[] {
  const chosen = segments.filter(Boolean)
  if (!chosen.length) return []
  return Array.from({ length: count }, (_, i) => demoParticipant(chosen[i % chosen.length], i, seed))
}

/** Shape of the raw JSON the model returns per participant. */
export interface RawParticipant {
  name?: string
  archetype?: string
  personality?: string[]
  likes?: string[]
  dislikes?: string[]
  interests?: string[]
  goals?: string[]
  frustrations?: string[]
  bio?: string
  voice?: string
}

const arr = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) && v.length ? (v.filter((x) => typeof x === 'string') as string[]) : fallback

/** Normalize one model-produced participant into a full Participant, grounded in its segment. */
export function coerceParticipant(raw: RawParticipant, segment: Segment, i: number, seed: number): Participant {
  const demo = demoParticipant(segment, i, seed)
  const name = (raw.name && raw.name.trim()) || demo.name
  return {
    ...demo,
    name,
    archetype: (raw.archetype && raw.archetype.trim()) || demo.archetype,
    personality: arr(raw.personality, demo.personality),
    likes: arr(raw.likes, demo.likes),
    dislikes: arr(raw.dislikes, demo.dislikes),
    interests: arr(raw.interests, demo.interests),
    goals: arr(raw.goals, demo.goals),
    frustrations: arr(raw.frustrations, demo.frustrations),
    bio: (raw.bio && raw.bio.trim()) || demo.bio,
    voice: (raw.voice && raw.voice.trim()) || demo.voice,
    avatarSeed: avatarSeed(name, i),
  }
}

// ── Moderator agenda ────────────────────────────────────────────────────────

/** The moderator's agenda — the same five beats a real content focus group walks. */
export function buildAgenda(topic: TopicOpportunity, channel: ChannelKey): AgendaItem[] {
  const surface = channelSpec(channel).label
  const subject = topic.title.split(':')[0]
  return [
    {
      id: 'ag_first',
      title: 'First impressions',
      prompt: `Take a look at this ${surface.toLowerCase()} piece on "${subject}". What's your gut reaction in a sentence?`,
    },
    {
      id: 'ag_clarity',
      title: 'Clarity & trust',
      prompt: 'Was anything confusing or hard to believe? Did it feel straight with you, or were there red flags?',
    },
    {
      id: 'ag_offer',
      title: 'The offer & call-to-action',
      prompt: 'Is it clear what they want you to do next — and does it feel worth doing? What would make you actually click?',
    },
    {
      id: 'ag_objections',
      title: 'Objections & fine print',
      prompt: "What's holding you back? Anything about fees, terms, or the fine print that nags at you?",
    },
    {
      id: 'ag_act',
      title: 'Would you act?',
      prompt: 'Bottom line — would you take the next step, and what one change would move you from maybe to yes?',
    },
  ]
}

/** The moderator's opening — sets the agenda and the ground rules. */
export function moderatorOpening(topic: TopicOpportunity, channel: ChannelKey, count: number): string {
  const surface = channelSpec(channel).label.toLowerCase()
  return (
    `Thanks for joining, everyone. We've got ${count} of you today. We're going to look at a ${surface} piece about "${topic.title.split(':')[0]}" and I want your honest, gut reactions — there are no wrong answers, and you won't hurt anyone's feelings. ` +
    `Ground rules: react to what's actually on the page, be specific, and it's fine to disagree with each other. Let's start.`
  )
}

// ── Live discussion ──────────────────────────────────────────────────────────

function isSkeptic(p: Participant): boolean {
  return p.personality.some((t) => /skeptic|cautious|impatient|no-nonsense|analytical/.test(t))
}

/** Deterministic demo sentiment, biased by personality + the agenda beat. */
function demoSentiment(p: Participant, item: AgendaItem, seed: number): PersonaSentiment {
  const base = unit(`${seed}:${p.id}:${item.id}`)
  const skew =
    (isSkeptic(p) ? -0.16 : 0.06) +
    (item.id === 'ag_objections' ? -0.16 : 0) +
    (item.id === 'ag_first' ? 0.05 : 0)
  const score = base + skew
  return score > 0.6 ? 'positive' : score > 0.4 ? 'mixed' : 'negative'
}

/** A grounded, in-character demo line for one participant on one agenda beat. */
function demoLine(p: Participant, item: AgendaItem, topic: TopicOpportunity, sentiment: PersonaSentiment): string {
  const subject = topic.title.split(':')[0].toLowerCase()
  const goal = (p.goals[0] ?? 'a fair, clear deal').toLowerCase()
  const gripe = (p.frustrations[0] ?? 'anything that hides the details').toLowerCase()
  const pos = sentiment === 'positive'
  const neg = sentiment === 'negative'

  switch (item.id) {
    case 'ag_first':
      return pos
        ? `Honestly? Pretty good first impression. It gets to the point about ${subject} without the usual hype.`
        : neg
          ? `My gut says "here we go again." It looks fine, but I've been burned by ${gripe} before.`
          : `It's clean and readable. I'm interested but not sold yet — depends on the details.`
    case 'ag_clarity':
      return pos
        ? `It read straight with me. Nothing felt buried, and that matters to me since I care about ${goal}.`
        : neg
          ? `A couple of spots felt slippery. When I care about ${goal}, vague wording reads as a red flag.`
          : `Mostly clear, but one or two lines I'd want to re-read before I trusted them.`
    case 'ag_offer':
      return pos
        ? `The next step was obvious and it felt worth it — I'd click to see the specifics.`
        : neg
          ? `I honestly wasn't sure what they wanted me to do, and that kills it for me.`
          : `I can see the ask, but "worth doing" is a maybe. Show me the number and I'll decide.`
    case 'ag_objections':
      return pos
        ? `Not much holding me back — the "no surprises" framing actually addressed my usual worry about ${gripe}.`
        : neg
          ? `The fine print is exactly my hang-up. Until I see the fees and terms spelled out, ${gripe} keeps me away.`
          : `My one snag is the fee/terms question. It's hinted at, but I'd want it explicit.`
    case 'ag_act':
    default:
      return pos
        ? `Yeah, I'd take the next step. One tweak: put the concrete ${goal} proof right up top.`
        : neg
          ? `Not as-is. To move me from no to maybe, they'd have to lead with the real numbers, not the vibe.`
          : `Maybe. The one change that'd flip me to yes is a clear, specific line on ${goal}.`
  }
}

/** Deterministic demo turns for one agenda beat (participants only; moderator added by caller). */
export function demoDiscussionTurns(
  item: AgendaItem,
  participants: Participant[],
  topic: TopicOpportunity,
  seed: number,
): DiscussionTurn[] {
  return participants.map((p) => {
    const sentiment = demoSentiment(p, item, seed)
    return {
      id: `turn_${item.id}_${p.id}`,
      agendaItemId: item.id,
      kind: 'participant',
      speakerId: p.id,
      speakerName: p.name,
      text: demoLine(p, item, topic, sentiment),
      sentiment,
      ts: 0,
    }
  })
}

// ── Wrap-up: stats, summary, recommendations, revised copy ───────────────────

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Each participant's dominant sentiment across their own turns. */
function dominantByParticipant(transcript: DiscussionTurn[]): Record<string, PersonaSentiment> {
  const tally: Record<string, Record<PersonaSentiment, number>> = {}
  for (const t of transcript) {
    if (t.kind !== 'participant' || !t.speakerId || !t.sentiment) continue
    tally[t.speakerId] ??= { positive: 0, mixed: 0, negative: 0 }
    tally[t.speakerId][t.sentiment]++
  }
  const out: Record<string, PersonaSentiment> = {}
  for (const [id, c] of Object.entries(tally)) {
    out[id] = (['positive', 'mixed', 'negative'] as PersonaSentiment[]).sort((a, b) => c[b] - c[a])[0]
  }
  return out
}

/** Compute the light end-of-group stats deterministically from the transcript. */
export function computeStats(transcript: DiscussionTurn[], participants: Participant[]): FocusGroupStats {
  const pturns = transcript.filter((t) => t.kind === 'participant')
  const sentiment = { positive: 0, mixed: 0, negative: 0 }
  for (const t of pturns) if (t.sentiment) sentiment[t.sentiment]++

  // Concern themes: shared participant frustrations, counted across the group.
  const concern = new Map<string, number>()
  for (const p of participants) {
    for (const fr of p.frustrations) {
      const key = fr.trim().toLowerCase()
      if (key) concern.set(key, (concern.get(key) ?? 0) + 1)
    }
  }
  // Positive themes: goals of participants who read positive overall.
  const dominant = dominantByParticipant(transcript)
  const praise = new Map<string, number>()
  for (const p of participants) {
    if (dominant[p.id] === 'positive' && p.goals[0]) {
      const key = p.goals[0].trim().toLowerCase()
      praise.set(key, (praise.get(key) ?? 0) + 1)
    }
  }
  const themes: ThemeStat[] = [
    ...[...praise.entries()].map(([theme, count]) => ({ theme: titleCase(theme), count, sentiment: 'positive' as PersonaSentiment })),
    ...[...concern.entries()].map(([theme, count]) => ({ theme: titleCase(theme), count, sentiment: 'negative' as PersonaSentiment })),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Standout quotes: one strong positive, one strong concern, one closing line.
  const positive = pturns.find((t) => t.sentiment === 'positive')
  const negative = pturns.find((t) => t.sentiment === 'negative')
  const closing = [...pturns].reverse().find((t) => t.agendaItemId === 'ag_act')
  const standoutQuotes = [positive, negative, closing]
    .filter((t): t is DiscussionTurn => !!t)
    .filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i)
    .map((t) => ({ speakerName: t.speakerName, text: t.text, sentiment: t.sentiment ?? 'mixed' }))

  const total = pturns.length || 1
  const net = (sentiment.positive - sentiment.negative) / total
  const resonance: FocusGroupStats['resonance'] = net > 0.15 ? 'strong' : net > -0.15 ? 'mixed' : 'weak'

  return { sentiment, themes, standoutQuotes, resonance }
}

/** Deterministic demo summary — a decision-ready read over the group. */
export function demoSummary(topic: TopicOpportunity, stats: FocusGroupStats): string {
  const subject = topic.title.split(':')[0].toLowerCase()
  const topConcern = stats.themes.find((t) => t.sentiment === 'negative')
  const topPraise = stats.themes.find((t) => t.sentiment === 'positive')
  const read = stats.resonance === 'strong' ? 'landed well' : stats.resonance === 'mixed' ? 'landed unevenly' : 'struggled'
  const p1 =
    `The group's read on "${subject}" ${read}: ${stats.sentiment.positive} positive, ${stats.sentiment.mixed} mixed, and ${stats.sentiment.negative} negative reactions across the discussion. ` +
    (topPraise
      ? `What resonated most was ${topPraise.theme.toLowerCase()} — the straight, no-hype framing did real work.`
      : `Even warm reactions stayed guarded; nobody was strongly enthusiastic.`)
  const p2 = topConcern
    ? `The recurring drag was ${topConcern.theme.toLowerCase()} (${topConcern.count} participant${topConcern.count === 1 ? '' : 's'}) — the group wanted the specifics, especially on fees and terms, before committing. That's an optimization, not a blocker, and it points cleanly at what to change.`
    : `No single objection dominated; the tweaks below are refinements rather than fixes.`
  return `${p1}\n\n${p2}`
}

// Map a concern keyword to a concrete content fix.
const REC_TEMPLATES: { match: RegExp; title: string; detail: string }[] = [
  { match: /fee|surprise|hidden|charge/, title: 'Put the real cost above the fold', detail: 'Lead with a plain-language line on fees and the [APR] so the "no surprises" promise is proven, not asserted.' },
  { match: /fine print|term|unclear|complicated|complex/, title: 'Replace fine-print hedging with specifics', detail: 'Swap vague reassurances for one concrete, scannable "here\'s exactly what you pay" block, keeping the disclosures inline.' },
  { match: /redemption|caps|cap|limit|category/, title: 'Show the limits up front', detail: 'Name any caps/categories plainly near the offer so value-focused readers trust the math.' },
  { match: /abstract|point|complicated/, title: 'Make the value tangible', detail: 'Translate rewards into a concrete everyday example so the benefit is felt, not calculated.' },
]

/** Deterministic demo recommendations, grounded in the group's concerns. */
export function demoRecommendations(topic: TopicOpportunity, stats: FocusGroupStats): ContentRecommendation[] {
  const concerns = stats.themes.filter((t) => t.sentiment === 'negative')
  const recs: ContentRecommendation[] = []
  for (const c of concerns) {
    const tmpl = REC_TEMPLATES.find((t) => t.match.test(c.theme.toLowerCase()))
    if (tmpl && !recs.some((r) => r.title === tmpl.title)) {
      recs.push({ id: `rec_${recs.length}`, title: tmpl.title, detail: tmpl.detail, rationale: `${c.count} participant(s) flagged "${c.theme.toLowerCase()}".`, addresses: c.theme })
    }
  }
  // Always offer a strengthen-the-opening rec.
  if (!recs.some((r) => /open|hook|above the fold/i.test(r.title))) {
    recs.push({
      id: `rec_${recs.length}`,
      title: 'Sharpen the opening hook',
      detail: `Lead with the single most concrete proof point for "${topic.title.split(':')[0]}" so the first line earns the read.`,
      rationale: stats.resonance === 'strong' ? 'Even a strong read leaves click-through on the table with a soft open.' : 'First impressions were lukewarm; the open is the cheapest lever.',
      addresses: 'First impressions',
    })
  }
  return recs.slice(0, 4)
}

/** Deterministic demo revised copy — applies the selected recs, preserving disclosures/placeholders. */
export function demoRevise(draft: DraftVariant, recs: ContentRecommendation[]): { title: string; body: string } {
  const clarity = '**In plain terms:** no surprises — here\'s exactly what you\'d pay, including the [APR], any [balance-transfer fee], and the [term]. Full details below.'
  const applied = recs.map((r) => `- ${r.title}: ${r.detail}`).join('\n')
  // Insert the clarity block right after the first paragraph; keep the rest (and its
  // disclosure block) intact so nothing material is dropped.
  const parts = draft.body.split('\n\n')
  const head = parts.slice(0, 1)
  const rest = parts.slice(1)
  const body = [...head, clarity, ...rest].join('\n\n') + `\n\n<!-- Focus-group revisions applied:\n${applied}\n-->`
  return { title: draft.title, body }
}

/** Raw JSON shape for a model-produced participant reaction. */
export interface RawTurn {
  text?: string
  sentiment?: string
}

const SENTIMENTS: PersonaSentiment[] = ['positive', 'mixed', 'negative']

/** Normalize model turns back onto the participant order for one agenda beat. */
export function coerceTurns(
  raw: RawTurn[],
  item: AgendaItem,
  participants: Participant[],
  topic: TopicOpportunity,
  seed: number,
): DiscussionTurn[] {
  return participants.map((p, i) => {
    const r = raw[i]
    const sentiment: PersonaSentiment =
      r && typeof r.sentiment === 'string' && (SENTIMENTS as string[]).includes(r.sentiment)
        ? (r.sentiment as PersonaSentiment)
        : demoSentiment(p, item, seed)
    const text = r && typeof r.text === 'string' && r.text.trim() ? r.text.trim() : demoLine(p, item, topic, sentiment)
    return {
      id: `turn_${item.id}_${p.id}`,
      agendaItemId: item.id,
      kind: 'participant',
      speakerId: p.id,
      speakerName: p.name,
      text,
      sentiment,
      ts: 0,
    }
  })
}
