import type { TrendTopic } from '../../src/discovery/types'
import type { TrendSource } from './types'
import { compactNumber } from './types'

// YouTube Data API v3 — official mostPopular chart. Needs a free API key
// (YOUTUBE_API_KEY). Off (and honestly labeled) when no key is present.
const REGION = process.env.YOUTUBE_REGION || 'US'

interface YtItem {
  id?: string
  snippet?: { title?: string; channelTitle?: string }
  statistics?: { viewCount?: string }
}

export const youtubeSource: TrendSource = {
  name: 'YouTube',
  requiresKey: 'youtube',
  unavailableReason:
    'Add a free YouTube Data API key (in Settings, or YOUTUBE_API_KEY on the host) to surface the official trending-videos chart.',

  async fetch(signal, ctx): Promise<TrendTopic[]> {
    const key = ctx.keys.youtube
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics` +
      `&chart=mostPopular&maxResults=8&regionCode=${REGION}&key=${key}`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`youtube ${res.status}`)
    const data = (await res.json()) as { items?: YtItem[] }
    const items = Array.isArray(data.items) ? data.items : []

    return items
      .filter((i) => i.snippet?.title)
      .map((i) => {
        const views = Number(i.statistics?.viewCount)
        return {
          title: i.snippet!.title as string,
          source: 'YouTube',
          url: `https://www.youtube.com/watch?v=${i.id}`,
          meta: [
            i.snippet?.channelTitle,
            Number.isFinite(views) ? `${compactNumber(views)} views` : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }
      })
  },

  async search(query, signal, ctx): Promise<TrendTopic[]> {
    const key = ctx.keys.youtube
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&order=viewCount&maxResults=8&q=${encodeURIComponent(query)}&regionCode=${REGION}&key=${key}`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`youtube-search ${res.status}`)
    const data = (await res.json()) as {
      items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[]
    }
    return (data.items ?? [])
      .filter((i) => i.snippet?.title && i.id?.videoId)
      .map((i) => ({
        title: i.snippet!.title as string,
        source: 'YouTube',
        url: `https://www.youtube.com/watch?v=${i.id!.videoId}`,
        meta: i.snippet?.channelTitle,
      }))
  },
}
