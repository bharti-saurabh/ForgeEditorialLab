import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge, severityTone } from '@/components/Badge'
import { SectionTitle, EmptyState, Stat } from '@/components/EmptyState'
import { ScoreGauge } from '@/components/ScoreGauge'
import { ModelTag } from '@/components/ModelTag'
import { ExportButton } from '@/components/ExportButton'
import { Disclaimer } from '@/components/Disclaimer'
import { Markdown } from '@/components/Markdown'
import { SEED_TOPIC_BACKLOG } from '@/seed/topicBacklog'
import { SEED_RULEBOOK } from '@/seed/rulebook'
import {
  analyzeContent,
  currentScore,
  issueCounts,
  recommendation,
  buildCleanVersion,
} from '@/lib/complianceEngine'
import {
  COMPLIANCE_SYSTEM,
  buildAssessmentPrompt,
  demoAssessment,
} from '@/lib/prompts/compliance'
import { runChat } from '@/lib/router/router'
import { wordDiff, stripMarkdown } from '@/lib/diff'
import { uid, fmtDateTime, fmtTime } from '@/lib/format'
import type {
  ComplianceIssue,
  ComplianceState,
  DraftVariant,
  SignOff,
  SignOffDecision,
} from '@/types'
import {
  IconShield,
  IconAlert,
  IconCheck,
  IconX,
  IconChevron,
  IconBolt,
  IconRefresh,
  IconActivity,
  IconEye,
} from '@/components/icons'
import { cn } from '@/lib/cn'

