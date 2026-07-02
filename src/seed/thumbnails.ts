// Inline SVG "creative" thumbnails encoded as data URLs so visual seed assets
// render with zero network dependency. Illustrative mockups, not real ads.

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const NAVY = '#004977'
const RED = '#d03027'
const CLOUD = '#f4f6f8'

export const THUMB_DISPLAY_AD = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500">
  <rect width="600" height="500" fill="${NAVY}"/>
  <circle cx="470" cy="120" r="160" fill="#0a5d92" opacity="0.5"/>
  <text x="48" y="150" fill="#fff" font-family="Inter,Arial" font-size="46" font-weight="800">Earn unlimited</text>
  <text x="48" y="205" fill="#fff" font-family="Inter,Arial" font-size="46" font-weight="800">rewards.</text>
  <text x="48" y="260" fill="#cfe2f0" font-family="Inter,Arial" font-size="22">No annual fee. No foreign</text>
  <text x="48" y="290" fill="#cfe2f0" font-family="Inter,Arial" font-size="22">transaction fees.</text>
  <rect x="48" y="330" width="230" height="56" rx="28" fill="${RED}"/>
  <text x="78" y="366" fill="#fff" font-family="Inter,Arial" font-size="22" font-weight="700">See if you're pre-qualified</text>
  <text x="48" y="460" fill="#9fc0d8" font-family="Inter,Arial" font-size="14">Credit approval required. Member FDIC.</text>
</svg>`)

export const THUMB_LANDING = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500">
  <rect width="600" height="500" fill="${CLOUD}"/>
  <rect width="600" height="70" fill="#fff"/>
  <text x="32" y="45" fill="${NAVY}" font-family="Inter,Arial" font-size="26" font-weight="800">Capital One</text>
  <text x="32" y="160" fill="${NAVY}" font-family="Inter,Arial" font-size="40" font-weight="800">What's in your</text>
  <text x="32" y="208" fill="${NAVY}" font-family="Inter,Arial" font-size="40" font-weight="800">wallet?</text>
  <text x="32" y="252" fill="#42546f" font-family="Inter,Arial" font-size="20">Banking made simple, with no hidden fees.</text>
  <rect x="32" y="285" width="180" height="52" rx="8" fill="${RED}"/>
  <text x="74" y="318" fill="#fff" font-family="Inter,Arial" font-size="20" font-weight="700">Get started</text>
  <rect x="360" y="120" width="208" height="260" rx="16" fill="${NAVY}"/>
  <circle cx="464" cy="200" r="44" fill="#0a5d92"/>
  <text x="384" y="300" fill="#fff" font-family="Inter,Arial" font-size="16">Top-rated mobile app</text>
  <text x="384" y="328" fill="#cfe2f0" font-family="Inter,Arial" font-size="13">24/7 account monitoring</text>
</svg>`)

export const THUMB_SOCIAL = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="#0a5d92"/>
  <rect x="0" y="0" width="600" height="600" fill="url(#g)"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="#0a5d92"/>
  </linearGradient></defs>
  <text x="50" y="250" fill="#fff" font-family="Inter,Arial" font-size="54" font-weight="800">Your money,</text>
  <text x="50" y="320" fill="#fff" font-family="Inter,Arial" font-size="54" font-weight="800">your way.</text>
  <text x="50" y="380" fill="#cfe2f0" font-family="Inter,Arial" font-size="24">Stay in control with CreditWise.</text>
  <rect x="50" y="430" width="160" height="56" rx="28" fill="#fff"/>
  <text x="84" y="466" fill="${NAVY}" font-family="Inter,Arial" font-size="22" font-weight="700">Learn more</text>
</svg>`)
