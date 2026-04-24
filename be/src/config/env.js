function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildServiceUrl() {
  if (process.env.AI_SERVICE_URL) {
    return process.env.AI_SERVICE_URL
  }

  const hostport = process.env.AI_SERVICE_HOSTPORT
  if (hostport) {
    const looksLikeHostOnly = !hostport.includes(':')
    return looksLikeHostOnly ? `https://${hostport}` : `http://${hostport}`
  }

  const host = process.env.AI_SERVICE_HOST
  const port = toNumber(process.env.AI_SERVICE_PORT, 8000)
  if (host) {
    return `http://${host}:${port}`
  }

  return 'http://localhost:8000'
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 8080),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  adminApiKey: process.env.ADMIN_API_KEY || '',
  autoInitDb: process.env.AUTO_INIT_DB === 'true',
  databaseUrl: process.env.DATABASE_URL,
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresPort: toNumber(process.env.POSTGRES_PORT, 5432),
  postgresUser: process.env.POSTGRES_USER || 'postgres',
  postgresPassword: process.env.POSTGRES_PASSWORD || 'postgres',
  postgresDb: process.env.POSTGRES_DB || 'sentimentx',
  aiServiceUrl: buildServiceUrl(),
  aiArticleLimit: Math.min(Math.max(toNumber(process.env.AI_ARTICLE_LIMIT, 10), 3), 20),
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  youtubeSearchMaxResults: Math.min(Math.max(toNumber(process.env.YOUTUBE_SEARCH_MAX_RESULTS, 4), 1), 10),
  youtubeCommentMaxResults: Math.min(Math.max(toNumber(process.env.YOUTUBE_COMMENT_MAX_RESULTS, 20), 5), 50),
  youtubeLookbackHours: Math.min(Math.max(toNumber(process.env.YOUTUBE_LOOKBACK_HOURS, 168), 24), 24 * 30),
  googleTrendsGeo: process.env.GOOGLE_TRENDS_GEO || 'VN',
  googleTrendsHl: process.env.GOOGLE_TRENDS_HL || 'vi',
  googleTrendsMaxItems: Math.min(Math.max(toNumber(process.env.GOOGLE_TRENDS_MAX_ITEMS, 12), 3), 25),
  entityExtractionConcurrency: Math.min(Math.max(toNumber(process.env.ENTITY_EXTRACTION_CONCURRENCY, 4), 1), 12),
  feedRequestTimeoutMs: Math.min(Math.max(toNumber(process.env.FEED_REQUEST_TIMEOUT_MS, 12000), 3000), 60000),
}

module.exports = env