export function ComplianceView() {
  const setView = useAppStore((s) => s.setView)
  const pushToast = useAppStore((s) => s.pushToast)
  const profile = useAppStore((s) => s.brandProfile)
  const pipeline = useAppStore((s) => s.pipeline)
  const setCompliance = useAppStore((s) => s.setCompliance)
  const resolveIssue = useAppStore((s) => s.resolveIssue)
  const applyCleanVersion = useAppStore((s) => s.applyCleanVersion)
  const signCompliance = useAppStore((s) => s.signCompliance)
  const requestRevisions = useAppStore((s) => s.requestRevisions)

  const topic = useMemo(
    () => SEED_TOPIC_BACKLOG.find((t) => t.id === pipeline.selectedTopicId) ?? null,
    [pipeline.selectedTopicId],
  )
  const draft = pipeline.drafts.find((d) => d.id === pipeline.chosenDraftId) ?? null
  const compliance = pipeline.compliance
  const [running, setRunning] = useState(false)
  const [reviewer, setReviewer] = useState('')

  const actor = reviewer.trim() || 'Reviewer'

  if (!topic || !draft) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle
          title="Step 4 · Legal & Compliance"
          description="The auditable, bank-grade gate over your copy and visuals."
        />
        <EmptyState
          icon={<IconShield size={22} />}
          title="Nothing to review yet"
          description="Pick a topic, write a draft, and (optionally) generate visuals — then run the compliance gate."
          action={
            <Button variant="primary" icon={<IconChevron size={15} />} onClick={() => setView(draft ? 'step-1' : 'step-2')}>
              {topic ? 'Finish the draft' : 'Go to Topic Intelligence'}
            </Button>
          }
        />
      </div>
    )
  }

  async function runReview() {
    if (!topic || !draft) return
    setRunning(true)
    try {
      const analysis = analyzeContent(draft, pipeline.visuals, topic, SEED_RULEBOOK, profile)
      const copy = `${draft.title}\n${draft.body}`
      const { text, mode, entry } = await runChat({
        role: 'strategy',
        step: 'Step 4 · Compliance review',
        system: COMPLIANCE_SYSTEM,
        user: buildAssessmentPrompt(profile, topic, copy, analysis.issues, analysis.checklist),
        reason:
          'Reasoning model — reviews net impression and material risk alongside the rule-cited engine findings.',
        maxTokens: 700,
        demo: () => demoAssessment(topic, analysis.issues, analysis.checklist),
      })
      const state: ComplianceState = {
        runAt: entry.ts,
        assessment: text,
        assessmentModelLabel: entry.modelLabel,
        assessmentMode: mode,
        issues: analysis.issues,
        checklist: analysis.checklist,
        initialScore: analysis.initialScore,
        cleanApplied: false,
        audit: [
          {
            id: uid('aud'),
            ts: entry.ts,
            actor: 'System',
            action: 'analyzed',
            detail: `Analyzed copy + ${pipeline.visuals.length} visual(s): ${analysis.issues.length} finding(s), ${analysis.checklist.filter((c) => !c.present).length} missing disclosure(s), initial score ${analysis.initialScore}.`,
          },
        ],
        signoff: null,
      }
      setCompliance(state)
      pushToast(mode === 'live' ? 'success' : 'info', `Compliance review complete — score ${analysis.initialScore}/100.`)
    } catch {
      pushToast('error', 'Could not complete the compliance review.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Step 4 · Legal & Compliance"
        description="Rule-cited review of copy + visuals, with human sign-off and a full audit trail."
        actions={
          <div className="flex items-center gap-2">
            {compliance?.signoff && compliance.signoff.decision !== 'rejected' && (
              <Button variant="primary" size="sm" icon={<IconChevron size={15} />} onClick={() => setView('step-5')}>
                Continue to Publish
              </Button>
            )}
            {compliance && (
              <Button
                variant="secondary"
                size="sm"
                icon={<IconRefresh size={15} />}
                onClick={() => {
                  requestRevisions('Reviewer requested edits at the compliance gate.')
                  pushToast('info', 'Sent back to Step 2 — revise, then re-run compliance.')
                }}
              >
                Send revisions
              </Button>
            )}
            {compliance && (
              <Button
                variant="secondary"
                size="sm"
                loading={running}
                icon={!running ? <IconRefresh size={15} /> : undefined}
                onClick={runReview}
              >
                Re-run
              </Button>
            )}
            {compliance && (
              <ExportButton
                name={`compliance-${topic.id}`}
                json={{ topic: topic.title, ...compliance, currentScore: currentScore(compliance) }}
                markdown={buildAuditMarkdown(topic.title, compliance)}
              />
            )}
          </div>
        }
      />

      <Disclaimer kind="legal" className="mb-5" />

      {!compliance ? (
        <Card>
          <CardBody className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-white">
              <IconShield size={26} />
            </div>
            <h3 className="text-lg font-bold text-ink-900">Run the compliance gate</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
              Scans "{draft.title}" and {pipeline.visuals.length} visual(s) against the rulebook
              (UDAAP, Reg Z/TILA, Reg B/ECOA, FTC) + the brand's compliance fingerprint. Every
              finding cites a rule; you decide each one and sign off.
            </p>
            <div className="mt-6">
              <Button variant="primary" loading={running} icon={!running ? <IconBolt size={15} /> : undefined} onClick={runReview}>
                Run compliance review
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <ComplianceResult
          compliance={compliance}
          draft={draft}
          reviewer={reviewer}
          setReviewer={setReviewer}
          actor={actor}
          onResolve={resolveIssue}
          onApplyClean={() => {
            applyCleanVersion(actor)
            pushToast('success', 'Clean version prepared with rewrites + disclosures.')
          }}
          onSign={(so) => {
            signCompliance(so)
            pushToast(
              so.decision === 'rejected' ? 'info' : 'success',
              `Sign-off recorded: ${so.decision.replace(/-/g, ' ')}.`,
            )
          }}
        />
      )}
    </div>
  )
}

function ComplianceResult({
  compliance,
  draft,
  reviewer,
  setReviewer,
  actor,
  onResolve,
  onApplyClean,
  onSign,
}: {
  compliance: ComplianceState
  draft: DraftVariant
  reviewer: string
  setReviewer: (s: string) => void
  actor: string
  onResolve: ReturnType<typeof useAppStore.getState>['resolveIssue']
  onApplyClean: () => void
  onSign: (so: SignOff) => void
}) {
  const score = currentScore(compliance)
  const counts = issueCounts(compliance.issues)
  const rec = recommendation(score, counts.critical)
  const passChecks = compliance.checklist.filter((c) => c.present).length
  const [tab, setTab] = useState<'redline' | 'clean'>('redline')

  return (
    <div className="space-y-5">
      {/* scoreboard */}
      <Card>
        <CardBody className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <ScoreGauge value={score} size={104} label="Compliance score" />
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={counts.critical ? 'crit' : score >= 90 ? 'ok' : 'warn'} dot>
                {rec}
              </Badge>
              {compliance.cleanApplied && <Badge tone="info">Clean version prepared</Badge>}
              {compliance.initialScore !== score && (
                <span className="text-xs text-ink-400">
                  Initial {compliance.initialScore} → now {score}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Open criticals" value={counts.critical} tone={counts.critical ? 'crit' : 'ok'} />
              <Stat label="Open issues" value={counts.open} tone={counts.open ? 'warn' : 'ok'} />
              <Stat label="Resolved" value={counts.resolved} tone="ok" />
              <Stat
                label="Disclosures"
                value={`${passChecks}/${compliance.checklist.length}`}
                tone={passChecks === compliance.checklist.length ? 'ok' : 'warn'}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI assessment */}
      <Card>
        <CardHeader icon={<IconEye size={18} />} title="Reviewer assessment" subtitle="AI decision support — not the basis for sign-off on its own." />
        <CardBody>
          <div className="mb-3 flex items-center gap-2">
            <ModelTag role="strategy" modelLabel={compliance.assessmentModelLabel} mode={compliance.assessmentMode} />
            <span className="text-xs text-ink-400">Run {fmtDateTime(compliance.runAt)}</span>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-ink-700">
            {compliance.assessment.split('\n\n').map((p, i) => (
              <p key={i} className={cn(p.startsWith('Recommendation') && 'font-semibold text-ink-900')}>
                {p}
              </p>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* issues */}
      <Card>
        <CardHeader
          icon={<IconAlert size={18} />}
          title={`Findings (${compliance.issues.length})`}
          subtitle="Each cites a rule. Accept the rewrite, edit it, or override with a documented reason."
        />
        <CardBody className="space-y-3">
          {compliance.issues.length === 0 ? (
            <div className="rounded-lg border border-ok/25 bg-ok/5 px-4 py-3 text-sm text-ok">
              No rule triggers fired. Confirm the disclosure checklist below before sign-off.
            </div>
          ) : (
            compliance.issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} actor={actor} onResolve={onResolve} />
            ))
          )}
        </CardBody>
      </Card>

      {/* disclosure checklist */}
      <Card>
        <CardHeader
          icon={<IconCheck size={18} />}
          title="Disclosure checklist"
          subtitle="Required disclosures + legal lines for this topic."
          actions={
            !compliance.cleanApplied &&
            compliance.checklist.some((c) => !c.present) && (
              <Button variant="secondary" size="sm" onClick={onApplyClean}>
                Apply clean version
              </Button>
            )
          }
        />
        <CardBody className="space-y-1.5">
          {compliance.checklist.map((c) => {
            const ok = c.present || compliance.cleanApplied
            return (
              <div key={c.id} className="flex items-start gap-2.5 text-sm">
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    ok ? 'bg-ok/15 text-ok' : 'bg-crit/15 text-crit',
                  )}
                >
                  {ok ? <IconCheck size={11} /> : <IconX size={11} />}
                </span>
                <span className="flex-1 text-ink-700">{c.text}</span>
                <Badge tone={c.source === 'legal-line' ? 'navy' : 'neutral'}>
                  {c.source === 'legal-line' ? 'Legal line' : 'Disclosure'}
                </Badge>
                {!c.present && compliance.cleanApplied && (
                  <span className="text-[11px] text-info">appended</span>
                )}
              </div>
            )
          })}
        </CardBody>
      </Card>

      {/* redline / clean before-after */}
      <Card>
        <CardHeader
          icon={<IconEye size={18} />}
          title="Redline & clean version"
          subtitle="The original with flagged spans marked, and the suggested clean rewrite."
          actions={
            <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
              {(['redline', 'clean'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium capitalize transition',
                    tab === t ? 'bg-navy-900 text-white' : 'text-ink-500 hover:text-ink-800',
                  )}
                >
                  {t === 'redline' ? 'Redline (before)' : 'Clean (after)'}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          {tab === 'redline' ? (
            <Redline draft={draft} compliance={compliance} />
          ) : (
            <Markdown source={buildCleanVersion(draft, compliance)} />
          )}
        </CardBody>
      </Card>

      {/* sign-off */}
      <SignOffPanel
        compliance={compliance}
        score={score}
        openCriticals={counts.critical}
        reviewer={reviewer}
        setReviewer={setReviewer}
        onSign={onSign}
      />

      {/* audit trail */}
      <Card>
        <CardHeader icon={<IconActivity size={18} />} title="Audit trail" subtitle="Every action, timestamped, for examination." />
        <CardBody>
          <ol className="space-y-2">
            {[...compliance.audit].reverse().map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 w-16 shrink-0 text-xs tabular-nums text-ink-400">{fmtTime(e.ts)}</span>
                <Badge tone={auditTone(e.action)}>{e.action}</Badge>
                <span className="flex-1 text-ink-700">
                  <span className="font-medium text-ink-900">{e.actor}</span> — {e.detail}
                </span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  )
}

function IssueCard({
  issue,
  actor,
  onResolve,
}: {
  issue: ComplianceIssue
  actor: string
  onResolve: ReturnType<typeof useAppStore.getState>['resolveIssue']
}) {
  const [mode, setMode] = useState<'none' | 'edit' | 'override'>('none')
  const [editText, setEditText] = useState(issue.editText ?? '')
  const [reason, setReason] = useState(issue.overrideReason ?? '')
  const resolved = issue.decision !== 'open'

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        resolved ? 'border-ink-200 bg-ink-50/50' : 'border-ink-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>
        <span className="text-sm font-semibold text-ink-900">{issue.title}</span>
        <Badge tone="neutral">{issue.element === 'visual' ? `Visual: ${issue.elementRef}` : 'Copy'}</Badge>
        {resolved && (
          <Badge tone={issue.decision === 'overridden' ? 'warn' : 'ok'} dot>
            {issue.decision}
          </Badge>
        )}
      </div>

      <div className="mt-2 text-xs font-medium text-ink-500">
        {issue.category} · <span className="font-mono">{issue.citation}</span>
      </div>

      <div className="mt-2 rounded-lg border border-crit/20 bg-crit/5 px-3 py-2 text-sm text-ink-800">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-crit">Flagged</span>
        <div className="mt-0.5 italic">"{issue.snippet}"</div>
      </div>

      <p className="mt-2 text-sm text-ink-600">{issue.rationale}</p>

      <div className="mt-2 rounded-lg bg-ok/5 px-3 py-2 text-sm text-ink-700">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ok">Suggested rewrite</span>
        <div className="mt-0.5">{issue.suggestedRewrite}</div>
      </div>

      {issue.decision === 'edited' && issue.editText && (
        <div className="mt-2 rounded-lg border border-info/25 bg-info/5 px-3 py-2 text-sm text-ink-700">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-info">Your edit</span>
          <div className="mt-0.5">{issue.editText}</div>
        </div>
      )}
      {issue.decision === 'overridden' && issue.overrideReason && (
        <div className="mt-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-ink-700">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-warn">Override reason</span>
          <div className="mt-0.5">{issue.overrideReason}</div>
        </div>
      )}

      {/* inline editors */}
      {mode === 'edit' && (
        <div className="mt-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={2}
            placeholder="Your replacement text…"
            className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!editText.trim()}
              onClick={() => {
                onResolve(issue.id, 'edited', actor, { editText: editText.trim() })
                setMode('none')
              }}
            >
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {mode === 'override' && (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Document why this is acceptable to publish as-is…"
            className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                onResolve(issue.id, 'overridden', actor, { overrideReason: reason.trim() })
                setMode('none')
              }}
            >
              Confirm override
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* action row */}
      {mode === 'none' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!resolved ? (
            <>
              <Button size="sm" variant="primary" icon={<IconCheck size={14} />} onClick={() => onResolve(issue.id, 'accepted', actor)}>
                Accept rewrite
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMode('edit')}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('override')}>
                Override
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" icon={<IconRefresh size={14} />} onClick={() => onResolve(issue.id, 'open', actor)}>
              Reopen
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function Redline({
  draft,
  compliance,
}: {
  draft: DraftVariant
  compliance: ComplianceState
}) {
  // A true redline: word-level diff of the original draft against the clean
  // version (accepted rewrites + edits + appended disclosures). Removed text is
  // struck through in red; added text is underlined in green.
  const before = stripMarkdown(`# ${draft.title}\n\n${draft.body}`)
  const after = stripMarkdown(buildCleanVersion(draft, compliance))
  const ops = useMemo(() => wordDiff(before, after), [before, after])

  const dels = ops.filter((o) => o.type === 'del').length
  const ins = ops.filter((o) => o.type === 'ins').length

  if (dels === 0 && ins === 0) {
    return (
      <div className="rounded-lg border border-ok/25 bg-ok/5 px-4 py-3 text-sm text-ok">
        No text changes between the original and the clean version. Resolve findings or apply the
        clean version to see edits here.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded bg-crit/15 ring-1 ring-crit/30" /> Removed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded bg-ok/15 ring-1 ring-ok/30" /> Added
        </span>
        <span className="text-ink-400">
          {dels} deletion{dels === 1 ? '' : 's'} · {ins} insertion{ins === 1 ? '' : 's'}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
        {ops.map((op, i) =>
          op.type === 'equal' ? (
            <span key={i}>{op.text}</span>
          ) : op.type === 'del' ? (
            <del key={i} className="rounded bg-crit/15 px-0.5 text-crit decoration-crit/60">
              {op.text}
            </del>
          ) : (
            <ins key={i} className="rounded bg-ok/15 px-0.5 text-ok no-underline">
              {op.text}
            </ins>
          ),
        )}
      </div>
    </div>
  )
}

function SignOffPanel({
  compliance,
  score,
  openCriticals,
  reviewer,
  setReviewer,
  onSign,
}: {
  compliance: ComplianceState
  score: number
  openCriticals: number
  reviewer: string
  setReviewer: (s: string) => void
  onSign: (so: SignOff) => void
}) {
  const [decision, setDecision] = useState<SignOffDecision>('approved-with-changes')
  const [note, setNote] = useState('')
  const existing = compliance.signoff

  return (
    <Card>
      <CardHeader
        icon={<IconShield size={18} />}
        title="Human sign-off"
        subtitle="A named reviewer makes the final call. AI is decision support only."
      />
      <CardBody className="space-y-3">
        {existing && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 text-sm',
              existing.decision === 'rejected'
                ? 'border-crit/30 bg-crit/5'
                : existing.decision === 'approved'
                  ? 'border-ok/30 bg-ok/5'
                  : 'border-warn/30 bg-warn/5',
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-ink-900">
              <IconCheck size={15} />
              {existing.decision.replace(/-/g, ' ')} by {existing.reviewer}
            </div>
            <div className="mt-1 text-xs text-ink-500">
              {fmtDateTime(existing.ts)} · score at sign-off {existing.scoreAtSignoff}
              {existing.note && ` · "${existing.note}"`}
            </div>
          </div>
        )}

        {openCriticals > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-crit/30 bg-crit/5 px-3 py-2 text-sm text-crit">
            <IconAlert size={15} />
            {openCriticals} open Critical issue(s) — resolve before approving, or document an override.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink-600">
            Reviewer name
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="e.g. J. Rivera, Marketing Compliance"
              className="mt-1 block h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
            />
          </label>
          <label className="text-xs font-medium text-ink-600">
            Decision
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as SignOffDecision)}
              className="mt-1 block h-9 w-full rounded-lg border border-ink-200 bg-white px-2 text-sm font-medium text-ink-700 focus:border-straive-400 focus:outline-none"
            >
              <option value="approved">Approve</option>
              <option value="approved-with-changes">Approve with changes</option>
              <option value="rejected">Reject</option>
            </select>
          </label>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Sign-off note (optional)…"
          className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<IconShield size={15} />}
            disabled={!reviewer.trim() || (decision === 'approved' && openCriticals > 0)}
            onClick={() =>
              onSign({
                reviewer: reviewer.trim(),
                decision,
                note: note.trim(),
                ts: Date.now(),
                scoreAtSignoff: score,
              })
            }
          >
            {existing ? 'Re-record sign-off' : 'Record sign-off'}
          </Button>
          {decision === 'approved' && openCriticals > 0 && (
            <span className="text-xs text-crit">Cannot approve with open Criticals.</span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

function auditTone(action: string) {
  switch (action) {
    case 'signoff':
      return 'accent' as const
    case 'override':
      return 'warn' as const
    case 'accept':
    case 'edit':
    case 'clean-applied':
      return 'ok' as const
    case 'reopen':
      return 'info' as const
    default:
      return 'neutral' as const
  }
}

function buildAuditMarkdown(topicTitle: string, c: ComplianceState): string {
  const score = currentScore(c)
  const counts = issueCounts(c.issues)
  const lines: string[] = [`# Compliance Report — ${topicTitle}`, '']
  lines.push(`**Current score:** ${score}/100 (initial ${c.initialScore})`)
  lines.push(`**Open issues:** ${counts.open} (Critical ${counts.critical}) · **Resolved:** ${counts.resolved}`, '')
  lines.push('## Reviewer assessment', '', c.assessment, '')
  lines.push('## Findings', '')
  for (const i of c.issues) {
    lines.push(`### [${i.severity}] ${i.title} — ${i.decision}`)
    lines.push(`- Rule: ${i.citation} (${i.category})`)
    lines.push(`- Element: ${i.element}${i.elementRef ? ` (${i.elementRef})` : ''}`)
    lines.push(`- Flagged: "${i.snippet}"`)
    lines.push(`- Suggested: ${i.suggestedRewrite}`)
    if (i.editText) lines.push(`- Edit: ${i.editText}`)
    if (i.overrideReason) lines.push(`- Override reason: ${i.overrideReason}`)
    lines.push('')
  }
  lines.push('## Disclosure checklist', '')
  for (const chk of c.checklist)
    lines.push(`- [${chk.present || c.cleanApplied ? 'x' : ' '}] (${chk.source}) ${chk.text}`)
  lines.push('', '## Sign-off', '')
  lines.push(
    c.signoff
      ? `${c.signoff.decision} by ${c.signoff.reviewer} at ${fmtDateTime(c.signoff.ts)} (score ${c.signoff.scoreAtSignoff})${c.signoff.note ? ` — "${c.signoff.note}"` : ''}`
      : '_Not yet signed off._',
  )
  lines.push('', '## Audit trail', '')
  for (const e of c.audit)
    lines.push(`- ${fmtDateTime(e.ts)} · ${e.actor} · ${e.action} · ${e.detail}`)
  lines.push('', '_AI compliance output is decision support, not legal advice._')
  return lines.join('\n')
}
