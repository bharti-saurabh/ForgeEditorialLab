// ───────────────────────────────────────────────────────────────────────────
// Root app store (Zustand + localStorage persistence).
// Holds settings, the brand repository, the learned brand profile, the Model
// Router log, and lightweight UI state. Everything stays client-side; the API
// key is persisted only when the user opts in.
// ───────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AssetAnalysis,
  BrandAsset,
  BrandProfile,
  ComplianceState,
  ContentBrief,
  DraftVariant,
  FairnessFlag,
  IssueDecision,
  ModelSlotKey,
  PersonaLabState,
  PipelineState,
  PublishPackage,
  RoleTestResult,
  RouterLogEntry,
  Settings,
  SignOff,
  TopicRead,
  VisualAsset,
  VoiceControls,
} from '@/types'
import { DEFAULT_SETTINGS } from '@/seed/defaults'
import { SEED_BRAND_ASSETS } from '@/seed/brandAssets'
import { SEED_BRAND_PROFILE } from '@/seed/brandProfile'
import { buildCompletedPipeline } from '@/seed/completedRunBuild'
import { estimateCostUsd } from '@/lib/router/pricing'
import { uid } from '@/lib/format'

export type ViewId =
  | 'overview'
  | 'brand-memory'
  | 'brand-profile'
  | 'step-1'
  | 'step-2'
  | 'step-3'
  | 'step-4'
  | 'step-5'
  | 'step-6'
  | 'settings'

export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: string
  kind: ToastKind
  message: string
}

export type ModelSlot = ModelSlotKey // 'text' | 'image' | 'vision'

interface AppState {
  // persisted
  settings: Settings
  brandRepo: BrandAsset[]
  brandProfile: BrandProfile
  routerLog: RouterLogEntry[]
  pipeline: PipelineState
  activeView: ViewId

  // ephemeral
  routerOpen: boolean
  sidebarCollapsed: boolean
  toasts: Toast[]
  testResults: Record<ModelSlot, RoleTestResult>

  // ── settings actions ──
  updateSettings: (patch: Partial<Settings>) => void
  updateModels: (patch: Partial<Settings['models']>) => void
  resetSettings: () => void
  clearKey: () => void
  setTestResult: (slot: ModelSlot, result: RoleTestResult) => void

  // ── brand repo actions ──
  addAsset: (asset: BrandAsset) => void
  updateAsset: (id: string, patch: Partial<BrandAsset>) => void
  removeAsset: (id: string) => void
  setAssetAnalyzing: (id: string, analyzing: boolean) => void
  setAssetAnalysis: (id: string, analysis: AssetAnalysis) => void

  // ── brand profile actions ──
  updateBrandProfile: (updater: (p: BrandProfile) => BrandProfile) => void
  resetBrandProfile: () => void

  // ── router log actions ──
  addRouterLog: (entry: RouterLogEntry) => void
  clearRouterLog: () => void

  // ── pipeline actions ──
  selectTopic: (id: string | null) => void
  setTopicRead: (read: TopicRead | null) => void
  setBrief: (brief: ContentBrief | null) => void
  updateVoice: (patch: Partial<VoiceControls>) => void
  addDraft: (draft: DraftVariant) => void
  removeDraft: (id: string) => void
  chooseDraft: (id: string | null) => void
  clearDrafts: () => void
  addVisual: (visual: VisualAsset) => void
  updateVisual: (id: string, patch: Partial<VisualAsset>) => void
  removeVisual: (id: string) => void
  setCompliance: (state: ComplianceState | null) => void
  resolveIssue: (
    id: string,
    decision: IssueDecision,
    actor: string,
    extra?: { editText?: string; overrideReason?: string },
  ) => void
  applyCleanVersion: (actor: string) => void
  signCompliance: (signoff: SignOff) => void
  setPublish: (pkg: PublishPackage | null) => void
  setPersona: (state: PersonaLabState | null) => void
  addFairnessFlag: (flag: FairnessFlag) => void
  /** send the piece back to Step 2 for revision (re-open the loop) */
  requestRevisions: (note: string) => void
  /** load the preloaded, finished end-to-end example run into the pipeline */
  loadCompletedRun: () => void

