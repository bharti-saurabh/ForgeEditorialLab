import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge, ratingTone, type BadgeTone } from '@/components/Badge'
import { Stat, SectionTitle, EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Sparkline } from '@/components/Sparkline'
import { SEED_TOPIC_BACKLOG } from '@/seed/topicBacklog'
import { SEED_COMPETITOR_MOVES } from '@/seed/competitorMoves'
import {
  rankTopics,
  sortRanked,
  SCORE_PRESETS,
  DEFAULT_WEIGHTS,
  type RankedTopic,
  type SortKey,
  type ScoreWeights,
  type TopicScore,
} from '@/lib/topics'
import { buildTopicIntelPrompt, demoTopicIntel, TOPIC_INTEL_SYSTEM } from '@/lib/prompts/topicIntel'
import { runChat } from '@/lib/router/router'
import { uid, fmtMs, fmtDateTime } from '@/lib/format'
import type {
  CompetitorMove,
  DemandTrend,
  FunnelStage,
  Rating,
  RecommendedFormat,
  TopicOpportunity,
  TopicOrigin,
} from '@/types'
import {
  IconSparkles,
  IconChevron,
  IconAlert,
  IconBolt,
  IconPlus,
  IconTrash,
  IconLink,
  IconEye,
  IconLayers,
  IconX,
} from '@/components/icons'
import { cn } from '@/lib/cn'

type StageFilter = 'all' | 'awareness' | 'consideration' | 'decision'
type BrandFilter = 'all' | 'onbrand' | 'offbrand'
type OriginFilter = 'all' | 'trending' | 'user'
type PresetKey = 'balanced' | 'reach' | 'speed' | 'risk' | 'custom'

const DEMAND_SCORE: Record<Rating, number> = { High: 82, Medium: 62, Low: 42 }

const TREND_COLOR: Record<DemandTrend, string> = {
  rising: '#1f9d61',
  steady: '#7689a6',
  falling: '#d23b34',
}

const ORIGIN_META: Record<TopicOrigin, { label: string; className: string }> = {
  trending: { label: 'Trending', className: 'bg-straive-100 text-straive-700 ring-straive-200' },
  'competitor-gap': { label: 'Competitor gap', className: 'bg-info/10 text-info ring-info/30' },
  seasonal: { label: 'Seasonal', className: 'bg-warn/10 text-warn ring-warn/30' },
  evergreen: { label: 'Evergreen', className: 'bg-ink-100 text-ink-500 ring-ink-200' },
  user: { label: 'Yours', className: 'bg-violet-100 text-violet-700 ring-violet-200' },
}

const PRESETS: { k: Exclude<PresetKey, 'custom'>; label: string; hint: string }[] = [
  { k: 'balanced', label: 'Balanced', hint: 'Demand vs. effort vs. risk, evenly weighted.' },
  { k: 'reach', label: 'Max reach', hint: 'Chase the biggest audiences; discount effort and caution.' },
  { k: 'speed', label: 'Fast to ship', hint: 'Favor low-effort topics we can publish quickly.' },
  { k: 'risk', label: 'Low risk', hint: 'Push compliance-sensitive topics down the list.' },
]

