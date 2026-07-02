import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Disclaimer } from '@/components/Disclaimer'
import { PIPELINE, type NavItem } from './nav'
import { SEED_COMPLETED_RUN } from '@/seed/completedRun'
import {
  IconLayers,
  IconFingerprint,
  IconRoute,
  IconChevron,
  IconBolt,
} from '@/components/icons'
import type { ViewId } from '@/store/useAppStore'

export function OverviewView() {
  const setView = useAppStore((s) => s.setView)
  const profile = useAppStore((s) => s.brandProfile)
  const settings = useAppStore((s) => s.settings)
  const log = useAppStore((s) => s.routerLog)
  const loadCompletedRun = useAppStore((s) => s.loadCompletedRun)
  const pushToast = useAppStore((s) => s.pushToast)
  const hasRun = useAppStore((s) => s.pipeline.publish !== null)
  const live = Boolean(settings.gatewayUrl.trim() && settings.apiKey.trim())

  return (
    <div className="mx-auto max-w-6xl">
      {/* hero */}
      <div className="chrome-mesh relative mb-6 overflow-hidden rounded-2xl p-7 text-white shadow-pop">
        {/* floating 3D shapes */}
        <div
          className="orb -right-16 -top-20 h-64 w-64 animate-float opacity-40"
          style={{ background: 'radial-gradient(circle at 30% 30%, #ff7438 0%, #ff5000 45%, transparent 72%)' }}
        />
        <div
          className="orb -bottom-24 right-24 h-52 w-52 animate-float-slow opacity-30"
          style={{ background: 'radial-gradient(circle at 40% 40%, #2a7fd0 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute right-40 top-6 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-straive-400/40 to-straive-600/10 ring-1 ring-white/10 backdrop-blur-sm animate-float"
        />
        <div
          className="pointer-events-none absolute bottom-8 right-64 hidden h-10 w-10 -rotate-6 rounded-xl bg-white/5 ring-1 ring-white/15 backdrop-blur-sm animate-float-slow lg:block"
        />
        <div className="relative flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-straive-500/20 px-2.5 py-0.5 text-xs font-semibold text-straive-300 ring-1 ring-straive-500/30">
                Straive · Editorial Lab
              </span>
              <Badge tone={live ? 'ok' : 'warn'} className="bg-white/15 text-white border-white/20" dot>
                {live ? 'Live mode' : 'Demo mode'}
              </Badge>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
              The compliance-first, multi-model AI content engine
            </h1>
            <p className="mt-2 text-sm text-white/80">
              From “what should we write about” → on-brand creation → an auditable
              legal-and-compliance gate → synthetic audience validation → a publish-ready
              package. Grounded in {profile.brandName}'s brand, routing each task to the best
              model for the job.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<IconLayers size={15} />}
                onClick={() => setView('brand-memory')}
              >
                Open Brand Memory
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                icon={<IconFingerprint size={15} />}
                onClick={() => setView('brand-profile')}
              >
                View Brand Profile
              </Button>
            </div>
          </div>
          <div className="hidden shrink-0 sm:block">
            <div className="glass rounded-2xl p-5 text-center shadow-3d shadow-inner-top">
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-straive-400 to-straive-600 text-white shadow-brand-glow">
                <IconRoute size={22} />
              </div>
              <div className="text-3xl font-extrabold tabular-nums text-white">{log.length}</div>
              <div className="text-xs text-navy-200">model calls logged</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* pipeline map */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<IconBolt size={18} />}
            title="The pipeline"
            subtitle="A guided, end-to-end flow. Foundation is live; steps roll out incrementally."
          />
          <CardBody className="space-y-2">
            {PIPELINE.map((item) => (
              <PipelineRow key={item.id} item={item} onClick={() => setView(item.id)} />
            ))}
          </CardBody>
        </Card>

        {/* completed example + disclaimers */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Example run" subtitle="A finished end-to-end demo — load it into the pipeline." />
            <CardBody>
              <div className="text-sm font-semibold text-ink-900">{SEED_COMPLETED_RUN.title}</div>
              <p className="mt-1 text-xs text-ink-500">{SEED_COMPLETED_RUN.summary}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone="warn">Compliance {SEED_COMPLETED_RUN.complianceScore}/100</Badge>
                <Badge tone="info">{SEED_COMPLETED_RUN.recommendation.split(' —')[0]}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<IconBolt size={14} />}
                  onClick={() => {
                    loadCompletedRun()
                    setView('step-5')
                    pushToast('success', 'Loaded the finished example run into every step.')
                  }}
                >
                  Load example run
                </Button>
                {hasRun && (
                  <Button variant="secondary" size="sm" onClick={() => setView('step-6')}>
                    Open Persona Lab
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
          <Disclaimer kind="legal" />
          <Disclaimer kind="synthetic" />
        </div>
      </div>
    </div>
  )
}

function PipelineRow({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-ink-200 px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-straive-300 hover:shadow-cardHover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-navy-700 to-navy-900 text-white shadow-sm transition group-hover:from-straive-500 group-hover:to-straive-600">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900">{item.label}</span>
          {item.status === 'ready' ? (
            <Badge tone="ok">Ready</Badge>
          ) : (
            <Badge tone="neutral">{item.statusLabel ?? 'Soon'}</Badge>
          )}
        </div>
        <p className="truncate text-xs text-ink-500">{item.blurb}</p>
      </div>
      <IconChevron size={16} className="shrink-0 text-ink-300" />
    </button>
  )
}

export type { ViewId }
