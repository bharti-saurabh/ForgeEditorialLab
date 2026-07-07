// Builds a complete, finished end-to-end PipelineState for the balance-transfer
// example — brief → draft → hero visual → compliance review (issues resolved +
// signed off) → publish package → Persona Lab. Assembled deterministically from
// the same demo generators the live steps use, so "Load example run" opens the
// app on a coherent, finished story with zero keys. Synthetic / illustrative.

import type {
  ChannelAdaptation,
  ComplianceIssue,
  ComplianceState,
  ContentBrief,
  DiscussionTurn,
  DraftVariant,
  PersonaLabState,
  PipelineState,
  PublishPackage,
  VisualAsset,
} from '@/types'
import { SEED_BRAND_PROFILE } from '@/seed/brandProfile'
import { SEED_TOPIC_BACKLOG } from '@/seed/topicBacklog'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import { SEED_SEGMENTS } from '@/seed/segments'
import { DEFAULT_VOICE, DEFAULT_BRIEF_INPUT } from '@/store/useAppStore'
import { friendlyModel } from '@/lib/router/roles'
import { brandMatchScore } from '@/lib/brand/grounding'
import { disclosuresForTopic } from '@/lib/compliance'
import { demoBrief, demoDraft } from '@/lib/prompts/draft'
import { suggestedSlots, buildImagePrompt, demoVisualText, assessBrandSafety } from '@/lib/prompts/visual'
import { buildBrandMockSvg } from '@/lib/visualMock'
import { analyzeContent, computeScore, buildCleanVersion } from '@/lib/complianceEngine'
import { demoAssessment } from '@/lib/prompts/compliance'
import { CHANNELS, recheckChannel, defaultHandoff } from '@/lib/publish'
import { isImageChannel } from '@/lib/channels'
import { demoAdaptation, composeSemBody, type AdaptationDraft } from '@/lib/prompts/publish'
import { defaultPanel, FAIRNESS_NOTE } from '@/lib/persona'
import {
  demoParticipants,
  buildAgenda,
  moderatorOpening,
  demoDiscussionTurns,
  computeStats,
  demoSummary,
  demoRecommendations,
} from '@/lib/focusGroup'
import { uid } from '@/lib/format'

