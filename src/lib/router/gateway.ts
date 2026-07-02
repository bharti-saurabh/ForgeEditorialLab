// ───────────────────────────────────────────────────────────────────────────
// Gateway — the only place that talks HTTP to the LLM Foundry.
// OpenAI-compatible: POST {baseUrl}/chat/completions with `Authorization: Bearer`.
// Pure functions, no app-state dependency. The router layer wraps these and
// handles model selection, logging, and live-or-demo fallback.
// ───────────────────────────────────────────────────────────────────────────

import type { TokenUsage } from '@/types'

export interface TextPart {
  type: 'text'
  text: string
}
export interface ImagePart {
  type: 'image_url'
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' }
}
export type ContentPart = TextPart | ImagePart

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface ChatResult {
  text: string
  usage: TokenUsage
  raw: unknown
}

export interface ImageResult {
  /** data URL (preferred) or remote URL */
  url: string
  usage: TokenUsage
  raw: unknown
}

export class GatewayError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GatewayError'
    this.status = status
  }
}

function normBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function joinPath(base: string, path: string): string {
  const b = normBase(base)
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

async function parseError(res: Response): Promise<string> {
  let detail = `HTTP ${res.status} ${res.statusText}`
  try {
    const body = await res.text()
    if (body) {
      try {
        const json = JSON.parse(body)
        detail = json?.error?.message || json?.message || body.slice(0, 300)
      } catch {
        detail = body.slice(0, 300)
      }
    }
  } catch {
    /* ignore */
  }
  return detail
}

export interface ChatArgs {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

/**
 * Newer OpenAI models (gpt-5.x, o1/o3/o4 reasoning models) rename `max_tokens`
 * to `max_completion_tokens` and only accept the default temperature. We can't
 * know a gateway's model quirks up front, so we detect the model family AND
 * self-heal on a 400 that names the offending parameter.
 */
function isNextGenModel(model: string): boolean {
  return /(^|\/)(gpt-5|o1|o3|o4)/i.test(model)
}

/** OpenAI-compatible chat completion. Handles both text and vision messages. */
export async function chatCompletion(args: ChatArgs): Promise<ChatResult> {
  const { baseUrl, apiKey, model, messages, temperature = 0.5, maxTokens, signal } = args

  // Start from the shape this model family is most likely to accept.
  let useCompletionTokens = isNextGenModel(model)
  let sendTemperature = !isNextGenModel(model)

  const buildBody = () => ({
    model,
    messages,
    ...(sendTemperature ? { temperature } : {}),
    ...(maxTokens
      ? useCompletionTokens
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }
      : {}),
  })

  let res: Response
  // At most a couple of adaptive retries: swap token param, then drop temperature.
  for (let attempt = 0; ; attempt++) {
    res = await fetch(joinPath(baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildBody()),
      signal,
    })

    if (res.ok || attempt >= 2) break

    const detail = await parseError(res)
    const lower = detail.toLowerCase()
    let adjusted = false
    if (!useCompletionTokens && lower.includes('max_completion_tokens')) {
      useCompletionTokens = true
      adjusted = true
    }
    if (sendTemperature && lower.includes('temperature')) {
      sendTemperature = false
      adjusted = true
    }
    if (!adjusted) throw new GatewayError(detail, res.status)
  }

  if (!res.ok) throw new GatewayError(await parseError(res), res.status)

  const json: any = await res.json()
  const choice = json?.choices?.[0]
  const msg = choice?.message?.content
  const text =
    typeof msg === 'string'
      ? msg
      : Array.isArray(msg)
        ? msg.map((p: any) => p?.text ?? '').join('')
        : ''

  const u = json?.usage ?? {}
  const usage: TokenUsage = {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  }

  return { text: text ?? '', usage, raw: json }
}

export interface ImageArgs {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  /** endpoint path relative to baseUrl, e.g. "/images/generations" */
  endpoint: string
  size?: string
  signal?: AbortSignal
}

/**
 * OpenAI-compatible image generation. Tries to read a b64_json or url payload.
 * Image endpoints vary by gateway, so this is defensive about the response shape.
 */
