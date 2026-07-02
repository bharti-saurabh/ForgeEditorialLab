// Cost estimation for the Model Router. These are ILLUSTRATIVE list-price
// estimates by model family (USD), not your gateway's actual billing — the UI
// labels them "estimated". Adjust the tables to match your contract if needed.
//
// Text is priced per 1M tokens (separate in/out rates). When only a total token
// count is known (demo mode, or gateways that don't return a split), we apply a
// blended rate. Image models are priced per generated image.

import type { ModelRole, TokenUsage } from '@/types'

interface TextRate {
  inPer1M: number
  outPer1M: number
}
interface ImageRate {
  perImage: number
}

const TEXT_RATES: Array<{ match: RegExp; rate: TextRate }> = [
  { match: /claude.*opus/i, rate: { inPer1M: 15, outPer1M: 75 } },
  { match: /claude.*sonnet/i, rate: { inPer1M: 3, outPer1M: 15 } },
  { match: /claude.*haiku/i, rate: { inPer1M: 0.8, outPer1M: 4 } },
  { match: /(gpt-5.*mini|gpt-4o-mini|o4-mini|o3-mini)/i, rate: { inPer1M: 0.4, outPer1M: 1.6 } },
  { match: /(gpt-5|gpt-4\.1|gpt-4o|o1|o3)/i, rate: { inPer1M: 2.5, outPer1M: 10 } },
  { match: /gemini.*(flash|nano)/i, rate: { inPer1M: 0.3, outPer1M: 2.5 } },
  { match: /gemini.*pro/i, rate: { inPer1M: 1.25, outPer1M: 10 } },
]
const DEFAULT_TEXT: TextRate = { inPer1M: 1, outPer1M: 3 }

const IMAGE_RATES: Array<{ match: RegExp; rate: ImageRate }> = [
  { match: /(gemini.*image|nano.?banana)/i, rate: { perImage: 0.04 } },
  { match: /(gpt-image|dall-?e-?3)/i, rate: { perImage: 0.04 } },
]
const DEFAULT_IMAGE: ImageRate = { perImage: 0.04 }

function textRate(model: string): TextRate {
  return TEXT_RATES.find((r) => r.match.test(model))?.rate ?? DEFAULT_TEXT
}
function imageRate(model: string): ImageRate {
  return IMAGE_RATES.find((r) => r.match.test(model))?.rate ?? DEFAULT_IMAGE
}

/** Estimated USD cost for one model call from its usage. */
export function estimateCostUsd(
  modelId: string,
  role: ModelRole,
  usage: TokenUsage,
): number {
  if (role === 'image') return (usage.assets ?? 0) * imageRate(modelId).perImage

  const r = textRate(modelId)
  const inTok = usage.promptTokens
  const outTok = usage.completionTokens
  if (inTok !== undefined || outTok !== undefined) {
    return ((inTok ?? 0) / 1e6) * r.inPer1M + ((outTok ?? 0) / 1e6) * r.outPer1M
  }
  // Only a total is known — apply a blended in/out rate.
  const total = usage.totalTokens ?? 0
  return (total / 1e6) * ((r.inPer1M + r.outPer1M) / 2)
}

/** Compact USD formatter with more precision for sub-cent amounts. */
export function fmtUsd(n: number | undefined): string {
  if (n === undefined) return '—'
  if (n <= 0) return '$0.00'
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}
