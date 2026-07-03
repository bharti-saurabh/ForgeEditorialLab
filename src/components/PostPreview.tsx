// Posted preview — renders the chosen draft + hero visual in the chrome of the
// surface it's authored for (article header, in-feed sponsored card, Google
// search result, or email/inbox). Shown in Step 3 after generation and again at
// the top of Step 4 so the compliance sign-off is against the artifact as the
// consumer actually sees it (net-impression review). Deterministic + illustrative.

import type { BrandProfile, ChannelKey, DraftVariant, VisualAsset } from '@/types'
import { channelSpec } from '@/lib/channels'
import { cn } from '@/lib/cn'

interface PostPreviewProps {
  channel: ChannelKey
  profile: BrandProfile
  draft: DraftVariant | null
  visual?: VisualAsset | null
  className?: string
}

export function PostPreview({ channel, profile, draft, visual, className }: PostPreviewProps) {
  const spec = channelSpec(channel)
  const body = draft ? stripFooter(draft.body) : ''

  return (
    <div className={cn('rounded-xl border border-ink-200 bg-ink-50/60 p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          Posted preview · {spec.label}
        </span>
        <span className="rounded-full bg-ink-200/70 px-2 py-0.5 text-[10px] font-medium text-ink-600">
          Illustrative
        </span>
      </div>

      {!draft ? (
        <p className="py-6 text-center text-sm text-ink-400">
          Finish a draft to preview how this piece will look once posted.
        </p>
      ) : spec.preview === 'article' ? (
        <ArticlePreview profile={profile} title={draft.title} body={body} visual={visual} />
      ) : spec.preview === 'feed' ? (
        <FeedPreview profile={profile} body={body} visual={visual} />
      ) : spec.preview === 'serp' ? (
        <SerpPreview profile={profile} title={draft.title} body={draft.body} />
      ) : (
        <InboxPreview profile={profile} title={draft.title} body={body} visual={visual} />
      )}
    </div>
  )
}

// ── chrome variants ────────────────────────────────────────────────────────

function ArticlePreview({
  profile,
  title,
  body,
  visual,
}: {
  profile: BrandProfile
  title: string
  body: string
  visual?: VisualAsset | null
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm">
      <BrowserBar url={`${brandSlug(profile)}.com/insights`} />
      <HeroImage visual={visual} className="aspect-[16/9]" />
      <div className="p-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-straive-600">
          {profile.brandName} · Insights
        </div>
        <h3 className="text-xl font-bold leading-tight text-ink-900">{title}</h3>
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-600">{excerpt(body, 320)}</p>
      </div>
    </div>
  )
}

function FeedPreview({
  profile,
  body,
  visual,
}: {
  profile: BrandProfile
  body: string
  visual?: VisualAsset | null
}) {
  const cta = profile.messaging.ctas[0] ?? 'Learn more'
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <BrandAvatar profile={profile} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">{profile.brandName}</div>
          <div className="text-[11px] text-ink-400">Sponsored · Paid partnership</div>
        </div>
      </div>
      <p className="px-3 pb-3 text-sm leading-snug text-ink-700">{excerpt(body, 200)}</p>
      <HeroImage visual={visual} className="aspect-square" />
      <div className="flex items-center justify-between gap-2 bg-ink-50 px-3 py-2.5">
        <span className="truncate text-[11px] text-ink-500">{brandSlug(profile)}.com</span>
        <span className="shrink-0 rounded-md bg-straive-500 px-3 py-1 text-xs font-semibold text-white">
          {cta}
        </span>
      </div>
    </div>
  )
}

function SerpPreview({
  profile,
  title,
  body,
}: {
  profile: BrandProfile
  title: string
  body: string
}) {
  const ad = parseSearchAd(body, title)
  const path = brandSlug(profile)
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-ink-600">
        <span className="rounded-sm border border-ink-300 px-1 py-px text-[10px] font-bold text-ink-700">
          Ad
        </span>
        <span className="text-ink-800">{path}.com</span>
        <span className="text-ink-400">›</span>
        <span className="text-ink-400">{ad.displayPath}</span>
      </div>
      <h3 className="mt-1 text-lg font-medium leading-snug text-info hover:underline">
        {ad.headlines.slice(0, 3).join(' | ')}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">{ad.descriptions.join(' ')}</p>
    </div>
  )
}

