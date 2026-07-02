// Seed Brand Profile — illustrative, public-derived "Capital One" style reference.
// Used as a STYLE reference only; the engine generates original output.
// Clearly labelled illustrative; the user is prompted to upload real collateral.

import type { BrandProfile } from '@/types'

export const SEED_BRAND_PROFILE: BrandProfile = {
  brandName: 'Capital One',
  oneLiner:
    'A consumer-first bank that makes money simpler, more approachable, and more human — "What\'s in your wallet?"',
  derivedAt: Date.parse('2026-06-01T00:00:00Z'),
  illustrative: true,
  voice: {
    attributes: [
      'Confident',
      'Plain-spoken',
      'Optimistic',
      'Empowering',
      'Human / warm',
      'Jargon-free',
    ],
    readingLevel: 'Grade 7–8 (accessible, conversational)',
    sentenceRhythm:
      'Short, punchy sentences mixed with one longer explanatory line; frequent direct "you" address; questions used to engage.',
    doWords: [
      'you',
      'your money',
      'simple',
      'no fees',
      'rewards',
      'earn',
      'confidence',
      'in control',
      'no hassle',
    ],
    dontWords: [
      'guaranteed',
      'best',
      'pre-approved',
      'risk-free',
      'always',
      'never',
      'unlimited (unqualified)',
      'jargon',
    ],
    signaturePhrases: [
      "What's in your wallet?",
      'Banking reimagined',
      'No fees, no minimums',
      'Earn unlimited rewards',
    ],
  },
  messaging: {
    valueProps: [
      'Simple, transparent products with no hidden fees',
      'Rewards that are easy to earn and easy to use',
      'Tools that put you in control of your financial life',
      'Human, accessible banking for everyone',
    ],
    proofPoints: [
      'No annual fee on featured cards',
      'No foreign transaction fees',
      'Top-rated mobile app and 24/7 account monitoring',
      'CreditWise — free credit score and monitoring',
    ],
    ctas: [
      'See if you’re pre-qualified',
      'Learn more',
      'Get started',
      'Check your CreditWise score',
    ],
  },
  visual: {
    palette: [
      { name: 'Capital Navy', hex: '#004977' },
      { name: 'Signal Red', hex: '#d03027' },
      { name: 'Ink', hex: '#13171a' },
      { name: 'Cloud', hex: '#f4f6f8' },
      { name: 'Accent Blue', hex: '#0070ba' },
    ],
    typography:
      'Clean geometric sans-serif; bold confident headlines, generous whitespace, high legibility.',
    imageryStyle:
      'Real, diverse people in candid everyday moments; warm natural lighting; aspirational but attainable lifestyle; product shots are clean and uncluttered.',
    logoUsage:
      'Wordmark with the swoosh lockup; clear space preserved; navy on light or reversed white on navy; never stretched or recolored.',
    doList: [
      'Show diverse, relatable people in authentic moments',
      'Keep layouts clean with strong focal hierarchy',
      'Use navy + red sparingly as accents',
    ],
    dontList: [
      'No staged stock-photo clichés',
      'No cluttered or busy compositions',
      'No off-palette colors or recolored logo',
      'Do not depict guaranteed wealth or unrealistic outcomes',
    ],
  },
  compliance: {
    legalLines: [
      'Member FDIC',
      'Equal Housing Lender',
      '© Capital One. All rights reserved.',
    ],
    recurringDisclosures: [
      'Credit approval required. Terms and conditions apply.',
      'See terms for rates, fees, rewards, and other costs and benefits.',
      'CreditWise is free and available to everyone — for educational purposes; not a credit decision.',
      'Pre-qualification does not guarantee approval; a pre-qualified offer is not a firm offer of credit.',
    ],
    notes:
      'Brand consistently uses "pre-qualified" (not "pre-approved") and frames CreditWise as educational. Rewards claims are caveated with earn/redemption terms. APR and fee mentions carry rate disclosures.',
  },
}
