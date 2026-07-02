// Default Settings — prefilled, editable. The app works fully in DEMO mode with
// no key; entering a working gateway + key promotes calls to LIVE.
// These model ids are sensible placeholders — confirm them against your gateway.

import type { Settings } from '@/types'

export const DEFAULT_SETTINGS: Settings = {
  gatewayUrl: 'https://llmfoundry.straive.com/openai/v1',
  apiKey: '',
  models: {
    text: 'claude-sonnet-4',
    image: 'gemini-2.5-flash-image',
    vision: '', // blank → falls back to the text model
  },
  // Per-role base URLs. Text/vision default to the gateway base URL above
  // (OpenAI-compatible). The image role points at Gemini's native namespace,
  // which uses generateContent rather than /images/generations.
  baseUrls: {
    text: '',
    // Gemini's native namespace on LLM Foundry (note the /gemini provider
    // prefix). Images use generateContent under /models/{model}:generateContent.
    image: 'https://llmfoundry.straive.com/gemini/v1beta',
    vision: '',
  },
  temperature: 0.5,
  persistKey: true,
  imageEndpoint: '/images/generations',
  imageApi: 'gemini',
}
