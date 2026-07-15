// ---- Discovery payload (shared shape between /api/discover and seeded demo) ----

export type Momentum = 'rising' | 'steady' | 'new'
export type Sentiment = 'positive' | 'mixed' | 'negative'

export interface TrendingItem {
  title: string
  summary: string
  url: string
  source: string
  angle: string
  momentum: Momentum
}

export interface Competitor {
  name: string
  angle: string
  url: string
  summary: string
}

export interface BuzzItem {
  quote: string
  source: string
  url: string
  sentiment: Sentiment
}

export interface SourceRef {
  title: string
  url: string
}

export interface DiscoverPayload {
  trending: TrendingItem[]
  competitors: Competitor[]
  buzz: BuzzItem[]
  sources: SourceRef[]
}

// ---- Brand profile (client-side, drives grounding + on/off-brand judgement) ----

export interface BrandProfile {
  name: string
  voice: string
  valueProps: string
  dos: string
  donts: string
  targetNeeds: string
}

export const EMPTY_BRAND: BrandProfile = {
  name: '',
  voice: '',
  valueProps: '',
  dos: '',
  donts: '',
  targetNeeds: '',
}

// ---- Synthesis + recommendations ----

export type Confidence = 'High' | 'Medium' | 'Low'

export interface Recommendation {
  title: string
  angle: string
  audienceSegment: string
  funnelStage: string
  format: string
  channel: string
  keyMessage: string
  /** The specific trend/quote this rec is built on (grounding). */
  sourceInsight: string
  whyNow: string
  rationale: string
  confidence: Confidence
  tags: string[]
  onBrand: boolean
  offBrandReason: string
}

export interface Synthesis {
  dominantAngles: string[]
  sentimentSummary: string
  overServed: string
  gap: string
  /** One-line "over-served: X; opening: Y". */
  buzzSynthesis: string
  recommendations: Recommendation[]
}

// ---- Trending Now board (topic-less discovery) ----

export interface TrendTopic {
  /** The trending term/headline — also used as the seed topic when clicked. */
  title: string
  source: string
  url: string
  /** Short human hint, e.g. "200K+ searches", "980 points", "r/tech · 45k". */
  meta?: string
  /** Why it's trending — e.g. the related news headline behind a search spike. */
  context?: string
}

export interface TrendGroup {
  source: string
  live: boolean
  items: TrendTopic[]
  note?: string
}

export interface UnavailableSource {
  source: string
  reason: string
}

export interface TrendingBoard {
  groups: TrendGroup[]
  unavailable: UnavailableSource[]
  mode: 'live' | 'demo'
}

// ---- Run modes ----

export type Mode = 'live' | 'demo'

export interface ScanResult {
  topic: string
  discovery: DiscoverPayload
  synthesis: Synthesis
  discoveryMode: Mode
  synthesisMode: Mode
  /** Provider that produced discovery (e.g. "tavily" or "seeded"). */
  discoveryProvider?: string
  /** Human note explaining demo/seeded fallbacks. */
  discoveryNote?: string
}
