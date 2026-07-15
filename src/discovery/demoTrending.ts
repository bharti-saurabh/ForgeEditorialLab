import type { TrendingBoard } from './types'

// Deterministic, clearly-illustrative trending board for the zero-key / offline
// path. Static (no Date.now) — labeled as illustrative in the UI so it's never
// mistaken for a live signal.
export function demoTrending(): TrendingBoard {
  return {
    mode: 'demo',
    groups: [
      {
        source: 'Google News',
        live: false,
        items: [
          { title: 'AI customer service adoption accelerates', source: 'Google News', url: '#demo', meta: 'Reuters' },
          { title: 'New rules on sustainable packaging', source: 'Google News', url: '#demo', meta: 'The Verge' },
          { title: 'The return-to-office debate reignites', source: 'Google News', url: '#demo', meta: 'Bloomberg' },
          { title: 'Personal finance apps see record signups', source: 'Google News', url: '#demo', meta: 'TechCrunch' },
        ],
      },
      {
        source: 'Wikipedia',
        live: false,
        items: [
          { title: 'Artificial intelligence', source: 'Wikipedia', url: '#demo', meta: '340K views' },
          { title: 'Content marketing', source: 'Wikipedia', url: '#demo', meta: '95K views' },
          { title: 'Sustainability', source: 'Wikipedia', url: '#demo', meta: '80K views' },
        ],
      },
      {
        source: 'Hacker News',
        live: false,
        items: [
          { title: 'Show HN: an open-source analytics stack', source: 'Hacker News', url: '#demo', meta: '980 points' },
          { title: 'The hidden cost of SaaS sprawl', source: 'Hacker News', url: '#demo', meta: '640 points' },
          { title: 'How we cut cloud spend by 40%', source: 'Hacker News', url: '#demo', meta: '520 points' },
        ],
      },
      {
        source: 'Reddit',
        live: false,
        items: [
          { title: 'What marketing advice is actually overrated?', source: 'Reddit', url: '#demo', meta: 'r/marketing · 12K upvotes' },
          { title: 'Small teams: which tools are worth it?', source: 'Reddit', url: '#demo', meta: 'r/smallbusiness · 8K upvotes' },
          { title: 'Content that finally converted for us', source: 'Reddit', url: '#demo', meta: 'r/content_marketing · 5K upvotes' },
        ],
      },
    ],
    unavailable: [
      {
        source: 'Instagram / Facebook',
        reason:
          "Meta's API doesn't expose general trending hashtags; real data needs paid vendors or scraping (against ToS). Shown as unavailable rather than faked.",
      },
      {
        source: 'YouTube',
        reason: 'Add a free YOUTUBE_API_KEY on the host to surface the official trending chart.',
      },
    ],
  }
}
