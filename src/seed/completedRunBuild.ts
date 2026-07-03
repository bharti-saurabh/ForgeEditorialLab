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
  DraftVariant,
  FocusComment,
  PersonaLabState,
  PipelineState,
  PublishPackage,
  SurveyRow,
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
import { CHANNELS, recheckChannel } from '@/lib/publish'
import { demoAdaptation, adaptationText } from '@/lib/prompts/publish'
import {
  defaultPanel,
  simulateSurvey,
  simulateComment,
  aggregateMetrics,
  buildRecommendation,
  FAIRNESS_NOTE,
} from '@/lib/persona'
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
  const channels: ChannelAdaptation[] = CHANNELS.map((meta) => {
    const a = demoAdaptation(profile, topic, meta.key, masterCopy, disclosures)
    const recheck = recheckChannel(adaptationText(a), disclosures, SEED_RULEBOOK, meta)
    return {
      channel: meta.key,
      label: meta.label,
      headline: a.headline,
      body: a.body,
      cta: a.cta,
      hashtags: a.hashtags,
      charCount: a.body.length,
      charLimit: meta.charLimit,
      modelLabel: friendlyModel(textModel),
      mode: 'demo',
      recheck,
      generatedAt: now - 20 * 60 * 1000,
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

  // ── Persona Lab ─────────────────────────────────────────────────────────────
  const panelIds = defaultPanel(topic, SEED_SEGMENTS)
  const panel = SEED_SEGMENTS.filter((s) => panelIds.includes(s.id))
  const inputs = { brandMatch: draft.brandMatch.score, complianceScore: score }
  const survey: SurveyRow[] = panel.map((s) => simulateSurvey(s, topic, inputs))
  const comments: FocusComment[] = panel.map((s, i) => simulateComment(s, topic, survey[i]))
  const metrics = aggregateMetrics(survey)
  const recommendation = buildRecommendation(metrics, survey, comments)
  const persona: PersonaLabState = {
    runAt: now - 10 * 60 * 1000,
    panelSegmentIds: panelIds,
    comments,
    synthesis: buildExampleSynthesis(topic.title, metrics, recommendation),
    synthesisModelLabel: friendlyModel(textModel),
    synthesisMode: 'demo',
    survey,
    metrics,
    recommendation,
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
  }
}

function buildExampleSynthesis(
  topicTitle: string,
  metrics: PersonaLabState['metrics'],
  rec: PersonaLabState['recommendation'],
): string {
  const strongest = [...metrics].sort((a, b) => b.average - a.average)[0]
  const weakest = [...metrics].sort((a, b) => a.average - b.average)[0]
  return (
    `Across the panel, "${topicTitle.split(':')[0].toLowerCase()}" reads as ${strongest.label.toLowerCase()}-forward (${strongest.average}/100). Debt-Conscious Optimizers and Credit Builders responded most warmly to the straight, no-hype explanation, and the transparent "no surprises" framing carried real weight.\n\n` +
    `The drag is ${weakest.label.toLowerCase()} (${weakest.average}/100): more skeptical segments wanted concrete numbers before committing. That is an optimization opportunity, not a blocker, and it points cleanly at the A/B test.\n\n` +
    `Recommendation: ${rec.headline} ${rec.rationale}`
  )
}
