// Brand-asset analysis service. Routes copy → text/reasoning model and visuals
// → vision model, parses structured JSON, and provides a believable demo
// fallback so the flow works with zero keys.

import type { AssetAnalysis, BrandAsset } from '@/types'
import { runChat, runVision } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import {
  ANALYSIS_SYSTEM,
  buildCopyAnalysisPrompt,
  buildVisionAnalysisPrompt,
} from '@/lib/prompts/brandAnalysis'

function arr(x: unknown): string[] {
  if (Array.isArray(x)) return x.filter((s) => typeof s === 'string')
  if (typeof x === 'string' && x.trim()) return [x.trim()]
  return []
}

function coerce(raw: unknown, fallback: AssetAnalysis): AssetAnalysis {
  if (!raw || typeof raw !== 'object') return fallback
  const o = raw as Record<string, unknown>
  return {
    summary: typeof o.summary === 'string' && o.summary ? o.summary : fallback.summary,
    voiceSignals: arr(o.voiceSignals).length ? arr(o.voiceSignals) : fallback.voiceSignals,
    messagingSignals: arr(o.messagingSignals).length
      ? arr(o.messagingSignals)
      : fallback.messagingSignals,
    visualSignals: arr(o.visualSignals),
    complianceSignals: arr(o.complianceSignals),
    detectedDisclosures: arr(o.detectedDisclosures),
  }
}

/** Deterministic, content-aware demo analysis used in demo mode / on failure. */
export function demoAnalysis(asset: BrandAsset): AssetAnalysis {
  const copy = (asset.rawCopy || '').toLowerCase()
  const has = (...terms: string[]) => terms.some((t) => copy.includes(t))

  const voice: string[] = ['Plain-spoken', 'Customer-centric']
  if (has('you', 'your')) voice.push('Direct "you" address')
  if (has('simple', 'easy', 'no hassle')) voice.push('Simple / reassuring')
  if (has('rewards', 'earn', 'miles', 'cash back')) voice.push('Benefit-first')

  const messaging: string[] = []
  if (has('no fee', 'no annual fee', 'no minimum')) messaging.push('No-fee value prop')
  if (has('rewards', 'miles', 'cash back', 'points'))
    messaging.push('Rewards earning message')
  if (has('pre-qualified', 'pre-qualify', 'get started', 'learn more'))
    messaging.push('Soft conversion CTA')
  if (!messaging.length) messaging.push('General brand message')

  const compliance: string[] = []
  const disclosures: string[] = []
  if (has('member fdic')) {
    compliance.push('Member FDIC line present')
    disclosures.push('Member FDIC')
  }
  if (has('pre-qualified')) compliance.push('Uses "pre-qualified" (not "pre-approved")')
  if (has('educational')) compliance.push('Educational caveat present')
  if (has('credit approval required'))
    disclosures.push('Credit approval required. Terms and conditions apply.')
  if (has('apr', 'interest rate') && !has('terms'))
    compliance.push('⚠ APR/rate mention may need a rate disclosure')

  const visual: string[] = asset.imageUrl
    ? ['Brand navy palette', 'Bold geometric headline', 'Single focal CTA']
    : []

  return {
    summary: `Demo analysis of "${asset.name}" — a ${asset.type} for the ${asset.channel} channel. Signals extracted from the copy${asset.imageUrl ? ' and creative' : ''}.`,
    voiceSignals: [...new Set(voice)],
    messagingSignals: [...new Set(messaging)],
    visualSignals: visual,
    complianceSignals: [...new Set(compliance)],
    detectedDisclosures: [...new Set(disclosures)],
  }
}

/** Analyze a single asset. Returns the analysis + the call mode used. */
export async function analyzeAsset(
  asset: BrandAsset,
): Promise<{ analysis: AssetAnalysis; mode: 'live' | 'demo' }> {
  const fallback = demoAnalysis(asset)
  const step = `Brand Memory · Analyze ${asset.imageUrl ? 'creative' : 'copy'}: ${asset.name}`

  if (asset.imageUrl) {
    const res = await runVision({
      step,
      system: ANALYSIS_SYSTEM,
      text: buildVisionAnalysisPrompt(asset),
      imageUrl: asset.imageUrl,
      reason:
        'Vision-capable model reads the creative — layout, palette, imagery, and on-image copy.',
      demo: () => JSON.stringify(fallback),
    })
    const parsed = parseJsonLoose(res.text)
    return { analysis: coerce(parsed, fallback), mode: res.mode }
  }

  const res = await runChat({
    role: 'strategy',
    step,
    system: ANALYSIS_SYSTEM,
    user: buildCopyAnalysisPrompt(asset),
    reason:
      'Reasoning model extracts brand voice, messaging, and compliance signals from copy.',
    temperature: 0.2,
    demo: () => JSON.stringify(fallback),
  })
  const parsed = parseJsonLoose(res.text)
  return { analysis: coerce(parsed, fallback), mode: res.mode }
}
