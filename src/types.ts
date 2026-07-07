// ───────────────────────────────────────────────────────────────────────────
// Forge — central domain types. Shared across the routing, brand-grounding,
// and UI layers. Types for later pipeline increments live here too so seed
// data type-checks against them today.
// ───────────────────────────────────────────────────────────────────────────

// ── Model routing ──────────────────────────────────────────────────────────

/** A purpose-fit role. The router maps each role to a concrete model id. */
export type ModelRole = 'strategy' | 'copy' | 'vision' | 'image'

export type CallMode = 'live' | 'demo'
export type CallStatus = 'ok' | 'error' | 'running'

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  /** number of generated visual assets (image role) */
  assets?: number
}

/** One entry in the always-on Model Router console. */
export interface RouterLogEntry {
  id: string
  ts: number
  /** Human-readable pipeline step, e.g. "Brand Memory · Analyze copy" */
  step: string
  role: ModelRole
  /** Friendly model name shown in the UI */
  modelLabel: string
  /** Raw model id sent to the gateway */
  modelId: string
  /** One-line reason this model was chosen for this job */
  reason: string
  latencyMs: number
  mode: CallMode
  status: CallStatus
  usage: TokenUsage
  /** estimated USD cost for this call (illustrative list-price estimate) */
  costUsd?: number
  /** error message or short note */
  detail?: string
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface ModelAssignments {
  /** text / reasoning model (strategy + copy roles) */
  text: string
  /** image generation model (e.g. Gemini "Nano Banana") */
  image: string
  /** vision model for reading visual assets; defaults to text model when blank */
  vision: string
}

/** Which model slot in Settings fulfills a role. */
export type ModelSlotKey = keyof ModelAssignments // 'text' | 'image' | 'vision'

/** Which request/response shape the image endpoint speaks. */
export type ImageApi = 'openai' | 'gemini'

/** Per-role base URL overrides; blank falls back to the default gatewayUrl. */
export interface RoleBaseUrls {
  text: string
  image: string
  vision: string
}

export interface Settings {
  gatewayUrl: string
  apiKey: string
  models: ModelAssignments
  /** per-role base URL overrides so different providers can serve different
   *  roles through the same key (e.g. OpenAI text + Gemini image). */
  baseUrls: RoleBaseUrls
  temperature: number
  /** persist the API key to localStorage (off → key kept in memory only) */
  persistKey: boolean
  /** OpenAI-compatible image endpoint path, relative to the image base URL */
  imageEndpoint: string
  /** image API shape: OpenAI /images/generations vs Gemini :generateContent */
  imageApi: ImageApi
}

export type TestState = 'idle' | 'testing' | 'ok' | 'error'

export interface RoleTestResult {
  state: TestState
  latencyMs?: number
  message?: string
  at?: number
}

// ── Brand Memory ───────────────────────────────────────────────────────────

export type AssetType =
  | 'blog'
  | 'email'
  | 'paid-social'
  | 'display-ad'
  | 'tagline'
  | 'landing-page'
  | 'other'

export type Channel =
  | 'web'
  | 'email'
  | 'social'
  | 'display'
  | 'search'
  | 'print'
  | 'other'

export interface AssetAnalysis {
  summary: string
  voiceSignals: string[]
  messagingSignals: string[]
  visualSignals: string[]
  complianceSignals: string[]
  /** disclosures/legal lines detected verbatim in the asset */
  detectedDisclosures: string[]
}

export interface BrandAsset {
  id: string
  name: string
  type: AssetType
  channel: Channel
  rawCopy: string
  /** data URL or remote URL for visual assets */
  imageUrl?: string
  sourceUrl?: string
  date?: string
  campaign?: string
  addedAt: number
  /** true while an analysis call is in flight */
  analyzing?: boolean
  analysis?: AssetAnalysis
  /** flags illustrative/public-derived seed assets */
  seed?: boolean
}

// ── Brand Profile ──────────────────────────────────────────────────────────

export interface PaletteColor {
  name: string
  hex: string
}

export interface BrandVoice {
  attributes: string[]
  readingLevel: string
  sentenceRhythm: string
  doWords: string[]
  dontWords: string[]
  signaturePhrases: string[]
}

export interface BrandMessaging {
  valueProps: string[]
  proofPoints: string[]
  ctas: string[]
}

export interface BrandVisual {
  palette: PaletteColor[]
  typography: string
  imageryStyle: string
  logoUsage: string
  doList: string[]
  dontList: string[]
}

export interface BrandComplianceFingerprint {
  legalLines: string[]
  recurringDisclosures: string[]
  notes: string
}

export interface BrandProfile {
  brandName: string
  oneLiner: string
  voice: BrandVoice
  messaging: BrandMessaging
  visual: BrandVisual
  compliance: BrandComplianceFingerprint
  /** when this profile was last (re)derived */
  derivedAt: number
  /** true if values are illustrative / public-derived rather than client-confirmed */
  illustrative: boolean
}

// ── Compliance rulebook (consumed in Increment 3; seeded now) ───────────────

export type RuleSeverity = 'Critical' | 'Major' | 'Minor'

export interface ComplianceRule {
  id: string
  category: string
  /** the regulation / standard cited, e.g. "Reg Z / TILA §1026.16" */
  citation: string
  title: string
  description: string
  defaultSeverity: RuleSeverity
  /** trigger terms / regex-ish substrings (case-insensitive) */
  triggers?: string[]
  /** topics that require this rule's disclosure */
  topics?: string[]
}

export interface RequiredLegalLine {
  id: string
  text: string
  appliesWhen: string
}

export interface RuleBook {
  legalLines: RequiredLegalLine[]
  rules: ComplianceRule[]
  /** disclosures keyed by topic tag */
  disclosuresByTopic: Record<string, string[]>
}

// ── Topic backlog (Increment 2; seeded now) ─────────────────────────────────

export type FunnelStage = 'awareness' | 'consideration' | 'decision'
export type Rating = 'Low' | 'Medium' | 'High'
export type RecommendedFormat =
  | 'blog'
  | 'explainer'
  | 'email'
  | 'social'
  | 'landing-page'

/** How a topic entered the backlog — drives the provenance badge in Step 1. */
export type TopicOrigin = 'trending' | 'competitor-gap' | 'seasonal' | 'evergreen' | 'user'

export type DemandTrend = 'rising' | 'steady' | 'falling'

/** A cited, real-world source that surfaced a trend (kept honest + linkable). */
export interface TopicSource {
  publisher: string
  url: string
  /** 'YYYY-MM' */
  date: string
}

/** A competitor publishing on this topic — the "what competitors are doing" signal. */
export interface CompetitorRef {
  name: string
  url?: string
}

/**
 * The evidence behind a topic's ranking — what makes the score feel *earned*.
 * Rendered as an inline mini-viz + provenance in Step 1.
 */
export interface TopicSignals {
  /** relative-interest series (oldest→newest) for the demand sparkline */
  demandSeries: number[]
  demandTrend: DemandTrend
  /** when it trended, e.g. 'Apr–Jun 2026' */
  trendWindow?: string
  /** competitors currently publishing on this */
  competitors: CompetitorRef[]
  /** how many of our own Brand Memory assets already cover it (gap = competitors − ours) */
  ourAssets: number
  /** citation for the trend (a real article/report) */
  source?: TopicSource
}

/** A recent competitor move shown in the Step 1 "Competitor watch" panel. */
export interface CompetitorMove {
  competitor: string
  move: string
  /** 'YYYY-MM' */
  date: string
  url: string
}

export interface TopicOpportunity {
  id: string
  title: string
  rationale: string
  audienceSegment: string
  funnelStage: FunnelStage
  format: RecommendedFormat
  demand: Rating
  demandScore: number
  difficulty: Rating
  complianceSensitivity: Rating
  onBrand: boolean
  offBrandReason?: string
  tags: string[]
  /** provenance — how this opportunity was surfaced (defaults to evergreen) */
  origin?: TopicOrigin
  /** ranking evidence: demand trend, competitor coverage, source citation */
  signals?: TopicSignals
}

// ── Pipeline run state (flows across steps; extended each increment) ─────────

/** The AI editorial read produced over the ranked backlog (Step 1). */
export interface TopicRead {
  text: string
  modelLabel: string
  mode: CallMode
  ranAt: number
}

/** Auto content brief produced by the strategy model (Step 2). */
export interface ContentBrief {
  objective: string
  audience: string
  angle: string
  keyMessages: string[]
  seoKeywords: string[]
  structure: string[]
  toneNotes: string
  /** disclosures the copy must carry, derived from the topic + rulebook */
  mandatoryDisclosures: string[]
  modelLabel: string
  mode: CallMode
  generatedAt: number
}

/** Optional human direction fed into the brief generation (Step 2). */
export interface BriefInput {
  /** a working headline the editor wants the brief to steer toward */
  workingTitle: string
  /** a preferred angle/hook, if the editor has one in mind */
  anglePreference: string
  /** points the piece must include — newline-separated */
  mustInclude: string
}

/** Brand-voice dials that shape the draft prompt (Step 2). */
export interface VoiceControls {
  /** 0 = casual … 100 = formal */
  formality: number
  /** 0 = neutral … 100 = warm */
  warmth: number
  /** 0 = simple … 100 = in-depth */
  depth: number
  length: 'short' | 'standard' | 'long'
}

export interface BrandMatch {
  score: number
  hit: string[]
  missed: string[]
}

/** One drafting attempt — the bake-off compares several across models. */
export interface DraftVariant {
  id: string
  modelId: string
  modelLabel: string
  mode: CallMode
  title: string
  body: string
  brandMatch: BrandMatch
  wordCount: number
  latencyMs: number
  /** token usage reported by the router (drives the cost estimate) */
  usage?: TokenUsage
  /** set once an editor has hand-edited or AI-refined this variant */
  edited?: boolean
  generatedAt: number
}

/** Brand-safety read on a visual (Step 3). */
export interface VisualSafety {
  status: 'pass' | 'review'
  notes: string[]
}

/** A generated visual asset — image (image model) + text (text model). */
export interface VisualAsset {
  id: string
  role: 'hero' | 'supporting'
  title: string
  /** the image prompt used (editable → regenerate) */
  prompt: string
  /** data URL or remote URL */
  url: string
  imageModelLabel: string
  imageMode: CallMode
  imageLatencyMs: number
  /** estimated USD cost of the image call (illustrative) */
  costUsd?: number
  caption: string
  altText: string
  textModelLabel: string
  textMode: CallMode
  safety: VisualSafety
  /** how the brand-safety read was produced: a vision-model look at the image,
   *  or the deterministic text heuristic (demo / non-live images) */
  safetyModelLabel?: string
  safetyMode?: CallMode
  /** set once an editor has hand-edited the caption or alt text */
  edited?: boolean
  generatedAt: number
}

// ── Compliance gate (Step 4) ─────────────────────────────────────────────

export type IssueElement = 'copy' | 'visual'
export type IssueDecision = 'open' | 'accepted' | 'edited' | 'overridden'

export interface ComplianceIssue {
  id: string
  ruleId: string
  citation: string
  category: string
  title: string
  severity: RuleSeverity
  element: IssueElement
  /** which visual, when element === 'visual' */
  elementRef?: string
  /** the offending text/snippet */
  snippet: string
  rationale: string
  suggestedRewrite: string
  decision: IssueDecision
  /** reviewer's replacement text when decision === 'edited' */
  editText?: string
  /** reviewer's justification when decision === 'overridden' */
  overrideReason?: string
  /** raised by the human reviewer (or promoted from a net-impression check) rather than the rule engine */
  manual?: boolean
}

export interface DisclosureCheck {
  id: string
  text: string
  present: boolean
  source: 'rulebook' | 'legal-line'
  /** satisfied via a "see terms" link cue rather than inline (short-form channels) */
  linked?: boolean
}

export type AuditAction =
  | 'analyzed'
  | 'accept'
  | 'edit'
  | 'override'
  | 'reopen'
  | 'clean-applied'
  | 'signoff'

export interface AuditEvent {
  id: string
  ts: number
  actor: string
  action: AuditAction
  detail: string
}

export type SignOffDecision = 'approved' | 'approved-with-changes' | 'rejected'

export interface SignOff {
  reviewer: string
  decision: SignOffDecision
  note: string
  ts: number
  scoreAtSignoff: number
}

export interface ComplianceState {
  runAt: number
  /** signature of the copy + visuals this review pertains to; a later edit that
   *  changes it makes the sign-off stale (must re-run before publish) */
  reviewedSig?: string
  /** narrative AI assessment (model-labelled) */
  assessment: string
  assessmentModelLabel: string
  assessmentMode: CallMode
  issues: ComplianceIssue[]
  checklist: DisclosureCheck[]
  /** score at first analysis (before any human action) */
  initialScore: number
  /** true once the suggested clean version has been applied */
  cleanApplied: boolean
  audit: AuditEvent[]
  signoff: SignOff | null
}

// ── Publish package (Step 5) ─────────────────────────────────────────────

export type ChannelKey = 'blog' | 'linkedin' | 'email' | 'paid-social' | 'sem'

/** Lightweight per-channel compliance re-check on the adapted copy. */
export interface ChannelRecheck {
  status: 'pass' | 'review'
  issues: number
  criticals: number
  missingDisclosures: number
  notes: string[]
}

/** Human override that clears a channel's re-check for export (Step 5 gate). */
export interface ChannelResolution {
  overridden: boolean
  by: string
  note: string
  at: number
}

/** Structured responsive-search-ad fields (SEM) with per-field limits. */
export interface SemAsset {
  headlines: string[]
  descriptions: string[]
}

export type HandoffStatus = 'draft' | 'scheduled' | 'published'

/** Per-channel scheduling / ownership / tracking metadata for the CMS handoff. */
export interface ChannelHandoff {
  status: HandoffStatus
  /** free-text / ISO date the channel is slated to go live */
  scheduledFor: string
  owner: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
}

/** One channel-adapted rendering of the approved copy. */
export interface ChannelAdaptation {
  channel: ChannelKey
  label: string
  headline: string
  body: string
  cta: string
  hashtags: string[]
  charCount: number
  charLimit: number
  modelLabel: string
  mode: CallMode
  recheck: ChannelRecheck
  generatedAt: number
  /** true for the surface the piece was authored & signed off FOR — this entry
   *  is the approved draft itself, not a re-adaptation */
  isPrimary?: boolean
  /** set once an editor has hand-edited this adaptation */
  edited?: boolean
  /** human override clearing a 'review' re-check for export */
  resolution?: ChannelResolution | null
  /** structured SEM fields (channel === 'sem') */
  sem?: SemAsset | null
  /** the visual assigned to this channel (image surfaces) */
  visualId?: string | null
  /** schedule / owner / UTM handoff metadata */
  handoff?: ChannelHandoff
}

export interface PublishPackage {
  assembledAt: number
  topicTitle: string
  /** the approved master copy (compliance clean version) */
  masterCopy: string
  channels: ChannelAdaptation[]
  /** gating snapshot taken from the compliance sign-off */
  complianceScore: number
  signedOffBy: string | null
  signOffDecision: SignOffDecision | null
  heroVisualId: string | null
}

// ── Persona Lab (Step 6) — live, agentic focus group ─────────────────────────

export type PersonaSentiment = 'positive' | 'mixed' | 'negative'

/** A fairness-guardrail event (blocked or allowed custom segment). */
export interface FairnessFlag {
  id: string
  ts: number
  text: string
  blocked: boolean
  reason: string
}

/** User setup: which behavioral segments to seat + how many participants. */
export interface FocusGroupConfig {
  segmentIds: string[]
  participantCount: number
}

/**
 * A generated individual focus-group participant. Believable and human, but
 * every attribute is BEHAVIORAL / needs-based — never a protected class or proxy
 * (Reg B / ECOA). Names are illustrative flavor, not a demographic basis.
 */
export interface Participant {
  id: string
  name: string
  /** the behavioral segment this participant represents */
  segmentId: string
  segmentName: string
  lens: SegmentLens
  /** one-line behavioral archetype, e.g. "Cautious first-time cardholder" */
  archetype: string
  personality: string[]
  likes: string[]
  dislikes: string[]
  interests: string[]
  goals: string[]
  frustrations: string[]
  /** short first-person bio */
  bio: string
  /** how they speak, e.g. "blunt, asks pointed questions" */
  voice: string
  /** deterministic avatar seed: 2 initials + a palette index */
  avatarSeed: string
}

/** One item on the moderator's agenda. */
export interface AgendaItem {
  id: string
  title: string
  /** the moderator's question posed to the group */
  prompt: string
}

export type TurnKind = 'moderator' | 'participant'

/** One line of the live discussion. */
export interface DiscussionTurn {
  id: string
  agendaItemId: string
  kind: TurnKind
  /** participant id when kind === 'participant', else null */
  speakerId: string | null
  speakerName: string
  text: string
  /** participant turns only */
  sentiment?: PersonaSentiment
  ts: number
}

/** A recurring theme surfaced across the discussion. */
export interface ThemeStat {
  theme: string
  count: number
  sentiment: PersonaSentiment
}

export interface FocusGroupStats {
  sentiment: { positive: number; mixed: number; negative: number }
  themes: ThemeStat[]
  standoutQuotes: { speakerName: string; text: string; sentiment: PersonaSentiment }[]
  /** qualitative overall read */
  resonance: 'strong' | 'mixed' | 'weak'
}

/** A concrete, selectable content fix produced from the discussion. */
export interface ContentRecommendation {
  id: string
  title: string
  detail: string
  rationale: string
  /** the theme / objection it addresses */
  addresses: string
}

/** Revised copy drafted from the selected recommendations (previewed inline). */
export interface RevisedDraft {
  title: string
  body: string
  appliedRecIds: string[]
  modelLabel: string
  mode: CallMode
}

export type FocusGroupStage = 'personas' | 'discussion' | 'complete'

export interface PersonaLabState {
  runAt: number
  /** the surface the piece was tested as */
  channel: ChannelKey
  /** how far the focus group has progressed */
  stage: FocusGroupStage
  config: FocusGroupConfig
  participants: Participant[]
  agenda: AgendaItem[]
  transcript: DiscussionTurn[]
  summary: string
  stats: FocusGroupStats | null
  recommendations: ContentRecommendation[]
  /** ids of the recommendations the user has selected to apply */
  selectedRecIds: string[]
  /** revised copy drafted from the selected recommendations */
  revisedDraft: RevisedDraft | null
  moderatorModelLabel: string
  mode: CallMode
  /** standing fairness statement + any guardrail events */
  fairnessNote: string
  fairnessFlags: FairnessFlag[]
}

export interface PipelineState {
  /** user-added topic opportunities (Step 1), merged with the seed backlog */
  userTopics: TopicOpportunity[]
  /** the topic the user took forward from Step 1 into Step 2+ */
  selectedTopicId: string | null
  /** the surface this piece is authored FOR — drives brief, draft, visuals,
   *  the posted preview, and the compliance review (Step 2 onward) */
  primaryChannel: ChannelKey
  /** cached editorial read so it survives navigation */
  topicRead: TopicRead | null
  /** optional human direction fed into brief generation (Step 2) */
  briefInput: BriefInput
  /** the brief generated for the selected topic (Step 2) */
  brief: ContentBrief | null
  /** brand-voice dials for drafting */
  voice: VoiceControls
  /** bake-off draft variants */
  drafts: DraftVariant[]
  /** the variant chosen to carry into Step 3+ */
  chosenDraftId: string | null
  /** generated visual assets (Step 3) */
  visuals: VisualAsset[]
  /** compliance gate result (Step 4) */
  compliance: ComplianceState | null
  /** publish-ready package (Step 5) */
  publish: PublishPackage | null
  /** synthetic-audience validation (Step 6) */
  persona: PersonaLabState | null
  /** revision-loop counter — bumped when revisions are sent back to Step 2 */
  revision: number
  /** the ask carried back to Step 2 when a stage sends the piece for revision
   *  (e.g. Persona Lab's weak metric + objections); shown as a banner, cleared
   *  once a new draft is generated */
  revisionNote: string
}

// ── Persona Lab segments (Increment 4; seeded now) ──────────────────────────

export type SegmentLens =
  | 'Value & Rewards Orientation'
  | 'Credit Lifecycle Stage'
  | 'Life Stage'
  | 'Financial Mindset & Behavior'

export interface Segment {
  id: string
  name: string
  lens: SegmentLens
  description: string
  motivations: string[]
  objections: string[]
}

// ── Completed end-to-end run (Increments 2-6; seeded now, loaded in 5) ───────

export interface CompletedRunMeta {
  topicId: string
  title: string
  summary: string
  complianceScore: number
  recommendation: string
  note: string
}