export function TopicIntelligenceView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const selectedTopicId = useAppStore((s) => s.pipeline.selectedTopicId)
  const userTopics = useAppStore((s) => s.pipeline.userTopics)
  const selectTopic = useAppStore((s) => s.selectTopic)
  const addUserTopic = useAppStore((s) => s.addUserTopic)
  const removeUserTopic = useAppStore((s) => s.removeUserTopic)
  const topicRead = useAppStore((s) => s.pipeline.topicRead)
  const setTopicRead = useAppStore((s) => s.setTopicRead)

  const [running, setRunning] = useState(false)
  const [sort, setSort] = useState<SortKey>('priority')
  const [stage, setStage] = useState<StageFilter>('all')
  const [brand, setBrand] = useState<BrandFilter>('all')
  const [origin, setOrigin] = useState<OriginFilter>('all')
  const [query, setQuery] = useState('')

  // Priority tuner — local UI state (not persisted); default = today's behavior.
  const [preset, setPreset] = useState<PresetKey>('balanced')
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)

  // Master-detail focus (distinct from the pipeline's "taken forward" selection).
  const [activeId, setActiveId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Top-bar tools that overlay in any mode.
  const [showRead, setShowRead] = useState(false)
  const [showCompetitor, setShowCompetitor] = useState(false)

  const ranked = useMemo(
    () => rankTopics([...SEED_TOPIC_BACKLOG, ...userTopics], weights),
    [userTopics, weights],
  )

  const rows = useMemo(() => {
    let r = ranked
    if (stage !== 'all') r = r.filter((x) => x.topic.funnelStage === stage)
    if (brand === 'onbrand') r = r.filter((x) => x.topic.onBrand)
    if (brand === 'offbrand') r = r.filter((x) => !x.topic.onBrand)
    if (origin === 'trending') r = r.filter((x) => x.topic.origin === 'trending')
    if (origin === 'user') r = r.filter((x) => x.topic.origin === 'user')
    if (query.trim()) {
      const q = query.toLowerCase()
      r = r.filter(
        (x) =>
          x.topic.title.toLowerCase().includes(q) ||
          x.topic.audienceSegment.toLowerCase().includes(q) ||
          x.topic.tags.some((t) => t.includes(q)),
      )
    }
    return sortRanked(r, sort)
  }, [ranked, stage, brand, origin, query, sort])

  const activeRow = useMemo(
    () => ranked.find((r) => r.topic.id === activeId) ?? null,
    [ranked, activeId],
  )

  const onBrandCount = ranked.filter((r) => r.topic.onBrand).length
  const highRisk = ranked.filter((r) => r.topic.complianceSensitivity === 'High').length
  const trendingCount = ranked.filter((r) => r.topic.origin === 'trending').length

  function applyPreset(k: Exclude<PresetKey, 'custom'>) {
    setPreset(k)
    setWeights(SCORE_PRESETS[k])
  }

  function changeWeight(dim: keyof ScoreWeights, value: number) {
    setPreset('custom')
    setWeights((w) => ({ ...w, [dim]: value }))
  }

  function focusTopic(id: string) {
    setAdding(false)
    setActiveId(id)
  }

  function backToOverview() {
    setActiveId(null)
    setAdding(false)
  }

  function openAdd() {
    setActiveId(null)
    setAdding(true)
  }

  async function runAnalysis() {
    setRunning(true)
    try {
      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 1 · Topic Intelligence',
        system: TOPIC_INTEL_SYSTEM,
        user: buildTopicIntelPrompt(profile, ranked),
        reason:
          'Frontier reasoning model — synthesizes demand, gaps, seasonality, and regulatory sensitivity into a ranked editorial read.',
        maxTokens: 900,
        demo: () => demoTopicIntel(profile, ranked),
      })
      setTopicRead({ text, modelLabel: entry.modelLabel, mode, ranAt: entry.ts })
      pushToast(
        mode === 'live' ? 'success' : 'info',
        mode === 'live'
          ? `Editorial read generated in ${fmtMs(entry.latencyMs)}.`
          : 'Editorial read generated (demo mode).',
      )
    } catch {
      pushToast('error', 'Could not generate the editorial read.')
    } finally {
      setRunning(false)
    }
  }

  function takeForward(row: RankedTopic) {
    selectTopic(row.topic.id)
    if (!row.topic.onBrand) {
      pushToast('info', `"${row.topic.title}" is off-brand — carried forward for review only.`)
    } else {
      pushToast('success', `Selected "${row.topic.title}" for the brief.`)
    }
    setView('step-2')
  }

  function handleAdd(topic: TopicOpportunity) {
    addUserTopic(topic)
    setAdding(false)
    setActiveId(topic.id)
    pushToast('success', `Added "${topic.title}" to the backlog.`)
  }

  function handleRemove(row: RankedTopic) {
    removeUserTopic(row.topic.id)
    if (activeId === row.topic.id) setActiveId(null)
    pushToast('info', `Removed "${row.topic.title}".`)
  }

  const exportPayload = {
    generatedAt: topicRead ? fmtDateTime(topicRead.ranAt) : null,
    editorialRead: topicRead?.text ?? null,
    lens: preset,
    weights,
    ranking: ranked.map((r) => ({ rank: r.rank, score: r.score.score, ...r.topic })),
  }
  const exportMd = buildExportMarkdown(ranked, topicRead?.text)

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Step 1 · Topic Intelligence"
        description="A self-serve opportunity workspace. Tune what matters, scan the ranked backlog on the left, and open any topic to see its evidence before taking it forward."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<IconSparkles size={15} />}
              onClick={() => setShowRead(true)}
            >
              AI read
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconEye size={15} />}
              onClick={() => setShowCompetitor(true)}
            >
              Competitor watch
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-crit animate-pulse-dot" />
            </Button>
            <ExportButton name="topic-intelligence" json={exportPayload} markdown={exportMd} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(340px,380px)_1fr]">
        {/* LEFT — ranked backlog (sticky driver) */}
        <div>
          <div className="lg:sticky lg:top-4">
            <Card>
              <CardHeader
                title="Ranked backlog"
                subtitle={`${rows.length} of ${ranked.length} shown`}
                actions={
                  <Button
                    variant={adding ? 'secondary' : 'ghost'}
                    size="sm"
                    icon={<IconPlus size={14} />}
                    onClick={openAdd}
                  >
                    Add
                  </Button>
                }
              />

              {/* controls */}
              <div className="space-y-3 border-b border-ink-100 px-4 py-3.5">
                <PriorityLens
                  preset={preset}
                  weights={weights}
                  onPreset={applyPreset}
                  onWeight={changeWeight}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search topics, segments, tags…"
                  className="h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Segmented
                    value={origin}
                    onChange={(v) => setOrigin(v as OriginFilter)}
                    options={[
                      { v: 'all', label: 'All' },
                      { v: 'trending', label: 'Trending' },
                      { v: 'user', label: 'Yours' },
                    ]}
                  />
                  <Segmented
                    value={brand}
                    onChange={(v) => setBrand(v as BrandFilter)}
                    options={[
                      { v: 'all', label: 'Any brand' },
                      { v: 'onbrand', label: 'On-brand' },
                      { v: 'offbrand', label: 'Off' },
                    ]}
                  />
                  <SortSelect value={sort} onChange={setSort} />
                </div>
                <Segmented
                  value={stage}
                  onChange={(v) => setStage(v as StageFilter)}
                  options={[
                    { v: 'all', label: 'All stages' },
                    { v: 'awareness', label: 'Aware' },
                    { v: 'consideration', label: 'Consider' },
                    { v: 'decision', label: 'Decide' },
                  ]}
                />
              </div>

              {/* list */}
              <div className="max-h-[52vh] divide-y divide-ink-100 overflow-y-auto lg:max-h-[calc(100vh-20rem)]">
                {rows.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-ink-400">
                    No topics match these filters.
                  </div>
                )}
                {rows.map((row) => (
                  <BacklogRow
                    key={row.topic.id}
                    row={row}
                    focused={row.topic.id === activeId}
                    taken={row.topic.id === selectedTopicId}
                    onClick={() => focusTopic(row.topic.id)}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* RIGHT — detail / add / overview */}
        <div className="min-w-0 space-y-5">
          {adding ? (
            <AddTopicForm onAdd={handleAdd} onCancel={backToOverview} />
          ) : activeRow ? (
            <TopicDetail
              row={activeRow}
              taken={activeRow.topic.id === selectedTopicId}
              onTakeForward={() => takeForward(activeRow)}
              onRemove={() => handleRemove(activeRow)}
              onBack={backToOverview}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Opportunities" value={ranked.length} />
                <Stat label="Trending now" value={trendingCount} tone="ok" />
                <Stat label="On-brand" value={`${onBrandCount}/${ranked.length}`} tone="ok" />
                <Stat label="High compliance risk" value={highRisk} tone={highRisk ? 'warn' : 'ok'} />
              </div>

              <Card>
                <CardBody className="space-y-4">
                  <EmptyState
                    icon={<IconLayers size={22} />}
                    title="Pick a topic to dig in"
                    description="Select any topic on the left to see its demand trend, competitor coverage, sources, and score breakdown — then take it forward. Or open one of the tools below."
                  />
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<IconSparkles size={15} />}
                      onClick={() => setShowRead(true)}
                    >
                      AI editorial read
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<IconEye size={15} />}
                      onClick={() => setShowCompetitor(true)}
                    >
                      Competitor watch
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          <p className="text-xs text-ink-400">
            Trend & competitor signals are compiled from public sources (cited) as of mid-2026;
            scores are illustrative decision support — a human editor selects the topic to take
            forward.
          </p>
        </div>
      </div>

      {/* AI editorial read — overlay tool */}
      <Modal
        open={showRead}
        onClose={() => setShowRead(false)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <IconSparkles size={18} /> AI editorial read
          </span>
        }
        subtitle="A strategist's synthesis over the ranked backlog — decision support, not a mandate."
        footer={
          <Button
            variant="primary"
            size="sm"
            loading={running}
            icon={!running ? <IconBolt size={15} /> : undefined}
            onClick={runAnalysis}
          >
            {topicRead ? 'Re-run analysis' : 'Prioritize backlog'}
          </Button>
        }
      >
        {topicRead ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ModelTag role="strategy" modelLabel={topicRead.modelLabel} mode={topicRead.mode} />
              <span className="text-xs text-ink-400">
                Generated {fmtDateTime(topicRead.ranAt)}
              </span>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-ink-700">
              {topicRead.text.split('\n\n').map((para, i) => (
                <p
                  key={i}
                  className={cn(
                    i === topicRead.text.split('\n\n').length - 1 &&
                      'text-xs italic text-ink-500',
                  )}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<IconSparkles size={20} />}
            title="No editorial read yet"
            description="Run the analysis to have the strategy model synthesize the backlog into prioritized recommendations. The ranking is available now."
          />
        )}
      </Modal>

      {/* Competitor watch — overlay tool (simulated live feed) */}
      <Modal
        open={showCompetitor}
        onClose={() => setShowCompetitor(false)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <IconEye size={18} /> Competitor watch
          </span>
        }
        subtitle="Recent moves from major issuers — a simulated live feed for market context."
      >
        <CompetitorFeed />
      </Modal>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Left panel — priority tuner + compact rows
 * ------------------------------------------------------------------------- */

/** Preset "lenses" + optional weight sliders that live re-rank the backlog. */
function PriorityLens({
  preset,
  weights,
  onPreset,
  onWeight,
}: {
  preset: PresetKey
  weights: ScoreWeights
  onPreset: (k: Exclude<PresetKey, 'custom'>) => void
  onWeight: (dim: keyof ScoreWeights, value: number) => void
}) {
  const [open, setOpen] = useState(false)
  const activeHint =
    preset === 'custom'
      ? 'Custom weighting — drag the sliders to shape the ranking.'
      : PRESETS.find((p) => p.k === preset)?.hint

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          Prioritize for
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-semibold text-straive-600 transition hover:text-straive-700"
        >
          {open ? 'Hide sliders' : 'Tune ▾'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.k}
            onClick={() => onPreset(p.k)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition',
              preset === p.k
                ? 'bg-navy-900 text-white shadow-card'
                : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-900',
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="rounded-lg bg-straive-100 px-2.5 py-1 text-xs font-semibold text-straive-700 ring-1 ring-straive-200">
            Custom
          </span>
        )}
      </div>
      {activeHint && <p className="mt-1.5 text-[11px] leading-snug text-ink-400">{activeHint}</p>}
      {open && (
        <div className="mt-3 space-y-2.5 border-t border-ink-200 pt-3">
          <WeightSlider
            label="Demand pull"
            value={weights.demand}
            onChange={(v) => onWeight('demand', v)}
          />
          <WeightSlider
            label="Effort sensitivity"
            value={weights.effort}
            onChange={(v) => onWeight('effort', v)}
          />
          <WeightSlider
            label="Compliance caution"
            value={weights.compliance}
            onChange={(v) => onWeight('compliance', v)}
          />
        </div>
      )}
    </div>
  )
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-ink-600">{label}</span>
        <span className="tabular-nums text-ink-400">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        step={10}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-straive-500"
      />
    </label>
  )
}

