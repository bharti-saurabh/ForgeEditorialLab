import { useEffect, useMemo, useState } from 'react'
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
  VISUAL_TEXT_SYSTEM,
  type VisualSlot,
} from '@/lib/prompts/visual'
import { buildBrandMockSvg } from '@/lib/visualMock'
import { runImage, runChat } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import { uid, fmtMs } from '@/lib/format'
import type { VisualAsset } from '@/types'
import {
  IconImage,
  IconBolt,
  IconChevron,
  IconTrash,
  IconRefresh,
  IconShield,
  IconCheck,
  IconAlert,
} from '@/components/icons'
import { cn } from '@/lib/cn'

export function VisualAssetsView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
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

  const [slotPrompts, setSlotPrompts] = useState<string[]>(() =>
    topic ? slots.map((s) => buildImagePrompt(profile, topic, headline, s)) : [],
  )
  const [runningKey, setRunningKey] = useState<string | null>(null)

  // Rebuild the editable slot prompts when the channel (and thus its slots)
  // changes — a paid-social square prompt shouldn't linger after switching to blog.
  useEffect(() => {
    setSlotPrompts(topic ? slots.map((s) => buildImagePrompt(profile, topic, headline, s)) : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryChannel])

  const visuals = pipeline.visuals
  const heroVisual = visuals.find((v) => v.role === 'hero') ?? visuals[0] ?? null

  // Resolve a slot (size/ratio) for regenerating an existing visual.
  const slotForVisual = (v: VisualAsset): VisualSlot =>
    slots.find((s) => s.title === v.title) ??
    slots[0] ?? {
      role: v.role,
      title: v.title,
      intent: '',
      size: v.role === 'hero' ? '1536x1024' : '1024x1024',
      square: v.role !== 'hero',
      ratio: v.role === 'hero' ? '16:9' : '1:1',
    }

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

  async function generate(slot: VisualSlot, prompt: string, existingId?: string) {
    if (!topic) return
    const key = existingId ?? `slot-${slot.title}`
    setRunningKey(key)
    const square = slot.square
    const seed = Math.floor(performance.now()) % 999
    try {
      // 1) image (image model)
      const img = await runImage({
        step: `Step 3 · ${slot.title}`,
        prompt,
        reason: 'Purpose-built image model — renders an on-brand visual from a grounded prompt.',
        size: slot.size,
        demo: () =>
          buildBrandMockSvg({
            profile,
            headline,
            subhead: profile.messaging.valueProps[0] ?? '',
            cta: profile.messaging.ctas[0] ?? 'Learn more',
            seed,
            square,
          }),
      })
      // 2) caption + alt text (text model)
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
      const safety = assessBrandSafety(`${prompt} ${parsed.caption ?? ''}`, profile)

      const base: Omit<VisualAsset, 'id'> = {
        role: slot.role,
        title: slot.title,
        prompt,
        url: img.url,
        imageModelLabel: img.entry.modelLabel,
        imageMode: img.mode,
        imageLatencyMs: img.entry.latencyMs,
        caption: parsed.caption ?? '',
        altText: parsed.altText ?? '',
        textModelLabel: txt.entry.modelLabel,
        textMode: txt.mode,
        safety,
        generatedAt: img.entry.ts,
      }

      if (existingId) {
        updateVisual(existingId, base)
        pushToast('success', `${slot.title} regenerated.`)
      } else {
        addVisual({ ...base, id: uid('vis') })
        pushToast('success', `${slot.title} generated.`)
      }
    } catch {
      pushToast('error', `Could not generate the ${slot.title.toLowerCase()}.`)
    } finally {
      setRunningKey(null)
    }
  }

  const exportMd = buildExportMarkdown(topic.title, visuals)

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Step 3 · Visual Assets"
        description="On-brand hero + supporting visuals — prompts auto-built from the visual identity."
        actions={
          <div className="flex items-center gap-2">
            <ChannelChip />
            {(visuals.length > 0 || !imageChannel) && (
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

      {imageChannel ? (
        <>
          {/* generator slots */}
          <Card className="mb-5">
            <CardHeader
              icon={<IconImage size={18} />}
              title="Visual set"
              subtitle={`Aspect ratios for ${channel.label}. Each prompt is grounded in the brand palette, imagery style, and lockup rules.`}
            />
            <CardBody className="space-y-4">
              {slots.map((slot, i) => (
                <div key={slot.title} className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900">{slot.title}</span>
                      <Badge tone={slot.role === 'hero' ? 'navy' : 'neutral'} className="capitalize">
                        {slot.role}
                      </Badge>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={runningKey === `slot-${slot.title}`}
                      icon={runningKey !== `slot-${slot.title}` ? <IconBolt size={14} /> : undefined}
                      disabled={!!runningKey}
                      onClick={() => generate(slot, slotPrompts[i] ?? '')}
                    >
                      Generate
                    </Button>
                  </div>
                  <textarea
                    value={slotPrompts[i] ?? ''}
                    onChange={(e) =>
                      setSlotPrompts((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))
                    }
                    rows={3}
                    className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-ink-700 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
                  />
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <Disclaimer kind="legal" />
            <Disclaimer kind="illustrative" />
          </div>

          {/* generated visuals */}
          {visuals.length === 0 ? (
            <EmptyState
              icon={<IconImage size={20} />}
              title="No visuals yet"
              description="Generate a hero and supporting visuals above. Each pairs the image model's render with a text-model caption and a brand-safety read."
            />
          ) : (
            <div className="space-y-4">
              {visuals.map((v) => (
                <VisualCard
                  key={v.id}
                  visual={v}
                  running={runningKey === v.id}
                  disabled={!!runningKey}
                  onPromptChange={(prompt) => updateVisual(v.id, { prompt })}
                  onRegenerate={() => generate(slotForVisual(v), v.prompt, v.id)}
                  onRemove={() => removeVisual(v.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* text-ad surface (SEM): no image to generate — the preview IS the asset */
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
          <PostPreview
            channel={primaryChannel}
            profile={profile}
            draft={chosenDraft}
            visual={heroVisual}
          />
        </CardBody>
      </Card>
    </div>
  )
}

function VisualCard({
  visual,
  running,
  disabled,
  onPromptChange,
  onRegenerate,
  onRemove,
}: {
  visual: VisualAsset
  running: boolean
  disabled: boolean
  onPromptChange: (p: string) => void
  onRegenerate: () => void
  onRemove: () => void
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const safe = visual.safety.status === 'pass'
  return (
    <Card>
      <div className="grid gap-0 md:grid-cols-2">
        {/* image side */}
        <div className="flex flex-col border-b border-ink-100 md:border-b-0 md:border-r">
          <div className="relative bg-ink-100">
            {visual.url ? (
              <img
                src={visual.url}
                alt={visual.altText || visual.title}
                className={cn('w-full object-cover', running && 'opacity-40')}
              />
            ) : (
              <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-1 px-4 text-center text-xs text-ink-500">
                <span className="font-medium text-ink-600">Image not stored across reloads</span>
                <span>Generated images stay in memory only — regenerate to view it again.</span>
              </div>
            )}
            {running && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-500">
            <ModelTag role="image" modelLabel={visual.imageModelLabel} mode={visual.imageMode} />
            <span>{fmtMs(visual.imageLatencyMs)}</span>
          </div>
        </div>

        {/* text side */}
        <div className="flex flex-col p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink-900">{visual.title}</span>
              <Badge tone={visual.role === 'hero' ? 'navy' : 'neutral'} className="capitalize">
                {visual.role}
              </Badge>
            </div>
            <button
              onClick={onRemove}
              aria-label="Remove visual"
              className="text-ink-300 transition hover:text-crit"
            >
              <IconTrash size={15} />
            </button>
          </div>

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Caption
          </div>
          <p className="mb-3 text-sm text-ink-700">{visual.caption}</p>

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Alt text
          </div>
          <p className="mb-3 text-xs italic text-ink-500">{visual.altText}</p>

          <div className="mb-3 flex items-center gap-2">
            <ModelTag role="copy" modelLabel={visual.textModelLabel} mode={visual.textMode} />
          </div>

          {/* brand safety */}
          <div
            className={cn(
              'rounded-lg border px-3 py-2',
              safe ? 'border-ok/25 bg-ok/5' : 'border-warn/30 bg-warn/5',
            )}
          >
            <div
              className={cn(
                'mb-1 flex items-center gap-1.5 text-xs font-semibold',
                safe ? 'text-ok' : 'text-warn',
              )}
            >
              {safe ? <IconShield size={14} /> : <IconAlert size={14} />}
              Brand safety: {safe ? 'Pass' : 'Needs review'}
            </div>
            <ul className="space-y-0.5">
              {visual.safety.notes.map((n, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-ink-600">
                  <IconCheck size={11} className="mt-0.5 shrink-0 text-ink-400" />
                  {n}
                </li>
              ))}
            </ul>
          </div>

          {/* prompt + regenerate */}
          <div className="mt-3">
            <button
              onClick={() => setShowPrompt((s) => !s)}
              className="text-xs font-medium text-ink-500 hover:text-ink-800"
            >
              {showPrompt ? 'Hide' : 'Edit'} image prompt
            </button>
            {showPrompt && (
              <textarea
                value={visual.prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-700 focus:border-straive-400 focus:outline-none"
              />
            )}
          </div>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              loading={running}
              icon={!running ? <IconRefresh size={14} /> : undefined}
              disabled={disabled}
              onClick={onRegenerate}
            >
              Regenerate
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function buildExportMarkdown(topicTitle: string, visuals: VisualAsset[]): string {
  const lines: string[] = [`# Visual Assets — ${topicTitle}`, '']
  if (!visuals.length) lines.push('_No visuals generated yet._')
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
