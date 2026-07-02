import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Tabs } from '@/components/Tabs'
import { Disclaimer } from '@/components/Disclaimer'
import { SectionTitle } from '@/components/EmptyState'
import { Field, TextInput, TextArea } from '@/components/Field'
import { ExportButton } from '@/components/ExportButton'
import {
  IconSparkles,
  IconRefresh,
  IconPlus,
  IconX,
  IconFingerprint,
  IconImage,
  IconDoc,
  IconBolt,
} from '@/components/icons'
import type { BrandProfile, PaletteColor } from '@/types'
import { profileToMarkdown } from '@/lib/brand/profile'
import { fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

type Section = 'voice' | 'messaging' | 'visual' | 'compliance'

export function BrandProfileView() {
  const profile = useAppStore((s) => s.brandProfile)
  const update = useAppStore((s) => s.updateBrandProfile)
  const reset = useAppStore((s) => s.resetBrandProfile)
  const pushToast = useAppStore((s) => s.pushToast)
  const [section, setSection] = useState<Section>('voice')

  function patch(updater: (p: BrandProfile) => BrandProfile) {
    update(updater)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Brand Profile"
        description="Auto-derived from the repository and fully editable. This profile grounds every step of the pipeline."
        actions={
          <>
            <ExportButton
              name={`brand-profile-${profile.brandName}`}
              json={profile}
              markdown={profileToMarkdown(profile)}
            />
            <Button
              variant="secondary"
              icon={<IconRefresh size={15} />}
              onClick={() => {
                if (confirm('Reset the Brand Profile to the seed values? Your edits will be lost.')) {
                  reset()
                  pushToast('info', 'Brand Profile reset to seed.')
                }
              }}
            >
              Reset to seed
            </Button>
          </>
        }
      />

      <Disclaimer kind="illustrative" className="mb-4" />

      {/* header card */}
      <Card className="mb-5">
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {profile.illustrative && <Badge tone="warn">Illustrative</Badge>}
            <Badge tone="navy" dot>
              Derived {fmtDateTime(profile.derivedAt)}
            </Badge>
          </div>
          <Field label="Brand name">
            <TextInput
              value={profile.brandName}
              onChange={(e) => patch((p) => ({ ...p, brandName: e.target.value }))}
            />
          </Field>
          <Field label="Positioning one-liner">
            <TextArea
              value={profile.oneLiner}
              onChange={(e) => patch((p) => ({ ...p, oneLiner: e.target.value }))}
              className="min-h-[60px]"
            />
          </Field>
        </CardBody>
      </Card>

      <Tabs
        tabs={[
          { id: 'voice', label: 'Voice & Tone' },
          { id: 'messaging', label: 'Messaging' },
          { id: 'visual', label: 'Visual Identity' },
          { id: 'compliance', label: 'Compliance Fingerprint' },
        ]}
        active={section}
        onChange={(s) => setSection(s as Section)}
        className="mb-5"
      />

      {section === 'voice' && <VoiceSection profile={profile} patch={patch} />}
      {section === 'messaging' && <MessagingSection profile={profile} patch={patch} />}
      {section === 'visual' && <VisualSection profile={profile} patch={patch} />}
      {section === 'compliance' && <ComplianceSection profile={profile} patch={patch} />}
    </div>
  )
}

type PatchFn = (updater: (p: BrandProfile) => BrandProfile) => void

function VoiceSection({ profile, patch }: { profile: BrandProfile; patch: PatchFn }) {
  const v = profile.voice
  const set = (k: keyof BrandProfile['voice'], val: any) =>
    patch((p) => ({ ...p, voice: { ...p.voice, [k]: val } }))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader icon={<IconSparkles size={18} />} title="Voice attributes" />
        <CardBody>
          <TagList items={v.attributes} onChange={(x) => set('attributes', x)} tone="navy" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={<IconBolt size={18} />} title="Cadence" />
        <CardBody className="space-y-3">
          <Field label="Reading level">
            <TextInput value={v.readingLevel} onChange={(e) => set('readingLevel', e.target.value)} />
          </Field>
          <Field label="Sentence rhythm">
            <TextArea
              value={v.sentenceRhythm}
              onChange={(e) => set('sentenceRhythm', e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Do words" subtitle="On-voice vocabulary to favor" />
        <CardBody>
          <TagList items={v.doWords} onChange={(x) => set('doWords', x)} tone="ok" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Don't words" subtitle="Risky / off-brand vocabulary to avoid" />
        <CardBody>
          <TagList items={v.dontWords} onChange={(x) => set('dontWords', x)} tone="crit" />
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Signature phrases" subtitle="Phrases the brand actually uses" />
        <CardBody>
          <TagList items={v.signaturePhrases} onChange={(x) => set('signaturePhrases', x)} tone="accent" />
        </CardBody>
      </Card>
    </div>
  )
}

function MessagingSection({ profile, patch }: { profile: BrandProfile; patch: PatchFn }) {
  const m = profile.messaging
  const set = (k: keyof BrandProfile['messaging'], val: string[]) =>
    patch((p) => ({ ...p, messaging: { ...p.messaging, [k]: val } }))
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title="Value propositions" />
        <CardBody>
          <LineList items={m.valueProps} onChange={(x) => set('valueProps', x)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Proof points" />
        <CardBody>
          <LineList items={m.proofPoints} onChange={(x) => set('proofPoints', x)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Calls to action" />
        <CardBody>
          <TagList items={m.ctas} onChange={(x) => set('ctas', x)} tone="navy" />
        </CardBody>
      </Card>
    </div>
  )
}

function VisualSection({ profile, patch }: { profile: BrandProfile; patch: PatchFn }) {
  const vis = profile.visual
  const set = (k: keyof BrandProfile['visual'], val: any) =>
    patch((p) => ({ ...p, visual: { ...p.visual, [k]: val } }))

  function setColor(i: number, c: Partial<PaletteColor>) {
    set(
      'palette',
      vis.palette.map((col, idx) => (idx === i ? { ...col, ...c } : col)),
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader icon={<IconImage size={18} />} title="Color palette" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {vis.palette.map((c, i) => (
              <div key={i} className="w-36 rounded-lg border border-ink-200 p-2">
                <div className="mb-2 h-14 w-full rounded-md border border-ink-200" style={{ background: c.hex }} />
                <input
                  className="input mb-1 px-2 py-1 text-xs"
                  value={c.name}
                  onChange={(e) => setColor(i, { name: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={c.hex}
                    onChange={(e) => setColor(i, { hex: e.target.value })}
                    className="h-7 w-8 cursor-pointer rounded border border-ink-200 bg-white"
                  />
                  <input
                    className="input px-2 py-1 font-mono text-xs"
                    value={c.hex}
                    onChange={(e) => setColor(i, { hex: e.target.value })}
                  />
                  <button
                    onClick={() => set('palette', vis.palette.filter((_, idx) => idx !== i))}
                    className="text-ink-400 hover:text-crit"
                    aria-label="Remove color"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => set('palette', [...vis.palette, { name: 'New', hex: '#888888' }])}
              className="flex h-[118px] w-36 flex-col items-center justify-center rounded-lg border border-dashed border-ink-300 text-ink-400 hover:border-brand-navy/40 hover:text-brand-navy"
            >
              <IconPlus size={18} />
              <span className="mt-1 text-xs">Add color</span>
            </button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Typography & imagery" />
        <CardBody className="space-y-3">
          <Field label="Typography feel">
            <TextArea value={vis.typography} onChange={(e) => set('typography', e.target.value)} />
          </Field>
          <Field label="Imagery style">
            <TextArea value={vis.imageryStyle} onChange={(e) => set('imageryStyle', e.target.value)} />
          </Field>
          <Field label="Logo / lockup usage">
            <TextArea value={vis.logoUsage} onChange={(e) => set('logoUsage', e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Visual do / don't" />
        <CardBody className="space-y-4">
          <div>
            <div className="label">Do</div>
            <LineList items={vis.doList} onChange={(x) => set('doList', x)} />
          </div>
          <div>
            <div className="label">Don't</div>
            <LineList items={vis.dontList} onChange={(x) => set('dontList', x)} />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function ComplianceSection({ profile, patch }: { profile: BrandProfile; patch: PatchFn }) {
  const c = profile.compliance
  const set = (k: keyof BrandProfile['compliance'], val: any) =>
    patch((p) => ({ ...p, compliance: { ...p.compliance, [k]: val } }))
  return (
    <div className="grid gap-4">
      <Disclaimer kind="legal" compact />
      <Card>
        <CardHeader
          icon={<IconFingerprint size={18} />}
          title="Required legal lines"
          subtitle="Feeds the compliance rulebook in Step 4."
        />
        <CardBody>
          <LineList items={c.legalLines} onChange={(x) => set('legalLines', x)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={<IconDoc size={18} />} title="Recurring disclosures" />
        <CardBody>
          <LineList items={c.recurringDisclosures} onChange={(x) => set('recurringDisclosures', x)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Notes" />
        <CardBody>
          <TextArea value={c.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-[80px]" />
        </CardBody>
      </Card>
    </div>
  )
}

// ── editors ──────────────────────────────────────────────────────────────────

function TagList({
  items,
  onChange,
  tone = 'navy',
}: {
  items: string[]
  onChange: (items: string[]) => void
  tone?: 'navy' | 'ok' | 'crit' | 'accent' | 'info'
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={i}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
              tone === 'navy' && 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
              tone === 'ok' && 'bg-ok/10 text-ok border-ok/20',
              tone === 'crit' && 'bg-crit/10 text-crit border-crit/20',
              tone === 'accent' && 'bg-brand-accentSoft text-brand-accent border-brand-accent/20',
              tone === 'info' && 'bg-info/10 text-info border-info/20',
            )}
          >
            {it}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label="Remove">
              <IconX size={12} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-ink-400">None yet.</span>}
      </div>
      <div className="flex gap-2">
        <TextInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add and press Enter…"
          className="text-sm"
        />
        <Button size="sm" variant="secondary" icon={<IconPlus size={14} />} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  )
}

function LineList({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <input
            className="input flex-1 text-sm"
            value={it}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="mt-2 text-ink-400 hover:text-crit"
            aria-label="Remove"
          >
            <IconX size={15} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <TextInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add a line and press Enter…"
          className="text-sm"
        />
        <Button size="sm" variant="secondary" icon={<IconPlus size={14} />} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  )
}
