// Prompt builders for the Brand Memory analysis step.
// Output is requested as strict JSON so we can render structured signals.

import type { BrandAsset } from '@/types'

const SCHEMA_HINT = `Return ONLY a JSON object with this exact shape (no prose, no markdown fences):
{
  "summary": "one-sentence read on what this asset reveals about the brand",
  "voiceSignals": ["tone/voice attributes evident in the copy"],
  "messagingSignals": ["value props, proof points, or CTAs used"],
  "visualSignals": ["color, layout, imagery, or lockup observations (for visual assets)"],
  "complianceSignals": ["legal lines, disclosures, or risk patterns present"],
  "detectedDisclosures": ["verbatim legal/disclosure lines found in the asset"]
}`

export const ANALYSIS_SYSTEM = `You are a brand strategist and financial-services compliance analyst working for a regulated card issuer. You analyze a single piece of marketing collateral and extract structured brand + compliance signals. Be precise and concise. ${SCHEMA_HINT}`

export function buildCopyAnalysisPrompt(asset: BrandAsset): string {
  return `Analyze this ${asset.type} asset for the ${asset.channel} channel.

ASSET NAME: ${asset.name}
${asset.campaign ? `CAMPAIGN: ${asset.campaign}\n` : ''}${asset.date ? `DATE: ${asset.date}\n` : ''}
COPY:
"""
${asset.rawCopy || '(no copy provided)'}
"""

Extract the brand voice, messaging, and compliance signals. ${SCHEMA_HINT}`
}

export function buildVisionAnalysisPrompt(asset: BrandAsset): string {
  return `Analyze the attached image, which is a ${asset.type} asset for the ${asset.channel} channel (name: ${asset.name}). Read any on-image copy, and describe the color palette, typography feel, imagery style, and logo/lockup usage. Note any visible legal lines or disclosures. ${SCHEMA_HINT}`
}
