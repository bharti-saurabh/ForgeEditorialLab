import { useMemo, useState } from 'react'
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
import { SEED_TOPIC_BACKLOG } from '@/seed/topicBacklog'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import { disclosuresForTopic, rulesForTopic } from '@/lib/compliance'
import {
  BRIEF_SYSTEM,
  buildBriefPrompt,
  demoBrief,
  DRAFT_SYSTEM,
  buildDraftPrompt,
  demoDraft,
  voiceDirectives,
} from '@/lib/prompts/draft'
import { runChat } from '@/lib/router/router'
import { brandMatchScore } from '@/lib/brand/grounding'
import { friendlyModel } from '@/lib/router/roles'
import { parseJsonLoose } from '@/lib/json'
import { uid, fmtMs, fmtDateTime } from '@/lib/format'
import type { ContentBrief, DraftVariant, VoiceControls } from '@/types'
import {
  IconDoc,
  IconBolt,
  IconSparkles,
  IconShield,
  IconChevron,
  IconTrash,
  IconCheck,
  IconRoute,
} from '@/components/icons'
import { cn } from '@/lib/cn'

const BAKEOFF_SUGGESTIONS = ['claude-sonnet-5', 'gpt-5.4', 'gemini-2.5-pro']

export function BriefDraftView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const settings = useAppStore((s) => s.settings)
  const pipeline = useAppStore((s) => s.pipeline)
  const setBrief = useAppStore((s) => s.setBrief)
  const updateVoice = useAppStore((s) => s.updateVoice)
  const addDraft = useAppStore((s) => s.addDraft)
  const removeDraft = useAppStore((s) => s.removeDraft)
  const chooseDraft = useAppStore((s) => s.chooseDraft)

  const topic = useMemo(
    () => SEED_TOPIC_BACKLOG.find((t) => t.id === pipeline.selectedTopicId) ?? null,
    [pipeline.selectedTopicId],
  )

  const disclosures = useMemo(
    () => (topic ? disclosuresForTopic(topic, SEED_RULEBOOK, profile) : []),
    [topic, profile],
  )
  const watchRules = useMemo(
    () => (topic ? rulesForTopic(topic, SEED_RULEBOOK) : []),
    [topic],
  )

  const [briefRunning, setBriefRunning] = useState(false)
  const [draftModel, setDraftModel] = useState(settings.models.text)
  const [draftRunningModel, setDraftRunningModel] = useState<string | null>(null)

  const { brief, voice, drafts, chosenDraftId } = pipeline
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
        user: buildBriefPrompt(profile, topic, disclosures),
        reason: 'Reasoning model — converts one topic into a structured, executable brief.',
        maxTokens: 700,
        demo: () => JSON.stringify(demoBrief(profile, topic)),
      })
      const parsed = parseJsonLoose<Partial<ContentBrief>>(text) ?? demoBrief(profile, topic)
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
        user: buildDraftPrompt(profile, brief, voice),
        modelId,
        reason: 'Brand-voice copywriter — drafts on-brand copy following the learned voice profile.',
        maxTokens: 1200,
        demo: () => demoDraft(profile, brief, topic, voice, modelId),
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
  const exportMd = brief ? buildExportMarkdown(topic.title, brief, chosen) : undefined

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

      <Disclaimer kind="legal" className="mb-5" />

      {/* brief */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconDoc size={18} />}
          title="Content brief"
          subtitle="Objective, angle, structure, and the disclosures the copy must carry."
          actions={
            <Button
              variant={brief ? 'secondary' : 'primary'}
              size="sm"
              loading={briefRunning}
              icon={!briefRunning ? <IconBolt size={15} /> : undefined}
              onClick={generateBrief}
            >
              {brief ? 'Regenerate' : 'Generate brief'}
            </Button>
          }
        />
        <CardBody>
          {brief ? (
            <BriefBody brief={brief} watchRules={watchRules} />
          ) : (
            <EmptyState
              icon={<IconDoc size={20} />}
              title="No brief yet"
              description="Generate a brief to define the objective, angle, structure, and mandatory disclosures before drafting."
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
                  chosen={d.id === chosenDraftId}
                  isTop={drafts.length > 1 && d.brandMatch.score === topScore}
                  onChoose={() => chooseDraft(d.id)}
                  onRemove={() => removeDraft(d.id)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
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
  chosen,
  isTop,
  onChoose,
  onRemove,
}: {
  draft: DraftVariant
  chosen: boolean
  isTop: boolean
  onChoose: () => void
  onRemove: () => void
}) {
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
          <Metric label="On-voice hits" value={draft.brandMatch.hit.length} />
        </div>
      </div>

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
