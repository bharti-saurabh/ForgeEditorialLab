// On-brand SVG "creative" generator for demo-mode visuals. Renders a grounded
// mockup from the brand palette + a headline so Step 3 tells a real story with
// zero image-API keys. Illustrative — not a real generated photo.

import type { BrandProfile } from '@/types'

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Wrap text into lines of at most `max` chars (word-aware). */
function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur.trim())
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
    if (lines.length >= maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur.trim())
  return lines.slice(0, maxLines)
}

function pick<T>(arr: T[], fallback: T): T {
  return arr.length ? arr[0] : fallback
}

export interface MockOpts {
  profile: BrandProfile
  headline: string
  subhead: string
  cta: string
  seed: number
  square?: boolean
}

/** Build an on-brand SVG data URL. Layout varies by seed. */
export function buildBrandMockSvg({
  profile,
  headline,
  subhead,
  cta,
  seed,
  square,
}: MockOpts): string {
  const pal = profile.visual.palette
  const navy = pick(pal.filter((c) => /navy|blue/i.test(c.name)), pal[0] ?? { name: 'navy', hex: '#004977' }).hex
  const accent = pick(pal.filter((c) => /red|orange|signal/i.test(c.name)), { name: 'accent', hex: '#d03027' }).hex
  const light = pick(pal.filter((c) => /cloud|light|white/i.test(c.name)), { name: 'light', hex: '#f4f6f8' }).hex

  const w = 640
  const h = square ? 640 : 420
  const variant = seed % 3
  const hl = wrap(headline, 18, 3)
  const sub = wrap(subhead, 34, 2)

  const hlSvg = hl
    .map(
      (line, i) =>
        `<text x="48" y="${140 + i * 52}" fill="#ffffff" font-family="Inter,Arial" font-size="44" font-weight="800">${esc(line)}</text>`,
    )
    .join('')
  const subY = 140 + hl.length * 52 + 8
  const subSvg = sub
    .map(
      (line, i) =>
        `<text x="48" y="${subY + i * 28}" fill="#cfe2f0" font-family="Inter,Arial" font-size="20">${esc(line)}</text>`,
    )
    .join('')
  const ctaY = subY + sub.length * 28 + 24

  // decorative shapes vary by layout variant
  const decor =
    variant === 0
      ? `<circle cx="${w - 90}" cy="110" r="180" fill="${accent}" opacity="0.16"/>
         <circle cx="${w - 40}" cy="${h - 60}" r="90" fill="#ffffff" opacity="0.06"/>`
      : variant === 1
        ? `<rect x="${w - 220}" y="-60" width="280" height="280" rx="40" fill="#ffffff" opacity="0.06" transform="rotate(18 ${w - 80} 80)"/>
           <circle cx="${w - 120}" cy="${h - 70}" r="130" fill="${accent}" opacity="0.14"/>`
        : `<path d="M${w} 0 L${w} ${h} L${w - 260} ${h} Z" fill="${accent}" opacity="0.15"/>
           <circle cx="${w - 150}" cy="90" r="70" fill="#ffffff" opacity="0.07"/>`

  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${navy}"/>
      <stop offset="1" stop-color="#0a5d92"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${decor}
  <text x="48" y="64" fill="${light}" font-family="Inter,Arial" font-size="20" font-weight="800" opacity="0.85">${esc(profile.brandName)}</text>
  ${hlSvg}
  ${subSvg}
  <rect x="48" y="${ctaY}" width="${Math.min(300, 60 + cta.length * 11)}" height="52" rx="26" fill="${accent}"/>
  <text x="72" y="${ctaY + 33}" fill="#ffffff" font-family="Inter,Arial" font-size="19" font-weight="700">${esc(cta)}</text>
  <text x="48" y="${h - 22}" fill="#9fc0d8" font-family="Inter,Arial" font-size="13">Illustrative concept — credit approval required. Member FDIC.</text>
</svg>`)
}