function InboxPreview({
  profile,
  title,
  body,
  visual,
}: {
  profile: BrandProfile
  title: string
  body: string
  visual?: VisualAsset | null
}) {
  const { preheader, rest } = splitPreheader(body)
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-ink-100 p-3">
        <BrandAvatar profile={profile} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink-900">{profile.brandName}</span>
            <span className="shrink-0 text-[11px] text-ink-400">now</span>
          </div>
          <div className="truncate text-sm font-medium text-ink-800">{title}</div>
          <div className="truncate text-[11px] text-ink-400">{preheader || excerpt(rest, 60)}</div>
        </div>
      </div>
      <HeroImage visual={visual} className="aspect-[16/9]" />
      <p className="whitespace-pre-line p-4 text-sm leading-relaxed text-ink-600">{excerpt(rest, 300)}</p>
    </div>
  )
}

// ── shared bits ──────────────────────────────────────────────────────────────

function HeroImage({ visual, className }: { visual?: VisualAsset | null; className?: string }) {
  if (visual?.url) {
    return (
      <img
        src={visual.url}
        alt={visual.altText || 'Hero visual'}
        className={cn('w-full object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center bg-gradient-to-br from-navy-100 to-ink-100 text-xs text-ink-400',
        className,
      )}
    >
      Generate a visual to complete this preview
    </div>
  )
}

function BrowserBar({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
      <span className="ml-2 truncate rounded bg-white px-2 py-0.5 text-[11px] text-ink-400">
        {url}
      </span>
    </div>
  )
}

function BrandAvatar({ profile }: { profile: BrandProfile }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
      {profile.brandName.charAt(0)}
    </span>
  )
}

// ── text helpers (deterministic markdown → preview text) ─────────────────────

function brandSlug(profile: BrandProfile): string {
  return profile.brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Drop the trailing "*Draft generated by …*" style note from demo drafts. */
function stripFooter(body: string): string {
  return body
    .split('\n')
    .filter((l) => !/^\*Draft generated by/i.test(l.trim()))
    .join('\n')
    .trim()
}

/** Plain-text excerpt: strip markdown tokens and clamp to n chars. */
function excerpt(md: string, n: number): string {
  const text = md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-•✓]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>]/g, '')
    .replace(/\n{2,}/g, ' — ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return text.length <= n ? text : text.slice(0, n - 1).trimEnd() + '…'
}

/** Pull the "**Preheader:** …" line out; return it plus the remaining body. */
function splitPreheader(body: string): { preheader: string; rest: string } {
  const lines = body.split('\n')
  let preheader = ''
  const kept: string[] = []
  for (const l of lines) {
    const m = l.match(/^\*\*preheader:\*\*\s*(.+)$/i)
    if (m) {
      preheader = m[1].trim()
      continue
    }
    if (/^-{3,}$/.test(l.trim())) continue // horizontal rule before footer
    kept.push(l)
  }
  return { preheader, rest: kept.join('\n').trim() }
}

/** Parse a responsive-search-ad draft into headlines + descriptions. */
function parseSearchAd(
  body: string,
  fallbackTitle: string,
): { headlines: string[]; descriptions: string[]; displayPath: string } {
  const bullets = (section: RegExp): string[] => {
    const lines = body.split('\n')
    const start = lines.findIndex((l) => section.test(l))
    if (start === -1) return []
    const out: string[] = []
    for (let i = start + 1; i < lines.length; i++) {
      const m = lines[i].match(/^\s*-\s+(.+)$/)
      if (m) out.push(m[1].replace(/\*/g, '').trim())
      else if (lines[i].trim() && !/^\s*-/.test(lines[i])) break
    }
    return out
  }
  const headlines = bullets(/headlines/i)
  const descriptions = bullets(/descriptions/i)
  const pathMatch = body.match(/display path:\**\s*([^\n]+)/i)
  const displayPath = (pathMatch?.[1] ?? 'cards').replace(/^.*\//, '').trim() || 'cards'
  return {
    headlines: headlines.length ? headlines : [fallbackTitle],
    descriptions: descriptions.length ? descriptions : [excerpt(body, 90)],
    displayPath,
  }
}
