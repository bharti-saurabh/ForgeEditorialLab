import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SectionTitle, EmptyState } from '@/components/EmptyState'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { ChannelChip } from '@/components/ChannelChip'
import { PostPreview } from '@/components/PostPreview'
import { channelSpec, isImageChannel } from '@/lib/channels'
import { findTopic } from '@/lib/topics'
import {
  suggestedSlots,
  buildImagePrompt,
  buildVisualTextPrompt,
  demoVisualText,
  assessBrandSafety,
  assessAltText,
  SAFETY_VISION_SYSTEM,
  buildSafetyVisionPrompt,
  VISUAL_TEXT_SYSTEM,
  type VisualSlot,
} from '@/lib/prompts/visual'
import { buildBrandMockSvg } from '@/lib/visualMock'
import { runImage, runChat, runVision } from '@/lib/router/router'
import { friendlyModel } from '@/lib/router/roles'
import { estimateCostUsd, fmtUsd } from '@/lib/router/pricing'
import { scanText } from '@/lib/complianceEngine'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import { parseJsonLoose } from '@/lib/json'
import { uid, fmtMs } from '@/lib/format'
import type { VisualAsset, VisualSafety } from '@/types'
import {
  IconImage,
  IconBolt,
  IconChevron,
  IconShield,
  IconCheck,
  IconAlert,
  IconRoute,
} from '@/components/icons'
import { cn } from '@/lib/cn'

/** Image models offered in the Step 3 variant bake-off. */
const IMAGE_BAKEOFF = ['gemini-2.5-flash-image', 'gpt-image-1', 'dall-e-3']

function groupByTitle(visuals: VisualAsset[]): Record<string, VisualAsset[]> {
  const m: Record<string, VisualAsset[]> = {}
  for (const v of visuals) (m[v.title] ??= []).push(v)
  return m
}

