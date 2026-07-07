import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SectionTitle, EmptyState } from '@/components/EmptyState'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { SEED_SEGMENTS } from '@/seed/segments'
import { findTopic } from '@/lib/topics'
import { channelSpec } from '@/lib/channels'
import {
  LENS_ORDER,
  PARTICIPANT_MIN,
  PARTICIPANT_MAX,
  SEGMENT_MIN,
  FAIRNESS_NOTE,
  SENTIMENT_TONE,
  defaultPanel,
  checkFairness,
} from '@/lib/persona'
import {
  demoParticipants,
  distributeSegments,
  coerceParticipant,
  buildAgenda,
  moderatorOpening,
  demoDiscussionTurns,
  coerceTurns,
  computeStats,
  demoSummary,
  demoRecommendations,
  demoRevise,
  type RawParticipant,
  type RawTurn,
} from '@/lib/focusGroup'
import {
  PERSONA_GEN_SYSTEM,
  buildPersonaGenPrompt,
  DISCUSSION_SYSTEM,
  buildDiscussionPrompt,
  SUMMARY_SYSTEM,
  buildSummaryPrompt,
  REVISE_SYSTEM,
  buildRevisePrompt,
} from '@/lib/prompts/persona'
import { runChat } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import { Markdown } from '@/components/Markdown'
import { uid, fmtDateTime } from '@/lib/format'
import type {
  ContentRecommendation,
  DiscussionTurn,
  FairnessFlag,
  FocusGroupStats,
  Participant,
  PersonaLabState,
  RevisedDraft,
  Segment,
} from '@/types'
import {
  IconUsers,
  IconChevron,
  IconBolt,
  IconRefresh,
  IconAlert,
  IconShield,
  IconPlus,
  IconSparkles,
  IconCheck,
  IconDoc,
  IconCopy,
} from '@/components/icons'
import { cn } from '@/lib/cn'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 6-slot avatar palette (paired with initials via participant.avatarSeed).
const AVATAR_BG = ['bg-navy-700', 'bg-straive-500', 'bg-info', 'bg-ok', 'bg-warn', 'bg-navy-900']

function toRaw(p: Participant): RawParticipant {
  return {
    name: p.name,
    archetype: p.archetype,
    personality: p.personality,
    likes: p.likes,
    dislikes: p.dislikes,
    interests: p.interests,
    goals: p.goals,
    frustrations: p.frustrations,
    bio: p.bio,
    voice: p.voice,
  }
}

