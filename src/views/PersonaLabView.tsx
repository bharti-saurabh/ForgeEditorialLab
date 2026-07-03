import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SectionTitle, EmptyState, Stat } from '@/components/EmptyState'
import { ScoreGauge } from '@/components/ScoreGauge'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { SEED_SEGMENTS } from '@/seed/segments'
import { findTopic } from '@/lib/topics'
import { currentScore } from '@/lib/complianceEngine'
import {
  LENS_ORDER,
  PANEL_MIN,
  PANEL_MAX,
  FAIRNESS_NOTE,
  defaultPanel,
  simulateSurvey,
  simulateComment,
  aggregateMetrics,
  overallScore,
  buildRecommendation,
  checkFairness,
  rowAverage,
  SENTIMENT_TONE,
} from '@/lib/persona'
import {
  PERSONA_SYSTEM,
  buildSynthesisPrompt,
  demoSynthesis,
} from '@/lib/prompts/persona'
import { runChat } from '@/lib/router/router'
import { uid, fmtDateTime } from '@/lib/format'
import type {
  FairnessFlag,
  FocusComment,
  PersonaLabState,
  Segment,
  SurveyRow,
} from '@/types'
import {
  IconUsers,
  IconChevron,
  IconBolt,
  IconRefresh,
  IconBeaker,
  IconAlert,
  IconShield,
  IconPlus,
} from '@/components/icons'
import { cn } from '@/lib/cn'

const BAND = (v: number) => (v >= 80 ? '#16794c' : v >= 60 ? '#b7791f' : '#c0362c')
const NAVY = '#123a5e'

