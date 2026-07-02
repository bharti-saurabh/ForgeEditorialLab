// Brand Profile helpers — derivation + serialization.
// In Increment 1 deriveProfile() assembles a profile from analyzed assets,
// merging signals into the editable profile structure. Later increments can
// route this through the reasoning model for a richer synthesis.

import type { BrandAsset, BrandProfile } from '@/types'

/** Merge analysis signals from the repository into a profile snapshot. */
export function aggregateSignals(assets: BrandAsset[]) {
  const voice = new Set<string>()
  const messaging = new Set<string>()
  const visual = new Set<string>()
  const compliance = new Set<string>()
  const disclosures = new Set<string>()

  for (const a of assets) {
    if (!a.analysis) continue
    a.analysis.voiceSignals.forEach((s) => voice.add(s))
    a.analysis.messagingSignals.forEach((s) => messaging.add(s))
    a.analysis.visualSignals.forEach((s) => visual.add(s))
    a.analysis.complianceSignals.forEach((s) => compliance.add(s))
    a.analysis.detectedDisclosures.forEach((s) => disclosures.add(s))
  }

  return {
    voice: [...voice],
    messaging: [...messaging],
    visual: [...visual],
    compliance: [...compliance],
    disclosures: [...disclosures],
  }
}

/** Count of analyzed vs total assets — drives the "profile freshness" badge. */
export function profileCoverage(assets: BrandAsset[]) {
  const total = assets.length
  const analyzed = assets.filter((a) => a.analysis).length
  return { total, analyzed, pct: total ? Math.round((analyzed / total) * 100) : 0 }
}

export function profileToMarkdown(p: BrandProfile): string {
  const v = p.voice
  const m = p.messaging
  const vis = p.visual
  const c = p.compliance
  return `# Brand Profile — ${p.brandName}

> ${p.oneLiner}
${p.illustrative ? '\n_Illustrative / public-derived. Replace with confirmed client collateral before production use._\n' : ''}
## Voice & Tone
- **Attributes:** ${v.attributes.join(', ')}
- **Reading level:** ${v.readingLevel}
- **Sentence rhythm:** ${v.sentenceRhythm}
- **Use:** ${v.doWords.join(', ')}
- **Avoid:** ${v.dontWords.join(', ')}
- **Signature phrases:** ${v.signaturePhrases.map((s) => `"${s}"`).join(', ')}

## Messaging
- **Value props:** ${m.valueProps.join('; ')}
- **Proof points:** ${m.proofPoints.join('; ')}
- **Calls to action:** ${m.ctas.join('; ')}

## Visual Identity
- **Palette:** ${vis.palette.map((c) => `${c.name} ${c.hex}`).join(', ')}
- **Typography:** ${vis.typography}
- **Imagery style:** ${vis.imageryStyle}
- **Logo / lockup:** ${vis.logoUsage}
- **Do:** ${vis.doList.join('; ')}
- **Don't:** ${vis.dontList.join('; ')}

## Compliance Fingerprint
- **Required legal lines:** ${c.legalLines.join(' | ')}
- **Recurring disclosures:** ${c.recurringDisclosures.join(' | ')}
- **Notes:** ${c.notes}
`
}
