import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Disclaimer } from '@/components/Disclaimer'
import { SectionTitle, EmptyState, Stat } from '@/components/EmptyState'
import { Select, TextInput } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { ExportButton } from '@/components/ExportButton'
import {
  IconPlus,
  IconLayers,
  IconImage,
  IconDoc,
  IconSparkles,
  IconTrash,
  IconRefresh,
  IconEye,
  IconLink,
} from '@/components/icons'
import { AddAssetModal } from './brand/AddAssetModal'
import { analyzeAsset } from '@/lib/brand/analyze'
import { deriveProfile } from '@/lib/brand/derive'
import { profileCoverage } from '@/lib/brand/profile'
import type { BrandAsset } from '@/types'
import { titleCase, fmtDate } from '@/lib/format'
import { cn } from '@/lib/cn'

export function BrandMemoryView() {
  const repo = useAppStore((s) => s.brandRepo)
  const addAsset = useAppStore((s) => s.addAsset)
  const removeAsset = useAppStore((s) => s.removeAsset)
  const setAnalyzing = useAppStore((s) => s.setAssetAnalyzing)
  const setAnalysis = useAppStore((s) => s.setAssetAnalysis)
  const profile = useAppStore((s) => s.brandProfile)
  const updateBrandProfile = useAppStore((s) => s.updateBrandProfile)
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)

  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState<BrandAsset | null>(null)
  const [deriving, setDeriving] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterAnalyzed, setFilterAnalyzed] = useState('all')
  const [q, setQ] = useState('')

  const coverage = profileCoverage(repo)

  const filtered = useMemo(() => {
    return repo.filter((a) => {
      if (filterType !== 'all' && a.type !== filterType) return false
      if (filterAnalyzed === 'analyzed' && !a.analysis) return false
      if (filterAnalyzed === 'pending' && a.analysis) return false
      if (q.trim()) {
        const hay = `${a.name} ${a.rawCopy} ${a.campaign ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [repo, filterType, filterAnalyzed, q])

  async function runAnalyze(asset: BrandAsset) {
    setAnalyzing(asset.id, true)
    try {
      const { analysis, mode } = await analyzeAsset(asset)
      setAnalysis(asset.id, analysis)
      pushToast(
        mode === 'live' ? 'success' : 'info',
        `Analyzed "${asset.name}" (${mode === 'live' ? 'live model' : 'demo mode'}).`,
      )
    } catch (err) {
      setAnalyzing(asset.id, false)
      pushToast('error', `Analysis failed: ${(err as Error).message}`)
    }
  }

  async function handleAdded(asset: BrandAsset, analyzeNow: boolean) {
    addAsset(asset)
    pushToast('success', `Added "${asset.name}" to the repository.`)
    if (analyzeNow) {
      // give the store a tick to persist the new asset before analyzing
      setTimeout(() => runAnalyze(asset), 50)
    }
  }

  async function reDerive() {
    if (coverage.analyzed === 0) {
      pushToast('error', 'Analyze at least one asset first.')
      return
    }
    setDeriving(true)
    try {
      const { profile: next, mode } = await deriveProfile(profile, repo)
      updateBrandProfile(() => next)
      pushToast(
        mode === 'live' ? 'success' : 'info',
        `Brand Profile re-derived from ${coverage.analyzed} analyzed assets (${mode === 'live' ? 'live model' : 'demo merge'}).`,
      )
    } catch (err) {
      pushToast('error', `Derivation failed: ${(err as Error).message}`)
    } finally {
      setDeriving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle
        title="Brand Memory"
        description="The grounding layer. Ingest the issuer's past collateral; the engine learns the brand and grounds every downstream step."
        actions={
          <>
            <ExportButton name="brand-repository" json={repo} label="Export repo" />
            <Button
              variant="secondary"
              icon={<IconSparkles size={15} />}
              loading={deriving}
              onClick={reDerive}
            >
              Re-derive Profile
            </Button>
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setAddOpen(true)}>
              Add asset
            </Button>
          </>
        }
      />

      <Disclaimer kind="illustrative" className="mb-4" />

      {/* coverage summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Assets" value={repo.length} />
        <Stat
          label="Analyzed"
          value={`${coverage.analyzed}/${coverage.total}`}
          tone={coverage.pct === 100 ? 'ok' : 'warn'}
        />
        <Stat label="Profile coverage" value={`${coverage.pct}%`} />
        <Stat
          label="Visual assets"
          value={repo.filter((a) => a.imageUrl).length}
        />
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search assets…"
            className="w-56"
          />
        </div>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
          <option value="all">All types</option>
          {['blog', 'email', 'paid-social', 'display-ad', 'tagline', 'landing-page', 'other'].map(
            (t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ),
          )}
        </Select>
        <Select
          value={filterAnalyzed}
          onChange={(e) => setFilterAnalyzed(e.target.value)}
          className="w-40"
        >
          <option value="all">All status</option>
          <option value="analyzed">Analyzed</option>
          <option value="pending">Pending analysis</option>
        </Select>
        <span className="ml-auto text-sm text-ink-400">
          {filtered.length} of {repo.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconLayers size={22} />}
          title="No matching assets"
          description="Adjust the filters, or add collateral to populate the repository."
          action={
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setAddOpen(true)}>
              Add asset
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              onAnalyze={() => runAnalyze(a)}
              onView={() => setDetail(a)}
              onDelete={() => {
                if (confirm(`Remove "${a.name}" from the repository?`)) {
                  removeAsset(a.id)
                  pushToast('info', 'Asset removed.')
                }
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button variant="ghost" icon={<IconEye size={15} />} onClick={() => setView('brand-profile')}>
          View learned Brand Profile
        </Button>
      </div>

      <AddAssetModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={handleAdded} />
      <AssetDetailModal asset={detail} onClose={() => setDetail(null)} onAnalyze={runAnalyze} />
    </div>
  )
}

function AssetCard({
  asset,
  onAnalyze,
  onView,
  onDelete,
}: {
  asset: BrandAsset
  onAnalyze: () => void
  onView: () => void
  onDelete: () => void
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative h-32 bg-ink-100">
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-300">
            <IconDoc size={34} />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge tone="navy">{titleCase(asset.type)}</Badge>
        </div>
        {asset.seed && (
          <div className="absolute right-2 top-2">
            <Badge tone="neutral">seed</Badge>
          </div>
        )}
      </div>

      <CardBody className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          {asset.imageUrl ? (
            <IconImage size={15} className="mt-0.5 shrink-0 text-ink-400" />
          ) : (
            <IconDoc size={15} className="mt-0.5 shrink-0 text-ink-400" />
          )}
          <h4 className="text-sm font-semibold leading-snug text-ink-900">{asset.name}</h4>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
          <span className="capitalize">{asset.channel}</span>
          {asset.campaign && <span>· {asset.campaign}</span>}
          {asset.date && <span>· {fmtDate(asset.date)}</span>}
        </div>

        {asset.rawCopy && (
          <p className="line-clamp-2 text-xs text-ink-500">{asset.rawCopy}</p>
        )}
        {asset.sourceUrl && (
          <a
            href={asset.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-info hover:underline"
          >
            <IconLink size={12} /> source
          </a>
        )}

        <div className="mt-auto pt-2">
          {asset.analyzing ? (
            <Badge tone="info" dot>
              Analyzing…
            </Badge>
          ) : asset.analysis ? (
            <Badge tone="ok" dot>
              Analyzed
            </Badge>
          ) : (
            <Badge tone="warn" dot>
              Pending analysis
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 border-t border-ink-100 pt-2.5">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            icon={<IconSparkles size={13} />}
            loading={asset.analyzing}
            onClick={onAnalyze}
          >
            {asset.analysis ? 'Re-analyze' : 'Analyze'}
          </Button>
          <Button size="sm" variant="ghost" icon={<IconEye size={14} />} onClick={onView} />
          <Button size="sm" variant="ghost" icon={<IconTrash size={14} />} onClick={onDelete} />
        </div>
      </CardBody>
    </Card>
  )
}

function AssetDetailModal({
  asset,
  onClose,
  onAnalyze,
}: {
  asset: BrandAsset | null
  onClose: () => void
  onAnalyze: (a: BrandAsset) => void
}) {
  if (!asset) return null
  const a = asset
  const sig = a.analysis
  return (
    <Modal
      open={!!asset}
      onClose={onClose}
      title={a.name}
      subtitle={`${titleCase(a.type)} · ${a.channel}${a.campaign ? ` · ${a.campaign}` : ''}`}
      size="lg"
      footer={
        <Button
          variant="primary"
          icon={<IconRefresh size={15} />}
          loading={a.analyzing}
          onClick={() => onAnalyze(a)}
        >
          {sig ? 'Re-analyze' : 'Analyze'}
        </Button>
      }
    >
      {a.imageUrl && (
        <img
          src={a.imageUrl}
          alt={a.name}
          className="mb-4 max-h-64 rounded-lg border border-ink-200"
        />
      )}
      {a.rawCopy && (
        <div className="mb-4">
          <div className="label">Copy</div>
          <pre className="whitespace-pre-wrap rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs text-ink-700">
            {a.rawCopy}
          </pre>
        </div>
      )}

      {sig ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-ink-200 bg-white p-3">
            <div className="label">Summary</div>
            <p className="text-sm text-ink-700">{sig.summary}</p>
          </div>
          <SignalList title="Voice signals" items={sig.voiceSignals} tone="navy" />
          <SignalList title="Messaging signals" items={sig.messagingSignals} tone="info" />
          {sig.visualSignals.length > 0 && (
            <SignalList title="Visual signals" items={sig.visualSignals} tone="accent" />
          )}
          {sig.complianceSignals.length > 0 && (
            <SignalList title="Compliance signals" items={sig.complianceSignals} tone="warn" />
          )}
          {sig.detectedDisclosures.length > 0 && (
            <div>
              <div className="label">Detected disclosures</div>
              <ul className="space-y-1">
                {sig.detectedDisclosures.map((d, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600"
                  >
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<IconSparkles size={20} />}
          title="Not analyzed yet"
          description="Run analysis to extract brand voice, messaging, and compliance signals from this asset."
        />
      )}
    </Modal>
  )
}

function SignalList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'navy' | 'info' | 'accent' | 'warn'
}) {
  if (!items.length) return null
  return (
    <div>
      <div className="label">{title}</div>
      <div className={cn('flex flex-wrap gap-1.5')}>
        {items.map((it, i) => (
          <Badge key={i} tone={tone}>
            {it}
          </Badge>
        ))}
      </div>
    </div>
  )
}
