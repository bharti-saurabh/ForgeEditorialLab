import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SectionTitle, EmptyState, Stat } from '@/components/EmptyState'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { PostPreview } from '@/components/PostPreview'
import { findTopic } from '@/lib/topics'
import { channelSpec, isImageChannel } from '@/lib/channels'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import { disclosuresForTopic } from '@/lib/compliance'
import { buildCleanVersion, currentScore, contentSignature } from '@/lib/complianceEngine'
import {
  CHANNELS,
  channelMeta,
  recheckChannel,
  defaultHandoff,
  utmQuery,
  SEM_LIMITS,
  type ChannelMeta,
} from '@/lib/publish'
import {
  PUBLISH_SYSTEM,
  buildAdaptationPrompt,
  demoAdaptation,
  composeSemBody,
  parseSemBody,
  type AdaptationDraft,
} from '@/lib/prompts/publish'
import { runChat } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import { fmtDateTime } from '@/lib/format'
import type {
  BrandProfile,
  ChannelAdaptation,
  ChannelHandoff,
  ChannelKey,
  DraftVariant,
  HandoffStatus,
  PublishPackage,
  VisualAsset,
} from '@/types'
import {
  IconPackage,
  IconShield,
  IconChevron,
  IconBolt,
  IconRefresh,
  IconCheck,
  IconAlert,
  IconUsers,
  IconDoc,
  IconImage,
  IconLink,
  IconCopy,
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
  const primaryChannel = pipeline.primaryChannel

  const [running, setRunning] = useState(false)
  const [busyChannel, setBusyChannel] = useState<ChannelKey | null>(null)
  const [selected, setSelected] = useState<ChannelKey>(primaryChannel)

  // Sign-off is only valid for the content it was recorded against — an edit
  // after sign-off makes it stale and blocks publish until the gate re-runs.
  const stale =
    !!compliance?.reviewedSig &&
    !!draft &&
    contentSignature(draft, pipeline.visuals) !== compliance.reviewedSig
  const signed =
    !!compliance?.signoff && compliance.signoff.decision !== 'rejected' && !stale

  const disclosures = useMemo(
    () => (topic ? disclosuresForTopic(topic, SEED_RULEBOOK, profile) : []),
    [topic, profile],
  )
  const masterCopy = useMemo(
    () => (draft && compliance ? buildCleanVersion(draft, compliance) : ''),
    [draft, compliance],
  )

  // Re-run the per-channel gate + char metrics after any edit to one channel.
  const finalizeChannel = useCallback(
    (c: ChannelAdaptation): ChannelAdaptation => {
      const meta = channelMeta(c.channel)
      const bodyText = c.sem ? composeSemBody(c.sem.headlines, c.sem.descriptions) : c.body
      const recheckText = [c.headline, bodyText, c.cta, c.hashtags.join(' ')]
        .filter(Boolean)
        .join('\n')
      const recheck = recheckChannel(recheckText, disclosures, SEED_RULEBOOK, meta)
      const charCount = c.sem
        ? Math.max(
            0,
            ...c.sem.headlines.map((h) => h.length),
            ...c.sem.descriptions.map((d) => d.length),
          )
        : c.body.length
      return { ...c, recheck, charCount }
    },
    [disclosures],
  )

  const hero = useMemo(
    () => pipeline.visuals.find((v) => v.role === 'hero') ?? pipeline.visuals[0] ?? null,
    [pipeline.visuals],
  )

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

  // ── build one channel adaptation from a model/derived draft ──────────────
  function toAdaptation(
    meta: ChannelMeta,
    a: AdaptationDraft,
    mode: ChannelAdaptation['mode'],
    modelLabel: string,
    ts: number,
    isPrimary: boolean,
    prev?: ChannelAdaptation,
  ): ChannelAdaptation {
    const sem =
      meta.key === 'sem'
        ? {
            headlines: (a.headlines ?? []).slice(0, SEM_LIMITS.headlines),
            descriptions: (a.descriptions ?? []).slice(0, SEM_LIMITS.descriptions),
          }
        : null
    const base: ChannelAdaptation = {
      channel: meta.key,
      label: meta.label,
      headline: a.headline,
      body: a.body,
      cta: a.cta,
      hashtags: a.hashtags,
      charCount: 0,
      charLimit: meta.charLimit,
      modelLabel,
      mode,
      recheck: { status: 'pass', issues: 0, criticals: 0, missingDisclosures: 0, notes: [] },
      generatedAt: ts,
      isPrimary,
      edited: false,
      // content changed on (re-)adapt → prior override no longer applies
      resolution: null,
      sem,
      visualId: isImageChannel(meta.key) ? prev?.visualId ?? hero?.id ?? null : null,
      // keep the operator's schedule/owner/UTM across a re-assemble
      handoff: prev?.handoff ?? defaultHandoff(meta.key, topic!),
    }
    return finalizeChannel(base)
  }

  // The primary channel's entry IS the approved draft, not a re-adaptation.
  function primaryAdaptationDraft(): AdaptationDraft {
    const cta = profile.messaging.ctas[0] ?? 'Learn more'
    if (primaryChannel === 'sem') {
      const parsed = parseSemBody(masterCopy)
      return {
        headline: parsed.headlines[0] ?? draft!.title,
        body: masterCopy,
        cta,
        hashtags: [],
        headlines: parsed.headlines,
        descriptions: parsed.descriptions,
      }
    }
    return { headline: draft!.title, body: masterCopy, cta, hashtags: [] }
  }

  async function adaptModel(meta: ChannelMeta): Promise<{ a: AdaptationDraft; mode: ChannelAdaptation['mode']; modelLabel: string; ts: number }> {
    const { text, mode, entry } = await runChat({
      role: 'copy',
      step: `Step 5 · ${meta.label} adaptation`,
      system: PUBLISH_SYSTEM,
      user: buildAdaptationPrompt(profile, topic!, meta, masterCopy, disclosures),
      reason: `Copy model — reshapes the approved master copy for ${meta.label} without dropping material terms.`,
      maxTokens: 800,
      demo: () => JSON.stringify(demoAdaptation(profile, topic!, meta.key, masterCopy, disclosures)),
    })
    const parsed =
      parseJsonLoose<AdaptationDraft>(text) ??
      demoAdaptation(profile, topic!, meta.key, masterCopy, disclosures)
    const a: AdaptationDraft = {
      headline: parsed.headline ?? topic!.title,
      body: parsed.body ?? '',
      cta: parsed.cta ?? profile.messaging.ctas[0] ?? 'Learn more',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      headlines: Array.isArray(parsed.headlines) ? parsed.headlines : undefined,
      descriptions: Array.isArray(parsed.descriptions) ? parsed.descriptions : undefined,
    }
    return { a, mode, modelLabel: entry.modelLabel, ts: entry.ts }
  }

  async function assemble() {
    setRunning(true)
    try {
      const prev = pkg
      const channels: ChannelAdaptation[] = []
      for (const meta of CHANNELS) {
        const prevCh = prev?.channels.find((c) => c.channel === meta.key)
        if (meta.key === primaryChannel) {
          channels.push(
            toAdaptation(meta, primaryAdaptationDraft(), draft!.mode, draft!.modelLabel, Date.now(), true, prevCh),
          )
        } else {
          const r = await adaptModel(meta)
          channels.push(toAdaptation(meta, r.a, r.mode, r.modelLabel, r.ts, false, prevCh))
        }
      }
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
      setSelected(primaryChannel)
      const review = channels.filter((c) => !isClear(c)).length
      pushToast(
        review ? 'info' : 'success',
        review
          ? `Package assembled — ${review} channel(s) need a look before export.`
          : 'Package assembled — every channel is clear to export.',
      )
    } catch {
      pushToast('error', 'Could not assemble the package.')
    } finally {
      setRunning(false)
    }
  }

  async function readapt(channel: ChannelKey) {
    if (!pkg || channel === primaryChannel) return
    setBusyChannel(channel)
    try {
      const meta = channelMeta(channel)
      const prevCh = pkg.channels.find((c) => c.channel === channel)
      const r = await adaptModel(meta)
      const updated = toAdaptation(meta, r.a, r.mode, r.modelLabel, r.ts, false, prevCh)
      setPublish({ ...pkg, channels: pkg.channels.map((c) => (c.channel === channel ? updated : c)) })
      pushToast('success', `${updated.label} re-adapted.`)
    } catch {
      pushToast('error', 'Could not re-adapt that channel.')
    } finally {
      setBusyChannel(null)
    }
  }

  // Persist an edit to one channel, re-running its gate.
  function patchChannel(channel: ChannelKey, patch: Partial<ChannelAdaptation>) {
    if (!pkg) return
    setPublish({
      ...pkg,
      channels: pkg.channels.map((c) => (c.channel === channel ? finalizeChannel({ ...c, ...patch }) : c)),
    })
  }

  const orderedChannels: ChannelAdaptation[] = pkg
    ? [...pkg.channels].sort(
        (a, b) => Number(b.channel === primaryChannel) - Number(a.channel === primaryChannel),
      )
    : []
  const clearCount = orderedChannels.filter(isClear).length
  const allClear = orderedChannels.length > 0 && clearCount === orderedChannels.length
  const active = orderedChannels.find((c) => c.channel === selected) ?? orderedChannels[0] ?? null

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Step 5 · Publish Package"
        description="The approved piece, packaged per channel — each surface gated, editable, and handed off with a schedule + tracking."
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
            {pkg &&
              (allClear ? (
                <ExportButton name={`publish-${topic.id}`} json={pkg} markdown={buildPackageMarkdown(pkg)} print />
              ) : (
                <Button variant="secondary" size="sm" disabled title="Resolve every channel's re-check to export">
                  Export blocked · {orderedChannels.length - clearCount} to clear
                </Button>
              ))}
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
              Carries the compliance-approved draft through as the{' '}
              <strong className="text-ink-700">{channelSpec(primaryChannel).label}</strong> primary, then adapts it for the
              other channels — running a compliance re-check on each so nothing slips.
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Compliance" value={`${pkg.complianceScore}/100`} tone={pkg.complianceScore >= 80 ? 'ok' : 'warn'} />
                <Stat label="Sign-off" value={(pkg.signOffDecision ?? '—').replace(/-/g, ' ')} tone={pkg.signOffDecision === 'approved' ? 'ok' : 'warn'} />
                <Stat label="Channels clear" value={`${clearCount}/${pkg.channels.length}`} tone={allClear ? 'ok' : 'warn'} />
                <Stat label="Export" value={allClear ? 'Ready' : 'Blocked'} tone={allClear ? 'ok' : 'warn'} />
              </div>
              {!allClear && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-warn">
                  <IconAlert size={13} />
                  Export is blocked until every channel passes its re-check or a reviewer overrides it below.
                </p>
              )}
            </CardBody>
          </Card>

          {/* master-detail: channel list ↔ channel detail */}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,320px)_1fr]">
            <div className="lg:sticky lg:top-4 space-y-2">
              {orderedChannels.map((c) => (
                <ChannelRow
                  key={c.channel}
                  adaptation={c}
                  active={active?.channel === c.channel}
                  onClick={() => setSelected(c.channel)}
                />
              ))}
            </div>

            {active && (
              <ChannelDetail
                key={active.channel}
                adaptation={active}
                isPrimary={active.channel === primaryChannel}
                busy={busyChannel === active.channel}
                disabled={!!busyChannel || running}
                profile={profile}
                draft={draft}
                visuals={pipeline.visuals}
                signedOffBy={pkg.signedOffBy}
                onReadapt={() => readapt(active.channel)}
                onPatch={(patch) => patchChannel(active.channel, patch)}
                onCopy={(text, what) => copyToClipboard(text, what, pushToast)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── a channel is exportable when it passed its re-check OR was overridden ────
function isClear(c: ChannelAdaptation): boolean {
  return c.recheck.status === 'pass' || !!c.resolution?.overridden
}

function copyToClipboard(text: string, what: string, pushToast: (t: 'success' | 'error', m: string) => void) {
  navigator.clipboard?.writeText(text).then(
    () => pushToast('success', `${what} copied to clipboard.`),
    () => pushToast('error', 'Clipboard unavailable in this browser.'),
  )
}

// ── left list row ────────────────────────────────────────────────────────
function ChannelRow({
  adaptation: c,
  active,
  onClick,
}: {
  adaptation: ChannelAdaptation
  active: boolean
  onClick: () => void
}) {
  const clear = isClear(c)
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border px-3 py-2.5 text-left transition',
        active ? 'border-straive-500 bg-straive-50/60 ring-1 ring-straive-500/30' : 'border-ink-200 bg-white hover:border-ink-300',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink-900">{c.label}</span>
        {c.isPrimary && <Badge tone="navy">Primary</Badge>}
        {c.edited && <span className="text-[10px] font-medium text-info">edited</span>}
        <span className={cn('ml-auto h-2 w-2 rounded-full', clear ? 'bg-ok' : 'bg-warn')} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
        <span className={cn('font-medium', clear ? 'text-ok' : 'text-warn')}>
          {c.recheck.status === 'pass' ? 'Re-check passed' : c.resolution?.overridden ? 'Overridden' : 'Needs a look'}
        </span>
        <span className="ml-auto tabular-nums">
          {c.sem ? `${c.sem.headlines.length}H · ${c.sem.descriptions.length}D` : `${c.charCount}/${c.charLimit}`}
        </span>
      </div>
    </button>
  )
}

// ── right detail / editor ──────────────────────────────────────────────────
function ChannelDetail({
  adaptation: c,
  isPrimary,
  busy,
  disabled,
  profile,
  draft,
  visuals,
  signedOffBy,
  onReadapt,
  onPatch,
  onCopy,
}: {
  adaptation: ChannelAdaptation
  isPrimary: boolean
  busy: boolean
  disabled: boolean
  profile: BrandProfile
  draft: DraftVariant
  visuals: VisualAsset[]
  signedOffBy: string | null
  onReadapt: () => void
  onPatch: (patch: Partial<ChannelAdaptation>) => void
  onCopy: (text: string, what: string) => void
}) {
  const assignedVisual = visuals.find((v) => v.id === c.visualId) ?? null
  const previewDraft: DraftVariant = {
    ...draft,
    title: c.headline,
    body: c.sem ? composeSemBody(c.sem.headlines, c.sem.descriptions) : c.body,
  }
  const clear = isClear(c)

  return (
    <div className="space-y-4">
      <Card className={cn(isPrimary && 'ring-2 ring-straive-500/30')}>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              {c.label}
              {isPrimary && <Badge tone="navy">Primary</Badge>}
              <Badge tone={clear ? 'ok' : 'warn'} dot>
                {c.recheck.status === 'pass' ? 'Re-check passed' : c.resolution?.overridden ? 'Overridden' : 'Needs a look'}
              </Badge>
              {c.edited && <Badge tone="info">Edited</Badge>}
            </span>
          }
          subtitle={isPrimary ? 'The surface this piece was authored & signed off for.' : channelMeta(c.channel).guidance}
          actions={
            <div className="flex items-center gap-2">
              <ModelTag role="copy" modelLabel={isPrimary ? 'Approved draft' : c.modelLabel} mode={c.mode} />
              {!isPrimary && (
                <Button variant="secondary" size="sm" loading={busy} icon={!busy ? <IconRefresh size={14} /> : undefined} disabled={disabled} onClick={onReadapt}>
                  Re-adapt
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="space-y-4">
          <PostPreview channel={c.channel} profile={profile} draft={previewDraft} visual={assignedVisual} />

          {isPrimary ? (
            <p className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 text-xs text-navy-700">
              This entry is the approved draft itself — carried straight through, not re-adapted. To change it, edit in Step 2
              and re-run the compliance gate so the sign-off stays valid.
            </p>
          ) : (
            <ChannelEditor adaptation={c} onSave={onPatch} />
          )}
        </CardBody>
      </Card>

      {/* per-channel gate + override */}
      <RecheckPanel adaptation={c} defaultReviewer={signedOffBy} onPatch={onPatch} />

      {/* per-channel visual */}
      {isImageChannel(c.channel) && (
        <VisualPanel adaptation={c} visuals={visuals} onPatch={onPatch} />
      )}

      {/* handoff: schedule / owner / UTM */}
      <HandoffPanel adaptation={c} onPatch={onPatch} onCopy={onCopy} />
    </div>
  )
}

// ── editable adaptation ────────────────────────────────────────────────────
function ChannelEditor({
  adaptation: c,
  onSave,
}: {
  adaptation: ChannelAdaptation
  onSave: (patch: Partial<ChannelAdaptation>) => void
}) {
  const [headline, setHeadline] = useState(c.headline)
  const [body, setBody] = useState(c.body)
  const [cta, setCta] = useState(c.cta)
  const [hashtags, setHashtags] = useState(c.hashtags.join(' '))
  const [headlines, setHeadlines] = useState<string[]>(c.sem?.headlines ?? [])
  const [descriptions, setDescriptions] = useState<string[]>(c.sem?.descriptions ?? [])

  const dirty =
    headline !== c.headline ||
    body !== c.body ||
    cta !== c.cta ||
    hashtags !== c.hashtags.join(' ') ||
    (c.sem && (headlines.join('|') !== c.sem.headlines.join('|') || descriptions.join('|') !== c.sem.descriptions.join('|')))

  function save() {
    const patch: Partial<ChannelAdaptation> = {
      headline,
      cta,
      hashtags: hashtags.split(/\s+/).map((h) => h.trim()).filter(Boolean),
      edited: true,
    }
    if (c.sem) {
      patch.sem = { headlines: headlines.map((h) => h.trim()), descriptions: descriptions.map((d) => d.trim()) }
      patch.body = composeSemBody(patch.sem.headlines, patch.sem.descriptions)
    } else {
      patch.body = body
    }
    onSave(patch)
  }

  function revert() {
    setHeadline(c.headline)
    setBody(c.body)
    setCta(c.cta)
    setHashtags(c.hashtags.join(' '))
    setHeadlines(c.sem?.headlines ?? [])
    setDescriptions(c.sem?.descriptions ?? [])
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <IconDoc size={14} className="text-ink-500" />
        <span className="text-xs font-semibold text-ink-700">Edit this adaptation</span>
        {dirty && <span className="text-[11px] font-medium text-warn">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={revert}>Revert</Button>
          <Button variant="primary" size="sm" disabled={!dirty} icon={<IconCheck size={14} />} onClick={save}>Save</Button>
        </div>
      </div>

      <div className="space-y-2.5">
        <Field label={c.channel === 'email' ? 'Subject' : 'Headline'}>
          <input className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </Field>

        {c.sem ? (
          <div className="space-y-2">
            <LimitedList
              label="Headlines"
              items={headlines}
              limit={SEM_LIMITS.headline}
              max={SEM_LIMITS.headlines}
              onChange={setHeadlines}
            />
            <LimitedList
              label="Descriptions"
              items={descriptions}
              limit={SEM_LIMITS.description}
              max={SEM_LIMITS.descriptions}
              onChange={setDescriptions}
            />
          </div>
        ) : (
          <Field label="Body">
            <textarea className={cn(inputCls, 'min-h-[160px] font-sans leading-relaxed')} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="CTA">
            <input className={inputCls} value={cta} onChange={(e) => setCta(e.target.value)} />
          </Field>
          {c.channel !== 'sem' && c.channel !== 'blog' && c.channel !== 'email' && (
            <Field label="Hashtags (space-separated)">
              <input className={inputCls} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
            </Field>
          )}
        </div>
      </div>
    </div>
  )
}

function LimitedList({
  label,
  items,
  limit,
  max,
  onChange,
}: {
  label: string
  items: string[]
  limit: number
  max: number
  onChange: (next: string[]) => void
}) {
  const rows = items.length ? items : ['']
  function set(i: number, v: string) {
    const next = [...rows]
    next[i] = v
    onChange(next)
  }
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</span>
        <span className="text-[10px] text-ink-400">≤{limit} char each · up to {max}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((v, i) => {
          const over = v.length > limit
          return (
            <div key={i} className="flex items-center gap-2">
              <input className={cn(inputCls, over && 'border-warn ring-1 ring-warn/40')} value={v} onChange={(e) => set(i, e.target.value)} />
              <span className={cn('w-12 text-right text-[11px] tabular-nums', over ? 'font-semibold text-warn' : 'text-ink-400')}>
                {v.length}/{limit}
              </span>
              {rows.length > 1 && (
                <button className="text-ink-400 hover:text-crit" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">×</button>
              )}
            </div>
          )
        })}
        {rows.length < max && (
          <Button variant="ghost" size="sm" onClick={() => onChange([...items, ''])}>+ Add {label.toLowerCase().replace(/s$/, '')}</Button>
        )}
      </div>
    </div>
  )
}

// ── per-channel re-check + override ────────────────────────────────────────
function RecheckPanel({
  adaptation: c,
  defaultReviewer,
  onPatch,
}: {
  adaptation: ChannelAdaptation
  defaultReviewer: string | null
  onPatch: (patch: Partial<ChannelAdaptation>) => void
}) {
  const [open, setOpen] = useState(false)
  const [reviewer, setReviewer] = useState(defaultReviewer ?? '')
  const [note, setNote] = useState('')
  const pass = c.recheck.status === 'pass'
  const overridden = !!c.resolution?.overridden

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className={cn('flex items-center gap-1.5 text-sm font-semibold', pass ? 'text-ok' : overridden ? 'text-info' : 'text-warn')}>
          {pass ? <IconCheck size={15} /> : <IconAlert size={15} />}
          Per-channel compliance re-check
          {c.recheck.criticals > 0 && <Badge tone="crit">{c.recheck.criticals} critical</Badge>}
          {overridden && <Badge tone="info">Overridden</Badge>}
        </div>
        <ul className="space-y-0.5">
          {c.recheck.notes.map((n, i) => (
            <li key={i} className="text-xs text-ink-600">• {n}</li>
          ))}
        </ul>

        {overridden ? (
          <div className="rounded-lg border border-info/25 bg-info/5 px-3 py-2 text-xs text-ink-700">
            <div className="flex items-center gap-2">
              <IconShield size={13} className="text-info" />
              <span>
                Overridden by <strong>{c.resolution!.by || 'a reviewer'}</strong> · {fmtDateTime(c.resolution!.at)}
              </span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onPatch({ resolution: null })}>Undo</Button>
            </div>
            {c.resolution!.note && <p className="mt-1 italic text-ink-500">“{c.resolution!.note}”</p>}
          </div>
        ) : pass ? (
          <p className="flex items-center gap-1.5 text-xs text-ok">
            <IconCheck size={13} /> Clear to export.
          </p>
        ) : (
          <div className="rounded-lg border border-warn/30 bg-warn/5 p-3">
            {!open ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-ink-600">
                  This channel blocks export. Fix it in the editor, or record a reviewer override.
                </span>
                <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Override</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-700">Reviewer override — accountable sign-off, not a fix.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Reviewer name" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
                  <input className={inputCls} placeholder="Reason / rationale" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!reviewer.trim()}
                    icon={<IconShield size={14} />}
                    onClick={() => {
                      onPatch({ resolution: { overridden: true, by: reviewer.trim(), note: note.trim(), at: Date.now() } })
                      setOpen(false)
                    }}
                  >
                    Override &amp; clear
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── per-channel visual assignment ──────────────────────────────────────────
function VisualPanel({
  adaptation: c,
  visuals,
  onPatch,
}: {
  adaptation: ChannelAdaptation
  visuals: VisualAsset[]
  onPatch: (patch: Partial<ChannelAdaptation>) => void
}) {
  const assigned = visuals.find((v) => v.id === c.visualId) ?? null
  return (
    <Card>
      <CardHeader icon={<IconImage size={16} />} title="Channel visual" subtitle="The asset that ships on this surface." />
      <CardBody>
        {visuals.length === 0 ? (
          <p className="text-xs text-ink-500">No visuals were generated in Step 3.</p>
        ) : (
          <div className="flex items-start gap-4">
            {assigned && assigned.url ? (
              <img src={assigned.url} alt={assigned.altText || 'Assigned visual'} className="h-24 w-40 rounded-lg border border-ink-200 object-cover" />
            ) : (
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-ink-300 bg-ink-50 text-[11px] text-ink-400">
                {assigned ? 'Image not stored (re-generate to view)' : 'No visual assigned'}
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Field label="Assigned asset">
                <select className={inputCls} value={c.visualId ?? ''} onChange={(e) => onPatch({ visualId: e.target.value || null })}>
                  <option value="">— none —</option>
                  {visuals.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.role === 'hero' ? '★ ' : ''}{v.title}
                    </option>
                  ))}
                </select>
              </Field>
              {assigned && <p className="text-[11px] text-ink-500">Alt: {assigned.altText || '—'}</p>}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── schedule / owner / UTM handoff ─────────────────────────────────────────
function HandoffPanel({
  adaptation: c,
  onPatch,
  onCopy,
}: {
  adaptation: ChannelAdaptation
  onPatch: (patch: Partial<ChannelAdaptation>) => void
  onCopy: (text: string, what: string) => void
}) {
  const h = c.handoff ?? defaultHandoff(c.channel, { title: c.label } as never)
  function set(patch: Partial<ChannelHandoff>) {
    onPatch({ handoff: { ...h, ...patch } })
  }
  const query = utmQuery(h)
  const cmsText = c.sem
    ? composeSemBody(c.sem.headlines, c.sem.descriptions)
    : `${c.headline}\n\n${c.body}${c.cta ? `\n\nCTA: ${c.cta}` : ''}${c.hashtags.length ? `\n${c.hashtags.join(' ')}` : ''}`

  return (
    <Card>
      <CardHeader icon={<IconLink size={16} />} title="Handoff" subtitle="Schedule, owner, and campaign tracking for the CMS." />
      <CardBody className="space-y-3">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Field label="Status">
            <select className={inputCls} value={h.status} onChange={(e) => set({ status: e.target.value as HandoffStatus })}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </Field>
          <Field label="Go-live date">
            <input type="date" className={inputCls} value={h.scheduledFor} onChange={(e) => set({ scheduledFor: e.target.value })} />
          </Field>
          <Field label="Owner">
            <input className={inputCls} placeholder="Channel owner" value={h.owner} onChange={(e) => set({ owner: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Field label="utm_source">
            <input className={inputCls} value={h.utmSource} onChange={(e) => set({ utmSource: e.target.value })} />
          </Field>
          <Field label="utm_medium">
            <input className={inputCls} value={h.utmMedium} onChange={(e) => set({ utmMedium: e.target.value })} />
          </Field>
          <Field label="utm_campaign">
            <input className={inputCls} value={h.utmCampaign} onChange={(e) => set({ utmCampaign: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] text-ink-600">
            {query || 'no UTM set'}
          </code>
          <Button variant="secondary" size="sm" icon={<IconCopy size={13} />} disabled={!query} onClick={() => onCopy(query, 'Tracking query')}>
            Copy UTM
          </Button>
          <Button variant="secondary" size="sm" icon={<IconCopy size={13} />} onClick={() => onCopy(cmsText, `${c.label} copy`)}>
            Copy for CMS
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

const inputCls =
  'w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-800 outline-none focus:border-straive-400 focus:ring-1 focus:ring-straive-400/40'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      {children}
    </label>
  )
}

function buildPackageMarkdown(pkg: PublishPackage): string {
  const lines: string[] = [`# Publish Package — ${pkg.topicTitle}`, '']
  lines.push(`**Compliance score:** ${pkg.complianceScore}/100`)
  lines.push(`**Sign-off:** ${(pkg.signOffDecision ?? 'n/a').replace(/-/g, ' ')}${pkg.signedOffBy ? ` by ${pkg.signedOffBy}` : ''}`)
  lines.push(`**Assembled:** ${fmtDateTime(pkg.assembledAt)}`, '')
  lines.push('## Master copy (approved)', '', pkg.masterCopy, '')
  for (const c of pkg.channels) {
    const status = c.resolution?.overridden ? `OVERRIDDEN by ${c.resolution.by}` : c.recheck.status.toUpperCase()
    lines.push(`## ${c.label}${c.isPrimary ? ' (primary)' : ''}`, '')
    lines.push(`**Headline:** ${c.headline}`, '')
    if (c.sem) {
      lines.push('**Headlines:**', ...c.sem.headlines.map((h) => `- ${h}`), '')
      lines.push('**Descriptions:**', ...c.sem.descriptions.map((d) => `- ${d}`), '')
    } else {
      lines.push(c.body, '')
    }
    lines.push(`**CTA:** ${c.cta}`)
    if (c.hashtags.length) lines.push(`**Hashtags:** ${c.hashtags.join(' ')}`)
    if (c.handoff) {
      lines.push(
        `**Handoff:** ${c.handoff.status}${c.handoff.scheduledFor ? ` · go-live ${c.handoff.scheduledFor}` : ''}${c.handoff.owner ? ` · owner ${c.handoff.owner}` : ''}`,
      )
      lines.push(`**UTM:** ${utmQuery(c.handoff) || '(none)'}`)
    }
    lines.push(`**Re-check:** ${status} — ${c.recheck.notes.join(' ')}`, '')
  }
  lines.push('_Channel adaptations preserve the approved terms. Decision support, not legal advice._')
  return lines.join('\n')
}
