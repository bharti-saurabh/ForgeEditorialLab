import type { ReactNode } from 'react'
import { useAppStore, type ViewId } from '@/store/useAppStore'
import { FOUNDATION, PIPELINE, SETTINGS_NAV, type NavItem } from './nav'
import { ModelRouterConsole } from './ModelRouterConsole'
import { StepRail } from '@/components/StepRail'
import { ForgeLockup } from '@/components/Logo'
import { friendlyModel } from '@/lib/router/roles'
import { IconRoute, IconActivity, IconGear, IconSidebar } from '@/components/icons'
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

export function AppShell({ children }: { children: ReactNode }) {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)
  const routerOpen = useAppStore((s) => s.routerOpen)
  const toggleRouter = useAppStore((s) => s.toggleRouter)
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const settings = useAppStore((s) => s.settings)
  const log = useAppStore((s) => s.routerLog)
  const profile = useAppStore((s) => s.brandProfile)
  const live = Boolean(settings.gatewayUrl.trim() && settings.apiKey.trim())
  const area = areaOf(activeView)
  const currentStep = stepOf(activeView)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-50 text-ink-800">
      {/* ── Top chrome ─────────────────────────────────────────── */}
      <header className="no-print chrome-mesh relative z-20 flex h-16 shrink-0 items-center justify-between pl-3 pr-4 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSidebar()}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <IconSidebar size={17} className={cn('transition', collapsed && 'opacity-70')} />
          </button>
          <ForgeLockup onDark />
        </div>

        {/* center: area switch */}
        <div className="hidden items-center gap-1 rounded-xl glass p-1 md:flex">
          <AreaTab label="Foundation" active={area === 'foundation'} onClick={() => setView('overview')} />
          <AreaTab label="Pipeline" active={area === 'pipeline'} onClick={() => setView('step-1')} />
        </div>

        {/* right: status + actions */}
        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 font-mono text-[12px] text-navy-200 lg:inline-flex">
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

      {/* ── Body: sidebar + content ────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <nav
          className={cn(
            'no-print flex shrink-0 flex-col bg-navy-800 transition-[width] duration-200 ease-out',
            collapsed ? 'w-[68px]' : 'w-64',
          )}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
            <NavGroup
              label="Foundation"
              items={FOUNDATION}
              active={activeView}
              onPick={setView}
              collapsed={collapsed}
            />
            <NavGroup
              label="Pipeline"
              items={PIPELINE}
              active={activeView}
              onPick={setView}
              collapsed={collapsed}
              className="mt-6"
            />
          </div>

          <div className="border-t border-white/10 p-3">
            <NavButton
              item={SETTINGS_NAV}
              active={activeView === 'settings'}
              onPick={setView}
              collapsed={collapsed}
            />
            {!collapsed && (
              <>
                <div className="mt-3 flex items-center justify-between px-2.5 text-[11px]">
                  <span className="text-navy-300">Brand</span>
                  <span className="font-semibold text-navy-100">{profile.brandName}</span>
                </div>
                <div className="mt-1 px-2.5 text-[10px] text-navy-400">
                  Synthetic · illustrative data
                </div>
              </>
            )}
          </div>
        </nav>

        {/* content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {currentStep && (
            <div className="no-print shrink-0 border-b border-ink-200 bg-white px-8 py-4">
              <StepRail current={currentStep} onPick={(n) => setView(`step-${n}` as ViewId)} />
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
            {routerOpen && <ModelRouterConsole />}
          </div>
        </div>
      </div>
    </div>
  )
}

function AreaTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg px-4 py-1.5 text-[13px] font-semibold transition',
        active ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-200 hover:text-white',
      )}
    >
      {label}
    </button>
  )
}

function NavGroup({
  label,
  items,
  active,
  onPick,
  collapsed,
  className,
}: {
  label: string
  items: NavItem[]
  active: ViewId
  onPick: (v: ViewId) => void
  collapsed: boolean
  className?: string
}) {
  return (
    <div className={className}>
      {collapsed ? (
        <div className="mx-2 mb-2 h-px bg-white/10" />
      ) : (
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-navy-400">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={active === item.id}
            onPick={onPick}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  )
}

function NavButton({
  item,
  active,
  onPick,
  collapsed,
}: {
  item: NavItem
  active: boolean
  onPick: (v: ViewId) => void
  collapsed: boolean
}) {
  const Icon = item.icon
  return (
    <button
      onClick={() => onPick(item.id)}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-lg py-2 text-left text-[13px] transition',
        collapsed ? 'justify-center px-0' : 'pl-3 pr-2',
        active ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-straive-500" />
      )}
      <Icon
        size={18}
        className={active ? 'text-straive-400' : 'text-navy-300 group-hover:text-navy-100'}
      />
      {!collapsed && <span className="flex-1 truncate font-medium">{item.label}</span>}
      {!collapsed && item.status === 'soon' && (
        <span
          className={cn(
            'rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide',
            active ? 'bg-white/15 text-navy-100' : 'bg-white/5 text-navy-400',
          )}
        >
          soon
        </span>
      )}
      {collapsed && item.status === 'soon' && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-straive-500/70" />
      )}
    </button>
  )
}
