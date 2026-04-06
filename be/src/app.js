const express = require('express')
const cors = require('cors')
const {
  initializeDatabase,
  getCrawlerSources,
  crawlAllFeeds,
  listArticles,
  listSources,
} = require('./services/crawler-service')

const app = express()

const corsOrigin = process.env.CORS_ORIGIN || '*'

app.use(cors({ origin: corsOrigin }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bav-be',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/meta', (_req, res) => {
  res.json({
    name: 'SentimentX Backend',
    product: 'SentimentX',
    modules: ['health', 'meta', 'crawler', 'postgres'],
  })
})

app.get('/api/crawler/sources', (_req, res) => {
  res.json({
    total: getCrawlerSources().length,
    items: getCrawlerSources(),
  })
})

app.post('/api/db/init', async (_req, res, next) => {
  try {
    await initializeDatabase()
    res.json({ ok: true, message: 'Database initialized' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/crawler/run', async (_req, res, next) => {
  try {
    const result = await crawlAllFeeds()
    res.json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})

app.get('/api/articles', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 25)
    const sourceKey = req.query.source_key
    const items = await listArticles({ limit, sourceKey })
    res.json({ total: items.length, items })
  } catch (error) {
    next(error)
  }
})

app.get('/api/sources', async (_req, res, next) => {
  try {
    const items = await listSources()
    res.json({ total: items.length, items })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({
    ok: false,
    error: error.message || 'Internal server error',
  })
})

module.exports = app
