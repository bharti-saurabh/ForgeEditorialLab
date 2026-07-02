import type { ReactNode } from 'react'
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
  IconHome,
  IconBolt,
  type IconType,
} from '@/components/icons'
import { cn } from '@/lib/cn'

type Area = 'foundation' | 'pipeline' | 'settings'

function areaOf(v: ViewId): Area {
  if (v === 'settings') return 'settings'
  if (v.startsWith('step-')) return 'pipeline'
  return 'foundation'
}

function stepOf(v: ViewId): number | null {
  const m = /^step-(\d)$/.exec(v)
  return m ? Number(m[1]) : null
}

/** Primary area switches shown as 3D-icon tabs. */
interface TopTab {
  key: Exclude<Area, 'settings'>
  label: string
  icon: IconType
  landing: ViewId
}
const TOP_NAV: TopTab[] = [
  { key: 'foundation', label: 'Foundation', icon: IconHome, landing: 'overview' },
  { key: 'pipeline', label: 'Editorial Lab', icon: IconBolt, landing: 'step-1' },
]

type PillState = 'active' | 'done' | 'todo'
interface PillItem {
  id: ViewId
  label: string
  icon: IconType
  state: PillState
}

export function AppShell({ children }: { children: ReactNode }) {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)
  const routerOpen = useAppStore((s) => s.routerOpen)
  const toggleRouter = useAppStore((s) => s.toggleRouter)
  const settings = useAppStore((s) => s.settings)
  const log = useAppStore((s) => s.routerLog)
  const live = Boolean(settings.gatewayUrl.trim() && settings.apiKey.trim())
  const area = areaOf(activeView)
  const currentStep = stepOf(activeView)

  // Sub-nav pills for the active area (foundation views or pipeline steps).
  let pills: PillItem[] = []
  if (area === 'foundation') {
    pills = FOUNDATION.map((f) => ({
      id: f.id,
      label: f.label,
      icon: f.icon,
      state: activeView === f.id ? 'active' : 'todo',
    }))
  } else if (area === 'pipeline' && currentStep) {
    pills = PIPELINE_STEPS.map((s) => ({
      id: `step-${s.step}` as ViewId,
      label: s.short,
      icon: s.icon,
      state: s.step === currentStep ? 'active' : s.step < currentStep ? 'done' : 'todo',
    }))
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-50 text-ink-800">
      {/* ── Single top bar: brand · primary nav · sub-nav · status ─ */}
      <header className="no-print chrome-mesh relative z-30 flex h-20 shrink-0 items-center gap-3 px-4 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <ForgeLockup />
        <span className="hidden h-9 w-px shrink-0 bg-white/15 md:block" />
        <ClientChip className="hidden md:flex" />

        {/* one floating pill, centered in the open space between brand and status */}
        <nav className="flex min-w-0 flex-1 items-center justify-center">
          <UnifiedNav
            area={area}
            currentStep={currentStep}
            activeView={activeView}
            pills={pills}
            onPick={setView}
          />
        </nav>

        {/* right: status + actions */}
        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 font-mono text-[12px] text-navy-200 2xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-straive-500 shadow-brand-glow" />
            {friendlyModel(settings.models.text) || 'no model set'}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1',
              live
                ? 'bg-ok/15 text-emerald-300 ring-ok/30'
                : 'bg-warn/15 text-amber-300 ring-warn/30',
            )}
          >
            <IconActivity size={13} className={live ? 'animate-pulse-dot' : ''} />
            {live ? 'Live' : 'Demo'}
          </span>

          {!routerOpen && (
            <button
              onClick={() => toggleRouter(true)}
              className="inline-flex items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 text-[12px] font-medium text-navy-200 transition hover:bg-white/10 hover:text-white"
            >
              <IconRoute size={15} />
              <span className="hidden sm:inline">Model Router</span>
              {log.length > 0 && (
                <span className="rounded-full bg-straive-500 px-1.5 text-[10px] font-bold text-white">
                  {log.length}
                </span>
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

const NAV_DIVIDER = <span className="mx-1.5 h-8 w-px shrink-0 bg-white/10" />

/**
 * One floating pill.
 *
 * Layout adapts to the active area:
 *  - Foundation active → [Foundation] · foundation sub-pills · | · [Editorial Lab]
 *    (Foundation groups with its sub-pills on the left; Editorial Lab sits at the
 *     far right as the "jump to the pipeline" switch).
 *  - Editorial Lab active → [Foundation] [Editorial Lab] · | · pipeline sub-pills.
 *
 * Two selected colours: the active **area** tab glows Straive-orange; the active
 * **sub-pill** glows blue (info) so the primary and secondary selections read as
 * distinct. Completed pipeline steps tint their icon green.
 */
function UnifiedNav({
  area,
  currentStep,
  activeView,
  pills,
  onPick,
}: {
  area: Area
  currentStep: number | null
  activeView: ViewId
  pills: PillItem[]
  onPick: (v: ViewId) => void
}) {
  const foundationTab = TOP_NAV[0]
  const editorialTab = TOP_NAV[1]

  const renderToggle = (tab: TopTab) => {
    const isActive = area === tab.key
    const Icon = tab.icon
    return (
      <button
        key={tab.key}
        type="button"
        onClick={() =>
          onPick(tab.key === 'pipeline' && currentStep ? activeView : tab.landing)
        }
        title={tab.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex h-14 shrink-0 items-center rounded-2xl px-5 outline-none transition-all duration-300 ease-out',
          isActive
            ? 'bg-gradient-to-b from-straive-400 to-straive-600 text-white shadow-brand-glow'
            : 'hover:bg-white/10',
        )}
      >
        <Icon
          size={28}
          className={cn(
            'shrink-0 transition-colors duration-300',
            isActive
              ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]'
              : 'text-navy-300 group-hover:text-white',
          )}
        />
        <span
          className={cn(
            'ml-3 whitespace-nowrap text-[17px] font-semibold transition-colors duration-300',
            isActive ? 'text-white' : 'text-navy-200 group-hover:text-white',
          )}
        >
          {tab.label}
        </span>
      </button>
    )
  }

  const renderPill = (it: PillItem) => {
    const Icon = it.icon
    const isActive = it.state === 'active'
    return (
      <button
        key={it.id}
        type="button"
        onClick={() => onPick(it.id)}
        title={it.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex h-14 items-center rounded-2xl px-4 outline-none transition-all duration-300 ease-out',
          isActive
            ? 'bg-gradient-to-b from-[#3a8fd8] to-info text-white shadow-[0_10px_30px_-8px_rgba(42,127,208,0.55)]'
            : 'hover:bg-white/10',
        )}
      >
        <Icon
          size={26}
          className={cn(
            'shrink-0 transition-colors duration-300',
            isActive
              ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]'
              : it.state === 'done'
                ? 'text-emerald-400'
                : 'text-navy-300 group-hover:text-white',
          )}
        />
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap text-[15px] font-semibold transition-all duration-300 ease-out',
            isActive ? 'ml-2 max-w-[160px] opacity-100' : 'ml-0 max-w-0 opacity-0',
          )}
        >
          {it.label}
        </span>
      </button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 backdrop-blur-md">
      {/* Foundation always leads */}
      {renderToggle(foundationTab)}

      {/* Editorial Lab sits inline (left) whenever Foundation is NOT the active area */}
      {area !== 'foundation' && renderToggle(editorialTab)}

      {/* active area's sub-pills */}
      {pills.length > 0 && NAV_DIVIDER}
      {pills.map(renderPill)}

      {/* in the Foundation view, Editorial Lab is pushed to the far right */}
      {area === 'foundation' && (
        <>
          {NAV_DIVIDER}
          {renderToggle(editorialTab)}
        </>
      )}
    </div>
  )
}
