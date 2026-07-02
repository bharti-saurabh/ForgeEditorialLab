// Shared navigation model — used by the AppShell sidebar and the Overview map.

import type { ViewId } from '@/store/useAppStore'
import {
  IconHome,
  IconLayers,
  IconFingerprint,
  IconSparkles,
  IconDoc,
  IconImage,
  IconShield,
  IconPackage,
  IconUsers,
  IconGear,
  type IconType,
} from '@/components/icons'

export interface NavItem {
  id: ViewId
  label: string
  blurb: string
  icon: IconType
  status: 'ready' | 'soon'
  statusLabel?: string
  step?: number
}

export const FOUNDATION: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    blurb: 'Executive summary and pipeline map',
    icon: IconHome,
    status: 'ready',
  },
  {
    id: 'brand-memory',
    label: 'Brand Memory',
    blurb: 'Ingest collateral; learn the brand',
    icon: IconLayers,
    status: 'ready',
  },
  {
    id: 'brand-profile',
    label: 'Brand Profile',
    blurb: 'The learned, editable brand grounding',
    icon: IconFingerprint,
    status: 'ready',
  },
]

export const PIPELINE: NavItem[] = [
  {
    id: 'step-1',
    label: 'Step 1 · Topic Intelligence',
    blurb: 'Rank a content opportunity backlog',
    icon: IconSparkles,
    status: 'ready',
    step: 1,
  },
  {
    id: 'step-2',
    label: 'Step 2 · Brief & Draft',
    blurb: 'Brief + on-brand draft with a model bake-off',
    icon: IconDoc,
    status: 'ready',
    step: 2,
  },
  {
    id: 'step-3',
    label: 'Step 3 · Visual Assets',
    blurb: 'On-brand hero + supporting visuals',
    icon: IconImage,
    status: 'ready',
    step: 3,
  },
  {
    id: 'step-4',
    label: 'Step 4 · Legal & Compliance',
    blurb: 'The auditable, bank-grade gate',
    icon: IconShield,
    status: 'ready',
    step: 4,
  },
  {
    id: 'step-5',
    label: 'Step 5 · Publish Package',
    blurb: 'Approved package + channel adaptation',
    icon: IconPackage,
    status: 'ready',
    step: 5,
  },
  {
    id: 'step-6',
    label: 'Step 6 · Persona Lab',
    blurb: 'Synthetic audience validation',
    icon: IconUsers,
    status: 'ready',
    step: 6,
  },
]

export const SETTINGS_NAV: NavItem = {
  id: 'settings',
  label: 'Settings',
  blurb: 'Gateway, keys, and model routing',
  icon: IconGear,
  status: 'ready',
}
