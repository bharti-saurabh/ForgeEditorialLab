import type {
  DiscoverPayload,
  TrendingItem,
  Competitor,
  BuzzItem,
  Momentum,
  Sentiment,
} from './types'
import { makeRng, pick, sample, titleCase } from './seed'

// Deterministic, clearly-illustrative discovery payload built from a topic.
// The serverless /api/discover returns this SAME shape (and this same payload
// when no search key is set), so demo and live are interchangeable downstream.

const MOMENTUM: Momentum[] = ['rising', 'steady', 'new']

const OUTLETS = [
  'The Verge',
  'TechCrunch',
  'Harvard Business Review',
  'Fast Company',
  'Marketing Brew',
  'Wired',
  'Reuters',
  'The Information',
  'Contentful Blog',
  'Substack Digest',
]

const COMMUNITIES = [
  'r/marketing',
  'LinkedIn',
  'X / Twitter',
  'Hacker News',
  'Discord community',
  'YouTube comments',
  'Product Hunt',
  'Reddit AMA',
]

const TREND_ANGLES = [
  'practical how-to',
  'contrarian take',
  'data-backed benchmark',
  'buyer education',
  'behind-the-scenes',
  'myth-busting',
  'ROI / cost angle',
  'future-of prediction',
]

const COMPETITOR_NAMES = [
  'Northbeam',
  'Clearscope',
  'Vantage Labs',
  'Beacon Digital',
  'Loop & Co.',
  'Meridian Studio',
  'Cadence',
  'Fieldnote',
]

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function demoUrl(host: string, topic: string, n: number): string {
  return `https://example.com/${slug(host)}/${slug(topic)}-${n}#demo`
}

export function demoDiscover(topicRaw: string): DiscoverPayload {
  const topic = (topicRaw || 'marketing').trim() || 'marketing'
  const T = titleCase(topic)
  const rng = makeRng(`discover::${topic.toLowerCase()}`)

  const trendTemplates: ((a: string, o: string) => Partial<TrendingItem>)[] = [
    (a, o) => ({
      title: `${T}: why the ${a} is suddenly everywhere`,
      summary: `${o} reports a spike in ${topic} coverage as teams chase a ${a}. Illustrative sample content.`,
      angle: `${a} framing on ${topic}`,
    }),
    (a, o) => ({
      title: `The new playbook for ${topic}`,
      summary: `A widely-shared ${o} piece reframes ${topic} around a ${a}. Illustrative sample content.`,
      angle: `playbook / ${a}`,
    }),
    (a, o) => ({
      title: `${T} in 2026: what actually changed`,
      summary: `${o} breaks down shifts in ${topic} buyer expectations with a ${a}. Illustrative sample content.`,
      angle: `state-of / ${a}`,
    }),
    (a, o) => ({
      title: `Everyone's wrong about ${topic}`,
      summary: `A ${a} on ${topic} from ${o} is driving debate across feeds. Illustrative sample content.`,
      angle: `contrarian / ${a}`,
    }),
    (a, o) => ({
      title: `${T} teardown: 6 examples that worked`,
      summary: `${o} compiles ${topic} examples into a ${a}. Illustrative sample content.`,
      angle: `examples / ${a}`,
    }),
  ]

  const trending: TrendingItem[] = sample(rng, trendTemplates, 5).map((tpl, i) => {
    const a = pick(rng, TREND_ANGLES)
    const o = pick(rng, OUTLETS)
    const base = tpl(a, o)
    return {
      title: base.title!,
      summary: base.summary!,
      angle: base.angle!,
      source: o,
      url: demoUrl(o, topic, i + 1),
      momentum: MOMENTUM[Math.floor(rng() * MOMENTUM.length)],
    }
  })

  const compTemplates = [
    (n: string) => ({
      angle: `Owns the "${topic} for beginners" educational lane`,
      summary: `${n} publishes steady 101-level ${topic} explainers and glossaries.`,
    }),
    (n: string) => ({
      angle: `Leads with data & original ${topic} benchmarks`,
      summary: `${n} runs quarterly ${topic} surveys and turns them into report content.`,
    }),
    (n: string) => ({
      angle: `Founder-voice hot takes on ${topic}`,
      summary: `${n} leans on personal LinkedIn essays and contrarian ${topic} threads.`,
    }),
    (n: string) => ({
      angle: `Product-led ${topic} tutorials`,
      summary: `${n} ties every ${topic} article back to a feature walkthrough.`,
    }),
  ]

  const competitors: Competitor[] = sample(rng, COMPETITOR_NAMES, 4).map(
    (name, i) => {
      const tpl = compTemplates[i % compTemplates.length]
      const c = tpl(name)
      return {
        name,
        angle: c.angle,
        summary: c.summary,
        url: demoUrl(name, topic, i + 1),
      }
    },
  )

  const buzzTemplates: { q: (t: string) => string; s: Sentiment }[] = [
    { q: (t) => `Honestly the ${t} advice out there all sounds the same now.`, s: 'negative' },
    { q: (t) => `Finally someone explained ${t} without the jargon — this clicked.`, s: 'positive' },
    { q: (t) => `Is ${t} actually worth it for small teams? Still not convinced.`, s: 'mixed' },
    { q: (t) => `The ${t} tools are great but nobody talks about the setup cost.`, s: 'mixed' },
    { q: (t) => `Switched our whole ${t} approach after that thread. Big improvement.`, s: 'positive' },
    { q: (t) => `Every ${t} "guide" is just a pitch in disguise. Tiring.`, s: 'negative' },
  ]

  const buzz: BuzzItem[] = sample(rng, buzzTemplates, 4).map((b, i) => ({
    quote: b.q(topic),
    source: pick(rng, COMMUNITIES),
    url: demoUrl('community', topic, i + 1),
    sentiment: b.s,
  }))

  const sources = [
    ...trending.map((t) => ({ title: t.title, url: t.url })),
    ...competitors.map((c) => ({ title: `${c.name} — ${c.angle}`, url: c.url })),
    ...buzz.map((b) => ({ title: `Community: ${b.source}`, url: b.url })),
  ]

  return { trending, competitors, buzz, sources }
}