  // ── ui actions ──
  setView: (v: ViewId) => void
  toggleRouter: (open?: boolean) => void
  toggleSidebar: (collapsed?: boolean) => void
  pushToast: (kind: ToastKind, message: string) => void
  dismissToast: (id: string) => void

  // ── danger zone ──
  resetAllData: () => void
}

const emptyTest: RoleTestResult = { state: 'idle' }

export const DEFAULT_VOICE: VoiceControls = {
  formality: 35,
  warmth: 70,
  depth: 45,
  length: 'standard',
}

/** Deep-merge persisted settings over defaults so new fields always exist. */
function mergeSettings(s: unknown): Settings {
  const p = (s ?? {}) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    models: { ...DEFAULT_SETTINGS.models, ...(p.models ?? {}) },
    baseUrls: { ...DEFAULT_SETTINGS.baseUrls, ...(p.baseUrls ?? {}) },
  }
}

const EMPTY_PIPELINE: PipelineState = {
  selectedTopicId: null,
  topicRead: null,
  brief: null,
  voice: DEFAULT_VOICE,
  drafts: [],
  chosenDraftId: null,
  visuals: [],
  compliance: null,
  publish: null,
  persona: null,
  revision: 0,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      brandRepo: SEED_BRAND_ASSETS,
      brandProfile: SEED_BRAND_PROFILE,
      routerLog: [],
      pipeline: EMPTY_PIPELINE,
      activeView: 'overview',

      routerOpen: true,
      sidebarCollapsed: false,
      toasts: [],
      testResults: { text: emptyTest, image: emptyTest, vision: emptyTest },

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateModels: (patch) =>
        set((s) => ({
          settings: { ...s.settings, models: { ...s.settings.models, ...patch } },
        })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      clearKey: () =>
        set((s) => ({ settings: { ...s.settings, apiKey: '' } })),
      setTestResult: (slot, result) =>
        set((s) => ({ testResults: { ...s.testResults, [slot]: result } })),

      addAsset: (asset) => set((s) => ({ brandRepo: [asset, ...s.brandRepo] })),
      updateAsset: (id, patch) =>
        set((s) => ({
          brandRepo: s.brandRepo.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAsset: (id) =>
        set((s) => ({ brandRepo: s.brandRepo.filter((a) => a.id !== id) })),
      setAssetAnalyzing: (id, analyzing) =>
        set((s) => ({
          brandRepo: s.brandRepo.map((a) => (a.id === id ? { ...a, analyzing } : a)),
        })),
      setAssetAnalysis: (id, analysis) =>
        set((s) => ({
          brandRepo: s.brandRepo.map((a) =>
            a.id === id ? { ...a, analysis, analyzing: false } : a,
          ),
        })),

      updateBrandProfile: (updater) =>
        set((s) => ({ brandProfile: updater(s.brandProfile) })),
      resetBrandProfile: () => set({ brandProfile: SEED_BRAND_PROFILE }),

      addRouterLog: (entry) =>
        set((s) => {
          // Attach an estimated cost at the single logging funnel so every call
          // (steps + Settings tests) is costed consistently and exportably.
          const withCost =
            entry.costUsd !== undefined
              ? entry
              : { ...entry, costUsd: estimateCostUsd(entry.modelId, entry.role, entry.usage) }
          return { routerLog: [withCost, ...s.routerLog].slice(0, 200) }
        }),
      clearRouterLog: () => set({ routerLog: [] }),

      selectTopic: (id) =>
        set((s) => {
          // Switching to a different topic invalidates the downstream brief/drafts.
          const changed = id !== s.pipeline.selectedTopicId
          return {
            pipeline: changed
              ? {
                  ...s.pipeline,
                  selectedTopicId: id,
                  brief: null,
                  drafts: [],
                  chosenDraftId: null,
                  visuals: [],
                  compliance: null,
                  publish: null,
                  persona: null,
                }
              : { ...s.pipeline, selectedTopicId: id },
          }
        }),
      setTopicRead: (read) =>
        set((s) => ({ pipeline: { ...s.pipeline, topicRead: read } })),
      setBrief: (brief) =>
        set((s) => ({ pipeline: { ...s.pipeline, brief } })),
      updateVoice: (patch) =>
        set((s) => ({
          pipeline: { ...s.pipeline, voice: { ...s.pipeline.voice, ...patch } },
        })),
      addDraft: (draft) =>
        set((s) => ({
          pipeline: {
            ...s.pipeline,
            drafts: [...s.pipeline.drafts, draft],
            // auto-select the first draft produced
            chosenDraftId: s.pipeline.chosenDraftId ?? draft.id,
          },
        })),
      removeDraft: (id) =>
        set((s) => {
          const drafts = s.pipeline.drafts.filter((d) => d.id !== id)
          const chosenDraftId =
            s.pipeline.chosenDraftId === id
              ? (drafts[0]?.id ?? null)
              : s.pipeline.chosenDraftId
          return { pipeline: { ...s.pipeline, drafts, chosenDraftId } }
        }),
      chooseDraft: (id) =>
        set((s) => ({ pipeline: { ...s.pipeline, chosenDraftId: id } })),
      clearDrafts: () =>
        set((s) => ({ pipeline: { ...s.pipeline, drafts: [], chosenDraftId: null } })),
      addVisual: (visual) =>
        set((s) => ({ pipeline: { ...s.pipeline, visuals: [...s.pipeline.visuals, visual] } })),
      updateVisual: (id, patch) =>
        set((s) => ({
          pipeline: {
            ...s.pipeline,
            visuals: s.pipeline.visuals.map((v) => (v.id === id ? { ...v, ...patch } : v)),
          },
        })),
      removeVisual: (id) =>
        set((s) => ({
          pipeline: { ...s.pipeline, visuals: s.pipeline.visuals.filter((v) => v.id !== id) },
        })),
      setCompliance: (state) =>
        set((s) => ({ pipeline: { ...s.pipeline, compliance: state } })),
      resolveIssue: (id, decision, actor, extra) =>
        set((s) => {
          const c = s.pipeline.compliance
          if (!c) return {}
          const issue = c.issues.find((i) => i.id === id)
          const action =
            decision === 'open'
              ? 'reopen'
              : decision === 'accepted'
                ? 'accept'
                : decision === 'edited'
                  ? 'edit'
                  : 'override'
          const detail = issue
            ? `${action} · ${issue.title} (${issue.citation})${
                extra?.overrideReason ? ` — "${extra.overrideReason}"` : ''
              }`
            : action
          return {
            pipeline: {
              ...s.pipeline,
              compliance: {
                ...c,
                issues: c.issues.map((i) =>
                  i.id === id
                    ? {
                        ...i,
                        decision,
                        editText: extra?.editText ?? (decision === 'edited' ? i.editText : undefined),
                        overrideReason:
                          extra?.overrideReason ?? (decision === 'overridden' ? i.overrideReason : undefined),
                      }
                    : i,
                ),
                audit: [
                  ...c.audit,
                  { id: uid('aud'), ts: Date.now(), actor, action, detail },
                ],
              },
            },
          }
        }),
      applyCleanVersion: (actor) =>
        set((s) => {
          const c = s.pipeline.compliance
          if (!c) return {}
          return {
            pipeline: {
              ...s.pipeline,
              compliance: {
                ...c,
                cleanApplied: true,
                audit: [
                  ...c.audit,
                  {
                    id: uid('aud'),
                    ts: Date.now(),
                    actor,
                    action: 'clean-applied',
                    detail: 'Applied suggested clean version (rewrites + disclosures).',
                  },
                ],
              },
            },
          }
        }),
      signCompliance: (signoff) =>
        set((s) => {
          const c = s.pipeline.compliance
          if (!c) return {}
          return {
            pipeline: {
              ...s.pipeline,
              compliance: {
                ...c,
                signoff,
                audit: [
                  ...c.audit,
                  {
                    id: uid('aud'),
                    ts: signoff.ts,
                    actor: signoff.reviewer,
                    action: 'signoff',
                    detail: `${signoff.decision} at score ${signoff.scoreAtSignoff}${
                      signoff.note ? ` — "${signoff.note}"` : ''
                    }`,
                  },
                ],
              },
            },
          }
        }),
      setPublish: (pkg) =>
        set((s) => ({ pipeline: { ...s.pipeline, publish: pkg } })),
      setPersona: (state) =>
        set((s) => ({ pipeline: { ...s.pipeline, persona: state } })),
      addFairnessFlag: (flag) =>
        set((s) => {
          const p = s.pipeline.persona
          if (!p) return {}
          return {
            pipeline: {
              ...s.pipeline,
              persona: { ...p, fairnessFlags: [...p.fairnessFlags, flag] },
            },
          }
        }),
      requestRevisions: (note) =>
        set((s) => {
          const c = s.pipeline.compliance
          // Re-opening the loop: bump the revision counter and record it in the
          // compliance audit trail so the round-trip is examinable. Downstream
          // stages (publish, persona) are invalidated so they get re-run.
          return {
            activeView: 'step-2',
            pipeline: {
              ...s.pipeline,
              revision: s.pipeline.revision + 1,
              publish: null,
              persona: null,
              compliance: c
                ? {
                    ...c,
                    audit: [
                      ...c.audit,
                      {
                        id: uid('aud'),
                        ts: Date.now(),
                        actor: 'Editor',
                        action: 'reopen',
                        detail: `Sent back to Step 2 for revision${note ? ` — "${note}"` : ''}. Re-run compliance + persona after editing.`,
                      },
                    ],
                  }
                : c,
            },
          }
        }),
      loadCompletedRun: () =>
        set({ pipeline: buildCompletedPipeline(), activeView: 'overview' }),

      setView: (v) => set({ activeView: v }),
      toggleRouter: (open) =>
        set((s) => ({ routerOpen: open ?? !s.routerOpen })),
      toggleSidebar: (collapsed) =>
        set((s) => ({ sidebarCollapsed: collapsed ?? !s.sidebarCollapsed })),
      pushToast: (kind, message) => {
        const id = uid('toast')
        set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
        // auto-dismiss
        setTimeout(() => {
          const exists = get().toasts.some((t) => t.id === id)
          if (exists) get().dismissToast(id)
        }, 4200)
      },
      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      resetAllData: () =>
        set({
          settings: DEFAULT_SETTINGS,
          brandRepo: SEED_BRAND_ASSETS,
          brandProfile: SEED_BRAND_PROFILE,
          routerLog: [],
          pipeline: EMPTY_PIPELINE,
          testResults: { text: emptyTest, image: emptyTest, vision: emptyTest },
        }),
    }),
    {
      name: 'forge-state-v1',
      version: 3,
      // Upgrade older persisted state so pre-Increment-4 pipelines (missing
      // publish/persona/revision) and pre-multi-provider settings (missing
      // baseUrls/imageApi) can't crash the app on rehydrate.
      migrate: (persisted: unknown, _from: number) => {
        const s = (persisted ?? {}) as Partial<AppState>
        return {
          ...s,
          settings: mergeSettings(s.settings),
          pipeline: { ...EMPTY_PIPELINE, ...(s.pipeline ?? {}) },
        }
      },
      // Belt-and-suspenders: deep-merge persisted settings + pipeline over
      // defaults so every field is always present regardless of stored version.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          ...p,
          settings: mergeSettings(p.settings),
          pipeline: { ...EMPTY_PIPELINE, ...(p.pipeline ?? {}) },
        }
      },
      partialize: (s) => ({
        settings: s.settings.persistKey
          ? s.settings
          : { ...s.settings, apiKey: '' },
        brandRepo: s.brandRepo,
        brandProfile: s.brandProfile,
        routerLog: s.routerLog,
        pipeline: s.pipeline,
        activeView: s.activeView,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    },
  ),
)
