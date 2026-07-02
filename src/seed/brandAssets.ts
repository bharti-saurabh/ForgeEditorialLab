// Seed brand repository — illustrative, public-derived "Capital One" style
// collateral. Used as a STYLE reference only; the engine generates original
// output. Clearly labelled synthetic. Most assets ship pre-analyzed so the
// Brand Profile opens "learned"; one asset is left un-analyzed to demo the
// Analyze flow.

import type { BrandAsset } from '@/types'
import { THUMB_DISPLAY_AD, THUMB_LANDING, THUMB_SOCIAL } from './thumbnails'

const t0 = Date.parse('2026-05-15T12:00:00Z')

export const SEED_BRAND_ASSETS: BrandAsset[] = [
  {
    id: 'seed_asset_tagline',
    name: "Tagline — \"What's in your wallet?\"",
    type: 'tagline',
    channel: 'print',
    seed: true,
    addedAt: t0,
    campaign: 'Brand Platform',
    date: '2023',
    rawCopy: "What's in your wallet?",
    analysis: {
      summary:
        'The flagship brand line — a direct, conversational question that puts the customer at the center.',
      voiceSignals: ['Conversational', 'Direct "you" address', 'Confident', 'Memorable'],
      messagingSignals: ['Customer-centric framing', 'Brand recall device'],
      visualSignals: [],
      complianceSignals: [],
      detectedDisclosures: [],
    },
  },
  {
    id: 'seed_asset_venture_email',
    name: 'Email — Venture rewards nurture',
    type: 'email',
    channel: 'email',
    seed: true,
    addedAt: t0 + 1000,
    campaign: 'Venture Q2',
    date: '2026-04',
    rawCopy: `Subject: Your travel rewards are waiting

Hi there,

Big trips start with small steps. With Venture, you earn unlimited miles on every purchase — and there are no foreign transaction fees when you travel.

Miles don't expire as long as your account is open, and you can redeem them for flights, hotels, and more.

See if you're pre-qualified — checking won't affect your credit score.

What's in your wallet?

Credit approval required. Terms and conditions apply. See terms for rates, fees, rewards, and other costs and benefits. Member FDIC.`,
    analysis: {
      summary:
        'Warm, benefit-led nurture email that leads with the travel reward and properly caveats the pre-qualification.',
      voiceSignals: ['Optimistic', 'Plain-spoken', 'Encouraging', 'Second person'],
      messagingSignals: [
        'Unlimited miles on every purchase',
        'No foreign transaction fees',
        'Miles don’t expire',
        'CTA: See if you’re pre-qualified',
      ],
      visualSignals: [],
      complianceSignals: [
        'Uses "pre-qualified" (not "pre-approved")',
        'Soft-pull reassurance: checking won’t affect credit score',
        'Rewards caveated with terms',
      ],
      detectedDisclosures: [
        'Credit approval required. Terms and conditions apply.',
        'See terms for rates, fees, rewards, and other costs and benefits.',
        'Member FDIC',
      ],
    },
  },
  {
    id: 'seed_asset_display_ad',
    name: 'Display ad — Unlimited rewards',
    type: 'display-ad',
    channel: 'display',
    seed: true,
    addedAt: t0 + 2000,
    campaign: 'Quicksilver Always-On',
    date: '2026-03',
    imageUrl: THUMB_DISPLAY_AD,
    rawCopy:
      'Earn unlimited rewards. No annual fee. No foreign transaction fees. See if you’re pre-qualified.',
    analysis: {
      summary:
        'High-contrast navy creative with a single bold benefit headline and a clear pre-qualification CTA.',
      voiceSignals: ['Confident', 'Punchy', 'Benefit-first'],
      messagingSignals: [
        'Unlimited rewards',
        'No annual fee',
        'No foreign transaction fees',
      ],
      visualSignals: [
        'Navy background with red CTA button',
        'Bold geometric sans headline',
        'Generous whitespace, single focal point',
      ],
      complianceSignals: [
        'Carries "Credit approval required" + Member FDIC footer',
        'Uses "pre-qualified"',
      ],
      detectedDisclosures: ['Credit approval required. Member FDIC.'],
    },
  },
  {
    id: 'seed_asset_landing',
    name: 'Landing page — Brand hero',
    type: 'landing-page',
    channel: 'web',
    seed: true,
    addedAt: t0 + 3000,
    campaign: 'Acquisition',
    date: '2026-02',
    imageUrl: THUMB_LANDING,
    rawCopy:
      "What's in your wallet? Banking made simple, with no hidden fees. Get started.",
    analysis: {
      summary:
        'Clean light-mode landing hero pairing the brand line with a simplicity value prop and a single primary CTA.',
      voiceSignals: ['Simple', 'Reassuring', 'Human'],
      messagingSignals: ['No hidden fees', 'Banking made simple', 'CTA: Get started'],
      visualSignals: [
        'Cloud/white background, navy headline',
        'Strong focal hierarchy, app product card',
        'Diverse-people imagery slot',
      ],
      complianceSignals: ['Avoids superlatives in hero', 'Fee claim is qualified ("no hidden fees")'],
      detectedDisclosures: [],
    },
  },
  {
    id: 'seed_asset_social',
    name: 'Paid social — CreditWise',
    type: 'paid-social',
    channel: 'social',
    seed: true,
    addedAt: t0 + 4000,
    campaign: 'CreditWise Awareness',
    date: '2026-01',
    imageUrl: THUMB_SOCIAL,
    rawCopy:
      'Your money, your way. Stay in control with CreditWise. Learn more. CreditWise is free and available to everyone.',
    analysis: {
      summary:
        'Empowerment-led square social creative promoting the free CreditWise tool with an educational framing.',
      voiceSignals: ['Empowering', 'Optimistic', 'In-control framing'],
      messagingSignals: ['Stay in control', 'CreditWise is free for everyone', 'CTA: Learn more'],
      visualSignals: ['Navy gradient', 'Bold white headline', 'White pill CTA'],
      complianceSignals: [
        'CreditWise framed as free + educational',
        'No credit-decision implication',
      ],
      detectedDisclosures: ['CreditWise is free and available to everyone.'],
    },
  },
  {
    id: 'seed_asset_blog',
    name: 'Blog — How credit scores work',
    type: 'blog',
    channel: 'web',
    seed: true,
    addedAt: t0 + 5000,
    campaign: 'Learn & Grow',
    date: '2025-11',
    rawCopy: `Understanding your credit score

Your credit score is one of the most useful numbers in your financial life — but it doesn't have to be a mystery. In plain terms, it's a snapshot of how you've handled credit so far.

A few things tend to matter most: paying on time, keeping balances low relative to your limits, and the length of your credit history.

The good news? You're in control. Small, consistent habits add up over time. And with CreditWise, you can check your score for free and see what's helping or hurting it — for educational purposes.

This article is for educational purposes and is not financial advice.`,
    analysis: {
      summary:
        'Educational, reassuring explainer that demystifies credit scores and routes to CreditWise with an educational caveat.',
      voiceSignals: ['Plain-spoken', 'Reassuring', 'Empowering', 'Grade 7–8 reading level'],
      messagingSignals: [
        'You’re in control',
        'Small habits add up',
        'CreditWise is free',
      ],
      visualSignals: [],
      complianceSignals: [
        'Repeated "for educational purposes" caveat',
        'Explicit "not financial advice" line',
        'No score guarantees',
      ],
      detectedDisclosures: [
        'This article is for educational purposes and is not financial advice.',
        'for educational purposes',
      ],
    },
  },
  {
    id: 'seed_asset_savings_email',
    name: 'Email — 360 Savings',
    type: 'email',
    channel: 'email',
    seed: true,
    addedAt: t0 + 6000,
    campaign: 'Deposits',
    date: '2025-10',
    rawCopy: `Subject: Watch your savings grow

No fees. No minimums. Just a simple way to save.

With 360 Performance Savings, your money earns a competitive rate — and you can open an account in about 5 minutes.

Member FDIC.`,
    analysis: {
      summary:
        'Short, friction-light deposits email emphasizing simplicity and speed with no-fee/no-minimum proof points.',
      voiceSignals: ['Simple', 'Direct', 'Low-friction'],
      messagingSignals: ['No fees', 'No minimums', 'Open in ~5 minutes', 'Competitive rate'],
      visualSignals: [],
      complianceSignals: ['"competitive rate" avoids quoting an unqualified APY', 'Member FDIC present'],
      detectedDisclosures: ['Member FDIC'],
    },
  },
  {
    id: 'seed_asset_print',
    name: 'Print ad — Quicksilver cash back',
    type: 'display-ad',
    channel: 'print',
    seed: true,
    addedAt: t0 + 7000,
    campaign: 'Quicksilver',
    date: '2025-09',
    rawCopy:
      'Unlimited 1.5% cash back on every purchase, every day. No rotating categories. No annual fee. What’s in your wallet?',
    analysis: {
      summary:
        'Cash-back value-prop ad leaning on simplicity ("no rotating categories") and the brand sign-off line.',
      voiceSignals: ['Confident', 'Benefit-first', 'Brand sign-off line'],
      messagingSignals: [
        'Unlimited 1.5% cash back',
        'No rotating categories',
        'No annual fee',
      ],
      visualSignals: [],
      complianceSignals: ['Specific rate (1.5%) stated plainly; would require fee/terms disclosure in market'],
      detectedDisclosures: [],
    },
  },
  {
    id: 'seed_asset_unanalyzed',
    name: 'Email — Back-to-school spend (new, un-analyzed)',
    type: 'email',
    channel: 'email',
    seed: true,
    addedAt: t0 + 8000,
    campaign: 'Seasonal',
    date: '2026-06',
    rawCopy: `Subject: Make back-to-school spending work for you

The supply lists are long, but your rewards don't have to wait. Earn cash back on everyday purchases — from notebooks to new laptops — and put it toward what matters next.

Check your CreditWise score before the season ramps up.`,
    // intentionally left without analysis to demonstrate the Analyze action
  },
]
