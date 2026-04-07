function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiArticleLimit: Math.min(Math.max(toNumber(process.env.AI_ARTICLE_LIMIT, 10), 3), 20),
  entityExtractionConcurrency: Math.min(Math.max(toNumber(process.env.ENTITY_EXTRACTION_CONCURRENCY, 4), 1), 12),
  feedRequestTimeoutMs: Math.min(Math.max(toNumber(process.env.FEED_REQUEST_TIMEOUT_MS, 12000), 3000), 60000),
}

module.exports = env
