import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge, ratingTone, type BadgeTone } from '@/components/Badge'
import { Stat, SectionTitle, EmptyState } from '@/components/EmptyState'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { SEED_TOPIC_BACKLOG } from '@/seed/topicBacklog'
import {
  rankTopics,
  sortRanked,
  type RankedTopic,
  type SortKey,
} from '@/lib/topics'
import { buildTopicIntelPrompt, demoTopicIntel, TOPIC_INTEL_SYSTEM } from '@/lib/prompts/topicIntel'
import { runChat } from '@/lib/router/router'
import { fmtMs, fmtDateTime } from '@/lib/format'
import {
  IconSparkles,
  IconChevron,
  IconChevronDown,
  IconAlert,
  IconBolt,
} from '@/components/icons'
import { cn } from '@/lib/cn'

type StageFilter = 'all' | 'awareness' | 'consideration' | 'decision'
type BrandFilter = 'all' | 'onbrand' | 'offbrand'

export function TopicIntelligenceView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const selectedTopicId = useAppStore((s) => s.pipeline.selectedTopicId)
  const topicRead = useAppStore((s) => s.pipeline.topicRead)
  const selectTopic = useAppStore((s) => s.selectTopic)
  const setTopicRead = useAppStore((s) => s.setTopicRead)

  const [running, setRunning] = useState(false)
  const [sort, setSort] = useState<SortKey>('priority')
  const [stage, setStage] = useState<StageFilter>('all')
  const [brand, setBrand] = useState<BrandFilter>('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const ranked = useMemo(() => rankTopics(SEED_TOPIC_BACKLOG), [])

  const rows = useMemo(() => {
    let r = ranked
    if (stage !== 'all') r = r.filter((x) => x.topic.funnelStage === stage)
    if (brand === 'onbrand') r = r.filter((x) => x.topic.onBrand)
    if (brand === 'offbrand') r = r.filter((x) => !x.topic.onBrand)
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
  }, [ranked, stage, brand, query, sort])

  const onBrandCount = ranked.filter((r) => r.topic.onBrand).length
  const highRisk = ranked.filter((r) => r.topic.complianceSensitivity === 'High').length

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

  const exportPayload = {
    generatedAt: topicRead ? fmtDateTime(topicRead.ranAt) : null,
    editorialRead: topicRead?.text ?? null,
    ranking: ranked.map((r) => ({
      rank: r.rank,
      score: r.score.score,
      ...r.topic,
    })),
  }
  const exportMd = buildExportMarkdown(ranked, topicRead?.text)

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle
        title="Step 1 · Topic Intelligence"
        description="A ranked content-opportunity backlog with a compliance-sensitivity pre-score. Pick one to take forward."
        actions={
          <ExportButton name="topic-intelligence" json={exportPayload} markdown={exportMd} />
        }
      />

      {/* summary row */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Opportunities" value={ranked.length} />
        <Stat label="On-brand" value={`${onBrandCount}/${ranked.length}`} tone="ok" />
        <Stat label="High compliance risk" value={highRisk} tone={highRisk ? 'warn' : 'ok'} />
        <Stat label="Top score" value={ranked[0]?.score.score ?? '—'} />
      </div>

      {/* AI editorial read */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconSparkles size={18} />}
          title="AI editorial read"
          subtitle="A strategist's synthesis over the ranked backlog — decision support, not a mandate."
          actions={
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
        />
        <CardBody>
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
                  <p key={i} className={cn(i === topicRead.text.split('\n\n').length - 1 && 'text-xs italic text-ink-500')}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<IconSparkles size={20} />}
              title="No editorial read yet"
              description="Run the analysis to have the strategy model synthesize the backlog into prioritized recommendations. The ranking below is available now."
            />
          )}
        </CardBody>
      </Card>

      {/* ranked backlog */}
      <Card>
        <CardHeader
          title="Ranked backlog"
          subtitle="Opportunity score weighs demand up, difficulty and compliance load down; off-brand is penalized."
          actions={
            <div className="flex items-center gap-2">
              <SortSelect value={sort} onChange={setSort} />
            </div>
          }
        />
        <CardBody className="space-y-3">
          {/* filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, segments, tags…"
              className="h-9 w-full max-w-xs rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
            />
            <Segmented
              value={stage}
              onChange={(v) => setStage(v as StageFilter)}
              options={[
                { v: 'all', label: 'All stages' },
                { v: 'awareness', label: 'Awareness' },
                { v: 'consideration', label: 'Consideration' },
                { v: 'decision', label: 'Decision' },
              ]}
            />
            <Segmented
              value={brand}
              onChange={(v) => setBrand(v as BrandFilter)}
              options={[
                { v: 'all', label: 'All' },
                { v: 'onbrand', label: 'On-brand' },
                { v: 'offbrand', label: 'Off-brand' },
              ]}
            />
          </div>

          {/* table */}
          <div className="overflow-hidden rounded-xl border border-ink-200">
            <div className="hidden bg-ink-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 md:grid md:grid-cols-[2.5rem_1fr_7rem_6rem_6rem_5rem_auto] md:items-center md:gap-3">
              <span>#</span>
              <span>Topic</span>
              <span>Funnel</span>
              <span>Difficulty</span>
              <span>Compliance</span>
              <span>Score</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-ink-100">
              {rows.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-ink-400">
                  No topics match these filters.
                </div>
              )}
              {rows.map((row) => (
                <TopicRow
                  key={row.topic.id}
                  row={row}
                  selected={row.topic.id === selectedTopicId}
                  expanded={expanded === row.topic.id}
                  onToggle={() =>
                    setExpanded((e) => (e === row.topic.id ? null : row.topic.id))
                  }
                  onTakeForward={() => takeForward(row)}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-400">
            Scores are illustrative decision support derived from synthetic demand signals — a
            human editor selects the topic to take forward.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function TopicRow({
  row,
  selected,
  expanded,
  onToggle,
  onTakeForward,
}: {
  row: RankedTopic
  selected: boolean
  expanded: boolean
  onToggle: () => void
  onTakeForward: () => void
}) {
  const { topic, score, rank } = row
  return (
    <div className={cn(!topic.onBrand && 'bg-warn/5', selected && 'bg-straive-50')}>
      <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[2.5rem_1fr_7rem_6rem_6rem_5rem_auto]">
        <div className="hidden text-sm font-bold tabular-nums text-ink-400 md:block">
          {rank}
        </div>

        <button onClick={onToggle} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink-900">{topic.title}</span>
            {selected && <Badge tone="accent">Selected</Badge>}
            {!topic.onBrand && (
              <Badge tone="warn">
                <IconAlert size={11} /> Off-brand
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
            <span>{topic.audienceSegment}</span>
            <span className="text-ink-300">·</span>
            <span className="capitalize">{topic.format}</span>
            <IconChevronDown
              size={13}
              className={cn('text-ink-300 transition', expanded && 'rotate-180')}
            />
          </div>
        </button>

        <div className="hidden md:block">
          <Badge tone="neutral" className="capitalize">
            {topic.funnelStage}
          </Badge>
        </div>
        <div className="hidden md:block">
          <Badge tone={ratingTone(topic.difficulty)}>{topic.difficulty}</Badge>
        </div>
        <div className="hidden md:block">
          <Badge tone={ratingTone(topic.complianceSensitivity)}>
            {topic.complianceSensitivity}
          </Badge>
        </div>
        <ScorePill value={score.score} />

        <div className="flex justify-start md:justify-end">
          <Button
            size="sm"
            variant={topic.onBrand ? 'primary' : 'secondary'}
            onClick={onTakeForward}
          >
            {topic.onBrand ? 'Take forward' : 'Review anyway'}
            <IconChevron size={13} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink-100 bg-ink-50/60 px-4 py-3 md:pl-[3.4rem]">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
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
              <div className="flex flex-wrap gap-1.5 pt-1">
                {topic.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-ink-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-[13rem] rounded-lg border border-ink-200 bg-white p-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Score breakdown
              </div>
              <div className="space-y-1">
                {score.factors.map((f) => (
                  <div key={f.label} className="flex items-center justify-between text-xs">
                    <span className="text-ink-600">{f.label}</span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        f.delta >= 0 ? 'text-ok' : 'text-crit',
                      )}
                    >
                      {f.delta >= 0 ? '+' : ''}
                      {f.delta}
                    </span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-ink-100 pt-1 text-xs font-bold">
                  <span className="text-ink-700">Opportunity score</span>
                  <span className="tabular-nums text-ink-900">{score.score}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
        'inline-flex h-8 w-11 items-center justify-center rounded-lg text-sm font-bold tabular-nums ring-1',
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
  lines.push('| # | Topic | Score | Funnel | Demand | Difficulty | Compliance | On-brand |')
  lines.push('|---|-------|-------|--------|--------|------------|------------|----------|')
  for (const r of ranked) {
    lines.push(
      `| ${r.rank} | ${r.topic.title} | ${r.score.score} | ${r.topic.funnelStage} | ${r.topic.demand} | ${r.topic.difficulty} | ${r.topic.complianceSensitivity} | ${r.topic.onBrand ? 'Yes' : 'No'} |`,
    )
  }
  lines.push('', '_Synthetic / illustrative decision support — not a mandate._')
  return lines.join('\n')
}