/** Compact, clickable backlog row — the master list. */
function BacklogRow({
  row,
  focused,
  taken,
  onClick,
}: {
  row: RankedTopic
  focused: boolean
  taken: boolean
  onClick: () => void
}) {
  const { topic, score, rank } = row
  const signals = topic.signals
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition',
        focused
          ? 'border-straive-500 bg-straive-50'
          : cn('border-transparent hover:bg-ink-50', !topic.onBrand && 'bg-warn/5'),
      )}
    >
      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-ink-400">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900">{topic.title}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <OriginBadge origin={topic.origin} />
          {taken && (
            <span className="inline-flex items-center rounded-md bg-straive-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Selected
            </span>
          )}
          {!topic.onBrand && <IconAlert size={12} className="text-warn" />}
          {signals && (
            <Sparkline
              data={signals.demandSeries}
              width={40}
              height={14}
              color={TREND_COLOR[signals.demandTrend]}
            />
          )}
        </div>
      </div>
      <ScorePill value={score.score} />
      <IconChevron
        size={14}
        className={cn('shrink-0 transition', focused ? 'text-straive-500' : 'text-ink-300')}
      />
    </button>
  )
}

/* ----------------------------------------------------------------------------
 * Right panel — topic detail
 * ------------------------------------------------------------------------- */

