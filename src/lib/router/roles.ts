// Role registry — the heart of the "right model for the right job" story.
// Each role maps to a configured model slot and carries a default rationale
// shown in the Model Router console. Extensible: add a role here (e.g. a
// fast/cheap classifier, or a video/voice model) and the router picks it up.

import type { ModelRole, ModelAssignments, RoleBaseUrls } from '@/types'

export type ModelSlot = keyof ModelAssignments // 'text' | 'image' | 'vision'

export interface RoleMeta {
  role: ModelRole
  label: string
  /** which Settings model slot fulfills this role */
  slot: ModelSlot
  /** default one-line reason this model class is chosen for the role */
  defaultReason: string
  /** provider family hint shown on the model tag */
  family: 'reasoning' | 'copywriting' | 'vision' | 'image'
}

export const ROLE_META: Record<ModelRole, RoleMeta> = {
  strategy: {
    role: 'strategy',
    label: 'Strategy & Reasoning',
    slot: 'text',
    defaultReason:
      'Frontier reasoning model — best for multi-signal analysis, briefs, and compliance judgement.',
    family: 'reasoning',
  },
  copy: {
    role: 'copy',
    label: 'Brand-Voice Copywriting',
    slot: 'text',
    defaultReason:
      'Strong long-form writer — drafts on-brand copy that follows the learned voice profile.',
    family: 'copywriting',
  },
  vision: {
    role: 'vision',
    label: 'Visual Asset Analysis',
    slot: 'vision',
    defaultReason:
      'Vision-capable model — reads layout, imagery, and on-screen copy from uploaded creative.',
    family: 'vision',
  },
  image: {
    role: 'image',
    label: 'Image Generation',
    slot: 'image',
    defaultReason:
      'Purpose-built image model (Nano Banana) — renders on-brand visuals from a grounded prompt.',
    family: 'image',
  },
}

/** Resolve the concrete model id for a role from the user's Settings. */
export function modelForRole(role: ModelRole, models: ModelAssignments): string {
  const slot = ROLE_META[role].slot
  if (slot === 'vision') return models.vision?.trim() || models.text
  return models[slot]
}

/**
 * Resolve the base URL a role should call. Per-role overrides let different
 * providers serve different roles through the same key (e.g. OpenAI text +
 * Gemini image). Vision falls back to text, then to the default gateway URL.
 */
export function baseUrlForRole(
  role: ModelRole,
  s: { gatewayUrl: string; baseUrls?: Partial<RoleBaseUrls> },
): string {
  const b = s.baseUrls ?? {}
  const gw = s.gatewayUrl?.trim() ?? ''
  if (role === 'image') return (b.image?.trim() || gw).trim()
  if (role === 'vision') return (b.vision?.trim() || b.text?.trim() || gw).trim()
  return (b.text?.trim() || gw).trim()
}

/** Short, friendly label for a raw model id (strips provider prefixes). */
export function friendlyModel(modelId: string): string {
  if (!modelId) return '—'
  const id = modelId.split('/').pop() || modelId
  return id
}
