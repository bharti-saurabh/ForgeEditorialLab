// Brand Profile derivation — synthesizes a profile from the analyzed repository.
// Routes through the reasoning model (strategy role); demo fallback performs a
// deterministic merge so the feature works with zero keys.

import type { BrandAsset, BrandProfile } from '@/types'
import { runChat } from '@/lib/router/router'
import { parseJsonLoose } from '@/lib/json'
import { aggregateSignals } from './profile'

function uniq(a: string[]): string[] {
  return [...new Set(a.map((s) => s.trim()).filter(Boolean))]
}

/** Deterministic merge of repository signals into the existing profile. */
export function mergeSignals(profile: BrandProfile, assets: BrandAsset[]): BrandProfile {
  const sig = aggregateSignals(assets)
  return {
    ...profile,
    derivedAt: Date.now(),
    compliance: {
      ...profile.compliance,
      recurringDisclosures: uniq([
        ...profile.compliance.recurringDisclosures,
        ...sig.disclosures,
      ]),
    },
    messaging: {
      ...profile.messaging,
    },
  }
}

const DERIVE_SYSTEM = `You are a brand strategist for a regulated financial-services issuer. Given a set of analyzed marketing assets and the current brand profile, synthesize an UPDATED brand profile. Preserve good existing values; refine using the evidence. Return ONLY a JSON object matching the provided shape — no prose.`

function buildDerivePrompt(profile: BrandProfile, assets: BrandAsset[]): string {
  const analyzed = assets.filter((a) => a.analysis)
  const evidence = analyzed
    .map(
      (a) =>
        `- [${a.type}/${a.channel}] ${a.name}: ${a.analysis!.summary}\n    voice: ${a.analysis!.voiceSignals.join(', ')}\n    messaging: ${a.analysis!.messagingSignals.join(', ')}\n    compliance: ${a.analysis!.complianceSignals.join(', ')}\n    disclosures: ${a.analysis!.detectedDisclosures.join(' | ')}`,
    )
    .join('\n')

  return `CURRENT PROFILE (JSON):
${JSON.stringify(
  {
    brandName: profile.brandName,
    oneLiner: profile.oneLiner,
    voice: profile.voice,
    messaging: profile.messaging,
    visual: profile.visual,
    compliance: profile.compliance,
  },
  null,
  2,
)}

EVIDENCE FROM ${analyzed.length} ANALYZED ASSETS:
${evidence}

Return the updated profile as JSON with the same keys: brandName, oneLiner, voice {attributes[], readingLevel, sentenceRhythm, doWords[], dontWords[], signaturePhrases[]}, messaging {valueProps[], proofPoints[], ctas[]}, visual {palette[{name,hex}], typography, imageryStyle, logoUsage, doList[], dontList[]}, compliance {legalLines[], recurringDisclosures[], notes}.`
}

export async function deriveProfile(
  profile: BrandProfile,
  assets: BrandAsset[],
): Promise<{ profile: BrandProfile; mode: 'live' | 'demo' }> {
  const fallback = mergeSignals(profile, assets)
  const res = await runChat({
    role: 'strategy',
    step: 'Brand Memory · Re-derive Brand Profile',
    system: DERIVE_SYSTEM,
    user: buildDerivePrompt(profile, assets),
    reason:
      'Reasoning model synthesizes voice, messaging, visual, and compliance signals across the repository into one profile.',
    temperature: 0.3,
    demo: () => JSON.stringify(fallback),
  })

  const parsed = parseJsonLoose<Partial<BrandProfile>>(res.text)
  if (!parsed || typeof parsed !== 'object') {
    return { profile: fallback, mode: res.mode }
  }

  // Coerce: keep structure, accept refined values where present.
  const merged: BrandProfile = {
    ...profile,
    brandName: parsed.brandName || profile.brandName,
    oneLiner: parsed.oneLiner || profile.oneLiner,
    voice: { ...profile.voice, ...(parsed.voice ?? {}) },
    messaging: { ...profile.messaging, ...(parsed.messaging ?? {}) },
    visual: { ...profile.visual, ...(parsed.visual ?? {}) },
    compliance: { ...profile.compliance, ...(parsed.compliance ?? {}) },
    derivedAt: Date.now(),
    illustrative: profile.illustrative,
  }
  return { profile: merged, mode: res.mode }
}
