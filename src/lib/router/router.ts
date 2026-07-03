// ───────────────────────────────────────────────────────────────────────────
// Router service — the single funnel for every model call in the app.
// Picks the model for the role, runs LIVE when a gateway+key are configured
// (else serves the seeded DEMO response), captures latency + usage, and writes
// one Model Router log entry. UI never calls the gateway directly.
// ───────────────────────────────────────────────────────────────────────────

import type { CallMode, ModelRole, RouterLogEntry, TokenUsage } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { uid, estimateTokens } from '@/lib/format'
import {
  chatCompletion,
  imageGeneration,
  imageGenerationGemini,
  GatewayError,
  type ChatMessage,
} from './gateway'
import { ROLE_META, modelForRole, friendlyModel, baseUrlForRole } from './roles'

function settings() {
  return useAppStore.getState().settings
}

/** A role is live when its resolved base URL + an API key are both present. */
function isLiveFor(role: ModelRole): boolean {
  const s = settings()
  return Boolean(baseUrlForRole(role, s) && s.apiKey.trim())
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Realistic-feeling latency for demo-mode calls. */
function demoLatency(role: ModelRole): number {
  const base = role === 'image' ? 1600 : role === 'strategy' ? 900 : 650
  return base + Math.round(Math.random() * 500)
}

function logEntry(e: Omit<RouterLogEntry, 'id' | 'ts'>): RouterLogEntry {
  const entry: RouterLogEntry = { ...e, id: uid('log'), ts: Date.now() }
  useAppStore.getState().addRouterLog(entry)
  return entry
}

export interface RunChatOpts {
  role: ModelRole
  step: string
  /** convenience single user message; ignored if `messages` provided */
  user?: string
  system?: string
  messages?: ChatMessage[]
  reason?: string
  temperature?: number
  maxTokens?: number
  /** override the role's configured model (e.g. the Step 2 bake-off) */
  modelId?: string
  /** seeded response used in demo mode or on live failure */
  demo: () => string
}

export interface RunChatResult {
  text: string
  mode: CallMode
  entry: RouterLogEntry
}

export async function runChat(opts: RunChatOpts): Promise<RunChatResult> {
  const s = settings()
  const role = opts.role
  const modelId = opts.modelId?.trim() || modelForRole(role, s.models)
  const reason = opts.reason ?? ROLE_META[role].defaultReason
  const modelLabel = friendlyModel(modelId)

  const messages: ChatMessage[] =
    opts.messages ??
    [
      ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
      { role: 'user' as const, content: opts.user ?? '' },
    ]

  const start = performance.now()

  if (isLiveFor(role)) {
    try {
      const res = await chatCompletion({
        baseUrl: baseUrlForRole(role, s),
        apiKey: s.apiKey,
        model: modelId,
        messages,
        temperature: opts.temperature ?? s.temperature,
        maxTokens: opts.maxTokens,
      })
      const latencyMs = performance.now() - start
      const summed =
        (res.usage.promptTokens ?? 0) + (res.usage.completionTokens ?? 0)
      const usage: TokenUsage = {
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens ?? (summed || estimateTokens(res.text)),
      }
      const entry = logEntry({
        step: opts.step,
        role,
        modelLabel,
        modelId,
        reason,
        latencyMs,
        mode: 'live',
        status: 'ok',
        usage,
      })
      return { text: res.text, mode: 'live', entry }
    } catch (err) {
      // Live failed — fall back to the seeded response so the demo never breaks.
      const msg =
        err instanceof GatewayError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`
          : (err as Error)?.message ?? 'Unknown error'
      const text = opts.demo()
      const latencyMs = performance.now() - start
      const entry = logEntry({
        step: opts.step,
        role,
        modelLabel,
        modelId,
        reason,
        latencyMs,
        mode: 'demo',
        status: 'error',
        usage: { totalTokens: estimateTokens(text) },
        detail: `Live call failed (${msg}); served seeded response.`,
      })
      return { text, mode: 'demo', entry }
    }
  }

  // Demo mode
  await sleep(demoLatency(role))
  const text = opts.demo()
  const latencyMs = performance.now() - start
  const entry = logEntry({
    step: opts.step,
    role,
    modelLabel,
    modelId,
    reason,
    latencyMs,
    mode: 'demo',
    status: 'ok',
    usage: { totalTokens: estimateTokens(text) },
    detail: 'Demo mode — seeded response (configure a gateway + key for live).',
  })
  return { text, mode: 'demo', entry }
}

export interface RunVisionOpts {
  step: string
  text: string
  imageUrl: string
  system?: string
  reason?: string
  demo: () => string
}

/** Vision analysis — sends an image + instruction through the vision role. */
export async function runVision(opts: RunVisionOpts): Promise<RunChatResult> {
  const messages: ChatMessage[] = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: opts.text },
        { type: 'image_url' as const, image_url: { url: opts.imageUrl } },
      ],
    },
  ]
  return runChat({
    role: 'vision',
    step: opts.step,
    messages,
    reason: opts.reason,
    demo: opts.demo,
  })
}

export interface RunImageOpts {
  step: string
  prompt: string
  reason?: string
  /** seeded image url (data URL) for demo mode / live failure */
  demo: () => string
  size?: string
  /** override the role's configured image model (e.g. the Step 3 variant bake-off) */
  modelId?: string
}

export interface RunImageResult {
  url: string
  mode: CallMode
  entry: RouterLogEntry
}

export async function runImage(opts: RunImageOpts): Promise<RunImageResult> {
  const s = settings()
  const role: ModelRole = 'image'
  const modelId = opts.modelId?.trim() || modelForRole(role, s.models)
  const reason = opts.reason ?? ROLE_META[role].defaultReason
  const modelLabel = friendlyModel(modelId)
  const baseUrl = baseUrlForRole(role, s)
  const start = performance.now()

  if (isLiveFor(role)) {
    try {
      const res =
        s.imageApi === 'gemini'
          ? await imageGenerationGemini({
              baseUrl,
              apiKey: s.apiKey,
              model: modelId,
              prompt: opts.prompt,
            })
          : await imageGeneration({
              baseUrl,
              apiKey: s.apiKey,
              model: modelId,
              prompt: opts.prompt,
              endpoint: s.imageEndpoint,
              size: opts.size,
            })
      const latencyMs = performance.now() - start
      const entry = logEntry({
        step: opts.step,
        role,
        modelLabel,
        modelId,
        reason,
        latencyMs,
        mode: 'live',
        status: 'ok',
        usage: { assets: res.usage.assets ?? 1 },
      })
      return { url: res.url, mode: 'live', entry }
    } catch (err) {
      const msg =
        err instanceof GatewayError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`
          : (err as Error)?.message ?? 'Unknown error'
      const url = opts.demo()
      const latencyMs = performance.now() - start
      const entry = logEntry({
        step: opts.step,
        role,
        modelLabel,
        modelId,
        reason,
        latencyMs,
        mode: 'demo',
        status: 'error',
        usage: { assets: 1 },
        detail: `Live image call failed (${msg}); served seeded visual.`,
      })
      return { url, mode: 'demo', entry }
    }
  }

  await sleep(demoLatency(role))
  const url = opts.demo()
  const latencyMs = performance.now() - start
  const entry = logEntry({
    step: opts.step,
    role,
    modelLabel,
    modelId,
    reason,
    latencyMs,
    mode: 'demo',
    status: 'ok',
    usage: { assets: 1 },
    detail: 'Demo mode — seeded visual (configure a gateway + key for live).',
  })
  return { url, mode: 'demo', entry }
}
