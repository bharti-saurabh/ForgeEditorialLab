import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAppStore, type ViewId } from '@/store/useAppStore'
import { FOUNDATION } from './nav'
import { PIPELINE_STEPS } from '@/components/StepRail'
import { ModelRouterConsole } from './ModelRouterConsole'
import { ForgeLockup, ClientChip } from '@/components/Logo'
import { friendlyModel } from '@/lib/router/roles'
import {
  IconRoute,
  IconActivity,
  IconGear,
  IconLayers,
  IconChevronDown,
  IconCheck,
} from '@/components/icons'
import { cn } from '@/lib/cn'

function stepOf(v: ViewId): number | null {
  const m = /^step-(\d)$/.exec(v)
  return m ? Number(m[1]) : null
}

export function AppShell({ children }: { children: ReactNode }) {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)
  const routerOpen = useAppStore((s) => s.routerOpen)
  const toggleRouter = useAppStore((s) => s.toggleRouter)
  const settings = useAppStore((s) => s.settings)
  const log = useAppStore((s) => s.routerLog)
  const pipeline = useAppStore((s) => s.pipeline)
  const live = Boolean(settings.gatewayUrl.trim() && settings.apiKey.trim())
  const currentStep = stepOf(activeView)
  const onFoundation = FOUNDATION.some((f) => f.id === activeView)

  // Real pipeline progress — a step is "done" once its artifact exists, so the
  // stepper reads as progress even from a Foundation view.
  const done: number[] = []
  if (pipeline.selectedTopicId) done.push(1)
  if (pipeline.drafts.length) done.push(2)
  if (pipeline.visuals.length) done.push(3)
  if (pipeline.compliance) done.push(4)
  if (pipeline.publish) done.push(5)
  if (pipeline.persona) done.push(6)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-50 text-ink-800">
      {/* ── Single top bar: brand · pipeline nav · status ─ */}
      <header className="no-print chrome-mesh relative z-30 flex h-20 shrink-0 items-center gap-3 px-4 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <ForgeLockup />
        <span className="hidden h-9 w-px shrink-0 bg-white/15 md:block" />
        <ClientChip className="hidden lg:flex" />

        {/* center: the Editorial Lab pipeline — the primary nav */}
        <nav className="flex min-w-0 flex-1 items-center justify-center">
          <PipelineNav current={currentStep} done={done} onPick={(step) => setView(`step-${step}` as ViewId)} />
        </nav>

        {/* right: status + explore/config cluster */}
        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 font-mono text-[12px] text-navy-200 2xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-straive-500 shadow-brand-glow" />
            {friendlyModel(settings.models.text) || 'no model set'}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1',
              live ? 'bg-ok/15 text-emerald-300 ring-ok/30' : 'bg-warn/15 text-amber-300 ring-warn/30',
            )}
          >
            <IconActivity size={13} className={live ? 'animate-pulse-dot' : ''} />
            {live ? 'Live' : 'Demo'}
          </span>

          <FoundationMenu active={onFoundation ? activeView : null} onPick={setView} />

          {!routerOpen && (
            <button
              onClick={() => toggleRouter(true)}
              className="inline-flex items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 text-[12px] font-medium text-navy-200 transition hover:bg-white/10 hover:text-white"
            >
              <IconRoute size={15} />
              <span className="hidden sm:inline">Model Router</span>
              {log.length > 0 && (
                <span className="rounded-full bg-straive-500 px-1.5 text-[10px] font-bold text-white">{log.length}</span>
              )}
            </button>
          )}

          <button
            onClick={() => setView('settings')}
            aria-label="Settings"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition',
              activeView === 'settings'
                ? 'bg-straive-500 text-white ring-straive-500 shadow-brand-glow'
                : 'glass text-navy-200 hover:bg-white/10 hover:text-white',
            )}
          >
            <IconGear size={17} />
          </button>
        </div>
      </header>

      {/* ── Body: content + router dock ─────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
        {routerOpen && <ModelRouterConsole />}
      </div>
    </div>
  )
}

/**
 * The 6-step Editorial Lab pipeline — the app's primary navigation. Each step is
 * a numbered node; the active step glows Straive-orange with its label, completed
 * steps go green with a check, upcoming steps stay dim. Thin connectors between
 * nodes read the row as a pipeline.
 */
function PipelineNav({
  current,
  done,
  onPick,
}: {
  current: number | null
  done: number[]
  onPick: (step: number) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10 backdrop-blur-md">
      {PIPELINE_STEPS.map((s, i) => {
        const isActive = s.step === current
        const isDone = done.includes(s.step) && !isActive
        return (
          <div key={s.step} className="flex items-center">
            {i > 0 && <span className={cn('h-px w-2 shrink-0 sm:w-3', isDone || isActive ? 'bg-white/25' : 'bg-white/10')} />}
            <button
              type="button"
              onClick={() => onPick(s.step)}
              title={`Step ${s.step} · ${s.short}`}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'group flex items-center rounded-xl outline-none transition-all duration-300 ease-out',
                isActive ? 'bg-gradient-to-b from-straive-400 to-straive-600 px-2.5 py-2 shadow-brand-glow' : 'px-1.5 py-1.5 hover:bg-white/10',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold transition-colors',
                  isActive
                    ? 'bg-white/20 text-white'
                    : isDone
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-navy-300 group-hover:text-white',
                )}
              >
                {isDone ? <IconCheck size={15} /> : s.step}
              </span>
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap text-[14px] font-semibold transition-all duration-300 ease-out',
                  isActive
                    ? 'ml-2 max-w-[150px] text-white opacity-100'
                    : 'ml-0 max-w-0 opacity-0 xl:ml-2 xl:max-w-[150px] xl:opacity-100',
                  !isActive && (isDone ? 'text-emerald-200/80' : 'text-navy-200 group-hover:text-white'),
                )}
              >
                {s.short}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Corner "Foundation" button — a dropdown to explore Overview / Brand pages. */
function FoundationMenu({ active, onPick }: { active: ViewId | null; onPick: (v: ViewId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ring-1 transition',
          active
            ? 'bg-straive-500 text-white ring-straive-500 shadow-brand-glow'
            : 'glass text-navy-200 ring-white/10 hover:bg-white/10 hover:text-white',
        )}
      >
        <IconLayers size={15} />
        <span className="hidden sm:inline">Foundation</span>
        <IconChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-xl"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Foundation</div>
          {FOUNDATION.map((f) => {
            const Icon = f.icon
            const isActive = active === f.id
            return (
              <button
                key={f.id}
                role="menuitem"
                onClick={() => {
                  onPick(f.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                  isActive ? 'bg-straive-50' : 'hover:bg-ink-50',
                )}
              >
                <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', isActive ? 'bg-straive-500 text-white' : 'bg-ink-100 text-ink-500')}>
                  <Icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-semibold', isActive ? 'text-straive-700' : 'text-ink-800')}>{f.label}</span>
                  <span className="block text-[11px] text-ink-400">{f.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