export function PersonaLabView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const pipeline = useAppStore((s) => s.pipeline)
  const setPersona = useAppStore((s) => s.setPersona)
  const requestRevisions = useAppStore((s) => s.requestRevisions)

  const topic = useMemo(
    () => findTopic(pipeline.selectedTopicId, pipeline.userTopics),
    [pipeline.selectedTopicId, pipeline.userTopics],
  )
  const draft = pipeline.drafts.find((d) => d.id === pipeline.chosenDraftId) ?? null
  const persona = pipeline.persona
  const channel = pipeline.primaryChannel

  const [customSegs, setCustomSegs] = useState<Segment[]>([])
  const allSegments = useMemo(() => [...SEED_SEGMENTS, ...customSegs], [customSegs])
  const [segIds, setSegIds] = useState<string[]>(() =>
    persona?.config.segmentIds ?? (topic ? defaultPanel(topic, SEED_SEGMENTS) : []),
  )
  const [count, setCount] = useState<number>(persona?.config.participantCount ?? 4)
  const [flags, setFlags] = useState<FairnessFlag[]>(() => persona?.fairnessFlags ?? [])
  const [generating, setGenerating] = useState(false)
  const [running, setRunning] = useState(false)
  const [wrapping, setWrapping] = useState(false)
  const [revising, setRevising] = useState(false)
  const [live, setLive] = useState<DiscussionTurn[] | null>(null)
  const abort = useRef(false)

  if (!topic || !draft) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle title="Step 6 · Persona Lab" description="Pressure-test the piece with a live focus group." />
        <EmptyState
          icon={<IconUsers size={22} />}
          title="Nothing to test yet"
          description="The focus group reacts to a specific draft. Pick a topic and write a draft first."
          action={
            <Button variant="primary" icon={<IconChevron size={15} />} onClick={() => setView('step-1')}>
              Go to Topic Intelligence
            </Button>
          }
        />
      </div>
    )
  }

  function toggleSeg(id: string) {
    setSegIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function addCustom(name: string, desc: string) {
    const res = checkFairness(`${name} ${desc}`)
    const flag: FairnessFlag = { id: uid('fair'), ts: Date.now(), text: name, blocked: res.blocked, reason: res.reason }
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
    setSegIds((ids) => [...ids, seg.id])
    pushToast('success', `Added "${name}" as a segment.`)
  }

  async function generate() {
    if (segIds.length < SEGMENT_MIN) return
    setGenerating(true)
    try {
      const seed = Date.now() % 1_000_000
      const chosen = segIds.map((id) => allSegments.find((s) => s.id === id)).filter(Boolean) as Segment[]
      const assigned = distributeSegments(segIds, count).map(
        (id) => allSegments.find((s) => s.id === id)!,
      )
      const slots = assigned.map((segment) => ({ segment }))

      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 6 · Persona generation',
        system: PERSONA_GEN_SYSTEM,
        user: buildPersonaGenPrompt(profile, topic!, slots),
        reason: 'Reasoning model — instantiates believable, behavioral focus-group participants.',
        maxTokens: 1400,
        demo: () => JSON.stringify(demoParticipants(chosen, count, seed).map(toRaw)),
      })
      const parsed = parseJsonLoose<RawParticipant[]>(text)
      const raws = Array.isArray(parsed) ? parsed : demoParticipants(chosen, count, seed).map(toRaw)
      const participants = assigned.map((seg, i) => coerceParticipant(raws[i] ?? {}, seg, i, seed))

      const state: PersonaLabState = {
        runAt: entry.ts,
        channel,
        stage: 'personas',
        config: { segmentIds: segIds, participantCount: count },
        participants,
        agenda: buildAgenda(topic!, channel),
        transcript: [],
        summary: '',
        stats: null,
        recommendations: [],
        selectedRecIds: [],
        revisedDraft: null,
        moderatorModelLabel: entry.modelLabel,
        mode,
        fairnessNote: FAIRNESS_NOTE,
        fairnessFlags: flags,
      }
      setLive(null)
      setPersona(state)
      pushToast(mode === 'live' ? 'success' : 'info', `${participants.length} participants ready.`)
    } catch {
      pushToast('error', 'Could not generate the participants.')
    } finally {
      setGenerating(false)
    }
  }

  async function startDiscussion() {
    if (!persona) return
    setRunning(true)
    abort.current = false
    const seed = Date.now() % 1_000_000
    const turns: DiscussionTurn[] = []
    const push = async (t: DiscussionTurn, delay: number) => {
      turns.push({ ...t, ts: Date.now() })
      setLive([...turns])
      await sleep(delay)
    }
    try {
      await push(
        { id: 'turn_open', agendaItemId: 'open', kind: 'moderator', speakerId: null, speakerName: 'Moderator', text: moderatorOpening(topic!, channel, persona.participants.length), ts: 0 },
        650,
      )
      let mode: PersonaLabState['mode'] = 'demo'
      for (const item of persona.agenda) {
        if (abort.current) break
        await push({ id: `turn_mod_${item.id}`, agendaItemId: item.id, kind: 'moderator', speakerId: null, speakerName: 'Moderator', text: item.prompt, ts: 0 }, 550)

        const res = await runChat({
          role: 'strategy',
          step: `Step 6 · Discussion — ${item.title}`,
          system: DISCUSSION_SYSTEM,
          user: buildDiscussionPrompt(profile, topic!, draft!, persona.participants, item),
          reason: 'Reasoning model — role-plays each participant reacting to the copy in character.',
          maxTokens: 900,
          demo: () =>
            JSON.stringify(
              demoDiscussionTurns(item, persona.participants, topic!, seed).map((t) => ({ text: t.text, sentiment: t.sentiment })),
            ),
        })
        mode = res.mode
        const parsed = parseJsonLoose<RawTurn[]>(res.text)
        const itemTurns = Array.isArray(parsed)
          ? coerceTurns(parsed, item, persona.participants, topic!, seed)
          : demoDiscussionTurns(item, persona.participants, topic!, seed)
        for (const t of itemTurns) {
          if (abort.current) break
          await push(t, 480)
        }
      }

      setPersona({ ...persona, stage: 'discussion', transcript: turns, mode })
      setLive(null)
      pushToast('success', 'Focus group discussion complete.')
    } catch {
      pushToast('error', 'The discussion was interrupted.')
    } finally {
      setRunning(false)
    }
  }

  async function wrapUp() {
    if (!persona) return
    setWrapping(true)
    try {
      const stats = computeStats(persona.transcript, persona.participants)
      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 6 · Focus group summary',
        system: SUMMARY_SYSTEM,
        user: buildSummaryPrompt(topic!, persona.transcript, stats),
        reason: 'Reasoning model — synthesizes the transcript into a read + content recommendations.',
        maxTokens: 900,
        demo: () =>
          JSON.stringify({
            summary: demoSummary(topic!, stats),
            recommendations: demoRecommendations(topic!, stats).map(({ id: _id, ...r }) => r),
          }),
      })
      const parsed = parseJsonLoose<{ summary?: string; recommendations?: Partial<ContentRecommendation>[] }>(text)
      const summary = parsed?.summary?.trim() || demoSummary(topic!, stats)
      const rawRecs = Array.isArray(parsed?.recommendations) && parsed!.recommendations!.length
        ? parsed!.recommendations!
        : demoRecommendations(topic!, stats)
      const recommendations: ContentRecommendation[] = rawRecs.slice(0, 4).map((r, i) => ({
        id: `rec_${i}`,
        title: String(r.title ?? `Recommendation ${i + 1}`),
        detail: String(r.detail ?? ''),
        rationale: String(r.rationale ?? ''),
        addresses: String(r.addresses ?? ''),
      }))
      setPersona({ ...persona, stage: 'complete', stats, summary, recommendations, selectedRecIds: [], moderatorModelLabel: entry.modelLabel, mode })
      pushToast(mode === 'live' ? 'success' : 'info', 'Summary + recommendations ready.')
    } catch {
      pushToast('error', 'Could not summarize the discussion.')
    } finally {
      setWrapping(false)
    }
  }

  function toggleRec(id: string) {
    if (!persona) return
    const sel = persona.selectedRecIds.includes(id)
      ? persona.selectedRecIds.filter((x) => x !== id)
      : [...persona.selectedRecIds, id]
    setPersona({ ...persona, selectedRecIds: sel, revisedDraft: null })
  }

  async function revise() {
    if (!persona) return
    const chosen = persona.recommendations.filter((r) => persona.selectedRecIds.includes(r.id))
    if (!chosen.length) return
    setRevising(true)
    try {
      const { text, mode, entry } = await runChat({
        role: 'copy',
        step: 'Step 6 · Apply recommendations',
        system: REVISE_SYSTEM,
        user: buildRevisePrompt(profile, topic!, channel, draft!, chosen),
        reason: 'Copy model — applies the selected recommendations while preserving disclosures + placeholders.',
        maxTokens: 1200,
        demo: () => JSON.stringify(demoRevise(draft!, chosen)),
      })
      const parsed = parseJsonLoose<{ title?: string; body?: string }>(text)
      const fallback = demoRevise(draft!, chosen)
      const revisedDraft: RevisedDraft = {
        title: parsed?.title?.trim() || fallback.title,
        body: parsed?.body?.trim() || fallback.body,
        appliedRecIds: chosen.map((r) => r.id),
        modelLabel: entry.modelLabel,
        mode,
      }
      setPersona({ ...persona, revisedDraft })
      pushToast('success', 'Revised copy drafted below.')
    } catch {
      pushToast('error', 'Could not draft the revision.')
    } finally {
      setRevising(false)
    }
  }

  function sendToStep2() {
    if (!persona) return
    const chosen = persona.recommendations.filter((r) => persona.selectedRecIds.includes(r.id))
    const ask = `Focus-group revamp (${persona.stats?.resonance ?? 'mixed'} resonance): ${chosen.map((r) => r.title).join('; ') || 'apply the focus-group notes'}.`
    requestRevisions(ask)
    pushToast('info', 'Revision brief carried to Step 2.')
  }

  const transcript = live ?? persona?.transcript ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Step 6 · Persona Lab"
        description={`A live, moderated focus group for the ${channelSpec(channel).label} piece — pressure-test it before rollout.`}
        actions={
          <div className="flex items-center gap-2">
            {persona && persona.stage !== 'personas' && !running && (
              <Button variant="secondary" size="sm" icon={<IconUsers size={14} />} onClick={() => { setLive(null); setPersona(null) }}>
                New group
              </Button>
            )}
            {persona && persona.stage !== 'personas' && (
              <ExportButton name={`focus-group-${topic.id}`} json={persona} markdown={buildTranscriptMarkdown(persona)} print />
            )}
          </div>
        }
      />

      <Disclaimer kind="synthetic" className="mb-5" />

      {/* Step 1 — setup + persona generation */}
      {(!persona || persona.stage === 'personas') && !running && live === null && (
        <SetupCard
          segments={allSegments}
          segIds={segIds}
          count={count}
          onToggleSeg={toggleSeg}
          onCount={setCount}
          onAddCustom={addCustom}
          onDefault={() => setSegIds(defaultPanel(topic, SEED_SEGMENTS))}
          onGenerate={generate}
          generating={generating}
          hasPersonas={!!persona}
        />
      )}

      {/* Step 2 — roster + start */}
      {persona && persona.stage === 'personas' && live === null && !running && (
        <Roster persona={persona} onStart={startDiscussion} />
      )}

      {/* Step 3 — the live discussion */}
      {(running || transcript.length > 0) && persona && (
        <Discussion
          persona={persona}
          transcript={transcript}
          running={running}
          onStop={() => (abort.current = true)}
          onRestart={startDiscussion}
        />
      )}

      {/* Step 4 — wrap-up trigger */}
      {persona && persona.stage === 'discussion' && !running && (
        <Card className="mb-5">
          <CardBody className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-white">
              <IconSparkles size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-900">Wrap up the session</h3>
              <p className="mx-auto mt-0.5 max-w-md text-sm text-ink-500">
                Summarize the discussion, pull the recurring themes, and get concrete recommendations to revamp the piece.
              </p>
            </div>
            <Button variant="primary" loading={wrapping} icon={!wrapping ? <IconBolt size={15} /> : undefined} onClick={wrapUp}>
              Summarize &amp; get recommendations
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Step 5 — summary, stats, recommendations, revised copy */}
      {persona && persona.stage === 'complete' && persona.stats && (
        <Results
          persona={persona}
          revising={revising}
          onToggleRec={toggleRec}
          onApply={revise}
          onSend={sendToStep2}
          onCopy={(t) =>
            navigator.clipboard?.writeText(t).then(
              () => pushToast('success', 'Revised copy copied.'),
              () => pushToast('error', 'Clipboard unavailable.'),
            )
          }
        />
      )}

      {/* fairness guardrail */}
      <Card className="mt-5">
        <CardHeader icon={<IconShield size={18} />} title="Fairness guardrail" subtitle="Reg B / ECOA — segments & personas are behavioral only." />
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

// ── Setup ────────────────────────────────────────────────────────────────────
function SetupCard({
  segments,
  segIds,
  count,
  onToggleSeg,
  onCount,
  onAddCustom,
  onDefault,
  onGenerate,
  generating,
  hasPersonas,
}: {
  segments: Segment[]
  segIds: string[]
  count: number
  onToggleSeg: (id: string) => void
  onCount: (n: number) => void
  onAddCustom: (name: string, desc: string) => void
  onDefault: () => void
  onGenerate: () => void
  generating: boolean
  hasPersonas: boolean
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const tooFew = segIds.length < SEGMENT_MIN

  return (
    <Card className="mb-5">
      <CardHeader
        icon={<IconUsers size={18} />}
        title="1 · Recruit the focus group"
        subtitle={`Pick the behavioral segments to draw from, and how many people to seat.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDefault}>Reset to suggested</Button>
            <Button
              variant="primary"
              size="sm"
              loading={generating}
              icon={!generating ? <IconSparkles size={14} /> : undefined}
              disabled={tooFew || generating}
              onClick={onGenerate}
            >
              {hasPersonas ? 'Regenerate participants' : 'Generate participants'}
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {/* participant count */}
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/40 px-3 py-2.5">
          <span className="text-sm font-medium text-ink-700">Participants</span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled={count <= PARTICIPANT_MIN} onClick={() => onCount(count - 1)}>−</Button>
            <span className="w-8 text-center text-sm font-bold tabular-nums text-ink-900">{count}</span>
            <Button variant="secondary" size="sm" disabled={count >= PARTICIPANT_MAX} onClick={() => onCount(count + 1)}>+</Button>
          </div>
          <span className="text-[11px] text-ink-400">{PARTICIPANT_MIN}–{PARTICIPANT_MAX} · spread across the {segIds.length} selected segment{segIds.length === 1 ? '' : 's'}</span>
        </div>

        {/* segment picker */}
        {LENS_ORDER.map((lens) => (
          <div key={lens}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{lens}</div>
            <div className="flex flex-wrap gap-1.5">
              {segments
                .filter((s) => s.lens === lens)
                .map((s) => {
                  const on = segIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      title={s.description}
                      onClick={() => onToggleSeg(s.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                        on ? 'border-navy-900 bg-navy-900 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name (e.g. Rate-Shoppers)" className={inputCls} />
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Behavior / need (not identity)" className={inputCls} />
            <Button
              variant="secondary"
              size="sm"
              icon={<IconPlus size={14} />}
              disabled={!name.trim()}
              onClick={() => {
                onAddCustom(name.trim(), desc.trim())
                setName('')
                setDesc('')
              }}
            >
              Add
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">Screened against Reg B / ECOA — protected classes and proxies are blocked.</p>
        </div>

        {tooFew && (
          <div className="flex items-center gap-2 text-xs text-warn">
            <IconAlert size={13} /> Select at least {SEGMENT_MIN} segment to recruit the group.
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Roster ────────────────────────────────────────────────────────────────────
function Roster({ persona, onStart }: { persona: PersonaLabState; onStart: () => void }) {
  return (
    <Card className="mb-5">
      <CardHeader
        icon={<IconUsers size={18} />}
        title={`2 · Your focus group (${persona.participants.length})`}
        subtitle="Generated participants — behavioral personas, not demographic targeting."
        actions={
          <div className="flex items-center gap-2">
            <ModelTag role="strategy" modelLabel={persona.moderatorModelLabel} mode={persona.mode} />
            <Button variant="primary" size="sm" icon={<IconBolt size={14} />} onClick={onStart}>
              Start the discussion
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {persona.participants.map((p) => (
            <ParticipantCard key={p.id} p={p} />
          ))}
        </div>
        <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Moderator's agenda</div>
          <ol className="grid gap-1 sm:grid-cols-2">
            {persona.agenda.map((a, i) => (
              <li key={a.id} className="flex items-start gap-2 text-sm text-ink-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[10px] font-bold text-white">{i + 1}</span>
                {a.title}
              </li>
            ))}
          </ol>
        </div>
      </CardBody>
    </Card>
  )
}

function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const [initials, idx] = seed.split(':')
  const bg = AVATAR_BG[Number(idx) % AVATAR_BG.length] ?? AVATAR_BG[0]
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-white', bg)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  )
}

function ParticipantCard({ p }: { p: Participant }) {
  return (
    <div className="rounded-xl border border-ink-200 p-3.5">
      <div className="flex items-start gap-3">
        <Avatar seed={p.avatarSeed} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink-900">{p.name}</span>
            <Badge tone="neutral">{p.segmentName}</Badge>
          </div>
          <div className="text-xs capitalize text-ink-500">{p.archetype}</div>
        </div>
      </div>
      <p className="mt-2 text-sm italic text-ink-700">"{p.bio}"</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {p.personality.map((t) => (
          <span key={t} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-ink-600">{t}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-500">
        <div><span className="font-semibold text-ink-600">Wants:</span> {p.goals[0] ?? '—'}</div>
        <div><span className="font-semibold text-ink-600">Wary of:</span> {p.frustrations[0] ?? '—'}</div>
      </div>
    </div>
  )
}

// ── Discussion ──────────────────────────────────────────────────────────────
function Discussion({
  persona,
  transcript,
  running,
  onStop,
  onRestart,
}: {
  persona: PersonaLabState
  transcript: DiscussionTurn[]
  running: boolean
  onStop: () => void
  onRestart: () => void
}) {
  const byId = useMemo(() => {
    const m: Record<string, Participant> = {}
    for (const p of persona.participants) m[p.id] = p
    return m
  }, [persona.participants])
  const complete = !running && transcript.length > 0

  return (
    <Card className="mb-5">
      <CardHeader
        icon={<IconUsers size={18} />}
        title="3 · Live focus group"
        subtitle={complete ? `Discussion complete · ${fmtDateTime(persona.runAt)}` : 'Moderated discussion in progress…'}
        actions={
          <div className="flex items-center gap-2">
            <ModelTag role="strategy" modelLabel={persona.moderatorModelLabel} mode={persona.mode} />
            {running ? (
              <Button variant="secondary" size="sm" onClick={onStop}>Stop</Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<IconRefresh size={14} />} onClick={onRestart}>Re-run</Button>
            )}
          </div>
        }
      />
      <CardBody className="space-y-3">
        {transcript.map((t) =>
          t.kind === 'moderator' ? (
            <div key={t.id} className="rounded-xl border border-navy-200 bg-navy-50/60 px-3.5 py-2.5">
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-700">Moderator</div>
              <p className="text-sm text-ink-800">{t.text}</p>
            </div>
          ) : (
            <div key={t.id} className="flex items-start gap-3">
              <Avatar seed={byId[t.speakerId ?? '']?.avatarSeed ?? 'P:0'} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">{t.speakerName}</span>
                  {t.sentiment && <Badge tone={SENTIMENT_TONE[t.sentiment]} dot>{t.sentiment}</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-ink-700">{t.text}</p>
              </div>
            </div>
          ),
        )}
        {running && (
          <div className="flex items-center gap-2 pl-1 text-xs text-ink-400">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" />
            </span>
            the group is talking…
          </div>
        )}
        {complete && (
          <div className="rounded-xl border border-ok/25 bg-ok/5 px-3.5 py-2.5 text-sm text-ink-700">
            That's a wrap — {transcript.filter((t) => t.kind === 'participant').length} reactions across {persona.agenda.length} topics.
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Results: summary, stats, recommendations, revised copy ───────────────────
function Results({
  persona,
  revising,
  onToggleRec,
  onApply,
  onSend,
  onCopy,
}: {
  persona: PersonaLabState
  revising: boolean
  onToggleRec: (id: string) => void
  onApply: () => void
  onSend: () => void
  onCopy: (text: string) => void
}) {
  const stats = persona.stats as FocusGroupStats
  const resTone = stats.resonance === 'strong' ? 'ok' : stats.resonance === 'mixed' ? 'warn' : 'crit'
  const selected = persona.selectedRecIds.length

  return (
    <div className="mb-5 space-y-5">
      {/* summary */}
      <Card>
        <CardHeader
          icon={<IconSparkles size={18} />}
          title="Session summary"
          subtitle="A decision-ready read over the group — directional, not representative."
          actions={<ModelTag role="strategy" modelLabel={persona.moderatorModelLabel} mode={persona.mode} />}
        />
        <CardBody>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={resTone} dot>{stats.resonance} resonance</Badge>
            <span className="text-xs text-ink-500">
              {stats.sentiment.positive} positive · {stats.sentiment.mixed} mixed · {stats.sentiment.negative} negative
            </span>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-ink-700">
            {persona.summary.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* stats */}
      <Card>
        <CardHeader icon={<IconUsers size={18} />} title="What the room felt" subtitle="Sentiment, recurring themes, and standout quotes." />
        <CardBody className="space-y-4">
          <SentimentBar sentiment={stats.sentiment} />
          {stats.themes.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recurring themes</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.themes.map((t) => (
                  <span
                    key={t.theme}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                      t.sentiment === 'positive' ? 'border-ok/25 bg-ok/5 text-ok' : 'border-warn/30 bg-warn/5 text-warn',
                    )}
                  >
                    {t.theme}
                    <span className="rounded-full bg-white/60 px-1 text-[10px] tabular-nums">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {stats.standoutQuotes.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Standout quotes</div>
              {stats.standoutQuotes.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge tone={SENTIMENT_TONE[q.sentiment]} dot>{q.sentiment}</Badge>
                  <span className="flex-1 italic text-ink-700">"{q.text}" <span className="not-italic text-ink-400">— {q.speakerName}</span></span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* recommendations */}
      <Card>
        <CardHeader
          icon={<IconCheck size={18} />}
          title="Recommendations to revamp the content"
          subtitle="Select the fixes to apply, then draft the revised copy or hand the brief to Step 2."
        />
        <CardBody className="space-y-3">
          {persona.recommendations.map((r) => {
            const on = persona.selectedRecIds.includes(r.id)
            return (
              <button
                key={r.id}
                onClick={() => onToggleRec(r.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                  on ? 'border-straive-500 bg-straive-50/50 ring-1 ring-straive-500/30' : 'border-ink-200 hover:border-ink-300',
                )}
              >
                <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-straive-500 bg-straive-500 text-white' : 'border-ink-300')}>
                  {on && <IconCheck size={11} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">{r.title}</span>
                    {r.addresses && <Badge tone="neutral">{r.addresses}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-600">{r.detail}</p>
                  {r.rationale && <p className="mt-0.5 text-[11px] text-ink-400">{r.rationale}</p>}
                </div>
              </button>
            )
          })}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="primary" size="sm" loading={revising} icon={!revising ? <IconDoc size={14} /> : undefined} disabled={!selected || revising} onClick={onApply}>
              Apply &amp; draft revised copy
            </Button>
            <Button variant="secondary" size="sm" icon={<IconRefresh size={14} />} disabled={!selected} onClick={onSend}>
              Send brief to Step 2
            </Button>
            <span className="text-xs text-ink-400">{selected} selected</span>
          </div>
        </CardBody>
      </Card>

      {/* revised copy preview */}
      {persona.revisedDraft && (
        <Card>
          <CardHeader
            icon={<IconDoc size={18} />}
            title="Revised copy (draft)"
            subtitle="Recommendations applied — disclosures + placeholders preserved. Review before you ship."
            actions={<ModelTag role="copy" modelLabel={persona.revisedDraft.modelLabel} mode={persona.revisedDraft.mode} />}
          />
          <CardBody className="space-y-3">
            <div className="max-h-96 overflow-auto rounded-lg border border-ink-100 bg-ink-50/40 p-3">
              <Markdown source={`# ${persona.revisedDraft.title}\n\n${persona.revisedDraft.body}`} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" icon={<IconCopy size={13} />} onClick={() => onCopy(`${persona.revisedDraft!.title}\n\n${persona.revisedDraft!.body}`)}>
                Copy revised copy
              </Button>
              <Button variant="primary" size="sm" icon={<IconRefresh size={14} />} onClick={onSend}>
                Send brief to Step 2
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function SentimentBar({ sentiment }: { sentiment: FocusGroupStats['sentiment'] }) {
  const total = sentiment.positive + sentiment.mixed + sentiment.negative || 1
  const rows: { label: string; value: number; cls: string }[] = [
    { label: 'Positive', value: sentiment.positive, cls: 'bg-ok' },
    { label: 'Mixed', value: sentiment.mixed, cls: 'bg-warn' },
    { label: 'Negative', value: sentiment.negative, cls: 'bg-crit' },
  ]
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-16 text-[11px] text-ink-500">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div className={cn('h-full rounded-full', r.cls)} style={{ width: `${(r.value / total) * 100}%` }} />
          </div>
          <span className="w-6 text-right text-[11px] tabular-nums text-ink-600">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

const inputCls =
  'h-9 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20'

function buildTranscriptMarkdown(s: PersonaLabState): string {
  const lines: string[] = [`# Focus group — ${s.participants.length} participants`, '']
  lines.push('_Synthetic focus group — directional signal, not a real panel._', '')
  if (s.stage === 'complete' && s.stats) {
    lines.push(`## Summary (${s.stats.resonance} resonance)`, '', s.summary, '')
    lines.push(`**Sentiment:** ${s.stats.sentiment.positive} positive / ${s.stats.sentiment.mixed} mixed / ${s.stats.sentiment.negative} negative`)
    if (s.stats.themes.length) lines.push(`**Themes:** ${s.stats.themes.map((t) => `${t.theme} (${t.count})`).join(', ')}`)
    lines.push('', '## Recommendations', '')
    for (const r of s.recommendations) lines.push(`- **${r.title}** — ${r.detail} _(${r.rationale})_`)
    lines.push('')
    if (s.revisedDraft) lines.push('## Revised copy (draft)', '', `### ${s.revisedDraft.title}`, '', s.revisedDraft.body, '')
  }
  lines.push('## Participants', '')
  for (const p of s.participants) lines.push(`- **${p.name}** (${p.segmentName}) — ${p.archetype}`)
  lines.push('', '## Transcript', '')
  for (const t of s.transcript) {
    if (t.kind === 'moderator') lines.push(`**Moderator:** ${t.text}`, '')
    else lines.push(`**${t.speakerName}** _(${t.sentiment})_: ${t.text}`, '')
  }
  return lines.join('\n')
}
