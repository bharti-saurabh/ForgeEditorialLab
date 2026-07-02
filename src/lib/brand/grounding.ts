// Brand-grounding layer — turns the learned Brand Profile into a compact
// context block that is injected into every downstream prompt, so all
// generation stays on-brand. Centralizing this is why output is consistent
// across Topic Intelligence, Drafting, Visuals, Compliance, and Persona Lab.

import type { BrandProfile } from '@/types'

/** Compact, prompt-ready brand context. Used by every step's prompt builder. */
export function buildBrandContext(p: BrandProfile): string {
  const v = p.voice
  const m = p.messaging
  const c = p.compliance
  return [
    `BRAND: ${p.brandName} — ${p.oneLiner}`,
    ``,
    `VOICE & TONE`,
    `- Attributes: ${v.attributes.join(', ')}`,
    `- Reading level: ${v.readingLevel}`,
    `- Sentence rhythm: ${v.sentenceRhythm}`,
    `- Use words: ${v.doWords.join(', ')}`,
    `- Avoid words: ${v.dontWords.join(', ')}`,
    `- Signature phrases: ${v.signaturePhrases.map((s) => `"${s}"`).join(', ')}`,
    ``,
    `MESSAGING`,
    `- Value props: ${m.valueProps.join('; ')}`,
    `- Proof points: ${m.proofPoints.join('; ')}`,
    `- Calls to action: ${m.ctas.join('; ')}`,
    ``,
    `COMPLIANCE FINGERPRINT (the brand's own standards)`,
    `- Required legal lines: ${c.legalLines.join(' | ')}`,
    `- Recurring disclosures: ${c.recurringDisclosures.join(' | ')}`,
  ].join('\n')
}

/** Visual-only context for image prompt construction. */
export function buildVisualContext(p: BrandProfile): string {
  const vis = p.visual
  return [
    `BRAND VISUAL IDENTITY: ${p.brandName}`,
    `- Palette: ${vis.palette.map((c) => `${c.name} (${c.hex})`).join(', ')}`,
    `- Typography feel: ${vis.typography}`,
    `- Imagery style: ${vis.imageryStyle}`,
    `- Logo / lockup: ${vis.logoUsage}`,
    `- Do: ${vis.doList.join('; ')}`,
    `- Don't: ${vis.dontList.join('; ')}`,
  ].join('\n')
}

/** A quick heuristic brand-match scorer (deterministic, used as a demo signal). */
export function brandMatchScore(
  text: string,
  p: BrandProfile,
): { score: number; hit: string[]; missed: string[] } {
  const lower = text.toLowerCase()
  const hit: string[] = []
  const missed: string[] = []

  for (const phrase of p.voice.signaturePhrases) {
    if (lower.includes(phrase.toLowerCase())) hit.push(`Signature phrase: "${phrase}"`)
  }
  for (const w of p.voice.doWords) {
    if (lower.includes(w.toLowerCase())) hit.push(`On-voice word: "${w}"`)
  }
  for (const w of p.voice.dontWords) {
    if (lower.includes(w.toLowerCase())) missed.push(`Avoid word present: "${w}"`)
  }
  for (const vp of p.messaging.valueProps) {
    const key = vp.split(' ').slice(0, 2).join(' ').toLowerCase()
    if (key && lower.includes(key)) hit.push(`Value prop echoed: "${vp}"`)
  }

  const base = 62
  const score = Math.max(
    0,
    Math.min(100, base + hit.length * 6 - missed.length * 14),
  )
  return { score, hit, missed }
}