export async function imageGeneration(args: ImageArgs): Promise<ImageResult> {
  const { baseUrl, apiKey, model, prompt, endpoint, size = '1024x1024', signal } = args

  // Image endpoints vary a lot. The gpt-image-1 family always returns base64 and
  // rejects `response_format`; some gateways also don't accept `n` or `size`.
  // Start with the common OpenAI shape and self-heal on a 400 that names the
  // offending parameter, dropping it and retrying (mirrors chatCompletion).
  let sendResponseFormat = true
  let sendSize = true
  let sendN = true

  const buildBody = () => ({
    model,
    prompt,
    ...(sendN ? { n: 1 } : {}),
    ...(sendSize ? { size } : {}),
    ...(sendResponseFormat ? { response_format: 'b64_json' } : {}),
  })

  let res: Response
  for (let attempt = 0; ; attempt++) {
    res = await fetch(joinPath(baseUrl, endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildBody()),
      signal,
    })

    if (res.ok || attempt >= 3) break

    const detail = await parseError(res)
    const lower = detail.toLowerCase()
    let adjusted = false
    if (sendResponseFormat && lower.includes('response_format')) {
      sendResponseFormat = false
      adjusted = true
    }
    if (sendSize && lower.includes('size')) {
      sendSize = false
      adjusted = true
    }
    if (sendN && /parameter:?\s*['"]n['"]|['"]n['"]\s*(is|parameter|unknown|not)/.test(lower)) {
      sendN = false
      adjusted = true
    }
    if (!adjusted) throw new GatewayError(detail, res.status)
  }

  if (!res.ok) throw new GatewayError(await parseError(res), res.status)

  const json: any = await res.json()
  const item = json?.data?.[0] ?? json?.images?.[0] ?? json
  let url = ''
  if (item?.b64_json) url = `data:image/png;base64,${item.b64_json}`
  else if (item?.url) url = item.url
  else if (typeof item === 'string') url = item

  if (!url) throw new GatewayError('Gateway returned no image payload.')

  return { url, usage: { assets: 1 }, raw: json }
}

export interface GeminiImageArgs {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  signal?: AbortSignal
}

/**
 * Gemini-native image generation. Unlike OpenAI, Gemini has no /images route —
 * you call generateContent on an image model (e.g. gemini-2.5-flash-image,
 * "Nano Banana") and read the base64 image out of the response parts.
 *
 * Endpoint: {baseUrl}/models/{model}:generateContent
 * The image comes back as inlineData.data (base64) on a candidate part.
 */
export async function imageGenerationGemini(args: GeminiImageArgs): Promise<ImageResult> {
  const { baseUrl, apiKey, model, prompt, signal } = args
  const path = `/models/${encodeURIComponent(model)}:generateContent`

  // Ask for an image modality; if the gateway rejects that field, retry without it.
  let sendModalities = true
  const buildBody = () => ({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(sendModalities
      ? { generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }
      : {}),
  })

  let res: Response
  for (let attempt = 0; ; attempt++) {
    res = await fetch(joinPath(baseUrl, path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildBody()),
      signal,
    })
    if (res.ok || attempt >= 1) break
    const detail = await parseError(res)
    if (sendModalities && /modalit|generationconfig|responsemodalities/i.test(detail)) {
      sendModalities = false
      continue
    }
    throw new GatewayError(detail, res.status)
  }

  if (!res.ok) throw new GatewayError(await parseError(res), res.status)

  const json: any = await res.json()
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? []
  const imgPart = parts.find(
    (p) => p?.inlineData?.data || p?.inline_data?.data,
  )
  const inline = imgPart?.inlineData ?? imgPart?.inline_data
  if (!inline?.data) {
    // Surface any text the model returned instead of an image (e.g. a refusal).
    const textPart = parts.find((p) => typeof p?.text === 'string')?.text
    throw new GatewayError(
      textPart
        ? `Model returned text, not an image: "${String(textPart).slice(0, 160)}"`
        : 'Gemini returned no image data.',
    )
  }
  const mime = inline.mimeType ?? inline.mime_type ?? 'image/png'
  return { url: `data:${mime};base64,${inline.data}`, usage: { assets: 1 }, raw: json }
}

/** Lightweight connectivity probe used by Settings "Test" buttons. */
export async function pingChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  return chatCompletion({
    baseUrl,
    apiKey,
    model,
    temperature: 0,
    maxTokens: 16,
    messages: [
      {
        role: 'user',
        content: 'Reply with the single word: OK',
      },
    ],
    signal,
  })
}
