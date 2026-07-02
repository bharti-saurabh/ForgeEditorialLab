import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ROLE_META } from '@/lib/router/roles'
import { ModelTag, ModeDot } from '@/components/ModelTag'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconRoute, IconX, IconTrash, IconDownload, IconAlert } from '@/components/icons'
import { fmtMs, fmtNum, fmtTime } from '@/lib/format'
import { fmtUsd } from '@/lib/router/pricing'
import { exportJSON } from '@/lib/export'
import { cn } from '@/lib/cn'

export function ModelRouterConsole() {
  const log = useAppStore((s) => s.routerLog)
  const clear = useAppStore((s) => s.clearRouterLog)
  const toggle = useAppStore((s) => s.toggleRouter)

  const stats = useMemo(() => {
    const calls = log.length
    const live = log.filter((e) => e.mode === 'live').length
    const errors = log.filter((e) => e.status === 'error').length
    const tokens = log.reduce((a, e) => a + (e.usage.totalTokens ?? 0), 0)
    const assets = log.reduce((a, e) => a + (e.usage.assets ?? 0), 0)
    const cost = log.reduce((a, e) => a + (e.costUsd ?? 0), 0)
    const avgLatency = calls
      ? log.reduce((a, e) => a + e.latencyMs, 0) / calls
      : 0
    const byRole = (Object.keys(ROLE_META) as Array<keyof typeof ROLE_META>).map(
      (r) => ({ role: r, count: log.filter((e) => e.role === r).length }),
    )
    return { calls, live, errors, tokens, assets, cost, avgLatency, byRole }
  }, [log])

  return (
    <aside className="no-print flex h-full w-[380px] shrink-0 flex-col border-l border-ink-200 bg-white">
      {/* header */}
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-navy text-white">
            <IconRoute size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink-900 leading-tight">
              Model Router
            </h3>
            <p className="text-[11px] text-ink-500">Right model, right job — live log</p>
          </div>
        </div>
        <button
          onClick={() => toggle(false)}
          className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Collapse router"
        >
          <IconX size={16} />
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-3 gap-px border-b border-ink-200 bg-ink-200">
        <SummaryCell label="Calls" value={fmtNum(stats.calls)} />
        <SummaryCell
          label="Live"
          value={`${stats.live}/${stats.calls || 0}`}
          tone={stats.live ? 'ok' : 'neutral'}
        />
        <SummaryCell label="Avg latency" value={stats.calls ? fmtMs(stats.avgLatency) : '—'} />
        <SummaryCell label="Tokens" value={fmtNum(stats.tokens)} />
        <SummaryCell label="Images" value={fmtNum(stats.assets)} />
        <SummaryCell
          label="Errors"
          value={fmtNum(stats.errors)}
          tone={stats.errors ? 'crit' : 'neutral'}
        />
      </div>

      {/* estimated cost */}
      <div
        className="flex items-center justify-between border-b border-ink-200 bg-white px-4 py-2"
        title="Illustrative list-price estimate by model family — not your gateway's actual billing."
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
          Est. cost <span className="text-ink-300">(illustrative)</span>
        </span>
        <span className="text-sm font-bold text-ink-900 tabular-nums">{fmtUsd(stats.cost)}</span>
      </div>

      {/* role distribution */}
      <div className="flex flex-wrap gap-1.5 border-b border-ink-200 px-4 py-2.5">
        {stats.byRole.map((r) => (
          <Badge key={r.role} tone={r.count ? 'navy' : 'neutral'}>
            {ROLE_META[r.role].label.split(' ')[0]} · {r.count}
          </Badge>
        ))}
      </div>

      {/* log */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {log.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-ink-400">
            No model calls yet. Analyze an asset or run a step to see routing decisions
            appear here in real time.
          </div>
        ) : (
          <ul className="space-y-2">
            {log.map((e) => (
              <li
                key={e.id}
                className={cn(
                  'rounded-lg border bg-white p-3 text-xs shadow-card',
                  e.status === 'error' ? 'border-crit/30' : 'border-ink-200',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink-800 leading-snug">{e.step}</span>
                  <span className="shrink-0 text-[10px] text-ink-400">{fmtTime(e.ts)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <ModelTag role={e.role} modelLabel={e.modelLabel} mode={e.mode} />
                </div>
                <p className="mt-2 text-ink-500 leading-snug">
                  <span className="font-medium text-ink-600">Why: </span>
                  {e.reason}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                  <span>⏱ {fmtMs(e.latencyMs)}</span>
                  {e.usage.totalTokens !== undefined && (
                    <span>◇ {fmtNum(e.usage.totalTokens)} tok</span>
                  )}
                  {e.usage.assets !== undefined && (
                    <span>🖼 {fmtNum(e.usage.assets)} asset{e.usage.assets === 1 ? '' : 's'}</span>
                  )}
                  {e.costUsd !== undefined && e.costUsd > 0 && (
                    <span title="Estimated cost">≈ {fmtUsd(e.costUsd)}</span>
                  )}
                  <ModeDot mode={e.mode} />
                </div>
                {e.detail && (
                  <div
                    className={cn(
                      'mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-snug',
                      e.status === 'error'
                        ? 'bg-crit/5 text-crit'
                        : 'bg-ink-50 text-ink-500',
                    )}
                  >
                    {e.status === 'error' && <IconAlert size={12} className="mt-0.5 shrink-0" />}
                    <span>{e.detail}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* footer actions */}
      <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-3 py-2.5">
        <Button
          size="sm"
          variant="ghost"
          icon={<IconDownload size={14} />}
          onClick={() => exportJSON('model-router-log', log)}
          disabled={!log.length}
        >
          Export log
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<IconTrash size={14} />}
          onClick={clear}
          disabled={!log.length}
        >
          Clear
        </Button>
      </div>
    </aside>
  )
}

function SummaryCell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'crit'
}) {
  return (
    <div className="bg-white px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 text-sm font-bold',
          tone === 'ok' && 'text-ok',
          tone === 'crit' && 'text-crit',
          tone === 'neutral' && 'text-ink-900',
        )}
      >
        {value}
      </div>
    </div>
  )
}
