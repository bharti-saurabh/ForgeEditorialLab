import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import {
  buildGroundedRecoPrompt,
  demoGroundedReco,
  coerceReco,
  GROUNDED_SEARCH_SYSTEM,
  type RawReco,
} from '@/lib/prompts/topicIntel'
import { runChat } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import { discoverTopic } from '@/discovery/discover'
import { fetchTrending } from '@/discovery/trending'
import type { DiscoverPayload, Mode as DiscoveryMode, TrendingBoard } from '@/discovery/types'
import { uid, fmtMs, fmtDateTime } from '@/lib/format'
import type {
  CallMode,
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
  IconRefresh,
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

  // Generative campaign search — a free-text query → one pointed recommendation.
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [reco, setReco] = useState<{
    raw: RawReco
    topic: TopicOpportunity
    modelLabel: string
    mode: CallMode
    discovery: DiscoverPayload
    discoveryMode: DiscoveryMode
    discoveryNote?: string
  } | null>(null)

  // Top-bar tools that overlay in any mode.
  const [showRead, setShowRead] = useState(false)
  const [showBacklog, setShowBacklog] = useState(false)

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
    setReco(null)
    setActiveId(id)
    setShowBacklog(false)
  }

  function backToOverview() {
    setActiveId(null)
    setAdding(false)
    setReco(null)
  }

  function openAdd() {
    setActiveId(null)
    setReco(null)
    setAdding(true)
    setShowBacklog(false)
  }

  function recoToTopic(raw: RawReco): TopicOpportunity {
    return {
      id: `topic_reco_${uid()}`,
      title: raw.title,
      rationale: raw.rationale,
      audienceSegment: raw.audienceSegment,
      funnelStage: raw.funnelStage,
      format: raw.format,
      demand: raw.demand,
      demandScore: DEMAND_SCORE[raw.demand],
      difficulty: raw.difficulty,
      complianceSensitivity: raw.complianceSensitivity,
      onBrand: raw.onBrand,
      offBrandReason: raw.offBrandReason || undefined,
      tags: raw.tags,
      origin: 'user',
    }
  }

  async function runSearch(qArg?: string) {
    const q = (qArg ?? searchQuery).trim()
    if (!q || searching) return
    if (qArg) setSearchQuery(qArg)
    setSearching(true)
    try {
      // 1) Pull real market signals (trending / competitor angles / buzz).
      const disc = await discoverTopic(q)
      // 2) Synthesize one pointed recommendation grounded in those signals.
      const base = demoGroundedReco(profile, q, disc.payload)
      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 1 · Grounded campaign recommendation',
        system: GROUNDED_SEARCH_SYSTEM,
        user: buildGroundedRecoPrompt(profile, q, disc.payload),
        reason: 'Strategy model — grounds one pointed, on-brand campaign recommendation in real trending/competitor/buzz signals.',
        maxTokens: 800,
        demo: () => JSON.stringify(base),
      })
      const raw = coerceReco(base, parseJsonLoose<Partial<RawReco>>(text))
      setAdding(false)
      setActiveId(null)
      setReco({
        raw,
        topic: recoToTopic(raw),
        modelLabel: entry.modelLabel,
        mode,
        discovery: disc.payload,
        discoveryMode: disc.mode,
        discoveryNote: disc.note,
      })
      pushToast(mode === 'live' ? 'success' : 'info', 'Grounded campaign recommendation ready.')
    } catch {
      pushToast('error', 'Could not generate a recommendation.')
    } finally {
      setSearching(false)
    }
  }

  function takeRecoForward() {
    if (!reco) return
    addUserTopic(reco.topic)
    selectTopic(reco.topic.id)
    setReco(null)
    pushToast('success', `Selected "${reco.topic.title}" for the brief.`)
    setView('step-2')
  }

  function addRecoToBacklog() {
    if (!reco) return
    addUserTopic(reco.topic)
    const id = reco.topic.id
    setReco(null)
    setActiveId(id)
    pushToast('success', 'Added the recommendation to your backlog.')
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
        description="A self-serve opportunity workspace. Watch what's trending live on the left, describe a campaign to get a grounded recommendation, or browse the ranked backlog."
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
              icon={<IconLayers size={15} />}
              onClick={() => { setAdding(false); setShowBacklog(true) }}
            >
              Backlog
              <span className="ml-1.5 rounded-full bg-ink-200 px-1.5 text-[10px] font-bold text-ink-600">{ranked.length}</span>
            </Button>
            <ExportButton name="topic-intelligence" json={exportPayload} markdown={exportMd} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(360px,420px)_1fr]">
        {/* LEFT — find an opportunity: describe an idea OR pick a trend */}
        <div>
          <div className="lg:sticky lg:top-4 space-y-3">
            <CampaignSearch
              query={searchQuery}
              onQuery={setSearchQuery}
              onSearch={() => runSearch()}
              onExample={(ex) => runSearch(ex)}
              searching={searching}
            />
            <div className="flex items-center gap-2 px-1">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">or pick what's trending</span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>
            <TrendingNow onPick={(t) => void runSearch(t)} busy={searching} />
          </div>
        </div>

        {/* RIGHT — the result: recommendation / detail / add / overview */}
        <div className="min-w-0 space-y-5">
          {adding ? (
            <AddTopicForm onAdd={handleAdd} onCancel={backToOverview} />
          ) : reco ? (
            <RecommendationCard
              raw={reco.raw}
              modelLabel={reco.modelLabel}
              mode={reco.mode}
              discovery={reco.discovery}
              discoveryMode={reco.discoveryMode}
              discoveryNote={reco.discoveryNote}
              onTakeForward={takeRecoForward}
              onAddToBacklog={addRecoToBacklog}
              onDismiss={() => setReco(null)}
            />
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
                    title="Your recommendation appears here"
                    description="Describe a campaign idea or pick a trend on the left to get a grounded recommendation with cited sources. Prefer the ranked list? Open the backlog."
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
                      icon={<IconLayers size={15} />}
                      onClick={() => { setAdding(false); setShowBacklog(true) }}
                    >
                      Browse backlog
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

      {/* Ranked backlog — moved behind a button */}
      <Modal
        open={showBacklog}
        onClose={() => setShowBacklog(false)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <IconLayers size={18} /> Ranked backlog
          </span>
        }
        subtitle="Tune what matters, filter, and open any topic to see its evidence — then take it forward."
      >
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
                  placeholder="Filter this backlog…"
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
      </Modal>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Generative campaign search — free-text query → one pointed recommendation
 * ------------------------------------------------------------------------- */

const SEARCH_EXAMPLES = [
  'Balance transfers for holiday debt',
  'Building credit from scratch',
  'Travel rewards for first-timers',
  'Avoiding late fees',
]

function CampaignSearch({
  query,
  onQuery,
  onSearch,
  onExample,
  searching,
}: {
  query: string
  onQuery: (v: string) => void
  onSearch: () => void
  onExample: (ex: string) => void
  searching: boolean
}) {
  return (
    <Card>
      <CardBody className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <IconSparkles size={16} className="text-straive-500" />
          Describe a campaign idea
        </div>
        <p className="text-xs leading-snug text-ink-500">
          Type a theme → one on-brand, compliance-aware recommendation, grounded in live trends with cited sources.
        </p>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="e.g. balance transfers, building credit, holiday spending…"
          className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
        />
        <Button
          variant="primary"
          loading={searching}
          icon={!searching ? <IconSparkles size={15} /> : undefined}
          disabled={!query.trim() || searching}
          onClick={onSearch}
          className="w-full justify-center"
        >
          Recommend
        </Button>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-ink-400">Try:</span>
          {SEARCH_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onExample(ex)}
              disabled={searching}
              className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink-600 transition hover:border-straive-300 hover:text-straive-700 disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

/** The generated campaign recommendation, shown in the detail panel. */
function RecommendationCard({
  raw,
  modelLabel,
  mode,
  discovery,
  discoveryMode,
  discoveryNote,
  onTakeForward,
  onAddToBacklog,
  onDismiss,
}: {
  raw: RawReco
  modelLabel: string
  mode: CallMode
  discovery: DiscoverPayload
  discoveryMode: DiscoveryMode
  discoveryNote?: string
  onTakeForward: () => void
  onAddToBacklog: () => void
  onDismiss: () => void
}) {
  const live = discoveryMode === 'live'
  return (
    <Card className="ring-2 ring-straive-500/25">
      <CardHeader
        icon={<IconSparkles size={18} className="text-straive-500" />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {raw.title}
            {raw.onBrand ? <Badge tone="ok">On-brand</Badge> : <Badge tone="warn">Off-brand</Badge>}
          </span>
        }
        subtitle="Recommended campaign — review, then take it forward or park it in the backlog."
        actions={<Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
              live ? 'bg-ok/10 text-ok ring-ok/25' : 'bg-ink-100 text-ink-500 ring-ink-200',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-ok' : 'bg-ink-400')} />
            {live ? 'Grounded · live signals' : 'Grounded · seeded signals'}
          </span>
          <ModelTag role="strategy" modelLabel={modelLabel} mode={mode} />
        </div>
        {raw.sourceInsight && <p className="text-[11px] text-ink-500">{raw.sourceInsight}</p>}

        <p className="text-sm italic text-ink-700">{raw.angle}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" className="capitalize">{raw.funnelStage}</Badge>
          <Badge tone="neutral" className="capitalize">{raw.format}</Badge>
          <Badge tone="neutral">Demand: {raw.demand}</Badge>
          <Badge tone={ratingTone(raw.difficulty)}>Difficulty: {raw.difficulty}</Badge>
          <Badge tone={ratingTone(raw.complianceSensitivity)}>Compliance: {raw.complianceSensitivity}</Badge>
        </div>

        {!raw.onBrand && raw.offBrandReason && (
          <p className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs text-ink-700">
            <span className="font-semibold text-warn">Off-brand flag: </span>
            {raw.offBrandReason}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <RecoField label="Who it's for" value={raw.audienceSegment} />
          <RecoField label="Why now" value={raw.whyNow} />
        </div>
        <RecoField label="Key message" value={raw.keyMessage} />

        <p className="text-sm text-ink-700">
          <span className="font-semibold text-ink-800">Why it fits: </span>
          {raw.rationale}
        </p>

        {raw.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {raw.tags.map((t) => (
              <span key={t} className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-ink-200">
                #{t}
              </span>
            ))}
          </div>
        )}

        <EvidencePanel discovery={discovery} note={discoveryNote} />

        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3.5">
          <Button variant={raw.onBrand ? 'primary' : 'secondary'} onClick={onTakeForward}>
            {raw.onBrand ? 'Take forward to brief' : 'Review anyway'}
            <IconChevron size={14} />
          </Button>
          <Button variant="secondary" size="sm" icon={<IconPlus size={14} />} onClick={onAddToBacklog}>
            Add to backlog
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function RecoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <p className="text-sm text-ink-700">{value}</p>
    </div>
  )
}

const SENTIMENT_DOT: Record<string, string> = { positive: 'bg-ok', mixed: 'bg-warn', negative: 'bg-crit' }

/** The retrieved market signals the recommendation was grounded in. */
function EvidencePanel({ discovery, note }: { discovery: DiscoverPayload; note?: string }) {
  const trending = discovery.trending.slice(0, 3)
  const gap = discovery.competitors[0]
  const buzz = discovery.buzz.slice(0, 2)
  const sources = discovery.sources.slice(0, 4)
  const hasAny = trending.length || gap || buzz.length || sources.length
  if (!hasAny) return null

  return (
    <div className="rounded-lg border border-info/20 bg-info/[0.03] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-info">
        <IconEye size={13} /> Evidence behind this
      </div>
      <div className="space-y-2.5 text-xs">
        {trending.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-ink-500">Trending</div>
            <ul className="space-y-1">
              {trending.map((t, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', t.momentum === 'rising' ? 'bg-ok' : t.momentum === 'new' ? 'bg-info' : 'bg-ink-300')} />
                  <span className="text-ink-700">
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer" className="hover:text-info hover:underline">{t.title}</a>
                    ) : (
                      t.title
                    )}
                    <span className="text-ink-400"> · {t.source} · {t.momentum}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {gap && (
          <div>
            <div className="mb-0.5 font-semibold text-ink-500">Competitor lane (the crowded angle)</div>
            <p className="text-ink-700"><span className="font-medium">{gap.name}:</span> {gap.angle}</p>
          </div>
        )}
        {buzz.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-ink-500">Buzz</div>
            <ul className="space-y-1">
              {buzz.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', SENTIMENT_DOT[b.sentiment] ?? 'bg-ink-300')} />
                  <span className="italic text-ink-700">"{b.quote}" <span className="not-italic text-ink-400">— {b.source}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <span className="font-semibold text-ink-500">Sources:</span>
            {sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
                {s.title}
                <IconLink size={10} />
              </a>
            ))}
          </div>
        )}
        {note && <p className="pt-0.5 text-[11px] text-ink-400">{note}</p>}
      </div>
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
 * Trending now — live discovery board (replaces the simulated competitor feed)
 * ------------------------------------------------------------------------- */

const SOURCE_ICON: Record<string, string> = {
  'Google News': '📰',
  Wikipedia: '📚',
  'Hacker News': '🟧',
  Reddit: '👽',
  YouTube: '▶️',
}

/** Purely-planned connectors (not yet wired at all) — shown as "soon" chips
 *  alongside the API's real "unavailable" sources (which carry a why-tooltip). */
const PLANNED_SOURCES = ['TikTok', 'X', 'LinkedIn']

/**
 * Live "what's trending" board from free public feeds (Google News / HN / Reddit
 * / Wikipedia), fetched server-side via /api/discover. It's the primary Step-1
 * surface: click a trend to seed a grounded campaign recommendation, or search
 * news by keyword. Refresh re-pulls the feeds. Seeded fallback when offline.
 */
function TrendingNow({ onPick, busy }: { onPick: (title: string) => void; busy: boolean }) {
  const [board, setBoard] = useState<TrendingBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [financeOnly, setFinanceOnly] = useState(false)

  // Live refetch: query='' + sector='' → general; a term → keyword news search;
  // sector='finance' → re-pull top finance-sector topics (real, not client-filtered).
  const load = useCallback((query = '', sector = '') => {
    setLoading(true)
    setActiveQuery(query)
    fetchTrending({}, query, sector)
      .then(setBoard)
      .catch(() => setBoard(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  const live = board?.mode === 'live'
  const groups = board?.groups ?? []
  const empty = !!board && groups.length === 0 && !loading

  function toggleFinance() {
    const next = !financeOnly
    setFinanceOnly(next)
    setQ('')
    load('', next ? 'finance' : '')
  }
  function runKeyword() {
    if (q.trim().length < 2) return
    setFinanceOnly(false)
    load(q.trim(), '')
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Trending now
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                live ? 'bg-ok/10 text-ok ring-ok/25' : 'bg-ink-100 text-ink-400 ring-ink-200',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'animate-pulse-dot bg-ok' : 'bg-ink-400')} />
              {live ? 'Live' : loading ? '…' : 'Demo'}
            </span>
          </span>
        }
        subtitle="Live public signals — click any item to build a grounded campaign."
        actions={
          <Button
            variant="ghost"
            size="sm"
            loading={loading}
            icon={!loading ? <IconRefresh size={14} /> : undefined}
            onClick={() => load(activeQuery, financeOnly ? 'finance' : '')}
          >
            Refresh
          </Button>
        }
      />

      {/* news search */}
      <div className="border-b border-ink-100 px-4 py-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            runKeyword()
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search news by keyword…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={loading || q.trim().length < 2}>
            Search
          </Button>
        </form>
        {/* finance-sector toggle — refetches top finance topics, not a client filter */}
        <div className="mt-2 flex items-center gap-2">
          <button
            role="switch"
            aria-checked={financeOnly}
            onClick={toggleFinance}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60',
              financeOnly
                ? 'border-straive-500 bg-straive-50 text-straive-700'
                : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', financeOnly ? 'bg-straive-500' : 'bg-ink-300')} />
            Finance sector
          </button>
          <span className="text-[11px] text-ink-400">re-pulls top finance topics</span>
        </div>
        {(activeQuery || financeOnly) && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white">
            <span className="min-w-0 truncate">
              <span className="text-navy-300">{financeOnly ? 'Showing: ' : 'Results for: '}</span>
              <span className="font-semibold">{financeOnly ? 'Top finance-sector topics' : activeQuery}</span>
            </span>
            <button
              onClick={() => { setQ(''); setFinanceOnly(false); load('') }}
              className="shrink-0 rounded p-0.5 text-navy-300 transition hover:text-white"
              aria-label="Back to general trending"
            >
              <IconX size={14} />
            </button>
          </div>
        )}
      </div>

      {/* scrollable feed */}
      <div className="max-h-[calc(100vh-33rem)] min-h-[12rem] overflow-y-auto px-2 py-2">
        {loading && !board && (
          <div className="space-y-4 p-2">
            {[0, 1, 2].map((c) => (
              <div key={c}>
                <div className="mb-2 h-3 w-24 rounded bg-ink-100" />
                {[0, 1, 2].map((r) => (
                  <div key={r} className="mb-1.5 h-8 rounded bg-ink-50" />
                ))}
              </div>
            ))}
          </div>
        )}

        {empty && (
          <p className="px-2 py-8 text-center text-sm text-ink-400">
            {financeOnly
              ? 'No finance-sector topics came back right now. Try Refresh, or a keyword like "credit cards".'
              : activeQuery
                ? `No live news found for "${activeQuery}". Try a broader term.`
                : 'No trends available right now.'}
          </p>
        )}

        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.source}>
              <div className="mb-0.5 flex items-center gap-1.5 px-2">
                <span aria-hidden className="text-xs">{SOURCE_ICON[g.source] ?? '📈'}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{g.source}</span>
                <span className={cn('h-1.5 w-1.5 rounded-full', g.live ? 'bg-ok' : 'bg-ink-300')} title={g.live ? 'live' : 'illustrative'} />
              </div>
              <ol>
                {g.items.map((it, i) => (
                  <li key={i}>
                    <button
                      onClick={() => onPick(it.title)}
                      disabled={busy}
                      title={`Build a campaign from "${it.title}"`}
                      className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-straive-50 disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink-800 group-hover:text-straive-700">{it.title}</span>
                        {it.meta && <span className="mt-0.5 block truncate text-[11px] text-ink-400">{it.meta}</span>}
                        {it.context && (
                          <span className="mt-0.5 line-clamp-2 text-[11px] italic leading-snug text-ink-400">
                            why: {it.context}
                          </span>
                        )}
                      </span>
                      <IconChevron size={14} className="mt-0.5 shrink-0 text-ink-300 opacity-0 transition group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

      </div>

      {/* more sources — the API's real "unavailable" list (why-tooltip) + purely-planned ones */}
      <div className="border-t border-ink-100 px-4 py-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          More sources <span className="font-normal normal-case text-ink-300">· hover for why</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {board?.unavailable.map((u) => (
            <span
              key={u.source}
              title={u.reason}
              className="inline-flex cursor-help items-center gap-1 rounded-md border border-dashed border-ink-200 bg-ink-50/60 px-2 py-0.5 text-[11px] font-medium text-ink-500"
            >
              {u.source}
              <span className="rounded-full bg-ink-200 px-1 text-[9px] font-bold lowercase text-ink-500">?</span>
            </span>
          ))}
          {PLANNED_SOURCES.map((s) => (
            <span
              key={s}
              title="Planned connector — coming soon"
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-dashed border-ink-200 bg-ink-50/60 px-2 py-0.5 text-[11px] font-medium text-ink-400"
            >
              {s}
              <span className="rounded-full bg-ink-200 px-1 text-[9px] font-bold uppercase tracking-wide text-ink-500">soon</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
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
