// Connectivity tests for the Settings "Test" buttons. These hit the gateway
// directly (a real ping), update the per-slot test result, and log the probe to
// the Model Router so users can see the round-trip.

import type { ModelSlotKey, RoleTestResult } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { uid } from '@/lib/format'
import { pingChat, imageGeneration, imageGenerationGemini, GatewayError } from './gateway'
import { modelForRole, friendlyModel, baseUrlForRole } from './roles'

function errMsg(err: unknown): string {
  if (err instanceof GatewayError)
    return `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`
  return (err as Error)?.message ?? 'Unknown error'
}

export async function testTextConnection(): Promise<RoleTestResult> {
  const s = useAppStore.getState().settings
  const baseUrl = baseUrlForRole('strategy', s)
  if (!baseUrl || !s.apiKey.trim()) {
    return { state: 'error', message: 'Enter a gateway URL and API key first.', at: Date.now() }
  }
  const model = s.models.text
  const start = performance.now()
  try {
    const res = await pingChat(baseUrl, s.apiKey, model)
    const latencyMs = Math.round(performance.now() - start)
    useAppStore.getState().addRouterLog({
      id: uid('log'),
      ts: Date.now(),
      step: 'Settings · Connectivity test (text)',
      role: 'strategy',
      modelLabel: friendlyModel(model),
      modelId: model,
      reason: 'Manual connectivity probe from Settings.',
      latencyMs,
      mode: 'live',
      status: 'ok',
      usage: { totalTokens: res.usage.totalTokens },
    })
    return {
      state: 'ok',
      latencyMs,
      message: `Connected — ${friendlyModel(model)} replied "${res.text.trim().slice(0, 24)}".`,
      at: Date.now(),
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const message = errMsg(err)
    useAppStore.getState().addRouterLog({
      id: uid('log'),
      ts: Date.now(),
      step: 'Settings · Connectivity test (text)',
      role: 'strategy',
      modelLabel: friendlyModel(model),
      modelId: model,
      reason: 'Manual connectivity probe from Settings.',
      latencyMs,
      mode: 'live',
      status: 'error',
      usage: {},
      detail: message,
    })
    return { state: 'error', latencyMs, message, at: Date.now() }
  }
}

export async function testImageConnection(): Promise<RoleTestResult> {
  const s = useAppStore.getState().settings
  const baseUrl = baseUrlForRole('image', s)
  if (!baseUrl || !s.apiKey.trim()) {
    return { state: 'error', message: 'Enter a gateway URL and API key first.', at: Date.now() }
  }
  const model = s.models.image
  const prompt = 'A small navy blue square on a white background. Minimal test image.'
  const start = performance.now()
  try {
    if (s.imageApi === 'gemini') {
      await imageGenerationGemini({ baseUrl, apiKey: s.apiKey, model, prompt })
    } else {
      await imageGeneration({
        baseUrl,
        apiKey: s.apiKey,
        model,
        prompt,
        endpoint: s.imageEndpoint,
        size: '256x256',
      })
    }
    const latencyMs = Math.round(performance.now() - start)
    useAppStore.getState().addRouterLog({
      id: uid('log'),
      ts: Date.now(),
      step: 'Settings · Connectivity test (image)',
      role: 'image',
      modelLabel: friendlyModel(model),
      modelId: model,
      reason: 'Manual image connectivity probe from Settings.',
      latencyMs,
      mode: 'live',
      status: 'ok',
      usage: { assets: 1 },
    })
    return {
      state: 'ok',
      latencyMs,
      message: `Connected — ${friendlyModel(model)} returned an image.`,
      at: Date.now(),
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const message = errMsg(err)
    useAppStore.getState().addRouterLog({
      id: uid('log'),
      ts: Date.now(),
      step: 'Settings · Connectivity test (image)',
      role: 'image',
      modelLabel: friendlyModel(model),
      modelId: model,
      reason: 'Manual image connectivity probe from Settings.',
      latencyMs,
      mode: 'live',
      status: 'error',
      usage: {},
      detail: message,
    })
    return { state: 'error', latencyMs, message, at: Date.now() }
  }
}

export async function testConnection(slot: ModelSlotKey): Promise<RoleTestResult> {
  // vision shares the text endpoint
  if (slot === 'image') return testImageConnection()
  return testTextConnection()
}

export { modelForRole }