function TopicDetail({
  row,
  taken,
  onTakeForward,
  onRemove,
  onBack,
}: {
  row: RankedTopic
  taken: boolean
  onTakeForward: () => void
  onRemove: () => void
  onBack: () => void
}) {
  const { topic, score, rank } = row
  return (
    <Card>
      <CardHeader
        icon={
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-sm font-bold tabular-nums text-ink-500">
            {rank}
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {topic.title}
            <OriginBadge origin={topic.origin} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{topic.audienceSegment}</span>
            <span className="text-ink-300">·</span>
            <span className="capitalize">{topic.funnelStage}</span>
            <span className="text-ink-300">·</span>
            <span className="capitalize">{topic.format}</span>
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Overview
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {taken && <Badge tone="accent">Selected for brief</Badge>}
          {!topic.onBrand && (
            <Badge tone="warn">
              <IconAlert size={11} /> Off-brand
            </Badge>
          )}
          <Badge tone="neutral" className="capitalize">
            {topic.funnelStage}
          </Badge>
          <Badge tone={ratingTone(topic.difficulty)}>Difficulty: {topic.difficulty}</Badge>
          <Badge tone={ratingTone(topic.complianceSensitivity)}>
            Compliance: {topic.complianceSensitivity}
          </Badge>
        </div>

        {topic.signals && <SignalsPanel topic={topic} />}

        <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
          <div className="space-y-2 text-sm">
            <p className="text-ink-700">
              <span className="font-semibold text-ink-800">Why this topic: </span>
              {topic.rationale}
            </p>
            {!topic.onBrand && topic.offBrandReason && (
              <p className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs text-ink-700">
                <span className="font-semibold text-warn">Off-brand flag: </span>
                {topic.offBrandReason}
              </p>
            )}
            {topic.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {topic.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-ink-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ScoreBreakdown score={score} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3.5">
          <Button variant={topic.onBrand ? 'primary' : 'secondary'} onClick={onTakeForward}>
            {topic.onBrand ? 'Take forward to brief' : 'Review anyway'}
            <IconChevron size={14} />
          </Button>
          {topic.origin === 'user' && (
            <Button variant="ghost" size="sm" icon={<IconTrash size={14} />} onClick={onRemove}>
              Remove topic
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function ScoreBreakdown({ score }: { score: TopicScore }) {
  return (
    <div className="h-fit rounded-lg border border-ink-200 bg-ink-50/60 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        Score breakdown
      </div>
      <div className="space-y-1">
        {score.factors.map((f) => (
          <div key={f.label} className="flex items-center justify-between text-xs">
            <span className="text-ink-600">{f.label}</span>
            <span
              className={cn('font-semibold tabular-nums', f.delta >= 0 ? 'text-ok' : 'text-crit')}
            >
              {f.delta >= 0 ? '+' : ''}
              {f.delta}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-ink-200 pt-1 text-xs font-bold">
          <span className="text-ink-700">Opportunity score</span>
          <span className="tabular-nums text-ink-900">{score.score}</span>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Shared building blocks
 * ------------------------------------------------------------------------- */

/** Provenance chip: how the topic entered the backlog. */
function OriginBadge({ origin }: { origin?: TopicOrigin }) {
  const meta = ORIGIN_META[origin ?? 'evergreen']
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

function TrendTag({ trend }: { trend: DemandTrend }) {
  const map: Record<DemandTrend, { sym: string; cls: string; label: string }> = {
    rising: { sym: '▲', cls: 'text-ok', label: 'Rising' },
    steady: { sym: '→', cls: 'text-ink-400', label: 'Steady' },
    falling: { sym: '▼', cls: 'text-crit', label: 'Falling' },
  }
  const m = map[trend]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', m.cls)}>
      <span className="text-[10px]">{m.sym}</span>
      {m.label}
    </span>
  )
}

/** The evidence panel: demand trend mini-viz, competitor coverage, and source. */
function SignalsPanel({ topic }: { topic: TopicOpportunity }) {
  const s = topic.signals!
  const gap = s.competitors.length - s.ourAssets
  return (
    <div className="grid gap-4 rounded-xl border border-ink-200 bg-white p-3.5 sm:grid-cols-3">
      {/* demand */}
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          Search demand{s.trendWindow ? ` · ${s.trendWindow}` : ''}
        </div>
        <div className="flex items-center gap-3">
          <Sparkline
            data={s.demandSeries}
            width={104}
            height={36}
            color={TREND_COLOR[s.demandTrend]}
          />
          <div className="space-y-0.5">
            <TrendTag trend={s.demandTrend} />
            <div className="text-xs text-ink-500">{topic.demand} interest</div>
          </div>
        </div>
      </div>

      {/* competitors */}
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          Competitors publishing
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.competitors.map((c) =>
            c.url ? (
              <a
                key={c.name}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-700 ring-1 ring-ink-200 transition hover:bg-info/10 hover:text-info hover:ring-info/30"
              >
                {c.name}
                <IconLink size={11} />
              </a>
            ) : (
              <span
                key={c.name}
                className="inline-flex items-center rounded-md bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-700 ring-1 ring-ink-200"
              >
                {c.name}
              </span>
            ),
          )}
        </div>
        <div className="mt-1.5 text-xs text-ink-500">
          {gap > 0 ? (
            <span>
              <span className="font-semibold text-info">Content gap:</span> {s.competitors.length}{' '}
              competitor{s.competitors.length === 1 ? '' : 's'} vs {s.ourAssets} of our assets
            </span>
          ) : (
            <span>
              We have {s.ourAssets} asset{s.ourAssets === 1 ? '' : 's'} on this
            </span>
          )}
        </div>
      </div>

      {/* source */}
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          Source
        </div>
        {s.source ? (
          <a
            href={s.source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-start gap-1 text-xs font-medium text-info hover:underline"
          >
            <span>
              {s.source.publisher}
              <span className="text-ink-400"> · {s.source.date}</span>
            </span>
            <IconLink size={11} className="mt-0.5 shrink-0" />
          </a>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Competitor watch — simulated live feed
 * ------------------------------------------------------------------------- */

interface FeedItem {
  move: CompetitorMove
  key: number
  addedAtMs: number
}

const FEED_MAX = 6
const FEED_INTERVAL_MS = 4500

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

function relTime(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

/** Animated, clearly-labeled simulated feed of recent competitor moves. */
function CompetitorFeed() {
  const reduced = usePrefersReducedMotion()
  const idxRef = useRef(0)
  const keyRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [feed, setFeed] = useState<FeedItem[]>(() => {
    const base = Date.now()
    const seedCount = Math.min(5, SEED_COMPETITOR_MOVES.length)
    const init: FeedItem[] = []
    for (let i = 0; i < seedCount; i += 1) {
      init.push({ move: SEED_COMPETITOR_MOVES[i], key: i, addedAtMs: base - (i + 1) * 43_000 })
    }
    idxRef.current = seedCount % SEED_COMPETITOR_MOVES.length
    keyRef.current = seedCount
    return init
  })

  // Advance the feed on an interval (unless paused or reduced-motion).
  useEffect(() => {
    if (paused || reduced) return
    const id = setInterval(() => {
      const i = idxRef.current
      idxRef.current = i + 1
      const move = SEED_COMPETITOR_MOVES[i % SEED_COMPETITOR_MOVES.length]
      const item: FeedItem = { move, key: keyRef.current, addedAtMs: Date.now() }
      keyRef.current += 1
      setFeed((prev) => [item, ...prev].slice(0, FEED_MAX))
      setNow(Date.now())
    }, FEED_INTERVAL_MS)
    return () => clearInterval(id)
  }, [paused, reduced])

  // Keep relative timestamps fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  const live = !paused && !reduced

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ring-1',
            live ? 'bg-crit/10 text-crit ring-crit/25' : 'bg-ink-100 text-ink-400 ring-ink-200',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              live ? 'animate-pulse-dot bg-crit' : 'bg-ink-400',
            )}
          />
          {live ? 'Live · scanning newsrooms' : reduced ? 'Static' : 'Paused'}
        </span>
        {!reduced && (
          <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? '► Resume' : '❚❚ Pause'}
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        {feed.map((item, i) => (
          <a
            key={item.key}
            href={item.move.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'group flex gap-3 rounded-xl border px-3.5 py-3 transition hover:border-info/40 hover:shadow-cardHover',
              i === 0 && live ? 'animate-feed-in border-info/40 bg-info/5' : 'border-ink-200',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">{item.move.competitor}</span>
                <span className="text-[11px] tabular-nums text-ink-400">
                  {relTime(item.addedAtMs, now)}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{item.move.move}</p>
            </div>
            <IconLink
              size={13}
              className="mt-0.5 shrink-0 text-ink-300 transition group-hover:text-info"
            />
          </a>
        ))}
      </div>

      <p className="pt-3 text-[11px] text-ink-400">
        Simulated live feed · illustrative, compiled from public sources (cited). No external calls —
        all data stays in your browser.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Add-topic form + small controls
 * ------------------------------------------------------------------------- */

/** Form to add an editor's own topic to the backlog. */
function AddTopicForm({
  onAdd,
  onCancel,
}: {
  onAdd: (t: TopicOpportunity) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [segment, setSegment] = useState('')
  const [funnel, setFunnel] = useState<FunnelStage>('awareness')
  const [format, setFormat] = useState<RecommendedFormat>('blog')
  const [demand, setDemand] = useState<Rating>('Medium')
  const [difficulty, setDifficulty] = useState<Rating>('Medium')
  const [compliance, setCompliance] = useState<Rating>('Medium')

  const inputCls =
    'h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20'
  const selCls =
    'h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm font-medium text-ink-700 focus:border-straive-400 focus:outline-none'

  function submit() {
    const t = title.trim()
    if (!t) return
    onAdd({
      id: `topic_user_${uid()}`,
      title: t,
      rationale: 'Added by an editor to the backlog.',
      audienceSegment: segment.trim() || 'General audience',
      funnelStage: funnel,
      format,
      demand,
      demandScore: DEMAND_SCORE[demand],
      difficulty,
      complianceSensitivity: compliance,
      onBrand: true,
      tags: [],
      origin: 'user',
    })
  }

  return (
    <Card>
      <CardHeader
        icon={<IconPlus size={18} />}
        title="Add a topic to the backlog"
        subtitle="Your topic is scored and ranked alongside the rest, and can be taken all the way through the pipeline."
        actions={
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-ink-400 transition hover:text-ink-700"
          >
            <IconX size={18} />
          </button>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Topic headline (required)"
            className={cn(inputCls, 'flex-[2]')}
          />
          <input
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            placeholder="Audience segment"
            className={cn(inputCls, 'flex-1')}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <LabeledSelect label="Funnel" value={funnel} onChange={(v) => setFunnel(v as FunnelStage)} cls={selCls}>
            <option value="awareness">Awareness</option>
            <option value="consideration">Consideration</option>
            <option value="decision">Decision</option>
          </LabeledSelect>
          <LabeledSelect label="Format" value={format} onChange={(v) => setFormat(v as RecommendedFormat)} cls={selCls}>
            <option value="blog">Blog</option>
            <option value="explainer">Explainer</option>
            <option value="email">Email</option>
            <option value="social">Social</option>
            <option value="landing-page">Landing page</option>
          </LabeledSelect>
          <LabeledSelect label="Demand" value={demand} onChange={(v) => setDemand(v as Rating)} cls={selCls}>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </LabeledSelect>
          <LabeledSelect label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as Rating)} cls={selCls}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </LabeledSelect>
          <LabeledSelect label="Compliance" value={compliance} onChange={(v) => setCompliance(v as Rating)} cls={selCls}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </LabeledSelect>
          <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={submit} className="ml-auto">
            Add to backlog
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function LabeledSelect({
  label,
  value,
  onChange,
  cls,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  cls: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {children}
      </select>
    </label>
  )
}

function ScorePill({ value }: { value: number }) {
  const tone: BadgeTone = value >= 80 ? 'ok' : value >= 60 ? 'warn' : 'crit'
  const color =
    tone === 'ok'
      ? 'bg-ok/10 text-ok ring-ok/20'
      : tone === 'warn'
        ? 'bg-warn/10 text-warn ring-warn/25'
        : 'bg-crit/10 text-crit ring-crit/25'
  return (
    <span
      className={cn(
        'inline-flex h-8 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ring-1',
        color,
      )}
    >
      {value}
    </span>
  )
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-500">
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 focus:border-straive-400 focus:outline-none"
      >
        <option value="priority">Priority</option>
        <option value="demand">Demand</option>
        <option value="difficulty">Difficulty</option>
        <option value="compliance">Compliance risk</option>
        <option value="title">A–Z</option>
      </select>
    </label>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition',
            value === o.v ? 'bg-navy-900 text-white' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function buildExportMarkdown(ranked: RankedTopic[], read?: string): string {
  const lines: string[] = ['# Topic Intelligence — Ranked Backlog', '']
  if (read) {
    lines.push('## AI editorial read', '', read, '')
  }
  lines.push('## Ranking', '')
  lines.push('| # | Topic | Score | Origin | Funnel | Demand | Difficulty | Compliance | On-brand |')
  lines.push('|---|-------|-------|--------|--------|--------|------------|------------|----------|')
  for (const r of ranked) {
    lines.push(
      `| ${r.rank} | ${r.topic.title} | ${r.score.score} | ${r.topic.origin ?? 'evergreen'} | ${r.topic.funnelStage} | ${r.topic.demand} | ${r.topic.difficulty} | ${r.topic.complianceSensitivity} | ${r.topic.onBrand ? 'Yes' : 'No'} |`,
    )
  }
  lines.push(
    '',
    '_Trend & competitor signals compiled from public sources (cited); scores are synthetic / illustrative decision support — not a mandate._',
  )
  return lines.join('\n')
}
