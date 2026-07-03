// The channel/surface a piece is authored FOR. This is the single source of
// truth the brief, draft, visuals, posted preview, and compliance review all
// read from, so "what surface is this?" is decided once (Step 2) and honored
// everywhere downstream — rather than only at Publish (Step 5).
//
// PRIMARY_CHANNELS are the surfaces offered in the Step 2 picker. The wider
// ChannelKey set (incl. 'linkedin') still exists for the Publish fan-out.

import type { ChannelKey, RecommendedFormat } from '@/types'

/** image-centric surfaces render a visual; text-ad surfaces (SEM) are copy-only. */
export type ChannelKind = 'image' | 'text-ad'

/** How the posted-preview chrome renders this surface. */
export type PreviewChrome = 'article' | 'feed' | 'serp' | 'inbox'

export interface AspectRatio {
  key: string
  label: string
  /** display ratio, e.g. "1:1" */
  ratio: string
  /** image-generation size string passed to the image model */
  size: string
  /** true when this is a square crop (drives the demo mock) */
  square: boolean
}

export interface ChannelSpec {
  key: ChannelKey
  label: string
  /** compact label for chips */
  short: string
  kind: ChannelKind
  /** one-line description of the surface */
  blurb: string
  /** woven into brief generation — what the brief should optimize for */
  briefGuidance: string
  /** woven into draft generation — the form the copy should take */
  draftForm: string
  /** soft length target shown to the model + editor */
  lengthTarget: string
  /** visual aspect ratios offered in Step 3 (empty for text-ad surfaces) */
  ratios: AspectRatio[]
  /** which preview chrome renders this surface */
  preview: PreviewChrome
}

const LANDSCAPE: AspectRatio = { key: 'landscape', label: 'Landscape 16:9', ratio: '16:9', size: '1536x1024', square: false }
const SQUARE: AspectRatio = { key: 'square', label: 'Square 1:1', ratio: '1:1', size: '1024x1024', square: true }
const PORTRAIT: AspectRatio = { key: 'portrait', label: 'Portrait 4:5', ratio: '4:5', size: '1024x1280', square: false }
const BANNER: AspectRatio = { key: 'banner', label: 'Banner 16:9', ratio: '16:9', size: '1536x1024', square: false }

export const CHANNEL_SPECS: Record<ChannelKey, ChannelSpec> = {
  blog: {
    key: 'blog',
    label: 'Blog / Web',
    short: 'Blog',
    kind: 'image',
    blurb: 'Long-form editorial article with a lead hero image.',
    briefGuidance:
      'Full long-form article: a complete outline (intro, 3-5 sections, close), SEO keywords, and the complete disclosure block inline at the foot.',
    draftForm:
      'A long-form web article with a headline and clearly-sectioned body. Carry every mandatory disclosure inline at the end.',
    lengthTarget: '800-1,200 words',
    ratios: [LANDSCAPE, SQUARE],
    preview: 'article',
  },
  'paid-social': {
    key: 'paid-social',
    label: 'Paid social',
    short: 'Paid social',
    kind: 'image',
    blurb: 'In-feed sponsored card — image + a tight hook + one CTA.',
    briefGuidance:
      'A single scroll-stopping paid-social ad: one hook, one benefit, one CTA. Material terms must be present or clearly linked ("see terms").',
    draftForm:
      'A short paid-social caption: a strong first-line hook, 1-2 tight lines, a single CTA, and a "see terms" cue for material disclosures. No long paragraphs.',
    lengthTarget: '40-80 words',
    ratios: [SQUARE, PORTRAIT],
    preview: 'feed',
  },
  sem: {
    key: 'sem',
    label: 'SEM / Google search',
    short: 'SEM',
    kind: 'text-ad',
    blurb: 'Responsive search text ad — headlines + descriptions, no image.',
    briefGuidance:
      'A responsive search ad: intent-matched headline options and description options within Google Ads character limits. No hero image. Material terms clear or linked.',
    draftForm:
      'A responsive search ad. Provide 3 headlines (each ≤30 characters) and 2 descriptions (each ≤90 characters). Format as "Headlines:" then "Descriptions:" lists. No article body.',
    lengthTarget: '3 headlines ≤30 char · 2 descriptions ≤90 char',
    ratios: [],
    preview: 'serp',
  },
  email: {
    key: 'email',
    label: 'Email',
    short: 'Email',
    kind: 'image',
    blurb: 'Inbox/newsletter — subject + preheader + hero + scannable body.',
    briefGuidance:
      'An email: a subject line, a preheader, and a scannable body with one clear CTA. Legal lines sit in the footer.',
    draftForm:
      'An email with a subject line (first line), a one-line preheader, a scannable body with one clear CTA, and the legal lines in a footer.',
    lengthTarget: 'subject + preheader + ~150-word body',
    ratios: [BANNER, SQUARE],
    preview: 'inbox',
  },
  // Publish fan-out surface (not offered in the primary picker).
  linkedin: {
    key: 'linkedin',
    label: 'LinkedIn',
    short: 'LinkedIn',
    kind: 'image',
    blurb: 'Professional, insight-led post.',
    briefGuidance:
      'A professional, insight-led LinkedIn post: a two-line hook, 3-5 short paragraphs, a few hashtags.',
    draftForm:
      'A LinkedIn post: a two-line hook, 3-5 short paragraphs, a light CTA, a few hashtags.',
    lengthTarget: '120-200 words',
    ratios: [LANDSCAPE, SQUARE],
    preview: 'feed',
  },
}

/** Surfaces offered in the Step 2 primary-channel picker, in display order. */
export const PRIMARY_CHANNELS: ChannelKey[] = ['blog', 'paid-social', 'sem', 'email']

export function channelSpec(key: ChannelKey): ChannelSpec {
  return CHANNEL_SPECS[key] ?? CHANNEL_SPECS.blog
}

/** True when the surface centers on a generated image (Step 3 renders visuals). */
export function isImageChannel(key: ChannelKey): boolean {
  return channelSpec(key).kind === 'image'
}

const FORMAT_TO_CHANNEL: Record<RecommendedFormat, ChannelKey> = {
  blog: 'blog',
  explainer: 'blog',
  email: 'email',
  social: 'paid-social',
  'landing-page': 'blog',
}

/** Pre-select a sensible primary channel from a topic's recommended format. */
export function channelForFormat(format?: RecommendedFormat): ChannelKey {
  return format ? FORMAT_TO_CHANNEL[format] ?? 'blog' : 'blog'
}
