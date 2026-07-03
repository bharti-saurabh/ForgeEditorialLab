import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge, ratingTone } from '@/components/Badge'
import { SectionTitle, EmptyState } from '@/components/EmptyState'
import { ModelTag } from '@/components/ModelTag'
import { ScoreGauge } from '@/components/ScoreGauge'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { Markdown } from '@/components/Markdown'
import { findTopic } from '@/lib/topics'
import { PRIMARY_CHANNELS, channelSpec } from '@/lib/channels'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import { disclosuresForTopic, rulesForTopic } from '@/lib/compliance'
import { draftComplianceSummary, type DraftComplianceSummary } from '@/lib/draftCompliance'
import {
  BRIEF_SYSTEM,
  buildBriefPrompt,
  demoBrief,
  DRAFT_SYSTEM,
  buildDraftPrompt,
  demoDraft,
  voiceDirectives,
  REFINE_SYSTEM,
  REFINE_META,
  buildRefinePrompt,
  demoRefine,
  type RefineAction,
} from '@/lib/prompts/draft'
import { runChat } from '@/lib/router/router'
import { brandMatchScore } from '@/lib/brand/grounding'
import { friendlyModel } from '@/lib/router/roles'
import { estimateCostUsd, fmtUsd } from '@/lib/router/pricing'
import { parseJsonLoose } from '@/lib/json'
import { uid, fmtMs, fmtDateTime } from '@/lib/format'
import type { BriefInput, ContentBrief, DraftVariant, VoiceControls } from '@/types'
import {
  IconDoc,
  IconBolt,
  IconSparkles,
  IconShield,
  IconChevron,
  IconTrash,
  IconCheck,
  IconRoute,
  IconGear,
  IconAlert,
} from '@/components/icons'
import { cn } from '@/lib/cn'

const BAKEOFF_SUGGESTIONS = ['claude-sonnet-5', 'gpt-5.4', 'gemini-2.5-pro']