export function VisualAssetsView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const settings = useAppStore((s) => s.settings)
  const pipeline = useAppStore((s) => s.pipeline)
  const addVisual = useAppStore((s) => s.addVisual)
  const updateVisual = useAppStore((s) => s.updateVisual)
  const removeVisual = useAppStore((s) => s.removeVisual)

  const topic = useMemo(
    () => findTopic(pipeline.selectedTopicId, pipeline.userTopics),
    [pipeline.selectedTopicId, pipeline.userTopics],
  )
  const chosenDraft = pipeline.drafts.find((d) => d.id === pipeline.chosenDraftId) ?? null
  const headline = chosenDraft?.title ?? topic?.title ?? ''
  const primaryChannel = pipeline.primaryChannel
  const channel = useMemo(() => channelSpec(primaryChannel), [primaryChannel])
  const imageChannel = isImageChannel(primaryChannel)
  const slots = useMemo(() => suggestedSlots(channel), [channel])

  const visuals = pipeline.visuals
  const heroVisual = visuals.find((v) => v.role === 'hero') ?? visuals[0] ?? null

  // In-memory variant candidates per slot (seeded from persisted chosen visuals).
  // Only the SELECTED variant is persisted — keeps heavy base64 images out of storage.
  const [variants, setVariants] = useState<Record<string, VisualAsset[]>>(() => groupByTitle(visuals))
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [activeSlotTitle, setActiveSlotTitle] = useState(slots[0]?.title ?? '')
  const [imageModel, setImageModel] = useState(settings.models.image)
  const [runningKey, setRunningKey] = useState<string | null>(null)

  // Rebuild slot state when the channel (and thus its slots) changes.
  useEffect(() => {
    setActiveSlotTitle(slots[0]?.title ?? '')
    if (topic) {
      const next: Record<string, string> = {}
      for (const s of slots) next[s.title] = buildImagePrompt(profile, topic, headline, s)
      setPrompts(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryChannel])

  if (!topic) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle
          title="Step 3 · Visual Assets"
          description="Generate on-brand visuals for the piece."
        />
        <EmptyState
          icon={<IconImage size={22} />}
          title="Pick a topic first"
          description="Visuals are built for a specific piece. Start in Topic Intelligence, then draft it."
          action={
            <Button variant="primary" icon={<IconChevron size={15} />} onClick={() => setView('step-1')}>
              Go to Topic Intelligence
            </Button>
          }
        />
      </div>
    )
  }

  const activeSlot = slots.find((s) => s.title === activeSlotTitle) ?? slots[0] ?? null
  const promptFor = (slot: VisualSlot) =>
    prompts[slot.title] ?? buildImagePrompt(profile, topic, headline, slot)
  const chosenForSlot = (title: string) => visuals.find((v) => v.title === title) ?? null
  const activeVariants = activeSlot ? variants[activeSlot.title] ?? [] : []

  /** Persist a variant as the slot's chosen visual (replaces any prior one). */
  function selectVariant(title: string, v: VisualAsset) {
    for (const existing of visuals.filter((x) => x.title === title && x.id !== v.id))
      removeVisual(existing.id)
    if (!visuals.some((x) => x.id === v.id)) addVisual(v)
  }

  /** Generate one image variant for a slot (across the chosen image model). */
  async function generateVariant(slot: VisualSlot, modelId: string) {
    const key = `${slot.title}::${modelId}`
    setRunningKey(key)
    const seed = Math.floor(performance.now()) % 999
    const prompt = promptFor(slot)
    try {
      const img = await runImage({
        step: `Step 3 · ${slot.title}`,
        prompt,
        modelId,
        reason: 'Purpose-built image model — renders an on-brand visual from a grounded prompt.',
        size: slot.size,
        demo: () =>
          buildBrandMockSvg({
            profile,
            headline,
            subhead: profile.messaging.valueProps[0] ?? '',
            cta: profile.messaging.ctas[0] ?? 'Learn more',
            seed,
            square: slot.square,
          }),
      })
      const txt = await runChat({
        role: 'copy',
        step: `Step 3 · ${slot.title} caption`,
        system: VISUAL_TEXT_SYSTEM,
        user: buildVisualTextPrompt(profile, headline, slot),
        reason: 'Text model — writes caption + accessible alt text alongside the generated image.',
        maxTokens: 300,
        demo: () => JSON.stringify(demoVisualText(profile, headline, slot)),
      })
      const parsed =
        parseJsonLoose<{ caption?: string; altText?: string }>(txt.text) ??
        demoVisualText(profile, headline, slot)
      const caption = parsed.caption ?? ''

      // Brand safety: real VISION read on live images; heuristic for demo/mock.
      let safety = assessBrandSafety(`${prompt} ${caption}`, profile)
      let safetyModelLabel: VisualAsset['safetyModelLabel']
      let safetyMode: VisualAsset['safetyMode']
      if (img.mode === 'live') {
        const vis = await runVision({
          step: `Step 3 · ${slot.title} safety`,
          text: buildSafetyVisionPrompt(profile, caption),
          imageUrl: img.url,
          system: SAFETY_VISION_SYSTEM,
          reason: 'Vision model — reads the rendered image for net-impression / brand-safety risk.',
          demo: () => JSON.stringify(assessBrandSafety(`${prompt} ${caption}`, profile)),
        })
        const parsedSafety = parseJsonLoose<VisualSafety>(vis.text)
        if (parsedSafety?.status && Array.isArray(parsedSafety.notes)) safety = parsedSafety
        safetyModelLabel = vis.entry.modelLabel
        safetyMode = vis.mode
      }

      const variant: VisualAsset = {
        id: uid('vis'),
        role: slot.role,
        title: slot.title,
        prompt,
        url: img.url,
        imageModelLabel: img.entry.modelLabel,
        imageMode: img.mode,
        imageLatencyMs: img.entry.latencyMs,
        costUsd: estimateCostUsd(img.entry.modelId, 'image', img.entry.usage),
        caption,
        altText: parsed.altText ?? '',
        textModelLabel: txt.entry.modelLabel,
        textMode: txt.mode,
        safety,
        safetyModelLabel,
        safetyMode,
        generatedAt: img.entry.ts,
      }
      setVariants((prev) => ({ ...prev, [slot.title]: [variant, ...(prev[slot.title] ?? [])] }))
      // Auto-select the first variant so a slot always has a chosen visual.
      if (!chosenForSlot(slot.title)) selectVariant(slot.title, variant)
      pushToast('success', `${slot.title} variant added (${friendlyModel(modelId)}).`)
    } catch {
      pushToast('error', `Could not generate the ${slot.title.toLowerCase()}.`)
    } finally {
      setRunningKey(null)
    }
  }

  const exportMd = buildExportMarkdown(topic.title, visuals)
  const canContinue = visuals.length > 0 || !imageChannel

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Step 3 · Visual Assets"
        description="Generate image variants per slot, compare on brand-safety + cost, and pick the winner."
        actions={
          <div className="flex items-center gap-2">
            <ChannelChip />
            {canContinue && (
              <Button
                variant="primary"
                size="sm"
                icon={<IconChevron size={15} />}
                onClick={() => setView('step-4')}
              >
                Continue to Compliance
              </Button>
            )}
            <ExportButton
              name={`visuals-${topic.id}`}
              json={{ topic: topic.title, headline, visuals }}
              markdown={exportMd}
            />
          </div>
        }
      />

      {!chosenDraft && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-sm text-amber-900">
          <span>No chosen draft yet — visuals will use the topic title as the headline.</span>
          <Button variant="secondary" size="sm" onClick={() => setView('step-2')}>
            Finish the draft
          </Button>
        </div>
      )}

      {imageChannel && activeSlot ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,300px)_1fr]">
          {/* LEFT — slots */}
          <div className="space-y-4 lg:sticky lg:top-4">
            <Card>
              <CardHeader icon={<IconImage size={18} />} title="Visual slots" subtitle={channel.label} />
              <CardBody className="space-y-2">
                {slots.map((slot) => {
                  const count = (variants[slot.title] ?? []).length
                  const chosen = chosenForSlot(slot.title)
                  const active = slot.title === activeSlotTitle
                  return (
                    <button
                      key={slot.title}
                      onClick={() => setActiveSlotTitle(slot.title)}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left transition',
                        active
                          ? 'border-straive-400 bg-straive-50/40 ring-1 ring-straive-200'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900">{slot.title}</span>
                        <Badge tone={slot.role === 'hero' ? 'navy' : 'neutral'} className="capitalize">
                          {slot.role}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                        <span>{count} variant{count === 1 ? '' : 's'}</span>
                        {chosen && (
                          <span className="inline-flex items-center gap-0.5 text-ok">
                            <IconCheck size={11} /> selected
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </CardBody>
            </Card>

            <div className="grid gap-3">
              <Disclaimer kind="legal" />
              <Disclaimer kind="illustrative" />
            </div>
          </div>

          {/* RIGHT — variant bake-off for the active slot */}
          <div className="space-y-5">
            <Card>
              <CardHeader
                icon={<IconRoute size={18} />}
                title={`${activeSlot.title} — variant bake-off`}
                subtitle={`${activeSlot.ratio} · grounded in the brand palette, imagery style, and lockup rules.`}
                actions={
                  activeVariants.length > 0 ? (
                    <Badge tone="neutral">{activeVariants.length} variant{activeVariants.length > 1 ? 's' : ''}</Badge>
                  ) : undefined
                }
              />
              <CardBody className="space-y-3">
                <div className="space-y-2 rounded-xl border border-ink-200 bg-ink-50/50 p-3">
                  <label className="block text-xs font-medium text-ink-600">
                    Image model
                    <input
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                      className="mt-1 block h-9 w-full rounded-lg border border-ink-200 bg-white px-3 font-mono text-xs text-ink-800 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink-400">Try:</span>
                    {IMAGE_BAKEOFF.map((m) => (
                      <button
                        key={m}
                        onClick={() => setImageModel(m)}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs font-medium transition',
                          imageModel === m
                            ? 'border-straive-300 bg-straive-50 text-straive-700'
                            : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                        )}
                      >
                        {friendlyModel(m)}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    icon={<IconBolt size={15} />}
                    loading={runningKey === `${activeSlot.title}::${imageModel}`}
                    disabled={!!runningKey || !imageModel.trim()}
                    onClick={() => generateVariant(activeSlot, imageModel.trim())}
                  >
                    {activeVariants.length ? 'Generate another variant' : 'Generate variant'}
                  </Button>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-ink-500 hover:text-ink-800">Edit image prompt</summary>
                    <textarea
                      value={promptFor(activeSlot)}
                      onChange={(e) =>
                        setPrompts((p) => ({ ...p, [activeSlot.title]: e.target.value }))
                      }
                      rows={3}
                      className="mt-1.5 w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-700 focus:border-straive-400 focus:outline-none"
                    />
                  </details>
                </div>

                {activeVariants.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-400">
                    No variants yet — generate one (or several models) and pick the strongest.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeVariants.map((v) => (
                      <VariantCard
                        key={v.id}
                        visual={v}
                        selected={chosenForSlot(activeSlot.title)?.id === v.id}
                        onSelect={() => selectVariant(activeSlot.title, v)}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* selected visual — editable caption/alt + checks */}
            {(() => {
              const chosen = chosenForSlot(activeSlot.title)
              if (!chosen) return null
              return (
                <Card>
                  <CardHeader
                    icon={<IconCheck size={18} />}
                    title="Selected visual"
                    subtitle="Edit the caption and alt text; the checks re-run as you type."
                    actions={<ModelTag role="image" modelLabel={chosen.imageModelLabel} mode={chosen.imageMode} />}
                  />
                  <CardBody>
                    <SelectedVisualPanel
                      visual={chosen}
                      onCaptionChange={(caption) => updateVisual(chosen.id, { caption, edited: true })}
                      onAltChange={(altText) => updateVisual(chosen.id, { altText, edited: true })}
                    />
                  </CardBody>
                </Card>
              )
            })()}
          </div>
        </div>
      ) : (
        /* text-ad surface (SEM): no image to generate */
        <Card className="mb-5">
          <CardHeader
            icon={<IconImage size={18} />}
            title={`${channel.label} — text ad`}
            subtitle="This surface is text-only. There's no hero image to generate; the posted preview below is the deliverable."
          />
          <CardBody>
            <Disclaimer kind="legal" />
          </CardBody>
        </Card>
      )}

      {/* posted preview — how the piece looks on this surface, BEFORE the gate */}
      <Card className="mt-5">
        <CardHeader
          icon={<IconImage size={18} />}
          title="Posted preview"
          subtitle="How this piece will appear on the chosen channel — reviewed here before it reaches compliance."
        />
        <CardBody>
          <PostPreview channel={primaryChannel} profile={profile} draft={chosenDraft} visual={heroVisual} />
        </CardBody>
      </Card>
    </div>
  )
}

/** One image candidate in the slot bake-off. */
function VariantCard({
  visual,
  selected,
  onSelect,
}: {
  visual: VisualAsset
  selected: boolean
  onSelect: () => void
}) {
  const safe = visual.safety.status === 'pass'
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-white transition',
        selected ? 'border-straive-400 ring-1 ring-straive-200' : 'border-ink-200',
      )}
    >
      <div className="relative bg-ink-100">
        {visual.url ? (
          <img src={visual.url} alt={visual.altText || visual.title} className="w-full object-cover" />
        ) : (
          <div className="flex aspect-[3/2] w-full items-center justify-center px-4 text-center text-xs text-ink-500">
            Image not stored across reloads — regenerate to view it.
          </div>
        )}
        {selected && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-straive-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            <IconCheck size={11} /> Selected
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-ink-500">
        <ModelTag role="image" modelLabel={visual.imageModelLabel} mode={visual.imageMode} />
        <span className="tabular-nums">
          {fmtMs(visual.imageLatencyMs)} · {visual.costUsd !== undefined ? fmtUsd(visual.costUsd) : '—'}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold',
          safe ? 'text-ok' : 'text-warn',
        )}
      >
        {safe ? <IconShield size={12} /> : <IconAlert size={12} />}
        Brand safety: {safe ? 'Pass' : 'Review'}
        {visual.safetyModelLabel && <span className="font-normal text-ink-400">· vision read</span>}
      </div>
      <div className="mt-auto border-t border-ink-100 p-2">
        <Button
          variant={selected ? 'secondary' : 'primary'}
          size="sm"
          className="w-full"
          icon={selected ? <IconCheck size={14} /> : undefined}
          onClick={onSelect}
        >
          {selected ? 'Selected' : 'Use this'}
        </Button>
      </div>
    </div>
  )
}

/** Editable caption + alt text + the three checks for the chosen visual. */
function SelectedVisualPanel({
  visual,
  onCaptionChange,
  onAltChange,
}: {
  visual: VisualAsset
  onCaptionChange: (c: string) => void
  onAltChange: (a: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const captionIssues = useMemo(() => scanText(visual.caption, SEED_RULEBOOK, 'copy'), [visual.caption])
  const altCheck = useMemo(() => assessAltText(visual.altText, visual.title), [visual.altText, visual.title])
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Caption & alt text</span>
          <div className="flex items-center gap-1.5">
            {visual.edited && <Badge tone="info">Edited</Badge>}
            <button
              onClick={() => setEditing((e) => !e)}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
            >
              {editing ? 'Done' : 'Edit text'}
            </button>
          </div>
        </div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Caption</div>
        {editing ? (
          <textarea
            value={visual.caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            rows={2}
            className="mb-3 w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
          />
        ) : (
          <p className="mb-3 text-sm text-ink-700">{visual.caption}</p>
        )}
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Alt text</div>
        {editing ? (
          <textarea
            value={visual.altText}
            onChange={(e) => onAltChange(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
          />
        ) : (
          <p className="text-xs italic text-ink-500">{visual.altText}</p>
        )}
      </div>
      <VisualChecks visual={visual} captionIssues={captionIssues} altCheck={altCheck} />
    </div>
  )
}

/** Three labeled reads on a visual: image safety, caption compliance, alt-text a11y. */
function VisualChecks({
  visual,
  captionIssues,
  altCheck,
}: {
  visual: VisualAsset
  captionIssues: ReturnType<typeof scanText>
  altCheck: { ok: boolean; notes: string[] }
}) {
  const safe = visual.safety.status === 'pass'
  const captionOk = captionIssues.length === 0
  return (
    <div className="space-y-2">
      <CheckBlock
        ok={safe}
        title={`Brand safety (image): ${safe ? 'Pass' : 'Needs review'}`}
        extra={
          visual.safetyModelLabel ? (
            <ModelTag role="vision" modelLabel={visual.safetyModelLabel} mode={visual.safetyMode ?? 'demo'} />
          ) : (
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
              Text heuristic
            </span>
          )
        }
        notes={visual.safety.notes}
      />
      <CheckBlock
        ok={captionOk}
        title={`Caption compliance: ${captionOk ? 'No risky terms' : `${captionIssues.length} flag(s)`}`}
        notes={
          captionOk
            ? ['Caption carries no rule-triggering terms (preview — the gate is Step 4).']
            : captionIssues.map((i) => `${i.title} — ${i.citation}`)
        }
      />
      <CheckBlock
        ok={altCheck.ok}
        title={`Alt text (accessibility): ${altCheck.ok ? 'Good' : 'Review'}`}
        notes={altCheck.notes}
      />
    </div>
  )
}

function CheckBlock({
  ok,
  title,
  extra,
  notes,
}: {
  ok: boolean
  title: string
  extra?: ReactNode
  notes: string[]
}) {
  return (
    <div className={cn('rounded-lg border px-3 py-2', ok ? 'border-ok/25 bg-ok/5' : 'border-warn/30 bg-warn/5')}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-1.5 text-xs font-semibold', ok ? 'text-ok' : 'text-warn')}>
          {ok ? <IconShield size={14} /> : <IconAlert size={14} />}
          {title}
        </div>
        {extra}
      </div>
      <ul className="space-y-0.5">
        {notes.map((n, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-ink-600">
            <IconCheck size={11} className="mt-0.5 shrink-0 text-ink-400" />
            {n}
          </li>
        ))}
      </ul>
    </div>
  )
}

function buildExportMarkdown(topicTitle: string, visuals: VisualAsset[]): string {
  const lines: string[] = [`# Visual Assets — ${topicTitle}`, '']
  if (!visuals.length) lines.push('_No visuals selected yet._')
  for (const v of visuals) {
    lines.push(`## ${v.title} (${v.role})`, '')
    lines.push(`**Caption:** ${v.caption}`, '')
    lines.push(`**Alt text:** ${v.altText}`, '')
    lines.push(`**Brand safety:** ${v.safety.status === 'pass' ? 'Pass' : 'Needs review'}`)
    lines.push(...v.safety.notes.map((n) => `- ${n}`), '')
    lines.push('**Image prompt:**', '', '```', v.prompt, '```', '')
  }
  lines.push('_Illustrative concepts — not final creative. Decision support, not legal advice._')
  return lines.join('\n')
}
