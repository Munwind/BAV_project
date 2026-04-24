const env = require('../config/env')

function stripGooglePrefix(text) {
  return String(text || '').replace(/^\)\]\}',?\s*/, '').trim()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeTrendItem(item = {}, index = 0) {
  const title = String(item.title?.query || item.title || '').trim()
  if (!title) return null

  const articles = Array.isArray(item.articles) ? item.articles : []
  const relatedQueries = Array.isArray(item.relatedQueries) ? item.relatedQueries : []
  const traffic = item.formattedTraffic || item.traffic || ''

  return {
    id: `${title.toLowerCase().replace(/\s+/g, '-')}-${index}`,
    keyword: title,
    rank: index + 1,
    traffic: String(traffic || ''),
    trafficScore: toNumber(traffic, 0),
    relatedQueries: relatedQueries
      .map((query) => String(query?.query || query || '').trim())
      .filter(Boolean)
      .slice(0, 5),
    articles: articles
      .map((article) => ({
        title: String(article?.title || '').trim(),
        source: String(article?.source || '').trim(),
        url: article?.url || null,
        publishedAt: article?.timeAgo || article?.publishedAt || null,
      }))
      .filter((article) => article.title)
      .slice(0, 3),
  }
}

function parseGoogleDailyTrendsPayload(payload, limit = env.googleTrendsMaxItems) {
  const days = payload?.default?.trendingSearchesDays || []
  const items = days.flatMap((day) => day?.trendingSearches || [])

  return items
    .map((item, index) => normalizeTrendItem(item, index))
    .filter(Boolean)
    .slice(0, limit)
}

function buildDailyTrendsUrl({ geo = env.googleTrendsGeo, hl = env.googleTrendsHl } = {}) {
  const params = new URLSearchParams({
    hl,
    tz: '-420',
    geo,
    ns: '15',
  })

  return `https://trends.google.com/trends/api/dailytrends?${params}`
}

async function getGoogleDailyTrends(options = {}) {
  const geo = options.geo || env.googleTrendsGeo
  const hl = options.hl || env.googleTrendsHl
  const limit = Math.min(Math.max(Number(options.limit || env.googleTrendsMaxItems), 3), 25)
  const url = buildDailyTrendsUrl({ geo, hl })
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SentimentXBot/1.0 (+https://sentimentx.local)',
      Accept: 'application/json,text/plain,*/*',
    },
    signal: AbortSignal.timeout(env.feedRequestTimeoutMs),
  })
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Google Trends request failed with status ${response.status}`)
  }

  const payload = JSON.parse(stripGooglePrefix(text))
  const items = parseGoogleDailyTrendsPayload(payload, limit)

  return {
    geo,
    hl,
    total: items.length,
    items,
    fetchedAt: new Date().toISOString(),
    sourceUrl: `https://trends.google.com/trends/trendingsearches/daily?geo=${encodeURIComponent(geo)}&hl=${encodeURIComponent(hl)}`,
  }
}

module.exports = {
  buildDailyTrendsUrl,
  getGoogleDailyTrends,
  parseGoogleDailyTrendsPayload,
  stripGooglePrefix,
}
