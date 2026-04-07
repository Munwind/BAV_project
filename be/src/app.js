const express = require('express')
const cors = require('cors')
const env = require('./config/env')
const {
  initializeDatabase,
  getCrawlerSources,
  crawlAllFeeds,
  listArticles,
  listSources,
} = require('./services/crawler-service')
const { askAi, checkAiHealth, extractCompanyCandidates } = require('./services/ai-service')
const { getTrackedCompanies, getAlerts, getOverview } = require('./services/analytics-service')
const { findCompanyEntityByText } = require('./services/entity-service')
const { searchAll } = require('./services/search-service')

const app = express()

const allowedOrigins = String(env.corsOrigin || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

function requireAdmin(req, _res, next) {
  if (!env.adminApiKey && env.nodeEnv !== 'production') {
    next()
    return
  }

  if (!env.adminApiKey) {
    const error = new Error('Admin endpoints are disabled until ADMIN_API_KEY is configured')
    error.status = 403
    next(error)
    return
  }

  const authHeader = req.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const providedKey = req.get('x-admin-key') || bearerToken

  if (providedKey === env.adminApiKey) {
    next()
    return
  }

  const error = new Error('Admin API key is required')
  error.status = 401
  next(error)
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('CORS origin not allowed'))
  },
}))
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
    modules: ['health', 'meta', 'crawler', 'postgres', 'ai'],
  })
})

app.get('/api/crawler/sources', (_req, res) => {
  res.json({
    total: getCrawlerSources().length,
    items: getCrawlerSources(),
  })
})

app.post('/api/db/init', requireAdmin, async (_req, res, next) => {
  try {
    await initializeDatabase()
    res.json({ ok: true, message: 'Database initialized' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/crawler/run', requireAdmin, async (_req, res, next) => {
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
    const search = req.query.search ? String(req.query.search).trim() : undefined
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : undefined
    const dateTo = req.query.date_to ? String(req.query.date_to).trim() : undefined
    const items = await listArticles({ limit, sourceKey, search, dateFrom, dateTo })
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

app.get('/api/overview', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 120)
    const overview = await getOverview(limit)
    res.json({ ok: true, ...overview })
  } catch (error) {
    next(error)
  }
})

app.get('/api/companies', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 120)
    const items = await getTrackedCompanies(limit)
    res.json({ ok: true, total: items.length, items })
  } catch (error) {
    next(error)
  }
})

app.get('/api/alerts', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 120)
    const items = await getAlerts(limit)
    res.json({ ok: true, total: items.length, items })
  } catch (error) {
    next(error)
  }
})

app.get('/api/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    const results = await searchAll(q)
    res.json({
      ok: true,
      query: q,
      ...results,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/ai/health', async (_req, res, next) => {
  try {
    const health = await checkAiHealth()
    res.json({
      ok: true,
      ...health,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/ai/extract-company', async (req, res, next) => {
  try {
    const text = String(req.body?.text || req.body?.question || '').trim()

    if (text.length < 3) {
      return res.status(400).json({
        ok: false,
        error: 'Text must be at least 3 characters long',
      })
    }

    const companies = await extractCompanyCandidates(text, {
      locale: req.body?.locale,
      model: req.body?.model,
    })
    const matchedEntity = await findCompanyEntityByText({
      companyName: req.body?.companyName,
      question: text,
      nerCandidates: companies,
    })

    res.json({
      ok: true,
      input: text,
      companies,
      matchedEntity,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/ai/chat', async (req, res, next) => {
  try {
    const question = String(req.body?.question || '').trim()

    if (question.length < 3) {
      return res.status(400).json({
        ok: false,
        error: 'Question must be at least 3 characters long',
      })
    }

    const result = await askAi({
      question,
      sourceKey: req.body?.sourceKey,
      limit: Number(req.body?.limit || env.aiArticleLimit),
      locale: req.body?.locale,
      companyName: req.body?.companyName,
      entityId: req.body?.entityId,
      contextMode: req.body?.contextMode,
      history: Array.isArray(req.body?.history) ? req.body.history : [],
    })

    res.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  const statusCode = error.statusCode || error.status || 500

  res.status(statusCode).json({
    ok: false,
    error: error.message || 'Internal server error',
  })
})

module.exports = app