export function PersonaLabView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const pipeline = useAppStore((s) => s.pipeline)
  const setPersona = useAppStore((s) => s.setPersona)
  const requestRevisions = useAppStore((s) => s.requestRevisions)

  const topic = useMemo(
    () => findTopic(pipeline.selectedTopicId, pipeline.userTopics),
    [pipeline.selectedTopicId, pipeline.userTopics],
  )
  const draft = pipeline.drafts.find((d) => d.id === pipeline.chosenDraftId) ?? null
  const compliance = pipeline.compliance
  const persona = pipeline.persona

  const [customSegs, setCustomSegs] = useState<Segment[]>([])
  const allSegments = useMemo(() => [...SEED_SEGMENTS, ...customSegs], [customSegs])
  const [panelIds, setPanelIds] = useState<string[]>(() =>
    persona?.panelSegmentIds ?? (topic ? defaultPanel(topic, SEED_SEGMENTS) : []),
  )
  const [flags, setFlags] = useState<FairnessFlag[]>(() => persona?.fairnessFlags ?? [])
  const [running, setRunning] = useState(false)

  if (!topic || !draft) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle title="Step 6 · Persona Lab" description="Validate the piece against a synthetic audience." />
        <EmptyState
          icon={<IconUsers size={22} />}
          title="Nothing to test yet"
          description="Persona Lab reacts to a specific draft. Pick a topic and write a draft first."
          action={
            <Button variant="primary" icon={<IconChevron size={15} />} onClick={() => setView('step-1')}>
              Go to Topic Intelligence
            </Button>
          }
        />
      </div>
    )
  }

  function toggle(id: string) {
    setPanelIds((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length >= PANEL_MAX
          ? ids
          : [...ids, id],
    )
  }

  function addCustom(name: string, desc: string) {
    const res = checkFairness(`${name} ${desc}`)
    const flag: FairnessFlag = {
      id: uid('fair'),
      ts: Date.now(),
      text: name,
      blocked: res.blocked,
      reason: res.reason,
    }
    setFlags((f) => [...f, flag])
    if (res.blocked) {
      pushToast('error', 'Blocked: segment references a protected class or proxy.')
      return
    }
    const seg: Segment = {
      id: uid('seg_custom'),
      name,
      lens: 'Financial Mindset & Behavior',
      description: desc || 'Custom behavioral segment.',
      motivations: [desc || 'a clear, fair deal'],
      objections: ['unclear terms'],
    }
    setCustomSegs((c) => [...c, seg])
    setPanelIds((ids) => (ids.length < PANEL_MAX ? [...ids, seg.id] : ids))
    pushToast('success', `Added "${name}" to the panel.`)
  }

  async function run() {
    if (panelIds.length < PANEL_MIN) return
    setRunning(true)
    try {
      const brandMatch = draft!.brandMatch.score
      const complianceScore = compliance ? currentScore(compliance) : 72
      const panel = allSegments.filter((s) => panelIds.includes(s.id))
      const survey: SurveyRow[] = panel.map((s) =>
        simulateSurvey(s, topic!, { brandMatch, complianceScore }),
      )
      const comments: FocusComment[] = panel.map((s, i) => simulateComment(s, topic!, survey[i]))
      const metrics = aggregateMetrics(survey)
      const rec = buildRecommendation(metrics, survey, comments)

      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 6 · Focus group synthesis',
        system: PERSONA_SYSTEM,
        user: buildSynthesisPrompt(topic!, comments, metrics, rec),
        reason: 'Reasoning model — synthesizes the synthetic panel into a decision-ready read.',
        maxTokens: 600,
        demo: () => demoSynthesis(topic!, comments, metrics, rec),
      })

      const state: PersonaLabState = {
        runAt: entry.ts,
        panelSegmentIds: panelIds,
        comments,
        synthesis: text,
        synthesisModelLabel: entry.modelLabel,
        synthesisMode: mode,
        survey,
        metrics,
        recommendation: rec,
        fairnessNote: FAIRNESS_NOTE,
        fairnessFlags: flags,
      }
      setPersona(state)
      pushToast(mode === 'live' ? 'success' : 'info', `Persona Lab complete — ${overallScore(metrics)}/100 overall.`)
    } catch {
      pushToast('error', 'Could not run the persona panel.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Step 6 · Persona Lab"
        description="A synthetic focus group + survey across behavioral segments — directional signal to guide the decision."
        actions={
          <div className="flex items-center gap-2">
            {persona && (
              <Button variant="secondary" size="sm" icon={<IconRefresh size={15} />} onClick={() => setView('step-2')}>
                Send revisions
              </Button>
            )}
            {persona && (
              <ExportButton
                name={`persona-${topic.id}`}
                json={persona}
                markdown={buildPersonaMarkdown(topic.title, persona)}
                print
              />
            )}
          </div>
        }
      />

      <Disclaimer kind="synthetic" className="mb-5" />

      {/* panel builder */}
      <PanelBuilder
        segments={allSegments}
        panelIds={panelIds}
        onToggle={toggle}
        onAddCustom={addCustom}
        onDefault={() => setPanelIds(defaultPanel(topic, SEED_SEGMENTS))}
        onRun={run}
        running={running}
        hasRun={!!persona}
      />

      {persona && (
        <PersonaResults
          state={persona}
          onReviseNow={() => {
            requestRevisions('Persona Lab flagged weak resonance.')
          }}
        />
      )}

      {/* fairness guardrail */}
      <Card className="mt-5">
        <CardHeader icon={<IconShield size={18} />} title="Fairness guardrail" subtitle="Reg B / ECOA — segments are behavioral only." />
        <CardBody className="space-y-2">
          <p className="text-sm text-ink-600">{FAIRNESS_NOTE}</p>
          {flags.length > 0 && (
            <ul className="space-y-1.5">
              {[...flags].reverse().map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm">
                  <Badge tone={f.blocked ? 'crit' : 'ok'}>{f.blocked ? 'Blocked' : 'Cleared'}</Badge>
                  <span className="flex-1 text-ink-700">
                    <span className="font-medium text-ink-900">"{f.text}"</span> — {f.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function PanelBuilder({
  segments,
  panelIds,
  onToggle,
  onAddCustom,
  onDefault,
  onRun,
  running,
  hasRun,
}: {
  segments: Segment[]
  panelIds: string[]
  onToggle: (id: string) => void
  onAddCustom: (name: string, desc: string) => void
  onDefault: () => void
  onRun: () => void
  running: boolean
  hasRun: boolean
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const count = panelIds.length
  const tooFew = count < PANEL_MIN
  const full = count >= PANEL_MAX

  return (
    <Card className="mb-5">
      <CardHeader
        icon={<IconUsers size={18} />}
        title="Build the panel"
        subtitle={`Pick ${PANEL_MIN}-${PANEL_MAX} behavioral segments. ${count} selected.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDefault}>Reset to suggested</Button>
            <Button
              variant="primary"
              size="sm"
              loading={running}
              icon={!running ? <IconBolt size={14} /> : undefined}
              disabled={tooFew || running}
              onClick={onRun}
            >
              {hasRun ? 'Re-run panel' : 'Run panel'}
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {LENS_ORDER.map((lens) => (
          <div key={lens}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{lens}</div>
            <div className="flex flex-wrap gap-1.5">
              {segments
                .filter((s) => s.lens === lens)
                .map((s) => {
                  const on = panelIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      title={s.description}
                      onClick={() => onToggle(s.id)}
                      disabled={!on && full}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                        on
                          ? 'border-navy-900 bg-navy-900 text-white'
                          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 disabled:opacity-40',
                      )}
                    >
                      {s.name}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}

        {/* custom segment */}
        <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-3">
          <div className="mb-2 text-xs font-semibold text-ink-600">Add a custom behavioral segment</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Segment name (e.g. Rate-Shoppers)"
              className="h-9 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Behavior / need (not identity)"
              className="h-9 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<IconPlus size={14} />}
              disabled={!name.trim() || full}
              onClick={() => {
                onAddCustom(name.trim(), desc.trim())
                setName('')
                setDesc('')
              }}
            >
              Add
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            Screened against Reg B / ECOA — protected classes and proxies (race, religion, sex, age, ZIP, etc.) are blocked.
          </p>
        </div>

        {tooFew && (
          <div className="flex items-center gap-2 text-xs text-warn">
            <IconAlert size={13} /> Select at least {PANEL_MIN} segments to run the panel.
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function PersonaResults({
  state,
  onReviseNow,
}: {
  state: PersonaLabState
  onReviseNow: () => void
}) {
  const overall = overallScore(state.metrics)
  const rec = state.recommendation
  const recTone = rec.verdict === 'ship' ? 'ok' : rec.verdict === 'ab-test' ? 'info' : 'warn'
  const metricData = state.metrics.map((m) => ({ name: m.label, score: m.average }))
  const segData = [...state.survey]
    .map((r) => ({ name: shortName(r.segmentName), score: rowAverage(r) }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-5">
      {/* scoreboard */}
      <Card>
        <CardBody className="flex flex-col items-center gap-5 sm:flex-row">
          <ScoreGauge value={overall} size={104} label="Panel resonance" />
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={recTone} dot>{rec.verdict === 'ab-test' ? 'A/B test' : rec.verdict === 'ship' ? 'Ship' : 'Revise'}</Badge>
              <span className="text-sm font-medium text-ink-800">{rec.headline}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {state.metrics.map((m) => (
                <Stat key={m.key} label={m.label} value={m.average} tone={m.average >= 70 ? 'ok' : m.average >= 55 ? 'warn' : 'crit'} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<IconBeaker size={18} />} title="Survey averages" subtitle="Mean synthetic score per dimension (0-100)." />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metricData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={54}>
                  {metricData.map((d, i) => (
                    <Cell key={i} fill={BAND(d.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<IconUsers size={18} />} title="By segment" subtitle="Overall resonance per panel segment." />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={segData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {segData.map((d, i) => (
                    <Cell key={i} fill={d.score >= 60 ? NAVY : '#c0362c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* synthesis */}
      <Card>
        <CardHeader icon={<IconBeaker size={18} />} title="Focus-group synthesis" subtitle="AI read over the synthetic panel — directional, not representative." />
        <CardBody>
          <div className="mb-3 flex items-center gap-2">
            <ModelTag role="strategy" modelLabel={state.synthesisModelLabel} mode={state.synthesisMode} />
            <span className="text-xs text-ink-400">Run {fmtDateTime(state.runAt)}</span>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-ink-700">
            {state.synthesis.split('\n\n').map((p, i) => (
              <p key={i} className={cn(p.startsWith('Recommendation') && 'font-semibold text-ink-900')}>{p}</p>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* comments */}
      <Card>
        <CardHeader icon={<IconUsers size={18} />} title={`Panel reactions (${state.comments.length})`} subtitle="One simulated voice per segment." />
        <CardBody className="space-y-3">
          {state.comments.map((c) => (
            <div key={c.segmentId} className="rounded-xl border border-ink-200 p-3.5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">{c.segmentName}</span>
                <Badge tone="neutral">{c.lens}</Badge>
                <Badge tone={SENTIMENT_TONE[c.sentiment]} dot>{c.sentiment}</Badge>
              </div>
              <p className="text-sm italic text-ink-700">"{c.quote}"</p>
              <p className="mt-1 text-xs text-ink-500">Top objection: {c.objection}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* recommendation + A/B plan */}
      <Card>
        <CardHeader icon={<IconBolt size={18} />} title="Recommendation & A/B test plan" subtitle={rec.headline} />
        <CardBody className="space-y-3">
          <div className={cn('rounded-lg border px-4 py-3 text-sm', recTone === 'ok' ? 'border-ok/25 bg-ok/5' : recTone === 'info' ? 'border-info/25 bg-info/5' : 'border-warn/30 bg-warn/5')}>
            {rec.rationale}
          </div>
          <ol className="space-y-1.5">
            {rec.abPlan.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[10px] font-bold text-white">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          {rec.verdict !== 'ship' && (
            <div className="pt-1">
              <Button variant="secondary" size="sm" icon={<IconRefresh size={14} />} onClick={onReviseNow}>
                Send revisions back to Step 2
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function shortName(name: string): string {
  return name.length > 16 ? name.slice(0, 15) + '…' : name
}

function buildPersonaMarkdown(topicTitle: string, s: PersonaLabState): string {
  const lines: string[] = [`# Persona Lab — ${topicTitle}`, '']
  lines.push(`_Synthetic audience results are directional signal, not a real survey._`, '')
  lines.push(`**Overall resonance:** ${overallScore(s.metrics)}/100`)
  lines.push(`**Survey averages:** ${s.metrics.map((m) => `${m.label} ${m.average}`).join(', ')}`, '')
  lines.push('## Synthesis', '', s.synthesis, '')
  lines.push('## Panel reactions', '')
  for (const c of s.comments) {
    lines.push(`### ${c.segmentName} (${c.lens}) — ${c.sentiment}`)
    lines.push(`> ${c.quote}`)
    lines.push(`- Objection: ${c.objection}`, '')
  }
  lines.push('## Survey (per segment)', '')
  lines.push('| Segment | Clarity | Trust | Appeal | Intent |', '| --- | --- | --- | --- | --- |')
  for (const r of s.survey)
    lines.push(`| ${r.segmentName} | ${r.clarity} | ${r.trust} | ${r.appeal} | ${r.intent} |`)
  lines.push('', `## Recommendation: ${s.recommendation.verdict}`, '', s.recommendation.rationale, '')
  lines.push('### A/B test plan')
  lines.push(...s.recommendation.abPlan.map((p) => `- ${p}`), '')
  lines.push('## Fairness', '', s.fairnessNote)
  for (const f of s.fairnessFlags)
    lines.push(`- [${f.blocked ? 'BLOCKED' : 'cleared'}] "${f.text}" — ${f.reason}`)
  lines.push('', '_Directional signal only. Confirm with real audience data before major spend._')
  return lines.join('\n')
}