export function BriefDraftView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const settings = useAppStore((s) => s.settings)
  const pipeline = useAppStore((s) => s.pipeline)
  const updateBriefInput = useAppStore((s) => s.updateBriefInput)
  const setPrimaryChannel = useAppStore((s) => s.setPrimaryChannel)
  const setBrief = useAppStore((s) => s.setBrief)
  const updateBrief = useAppStore((s) => s.updateBrief)
  const updateVoice = useAppStore((s) => s.updateVoice)
  const addDraft = useAppStore((s) => s.addDraft)
  const updateDraft = useAppStore((s) => s.updateDraft)
  const removeDraft = useAppStore((s) => s.removeDraft)
  const chooseDraft = useAppStore((s) => s.chooseDraft)

  const topic = useMemo(
    () => findTopic(pipeline.selectedTopicId, pipeline.userTopics),
    [pipeline.selectedTopicId, pipeline.userTopics],
  )

  const disclosures = useMemo(
    () => (topic ? disclosuresForTopic(topic, SEED_RULEBOOK, profile) : []),
    [topic, profile],
  )
  const watchRules = useMemo(
    () => (topic ? rulesForTopic(topic, SEED_RULEBOOK) : []),
    [topic],
  )

  // Per-draft compliance PREVIEW for the bake-off (reuses the Step 4 engine).
  const draftSummaries = useMemo(() => {
    const m = new Map<string, DraftComplianceSummary>()
    if (!topic) return m
    for (const d of pipeline.drafts)
      m.set(d.id, draftComplianceSummary(d, topic, profile, SEED_RULEBOOK))
    return m
  }, [pipeline.drafts, topic, profile])

  // The variant closest to clearing the gate (cleared → most disclosures → fewest severe issues).
  const safestDraftId = useMemo(() => {
    if (pipeline.drafts.length < 2) return null
    let best: string | null = null
    let bestKey = -Infinity
    for (const d of pipeline.drafts) {
      const s = draftSummaries.get(d.id)
      if (!s) continue
      const key =
        (s.cleared ? 1000 : 0) + s.disclosuresPresent * 10 - (s.critical * 5 + s.major * 2)
      if (key > bestKey) {
        bestKey = key
        best = d.id
      }
    }
    return best
  }, [pipeline.drafts, draftSummaries])

  const [briefRunning, setBriefRunning] = useState(false)
  const [briefEditing, setBriefEditing] = useState(false)
  const [showInputs, setShowInputs] = useState(false)
  const [draftModel, setDraftModel] = useState(settings.models.text)
  const [draftRunningModel, setDraftRunningModel] = useState<string | null>(null)

  const { brief, briefInput, voice, drafts, chosenDraftId, primaryChannel } = pipeline
  const channel = channelSpec(primaryChannel)
  const topScore = drafts.length
    ? Math.max(...drafts.map((d) => d.brandMatch.score))
    : 0

  if (!topic) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle
          title="Step 2 · Brief & Draft"
          description="Turn an approved topic into a brief and an on-brand draft."
        />
        <EmptyState
          icon={<IconSparkles size={22} />}
          title="Pick a topic first"
          description="Step 2 works from a topic you take forward in Topic Intelligence. Choose one to begin."
          action={
            <Button variant="primary" icon={<IconChevron size={15} />} onClick={() => setView('step-1')}>
              Go to Topic Intelligence
            </Button>
          }
        />
      </div>
    )
  }

  async function generateBrief() {
    if (!topic) return
    setBriefRunning(true)
    try {
      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 2 · Content Brief',
        system: BRIEF_SYSTEM,
        user: buildBriefPrompt(profile, topic, disclosures, briefInput, channel),
        reason: 'Reasoning model — converts one topic into a structured, executable brief.',
        maxTokens: 700,
        demo: () => JSON.stringify(demoBrief(profile, topic, briefInput, channel)),
      })
      const parsed = parseJsonLoose<Partial<ContentBrief>>(text) ?? demoBrief(profile, topic, briefInput, channel)
      const next: ContentBrief = {
        objective: parsed.objective ?? '',
        audience: parsed.audience ?? '',
        angle: parsed.angle ?? '',
        keyMessages: parsed.keyMessages ?? [],
        seoKeywords: parsed.seoKeywords ?? [],
        structure: parsed.structure ?? [],
        toneNotes: parsed.toneNotes ?? '',
        mandatoryDisclosures: disclosures,
        modelLabel: entry.modelLabel,
        mode,
        generatedAt: entry.ts,
      }
      setBrief(next)
      pushToast(mode === 'live' ? 'success' : 'info', `Brief ready${mode === 'live' ? ` in ${fmtMs(entry.latencyMs)}` : ' (demo)'}.`)
    } catch {
      pushToast('error', 'Could not generate the brief.')
    } finally {
      setBriefRunning(false)
    }
  }

  async function generateDraft(modelId: string) {
    if (!topic || !brief) return
    setDraftRunningModel(modelId)
    try {
      const { text, mode, entry } = await runChat({
        role: 'copy',
        step: `Step 2 · Draft (${friendlyModel(modelId)})`,
        system: DRAFT_SYSTEM,
        user: buildDraftPrompt(profile, brief, voice, channel),
        modelId,
        reason: 'Brand-voice copywriter — drafts on-brand copy following the learned voice profile.',
        maxTokens: 1200,
        demo: () => demoDraft(profile, brief, topic, voice, modelId, channel),
      })
      const { title, body } = parseDraft(text)
      const brandMatch = brandMatchScore(`${title}\n${body}`, profile)
      const variant: DraftVariant = {
        id: uid('draft'),
        modelId,
        modelLabel: entry.modelLabel,
        mode,
        title,
        body,
        brandMatch,
        wordCount: body.split(/\s+/).filter(Boolean).length,
        latencyMs: entry.latencyMs,
        usage: entry.usage,
        generatedAt: entry.ts,
      }
      addDraft(variant)
      pushToast('success', `Draft from ${friendlyModel(modelId)} added (brand-match ${brandMatch.score}).`)
    } catch {
      pushToast('error', 'Could not generate the draft.')
    } finally {
      setDraftRunningModel(null)
    }
  }

  const chosen = drafts.find((d) => d.id === chosenDraftId) ?? null
  const chosenSummary = chosen ? draftSummaries.get(chosen.id) ?? null : null
  const exportMd = brief ? buildExportMarkdown(topic.title, brief, chosen) : undefined

  /** Re-score a hand-edited / refined variant and persist it. */
  function commitDraftEdit(id: string, title: string, body: string) {
    const brandMatch = brandMatchScore(`${title}\n${body}`, profile)
    const wordCount = body.split(/\s+/).filter(Boolean).length
    updateDraft(id, { title, body, brandMatch, wordCount, edited: true })
  }

  /** Run one AI-assist refinement on a passage; returns the revised markdown. */
  async function runRefine(
    action: RefineAction,
    text: string,
    missingDisclosures: string[],
  ): Promise<string> {
    const { text: out, mode, entry } = await runChat({
      role: 'copy',
      step: `Step 2 · Refine (${REFINE_META[action].label})`,
      system: REFINE_SYSTEM,
      user: buildRefinePrompt({ action, profile, voice, text, missingDisclosures }),
      reason: `Brand-voice copywriter — ${REFINE_META[action].label.toLowerCase()} the copy while preserving placeholders.`,
      maxTokens: 1200,
      demo: () => demoRefine(action, text, missingDisclosures),
    })
    pushToast(
      mode === 'live' ? 'success' : 'info',
      `${REFINE_META[action].label} applied${mode === 'live' ? ` in ${fmtMs(entry.latencyMs)}` : ' (demo)'}.`,
    )
    return out.trim()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Step 2 · Brief & Draft"
        description="Auto brief with mandatory disclosures, then an on-brand draft — with a live model bake-off."
        actions={
          <div className="flex items-center gap-2">
            {chosen && (
              <Button
                variant="primary"
                size="sm"
                icon={<IconChevron size={15} />}
                onClick={() => setView('step-3')}
              >
                Continue to Visuals
              </Button>
            )}
            <ExportButton
              name={`brief-${topic.id}`}
              json={{ topic, brief, chosenDraft: chosen }}
              markdown={exportMd}
            />
          </div>
        }
      />

      {/* selected topic banner */}
      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink-900">{topic.title}</span>
              {topic.onBrand ? (
                <Badge tone="ok">On-brand</Badge>
              ) : (
                <Badge tone="warn">Off-brand — review</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span>{topic.audienceSegment}</span>
              <span className="text-ink-300">·</span>
              <span className="capitalize">{topic.funnelStage}</span>
              <span className="text-ink-300">·</span>
              <span className="capitalize">{topic.format}</span>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1">
                Compliance
                <Badge tone={ratingTone(topic.complianceSensitivity)}>
                  {topic.complianceSensitivity}
                </Badge>
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView('step-1')}>
            Change topic
          </Button>
        </CardBody>
      </Card>

      {/* primary channel — the surface this piece is authored for (drives the
          brief, draft, visuals, posted preview, and compliance review) */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconRoute size={18} />}
          title="Publish channel"
          subtitle="Choose the surface this piece is built for — it shapes the brief, the draft, and the visuals downstream."
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIMARY_CHANNELS.map((key) => {
              const spec = channelSpec(key)
              const active = key === primaryChannel
              return (
                <button
                  key={key}
                  onClick={() => setPrimaryChannel(key)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-straive-500 bg-straive-50/70 ring-2 ring-straive-500/20'
                      : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn('text-sm font-semibold', active ? 'text-straive-700' : 'text-ink-800')}>
                      {spec.label}
                    </span>
                    {active && <IconCheck size={14} className="shrink-0 text-straive-600" />}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-ink-500">{spec.blurb}</p>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
            <span>
              <span className="font-medium text-ink-600">Length:</span> {channel.lengthTarget}
            </span>
            <span>
              <span className="font-medium text-ink-600">Visuals:</span>{' '}
              {channel.kind === 'text-ad'
                ? 'text-only (search ad)'
                : channel.ratios.map((r) => r.ratio).join(' · ')}
            </span>
          </div>
          {(brief || drafts.length > 0) && (
            <p className="mt-2 text-[11px] text-warn">
              Switched channel? Regenerate the brief and drafts so they match this surface.
            </p>
          )}
        </CardBody>
      </Card>

      <Disclaimer kind="legal" className="mb-5" />

      {/* brief */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconDoc size={18} />}
          title="Content brief"
          subtitle="Objective, angle, structure, and the disclosures the copy must carry."
          actions={
            <div className="flex items-center gap-2">
              {brief && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={briefEditing ? <IconCheck size={15} /> : <IconGear size={15} />}
                  onClick={() => setBriefEditing((v) => !v)}
                >
                  {briefEditing ? 'Done' : 'Edit'}
                </Button>
              )}
              <Button
                variant={brief ? 'secondary' : 'primary'}
                size="sm"
                loading={briefRunning}
                icon={!briefRunning ? <IconBolt size={15} /> : undefined}
                onClick={generateBrief}
              >
                {brief ? 'Regenerate' : 'Generate brief'}
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <BriefInputsPanel
            input={briefInput}
            onChange={updateBriefInput}
            open={showInputs || !brief}
            canToggle={!!brief}
            onToggle={() => setShowInputs((v) => !v)}
          />
          {brief ? (
            briefEditing ? (
              <BriefEditor brief={brief} onChange={updateBrief} />
            ) : (
              <BriefBody brief={brief} watchRules={watchRules} />
            )
          ) : (
            <EmptyState
              icon={<IconDoc size={20} />}
              title="No brief yet"
              description="Add any direction above (optional), then generate a brief to define the objective, angle, structure, and mandatory disclosures before drafting."
            />
          )}
        </CardBody>
      </Card>

      {/* voice controls */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconSparkles size={18} />}
          title="Brand-voice controls"
          subtitle="Dial the voice; changes apply to new drafts you generate."
        />
        <CardBody>
          <VoicePanel voice={voice} onChange={updateVoice} />
        </CardBody>
      </Card>

      {/* draft bake-off */}
      <Card>
        <CardHeader
          icon={<IconRoute size={18} />}
          title="Draft & model bake-off"
          subtitle="Generate a draft, then swap the model and compare on brand-match, speed, and read."
          actions={
            drafts.length > 0 && (
              <Badge tone="neutral">{drafts.length} variant{drafts.length > 1 ? 's' : ''}</Badge>
            )
          }
        />
        <CardBody className="space-y-4">
          {!brief && (
            <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/60 px-4 py-3 text-sm text-ink-500">
              Generate the brief first — drafts are written against it.
            </div>
          )}

          {brief && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-200 bg-ink-50/50 p-3">
              <label className="text-xs font-medium text-ink-600">
                Drafting model
                <input
                  value={draftModel}
                  onChange={(e) => setDraftModel(e.target.value)}
                  className="mt-1 block h-9 w-64 rounded-lg border border-ink-200 bg-white px-3 font-mono text-xs text-ink-800 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
                />
              </label>
              <Button
                variant="primary"
                icon={<IconBolt size={15} />}
                loading={draftRunningModel === draftModel}
                disabled={!!draftRunningModel || !draftModel.trim()}
                onClick={() => generateDraft(draftModel.trim())}
              >
                {drafts.length ? 'Run variant' : 'Generate draft'}
              </Button>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-400">Try:</span>
                {BAKEOFF_SUGGESTIONS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDraftModel(m)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition',
                      draftModel === m
                        ? 'border-straive-300 bg-straive-50 text-straive-700'
                        : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                    )}
                  >
                    {friendlyModel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {drafts.length === 0 ? (
            brief && (
              <EmptyState
                icon={<IconDoc size={20} />}
                title="No drafts yet"
                description="Generate your first draft, then run another model to compare side by side."
              />
            )
          ) : (
            <div
              className={cn(
                'grid gap-4',
                drafts.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1',
              )}
            >
              {drafts.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  summary={draftSummaries.get(d.id)}
                  chosen={d.id === chosenDraftId}
                  isTop={drafts.length > 1 && d.brandMatch.score === topScore}
                  isSafest={drafts.length > 1 && d.id === safestDraftId}
                  onChoose={() => chooseDraft(d.id)}
                  onRemove={() => removeDraft(d.id)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* finalize the chosen draft — manual edit + AI-assist */}
      {chosen && (
        <Card className="mt-5">
          <CardHeader
            icon={<IconSparkles size={18} />}
            title="Finalize the chosen draft"
            subtitle="Edit directly, or use an AI assist. Select text first to target a passage; otherwise the whole draft is refined."
            actions={
              <div className="flex items-center gap-2">
                {chosen.edited && <Badge tone="accent">Edited</Badge>}
                <ModelTag role="copy" modelLabel={chosen.modelLabel} mode={chosen.mode} />
              </div>
            }
          />
          <CardBody>
            <DraftEditor
              key={chosen.id}
              draft={chosen}
              summary={chosenSummary}
              onCommit={(title, body) => commitDraftEdit(chosen.id, title, body)}
              runRefine={runRefine}
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}

// ── Brief body ─────────────────────────────────────────────────────────────

function BriefBody({
  brief,
  watchRules,
}: {
  brief: ContentBrief
  watchRules: ReturnType<typeof rulesForTopic>
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ModelTag role="strategy" modelLabel={brief.modelLabel} mode={brief.mode} />
        <span className="text-xs text-ink-400">Generated {fmtDateTime(brief.generatedAt)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Objective">{brief.objective}</Field>
        <Field label="Audience">{brief.audience}</Field>
        <Field label="Angle" full>
          {brief.angle}
        </Field>
      </div>

      <div>
        <FieldLabel>Key messages</FieldLabel>
        <ul className="mt-1 space-y-1">
          {brief.keyMessages.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-straive-500" />
              {m}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>Outline</FieldLabel>
          <ol className="mt-1 space-y-1">
            {brief.structure.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <span className="mt-0.5 text-xs font-bold tabular-nums text-ink-400">
                  {i + 1}.
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <FieldLabel>SEO keywords</FieldLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {brief.seoKeywords.map((k) => (
              <span
                key={k}
                className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600"
              >
                {k}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <FieldLabel>Tone notes</FieldLabel>
            <p className="mt-1 text-sm text-ink-600">{brief.toneNotes}</p>
          </div>
        </div>
      </div>

      {/* mandatory disclosures + compliance watch-list */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
          <IconShield size={16} /> Mandatory disclosures
        </div>
        <ul className="space-y-1">
          {brief.mandatoryDisclosures.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
              <IconCheck size={13} className="mt-0.5 shrink-0" />
              {d}
            </li>
          ))}
        </ul>
        {watchRules.length > 0 && (
          <div className="mt-3 border-t border-amber-200 pt-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              Rules the Step 4 gate will enforce
            </div>
            <div className="flex flex-wrap gap-1.5">
              {watchRules.map((r) => (
                <span
                  key={r.id}
                  title={r.description}
                  className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900"
                >
                  {r.citation}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn(full && 'md:col-span-2')}>
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 text-sm text-ink-700">{children}</p>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
      {children}
    </span>
  )
}

// ── Voice controls ───────────────────────────────────────────────────────

function VoicePanel({
  voice,
  onChange,
}: {
  voice: VoiceControls
  onChange: (patch: Partial<VoiceControls>) => void
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Dial
        label="Formality"
        lo="Casual"
        hi="Formal"
        value={voice.formality}
        onChange={(formality) => onChange({ formality })}
      />
      <Dial
        label="Warmth"
        lo="Neutral"
        hi="Warm"
        value={voice.warmth}
        onChange={(warmth) => onChange({ warmth })}
      />
      <Dial
        label="Depth"
        lo="Skimmable"
        hi="In-depth"
        value={voice.depth}
        onChange={(depth) => onChange({ depth })}
      />
      <div>
        <div className="mb-1.5 text-xs font-medium text-ink-600">Length</div>
        <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
          {(['short', 'standard', 'long'] as const).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ length: l })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition',
                voice.length === l ? 'bg-navy-900 text-white' : 'text-ink-500 hover:text-ink-800',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-400 md:col-span-2">
        {voiceDirectives(voice).replace(/\n/g, ' · ').replace(/- /g, '')}
      </p>
    </div>
  )
}

function Dial({
  label,
  lo,
  hi,
  value,
  onChange,
}: {
  label: string
  lo: string
  hi: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-600">{label}</span>
        <span className="tabular-nums text-ink-400">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-straive-500"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-ink-400">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  )
}

// ── Draft card ─────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  summary,
  chosen,
  isTop,
  isSafest,
  onChoose,
  onRemove,
}: {
  draft: DraftVariant
  summary?: DraftComplianceSummary
  chosen: boolean
  isTop: boolean
  isSafest: boolean
  onChoose: () => void
  onRemove: () => void
}) {
  const cost = draft.usage ? estimateCostUsd(draft.modelId, 'copy', draft.usage) : undefined
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white transition',
        chosen ? 'border-straive-400 shadow-cardHover ring-1 ring-straive-200' : 'border-ink-200',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ModelTag role="copy" modelLabel={draft.modelLabel} mode={draft.mode} />
          {isTop && <Badge tone="ok">Top brand-match</Badge>}
          {isSafest && <Badge tone="info">Closest to compliant</Badge>}
          {draft.edited && <Badge tone="accent">Edited</Badge>}
          {chosen && <Badge tone="accent">Chosen</Badge>}
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove draft"
          className="text-ink-300 transition hover:text-crit"
        >
          <IconTrash size={15} />
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
        <ScoreGauge value={draft.brandMatch.score} size={54} />
        <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
          <Metric label="Brand-match" value={`${draft.brandMatch.score}/100`} />
          <Metric label="Words" value={draft.wordCount} />
          <Metric label="Latency" value={fmtMs(draft.latencyMs)} />
          <Metric
            label="Cost (est.)"
            value={cost !== undefined ? fmtUsd(cost) : '—'}
          />
        </div>
      </div>

      {summary && <ComplianceStrip summary={summary} />}

      {(draft.brandMatch.hit.length > 0 || draft.brandMatch.missed.length > 0) && (
        <div className="flex flex-wrap gap-1.5 border-b border-ink-100 px-4 py-2">
          {draft.brandMatch.hit.slice(0, 3).map((h, i) => (
            <span key={i} className="rounded bg-ok/10 px-1.5 py-0.5 text-[10px] font-medium text-ok">
              {h}
            </span>
          ))}
          {draft.brandMatch.missed.map((m, i) => (
            <span key={i} className="rounded bg-crit/10 px-1.5 py-0.5 text-[10px] font-medium text-crit">
              {m}
            </span>
          ))}
        </div>
      )}

      <div className="max-h-[420px] flex-1 overflow-y-auto px-4 py-3">
        <Markdown source={`# ${draft.title}\n\n${draft.body}`} />
      </div>

      <div className="border-t border-ink-100 p-3">
        <Button
          variant={chosen ? 'secondary' : 'primary'}
          size="sm"
          className="w-full"
          icon={chosen ? <IconCheck size={15} /> : undefined}
          onClick={onChoose}
        >
          {chosen ? 'Selected for Visuals' : 'Use this draft'}
        </Button>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="font-semibold tabular-nums text-ink-800">{value}</div>
    </div>
  )
}

// ── Compliance preview strip (bake-off) ────────────────────────────────────

function ComplianceStrip({ summary: s }: { summary: DraftComplianceSummary }) {
  const clean = s.disclosuresPresent === s.disclosuresTotal
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-100 px-4 py-2 text-[11px]">
      <span className="inline-flex items-center gap-1 font-semibold text-ink-500">
        <IconShield size={12} /> Compliance
      </span>
      <span
        className={cn('inline-flex items-center gap-1 font-medium', clean ? 'text-ok' : 'text-warn')}
      >
        Disclosures {s.disclosuresPresent}/{s.disclosuresTotal}
      </span>
      {s.critical > 0 && (
        <span className="rounded bg-crit/10 px-1.5 py-0.5 font-semibold text-crit">
          {s.critical} critical
        </span>
      )}
      {s.major > 0 && (
        <span className="rounded bg-warn/10 px-1.5 py-0.5 font-semibold text-warn">
          {s.major} major
        </span>
      )}
      {s.minor > 0 && (
        <span className="rounded bg-ink-100 px-1.5 py-0.5 font-medium text-ink-500">
          {s.minor} minor
        </span>
      )}
      {s.cleared ? (
        <span className="inline-flex items-center gap-1 font-semibold text-ok">
          <IconCheck size={12} /> Likely clears gate
        </span>
      ) : (
        <span className="text-ink-400">Step 4 gate will confirm</span>
      )}
    </div>
  )
}

// ── Brief inputs (steering) ────────────────────────────────────────────────

function BriefInputsPanel({
  input,
  onChange,
  open,
  canToggle,
  onToggle,
}: {
  input: BriefInput
  onChange: (patch: Partial<BriefInput>) => void
  open: boolean
  canToggle: boolean
  onToggle: () => void
}) {
  const inputCls =
    'h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20'
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/50">
      <button
        onClick={canToggle ? onToggle : undefined}
        className={cn(
          'flex w-full items-center justify-between px-3.5 py-2.5 text-left',
          !canToggle && 'cursor-default',
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Brief inputs <span className="font-normal normal-case text-ink-400">· optional direction</span>
        </span>
        {canToggle && (
          <IconChevron
            size={14}
            className={cn('text-ink-400 transition', open ? 'rotate-90' : '')}
          />
        )}
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-ink-200 px-3.5 py-3">
          <input
            className={inputCls}
            placeholder="Working title (optional)"
            value={input.workingTitle}
            onChange={(e) => onChange({ workingTitle: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Preferred angle / hook (optional)"
            value={input.anglePreference}
            onChange={(e) => onChange({ anglePreference: e.target.value })}
          />
          <textarea
            className={cn(inputCls, 'h-auto py-2 leading-relaxed')}
            rows={3}
            placeholder="Must include — one point per line (optional)"
            value={input.mustInclude}
            onChange={(e) => onChange({ mustInclude: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

// ── Editable brief ─────────────────────────────────────────────────────────

function BriefEditor({
  brief,
  onChange,
}: {
  brief: ContentBrief
  onChange: (patch: Partial<ContentBrief>) => void
}) {
  const areaCls =
    'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20'
  const toLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <EditField label="Objective">
          <textarea rows={2} className={areaCls} value={brief.objective} onChange={(e) => onChange({ objective: e.target.value })} />
        </EditField>
        <EditField label="Audience">
          <textarea rows={2} className={areaCls} value={brief.audience} onChange={(e) => onChange({ audience: e.target.value })} />
        </EditField>
      </div>
      <EditField label="Angle">
        <textarea rows={2} className={areaCls} value={brief.angle} onChange={(e) => onChange({ angle: e.target.value })} />
      </EditField>
      <EditField label="Key messages (one per line)">
        <textarea rows={4} className={areaCls} value={brief.keyMessages.join('\n')} onChange={(e) => onChange({ keyMessages: toLines(e.target.value) })} />
      </EditField>
      <div className="grid gap-4 md:grid-cols-2">
        <EditField label="Outline (one per line)">
          <textarea rows={5} className={areaCls} value={brief.structure.join('\n')} onChange={(e) => onChange({ structure: toLines(e.target.value) })} />
        </EditField>
        <div className="space-y-4">
          <EditField label="SEO keywords (comma-separated)">
            <input
              className={areaCls}
              value={brief.seoKeywords.join(', ')}
              onChange={(e) => onChange({ seoKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </EditField>
          <EditField label="Tone notes">
            <textarea rows={3} className={areaCls} value={brief.toneNotes} onChange={(e) => onChange({ toneNotes: e.target.value })} />
          </EditField>
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
        <span className="font-semibold">Mandatory disclosures are locked</span> — derived from the
        topic + rulebook and enforced by the Step 4 gate ({brief.mandatoryDisclosures.length}{' '}
        required).
      </div>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1">{children}</div>
    </div>
  )
}

// ── Chosen-draft editor + AI-assist ────────────────────────────────────────

function DraftEditor({
  draft,
  summary,
  onCommit,
  runRefine,
}: {
  draft: DraftVariant
  summary: DraftComplianceSummary | null
  onCommit: (title: string, body: string) => void
  runRefine: (action: RefineAction, text: string, missing: string[]) => Promise<string>
}) {
  const [title, setTitle] = useState(draft.title)
  const [body, setBody] = useState(draft.body)
  const [busy, setBusy] = useState<RefineAction | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function commit(nextTitle: string, nextBody: string) {
    setTitle(nextTitle)
    setBody(nextBody)
    onCommit(nextTitle, nextBody)
  }

  async function refine(action: RefineAction) {
    const ta = taRef.current
    const selStart = ta?.selectionStart ?? 0
    const selEnd = ta?.selectionEnd ?? 0
    const hasSel = action !== 'disclosures' && selEnd > selStart
    const target = hasSel ? body.slice(selStart, selEnd) : body
    const missing = summary?.missingDisclosures ?? []
    setBusy(action)
    try {
      const out = await runRefine(action, target, missing)
      const nextBody = hasSel ? body.slice(0, selStart) + out + body.slice(selEnd) : out
      commit(title, nextBody)
    } catch {
      /* error toast is raised upstream */
    } finally {
      setBusy(null)
    }
  }

  const fieldCls =
    'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20'
  const actions: RefineAction[] = ['tighten', 'warm', 'disclosures', 'derisk', 'simplify']

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          AI assist
        </span>
        {actions.map((a) => (
          <Button
            key={a}
            variant="secondary"
            size="sm"
            loading={busy === a}
            disabled={!!busy}
            icon={busy !== a ? <IconSparkles size={14} /> : undefined}
            onClick={() => refine(a)}
          >
            {REFINE_META[a].label}
          </Button>
        ))}
      </div>
      <input
        className={cn(fieldCls, 'font-semibold')}
        value={title}
        onChange={(e) => commit(e.target.value, body)}
        placeholder="Draft title"
      />
      <textarea
        ref={taRef}
        className={cn(fieldCls, 'font-mono text-[13px] leading-relaxed')}
        rows={16}
        value={body}
        onChange={(e) => commit(title, e.target.value)}
        spellCheck
      />
      <p className="flex items-start gap-1.5 text-xs text-ink-400">
        <IconAlert size={13} className="mt-0.5 shrink-0" />
        Edits re-score brand-match and the compliance preview live, and carry to Visuals.
        Placeholders like [APR] are preserved — approved figures are added at the compliance gate.
      </p>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

/** Split a markdown draft into its title (first # line) and body. */
function parseDraft(md: string): { title: string; body: string } {
  const lines = md.trim().split('\n')
  const idx = lines.findIndex((l) => l.startsWith('# '))
  if (idx === -1) return { title: 'Untitled draft', body: md.trim() }
  const title = lines[idx].replace(/^#\s+/, '').trim()
  const body = lines.slice(idx + 1).join('\n').trim()
  return { title, body }
}

function buildExportMarkdown(
  topicTitle: string,
  brief: ContentBrief,
  chosen: DraftVariant | null,
): string {
  const lines: string[] = [`# Brief & Draft — ${topicTitle}`, '']
  lines.push('## Brief', '')
  lines.push(`**Objective:** ${brief.objective}`, '')
  lines.push(`**Audience:** ${brief.audience}`, '')
  lines.push(`**Angle:** ${brief.angle}`, '')
  lines.push('**Key messages:**', ...brief.keyMessages.map((m) => `- ${m}`), '')
  lines.push('**Outline:**', ...brief.structure.map((s, i) => `${i + 1}. ${s}`), '')
  lines.push(`**SEO keywords:** ${brief.seoKeywords.join(', ')}`, '')
  lines.push('**Mandatory disclosures:**', ...brief.mandatoryDisclosures.map((d) => `- ${d}`), '')
  if (chosen) {
    lines.push('', `## Chosen draft — ${chosen.modelLabel} (brand-match ${chosen.brandMatch.score})`, '')
    lines.push(`# ${chosen.title}`, '', chosen.body)
  }
  lines.push('', '_Synthetic illustrative copy — placeholders require compliance-approved figures. Decision support, not legal advice._')
  return lines.join('\n')
}
