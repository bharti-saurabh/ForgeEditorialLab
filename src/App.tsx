import { lazy, Suspense } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { AppShell } from '@/views/AppShell'
import { OverviewView } from '@/views/OverviewView'
import { BrandMemoryView } from '@/views/BrandMemoryView'
import { BrandProfileView } from '@/views/BrandProfileView'
import { SettingsView } from '@/views/SettingsView'
import { TopicIntelligenceView } from '@/views/TopicIntelligenceView'
import { BriefDraftView } from '@/views/BriefDraftView'
import { VisualAssetsView } from '@/views/VisualAssetsView'
import { ComplianceView } from '@/views/ComplianceView'
import { PublishView } from '@/views/PublishView'
import { Toaster } from '@/components/Toaster'

// Persona Lab pulls in Recharts — lazy-load it so the heavy viz bundle stays
// out of the initial app load and only arrives when Step 6 is opened.
const PersonaLabView = lazy(() =>
  import('@/views/PersonaLabView').then((m) => ({ default: m.PersonaLabView })),
)

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-ink-400">
      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" />
      Loading…
    </div>
  )
}

export default function App() {
  const view = useAppStore((s) => s.activeView)

  return (
    <>
      <AppShell>
        {view === 'overview' && <OverviewView />}
        {view === 'brand-memory' && <BrandMemoryView />}
        {view === 'brand-profile' && <BrandProfileView />}
        {view === 'settings' && <SettingsView />}
        {view === 'step-1' && <TopicIntelligenceView />}
        {view === 'step-2' && <BriefDraftView />}
        {view === 'step-3' && <VisualAssetsView />}
        {view === 'step-4' && <ComplianceView />}
        {view === 'step-5' && <PublishView />}
        {view === 'step-6' && (
          <Suspense fallback={<ViewFallback />}>
            <PersonaLabView />
          </Suspense>
        )}
      </AppShell>
      <Toaster />
    </>
  )
}
