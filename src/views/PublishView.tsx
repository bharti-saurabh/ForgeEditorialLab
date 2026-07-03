import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SectionTitle, EmptyState, Stat } from '@/components/EmptyState'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { Markdown } from '@/components/Markdown'
import { PostPreview } from '@/components/PostPreview'
import { findTopic } from '@/lib/topics'
import { channelSpec } from '@/lib/channels'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import { disclosuresForTopic } from '@/lib/compliance'
import { buildCleanVersion, currentScore, contentSignature } from '@/lib/complianceEngine'
import { CHANNELS, channelMeta, recheckChannel, type ChannelMeta } from '@/lib/publish'
import {
  PUBLISH_SYSTEM,
  buildAdaptationPrompt,
  demoAdaptation,
  adaptationText,
  type AdaptationDraft,
} from '@/lib/prompts/publish'
import { runChat } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import { fmtDateTime } from '@/lib/format'
import type { ChannelAdaptation, ChannelKey, PublishPackage } from '@/types'
import {
  IconPackage,
  IconShield,
  IconChevron,
  IconBolt,
  IconRefresh,
  IconCheck,
  IconAlert,
  IconUsers,
} from '@/components/icons'
import { cn } from '@/lib/cn'

export function PublishView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const pipeline = useAppStore((s) => s.pipeline)
  const setPublish = useAppStore((s) => s.setPublish)

  const topic = useMemo(
    () => findTopic(pipeline.selectedTopicId, pipeline.userTopics),
    [pipeline.selectedTopicId, pipeline.userTopics],
  )
  const draft = pipeline.drafts.find((d) => d.id === pipeline.chosenDraftId) ?? null
  const compliance = pipeline.compliance
  const pkg = pipeline.publish

  const [running, setRunning] = useState(false)
  const [busyChannel, setBusyChannel] = useState<ChannelKey | null>(null)

  // Sign-off is only valid for the content it was recorded against — an edit
  // after sign-off makes it stale and blocks publish until the gate re-runs.
  const stale =
    !!compliance?.reviewedSig &&
    !!draft &&
    contentSignature(draft, pipeline.visuals) !== compliance.reviewedSig
  const signed =
    !!compliance?.signoff && compliance.signoff.decision !== 'rejected' && !stale

  // ── gates ──────────────────────────────────────────────────────────────
  if (!topic || !draft) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle title="Step 5 · Publish Package" description="Assemble the approved, channel-ready package." />
        <EmptyState
          icon={<IconPackage size={22} />}
          title="Nothing to package yet"
          description="Pick a topic and write a draft first, then clear the compliance gate."
          action={
            <Button variant="primary" icon={<IconChevron size={15} />} onClick={() => setView('step-1')}>
              Go to Topic Intelligence
            </Button>
          }
        />
      </div>
    )
  }

  if (!signed) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle title="Step 5 · Publish Package" description="Assemble the approved, channel-ready package." />
        <Disclaimer kind="legal" className="mb-4" />
        <EmptyState
          icon={<IconShield size={22} />}
          title={stale ? 'Sign-off is stale' : 'Compliance sign-off required'}
          description={
            stale
              ? 'The copy or visuals changed after sign-off. Re-run the compliance gate and re-approve before packaging.'
              : compliance?.signoff?.decision === 'rejected'
                ? 'This piece was rejected at the compliance gate. Send it back to Step 2 to revise before packaging.'
                : 'A named reviewer must approve the piece at the compliance gate before it can be packaged for publish.'
          }
          action={
            <Button variant="primary" icon={<IconShield size={15} />} onClick={() => setView('step-4')}>
              Go to the compliance gate
            </Button>
          }
        />
      </div>
    )
  }

  const disclosures = disclosuresForTopic(topic, SEED_RULEBOOK, profile)
  const masterCopy = buildCleanVersion(draft, compliance!)

  async function adaptOne(meta: ChannelMeta): Promise<ChannelAdaptation> {
    const { text, mode, entry } = await runChat({
      role: 'copy',
      step: `Step 5 · ${meta.label} adaptation`,
      system: PUBLISH_SYSTEM,
      user: buildAdaptationPrompt(profile, topic!, meta, masterCopy, disclosures),
      reason: `Copy model — reshapes the approved master copy for ${meta.label} without dropping material terms.`,
      maxTokens: 800,
      demo: () =>
        JSON.stringify(demoAdaptation(profile, topic!, meta.key, masterCopy, disclosures)),
    })
    const parsed =
      parseJsonLoose<AdaptationDraft>(text) ??
      demoAdaptation(profile, topic!, meta.key, masterCopy, disclosures)
    const adaptation: AdaptationDraft = {
      headline: parsed.headline ?? topic!.title,
      body: parsed.body ?? '',
      cta: parsed.cta ?? profile.messaging.ctas[0] ?? 'Learn more',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    }
    const recheck = recheckChannel(adaptationText(adaptation), disclosures, SEED_RULEBOOK, meta)
    return {
      channel: meta.key,
      label: meta.label,
      headline: adaptation.headline,
      body: adaptation.body,
      cta: adaptation.cta,
      hashtags: adaptation.hashtags,
      charCount: adaptation.body.length,
      charLimit: meta.charLimit,
      modelLabel: entry.modelLabel,
      mode,
      recheck,
      generatedAt: entry.ts,
    }
  }

  async function assemble() {
    setRunning(true)
    try {
      const channels: ChannelAdaptation[] = []
      for (const meta of CHANNELS) channels.push(await adaptOne(meta))
      const hero =
        pipeline.visuals.find((v) => v.role === 'hero') ?? pipeline.visuals[0] ?? null
      const next: PublishPackage = {
        assembledAt: Date.now(),
        topicTitle: topic!.title,
        masterCopy,
        channels,
        complianceScore: currentScore(compliance!),
        signedOffBy: compliance!.signoff?.reviewer ?? null,
        signOffDecision: compliance!.signoff?.decision ?? null,
        heroVisualId: hero?.id ?? null,
      }
      setPublish(next)
      const review = channels.filter((c) => c.recheck.status === 'review').length
      pushToast(
        review ? 'info' : 'success',
        review
          ? `Package assembled — ${review} channel(s) need a re-check look.`
          : 'Package assembled — all channels passed the re-check.',
      )
    } catch {
      pushToast('error', 'Could not assemble the package.')
    } finally {
      setRunning(false)
    }
  }

  async function regenerate(channel: ChannelKey) {
    if (!pkg) return
    setBusyChannel(channel)
    try {
      const updated = await adaptOne(channelMeta(channel))
      setPublish({
        ...pkg,
        channels: pkg.channels.map((c) => (c.channel === channel ? updated : c)),
      })
      pushToast('success', `${updated.label} re-adapted.`)
    } catch {
      pushToast('error', 'Could not re-adapt that channel.')
    } finally {
      setBusyChannel(null)
    }
  }

  const hero = pipeline.visuals.find((v) => v.id === pkg?.heroVisualId) ?? null
  const primaryChannel = pipeline.primaryChannel
  // Lead with the channel the piece was authored for; the rest are adaptations.
  const orderedChannels = pkg
    ? [...pkg.channels].sort(
        (a, b) => Number(b.channel === primaryChannel) - Number(a.channel === primaryChannel),
      )
    : []

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Step 5 · Publish Package"
        description="The approved copy + visuals + sign-off, adapted per channel with a re-check on each."
        actions={
          <div className="flex items-center gap-2">
            {pkg && (
              <Button variant="primary" size="sm" icon={<IconUsers size={15} />} onClick={() => setView('step-6')}>
                Validate in Persona Lab
              </Button>
            )}
            {pkg && (
              <Button variant="secondary" size="sm" loading={running} icon={!running ? <IconRefresh size={15} /> : undefined} onClick={assemble}>
                Re-assemble
              </Button>
            )}
            {pkg && (
              <ExportButton
                name={`publish-${topic.id}`}
                json={pkg}
                markdown={buildPackageMarkdown(pkg)}
                print
              />
            )}
          </div>
        }
      />

      <Disclaimer kind="legal" className="mb-5" />

      {!pkg ? (
        <Card>
          <CardBody className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-white">
              <IconPackage size={26} />
            </div>
            <h3 className="text-lg font-bold text-ink-900">Assemble the publish package</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
              Bundles the compliance-approved master copy, the hero visual, and the sign-off, then
              adapts the piece for {CHANNELS.map((c) => c.label).join(', ')} — running a lightweight
              compliance re-check on every channel so nothing slips.
            </p>
            <div className="mt-6">
              <Button variant="primary" loading={running} icon={!running ? <IconBolt size={15} /> : undefined} onClick={assemble}>
                Assemble package
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* package summary */}
          <Card>
            <CardHeader
              icon={<IconPackage size={18} />}
              title="Package summary"
              subtitle={`Assembled ${fmtDateTime(pkg.assembledAt)} · ${pkg.channels.length} channels`}
            />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
                {hero && hero.url && (
                  <img
                    src={hero.url}
                    alt={hero.altText || 'Hero visual'}
                    className="h-28 w-44 rounded-lg border border-ink-200 object-cover"
                  />
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Compliance" value={`${pkg.complianceScore}/100`} tone={pkg.complianceScore >= 80 ? 'ok' : 'warn'} />
                  <Stat
                    label="Sign-off"
                    value={(pkg.signOffDecision ?? '—').replace(/-/g, ' ')}
                    tone={pkg.signOffDecision === 'approved' ? 'ok' : 'warn'}
                  />
                  <Stat
                    label="Channels clear"
                    value={`${pkg.channels.filter((c) => c.recheck.status === 'pass').length}/${pkg.channels.length}`}
                    tone={pkg.channels.every((c) => c.recheck.status === 'pass') ? 'ok' : 'warn'}
                  />
                  <Stat label="Reviewer" value={pkg.signedOffBy ?? '—'} />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* primary-channel posted preview — the piece as authored, reused from Steps 3-4 */}
          <Card>
            <CardHeader
              icon={<IconPackage size={18} />}
              title={`Primary channel · ${channelSpec(primaryChannel).label}`}
              subtitle="The surface this piece was authored for, shown as it will appear once posted."
            />
            <CardBody>
              <PostPreview
                channel={primaryChannel}
                profile={profile}
                draft={draft}
                visual={hero}
              />
            </CardBody>
          </Card>

          {/* channel cards — primary first */}
          <div className="space-y-4">
            {orderedChannels.map((c) => (
              <ChannelCard
                key={c.channel}
                adaptation={c}
                isPrimary={c.channel === primaryChannel}
                busy={busyChannel === c.channel}
                disabled={!!busyChannel || running}
                onRegenerate={() => regenerate(c.channel)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelCard({
  adaptation: c,
  isPrimary,
  busy,
  disabled,
  onRegenerate,
}: {
  adaptation: ChannelAdaptation
  isPrimary: boolean
  busy: boolean
  disabled: boolean
  onRegenerate: () => void
}) {
  const pass = c.recheck.status === 'pass'
  const over = c.charCount > c.charLimit
  return (
    <Card className={cn(isPrimary && 'ring-2 ring-straive-500/30')}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {c.label}
            {isPrimary && <Badge tone="navy">Primary</Badge>}
            <Badge tone={pass ? 'ok' : 'warn'} dot>
              {pass ? 'Re-check passed' : 'Re-check: review'}
            </Badge>
          </span>
        }
        subtitle={c.headline}
        actions={
          <div className="flex items-center gap-2">
            <ModelTag role="copy" modelLabel={c.modelLabel} mode={c.mode} />
            <Button variant="secondary" size="sm" loading={busy} icon={!busy ? <IconRefresh size={14} /> : undefined} disabled={disabled} onClick={onRegenerate}>
              Re-adapt
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-3">
        {c.channel === 'blog' ? (
          <div className="max-h-72 overflow-auto rounded-lg border border-ink-100 bg-ink-50/40 p-3">
            <Markdown source={c.body} />
          </div>
        ) : (
          <pre className="whitespace-pre-wrap rounded-lg border border-ink-100 bg-ink-50/40 p-3 font-sans text-sm leading-relaxed text-ink-700">
            {c.body}
          </pre>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="navy">CTA: {c.cta}</Badge>
          {c.hashtags.map((h) => (
            <span key={h} className="text-info">{h}</span>
          ))}
          <span className={cn('ml-auto tabular-nums', over ? 'font-semibold text-warn' : 'text-ink-400')}>
            {c.charCount.toLocaleString()} / {c.charLimit.toLocaleString()} chars
          </span>
        </div>

        {/* re-check */}
        <div className={cn('rounded-lg border px-3 py-2', pass ? 'border-ok/25 bg-ok/5' : 'border-warn/30 bg-warn/5')}>
          <div className={cn('mb-1 flex items-center gap-1.5 text-xs font-semibold', pass ? 'text-ok' : 'text-warn')}>
            {pass ? <IconCheck size={14} /> : <IconAlert size={14} />}
            Per-channel compliance re-check
            {c.recheck.criticals > 0 && <Badge tone="crit">{c.recheck.criticals} critical</Badge>}
          </div>
          <ul className="space-y-0.5">
            {c.recheck.notes.map((n, i) => (
              <li key={i} className="text-[11px] text-ink-600">• {n}</li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  )
}

function buildPackageMarkdown(pkg: PublishPackage): string {
  const lines: string[] = [`# Publish Package — ${pkg.topicTitle}`, '']
  lines.push(`**Compliance score:** ${pkg.complianceScore}/100`)
  lines.push(
    `**Sign-off:** ${(pkg.signOffDecision ?? 'n/a').replace(/-/g, ' ')}${pkg.signedOffBy ? ` by ${pkg.signedOffBy}` : ''}`,
  )
  lines.push(`**Assembled:** ${fmtDateTime(pkg.assembledAt)}`, '')
  lines.push('## Master copy (approved)', '', pkg.masterCopy, '')
  for (const c of pkg.channels) {
    lines.push(`## ${c.label}`, '')
    lines.push(`**Headline:** ${c.headline}`, '')
    lines.push(c.body, '')
    lines.push(`**CTA:** ${c.cta}`)
    if (c.hashtags.length) lines.push(`**Hashtags:** ${c.hashtags.join(' ')}`)
    lines.push(
      `**Re-check:** ${c.recheck.status.toUpperCase()} — ${c.recheck.notes.join(' ')} (${c.charCount}/${c.charLimit} chars)`,
      '',
    )
  }
  lines.push('_Channel adaptations preserve the approved terms. Decision support, not legal advice._')
  return lines.join('\n')
}