function parseDraft(md: string): { title: string; body: string } {
  const lines = md.split('\n')
  const idx = lines.findIndex((l) => l.startsWith('# '))
  if (idx === -1) return { title: 'Untitled draft', body: md.trim() }
  const title = lines[idx].replace(/^#\s+/, '').trim()
  const body = lines.slice(idx + 1).join('\n').trim()
  return { title, body }
}

export function buildCompletedPipeline(): PipelineState {
  const now = Date.now()
  const profile = SEED_BRAND_PROFILE
  const topic = SEED_TOPIC_BACKLOG.find((t) => t.id === 'topic_bt_guide')!
  const voice = DEFAULT_VOICE
  const textModel = 'claude-sonnet-5'
  const disclosures = disclosuresForTopic(topic, SEED_RULEBOOK, profile)

  // ── Brief ────────────────────────────────────────────────────────────────
  const brief: ContentBrief = {
    ...demoBrief(profile, topic),
    mandatoryDisclosures: disclosures,
    modelLabel: friendlyModel(textModel),
    mode: 'demo',
    generatedAt: now - 60 * 60 * 1000,
  }

  // ── Draft ─────────────────────────────────────────────────────────────────
  const draftMd = demoDraft(profile, brief, topic, voice, textModel)
  const { title, body } = parseDraft(draftMd)
  const draft: DraftVariant = {
    id: 'draft_example',
    modelId: textModel,
    modelLabel: friendlyModel(textModel),
    mode: 'demo',
    title,
    body,
    brandMatch: brandMatchScore(`${title} ${body}`, profile),
    wordCount: body.split(/\s+/).filter(Boolean).length,
    latencyMs: 1180,
    generatedAt: now - 55 * 60 * 1000,
  }

  // ── Visual (hero) ──────────────────────────────────────────────────────────
  const heroSlot = suggestedSlots()[0]
  const heroPrompt = buildImagePrompt(profile, topic, title, heroSlot)
  const heroText = demoVisualText(profile, title, heroSlot)
  const visual: VisualAsset = {
    id: 'vis_example_hero',
    role: 'hero',
    title: heroSlot.title,
    prompt: heroPrompt,
    url: buildBrandMockSvg({
      profile,
      headline: title,
      subhead: profile.messaging.valueProps[0] ?? '',
      cta: profile.messaging.ctas[0] ?? 'Learn more',
      seed: 1,
      square: false,
    }),
    imageModelLabel: friendlyModel('gemini-2.5-flash-image'),
    imageMode: 'demo',
    imageLatencyMs: 1720,
    caption: heroText.caption,
    altText: heroText.altText,
    textModelLabel: friendlyModel(textModel),
    textMode: 'demo',
    safety: assessBrandSafety(`${heroPrompt} ${heroText.caption}`, profile),
    generatedAt: now - 50 * 60 * 1000,
  }

  // ── Compliance (analyzed, resolved, signed off) ────────────────────────────
  const analysis = analyzeContent(draft, [visual], topic, SEED_RULEBOOK, profile)
  // A finished run: accept the rewrites on Critical/Major findings; leave Minor open.
  const issues: ComplianceIssue[] = analysis.issues.map((i) =>
    i.severity === 'Critical' || i.severity === 'Major'
      ? { ...i, decision: 'accepted' as const }
      : i,
  )
  const cleanApplied = true
  const score = computeScore(issues, analysis.checklist, cleanApplied)
  const analyzedTs = now - 40 * 60 * 1000

  const accepted = issues.filter((i) => i.decision === 'accepted')
  const compliance: ComplianceState = {
    runAt: analyzedTs,
    assessment: demoAssessment(topic, analysis.issues, analysis.checklist),
    assessmentModelLabel: friendlyModel(textModel),
    assessmentMode: 'demo',
    issues,
    checklist: analysis.checklist,
    initialScore: analysis.initialScore,
    cleanApplied,
    audit: [
      {
        id: uid('aud'),
        ts: analyzedTs,
        actor: 'System',
        action: 'analyzed',
        detail: `Analyzed copy + 1 visual: ${analysis.issues.length} finding(s), initial score ${analysis.initialScore}.`,
      },
      ...accepted.map((i, k) => ({
        id: uid('aud'),
        ts: analyzedTs + (k + 1) * 60 * 1000,
        actor: 'J. Rivera, Marketing Compliance',
        action: 'accept' as const,
        detail: `accept · ${i.title} (${i.citation})`,
      })),
      {
        id: uid('aud'),
        ts: analyzedTs + 8 * 60 * 1000,
        actor: 'J. Rivera, Marketing Compliance',
        action: 'clean-applied',
        detail: 'Applied suggested clean version (rewrites + disclosures).',
      },
      {
        id: uid('aud'),
        ts: analyzedTs + 10 * 60 * 1000,
        actor: 'J. Rivera, Marketing Compliance',
        action: 'signoff',
        detail: `approved-with-changes at score ${score} — "Rewrites applied; disclosures complete. Cleared for publish."`,
      },
    ],
    signoff: {
      reviewer: 'J. Rivera, Marketing Compliance',
      decision: 'approved-with-changes',
      note: 'Rewrites applied; disclosures complete. Cleared for publish.',
      ts: analyzedTs + 10 * 60 * 1000,
      scoreAtSignoff: score,
    },
  }

  // ── Publish package ────────────────────────────────────────────────────────
  const masterCopy = buildCleanVersion(draft, compliance)
  const primaryKey = 'blog' as const
  const channels: ChannelAdaptation[] = CHANNELS.map((meta) => {
    const isPrimary = meta.key === primaryKey
    // The primary channel's entry IS the approved draft, not a re-adaptation.
    const a: AdaptationDraft = isPrimary
      ? { headline: draft.title, body: masterCopy, cta: profile.messaging.ctas[0] ?? 'Learn more', hashtags: [] }
      : demoAdaptation(profile, topic, meta.key, masterCopy, disclosures)
    const sem =
      meta.key === 'sem'
        ? { headlines: a.headlines ?? [], descriptions: a.descriptions ?? [] }
        : null
    const bodyText = sem ? composeSemBody(sem.headlines, sem.descriptions) : a.body
    const recheck = recheckChannel(
      [a.headline, bodyText, a.cta, a.hashtags.join(' ')].filter(Boolean).join('\n'),
      disclosures,
      SEED_RULEBOOK,
      meta,
    )
    return {
      channel: meta.key,
      label: meta.label,
      headline: a.headline,
      body: a.body,
      cta: a.cta,
      hashtags: a.hashtags,
      charCount: sem
        ? Math.max(0, ...sem.headlines.map((h) => h.length), ...sem.descriptions.map((d) => d.length))
        : a.body.length,
      charLimit: meta.charLimit,
      modelLabel: isPrimary ? 'Approved draft' : friendlyModel(textModel),
      mode: 'demo',
      recheck,
      generatedAt: now - 20 * 60 * 1000,
      isPrimary,
      edited: false,
      resolution: null,
      sem,
      visualId: isImageChannel(meta.key) ? visual.id : null,
      handoff: defaultHandoff(meta.key, topic),
    }
  })
  const publish: PublishPackage = {
    assembledAt: now - 20 * 60 * 1000,
    topicTitle: topic.title,
    masterCopy,
    channels,
    complianceScore: score,
    signedOffBy: compliance.signoff?.reviewer ?? null,
    signOffDecision: compliance.signoff?.decision ?? null,
    heroVisualId: visual.id,
  }

  // ── Persona Lab (live focus group) ───────────────────────────────────────────
  const personaChannel = 'blog' as const
  const personaSeed = 424242 // fixed so the example run is stable
  const segmentIds = defaultPanel(topic, SEED_SEGMENTS)
  const segments = SEED_SEGMENTS.filter((s) => segmentIds.includes(s.id))
  const participants = demoParticipants(segments, 4, personaSeed)
  const agenda = buildAgenda(topic, personaChannel)
  const transcript: DiscussionTurn[] = [
    {
      id: 'turn_open',
      agendaItemId: 'open',
      kind: 'moderator',
      speakerId: null,
      speakerName: 'Moderator',
      text: moderatorOpening(topic, personaChannel, participants.length),
      ts: now - 12 * 60 * 1000,
    },
  ]
  for (const item of agenda) {
    transcript.push({
      id: `turn_mod_${item.id}`,
      agendaItemId: item.id,
      kind: 'moderator',
      speakerId: null,
      speakerName: 'Moderator',
      text: item.prompt,
      ts: now - 11 * 60 * 1000,
    })
    for (const t of demoDiscussionTurns(item, participants, topic, personaSeed)) {
      transcript.push({ ...t, ts: now - 11 * 60 * 1000 })
    }
  }
  const stats = computeStats(transcript, participants)
  const persona: PersonaLabState = {
    runAt: now - 10 * 60 * 1000,
    channel: personaChannel,
    stage: 'complete',
    config: { segmentIds, participantCount: participants.length },
    participants,
    agenda,
    transcript,
    summary: demoSummary(topic, stats),
    stats,
    recommendations: demoRecommendations(topic, stats),
    selectedRecIds: [],
    revisedDraft: null,
    moderatorModelLabel: friendlyModel(textModel),
    mode: 'demo',
    fairnessNote: FAIRNESS_NOTE,
    fairnessFlags: [],
  }

  return {
    userTopics: [],
    selectedTopicId: topic.id,
    primaryChannel: 'blog',
    topicRead: {
      text: `The backlog favors "${topic.title}" — high consideration-stage demand with a direct product tie-in, balanced against a heavy disclosure load that the compliance gate is built to handle. Prioritized as the flagship piece for the period.`,
      modelLabel: friendlyModel(textModel),
      mode: 'demo',
      ranAt: now - 65 * 60 * 1000,
    },
    briefInput: DEFAULT_BRIEF_INPUT,
    brief,
    voice,
    drafts: [draft],
    chosenDraftId: draft.id,
    visuals: [visual],
    compliance,
    publish,
    persona,
    revision: 1,
    revisionNote: '',
  }
}
