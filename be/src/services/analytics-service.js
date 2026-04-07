const { query } = require('../db')
const { listArticles } = require('./crawler-service')
const { slugify } = require('./entity-service')

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function summarizeSentiment(score) {
  if (score >= 70) return 'Tích cực'
  if (score <= 45) return 'Tiêu cực'
  return 'Trung tính'
}

function detectSeverity(score, negativeSignals, recentMentions) {
  if (score <= 42 || negativeSignals >= 2 || recentMentions >= 5) return 'high'
  if (score <= 58 || negativeSignals >= 1 || recentMentions >= 2) return 'medium'
  return 'low'
}

function getTrendLabel(recentMentions, lifetimeMentions) {
  const olderMentions = Math.max(lifetimeMentions - recentMentions, 0)
  const delta = recentMentions - olderMentions
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return '0'
}

function buildRiskForecast({
  score,
  negativeSignals,
  recentMentions,
  last24hMentions,
  sourceCount,
  lifetimeMentions,
}) {
  const drivers = []
  let forecastScore24h = 0
  let forecastScore7d = 0

  if (negativeSignals >= 3) {
    forecastScore24h += 4
    forecastScore7d += 4
    drivers.push('Negative signals elevated')
  } else if (negativeSignals >= 1) {
    forecastScore24h += 2
    forecastScore7d += 2
    drivers.push('Negative coverage present')
  }

  if (last24hMentions >= 4) {
    forecastScore24h += 3
    forecastScore7d += 2
    drivers.push('24h media activity spiking')
  } else if (last24hMentions >= 2) {
    forecastScore24h += 2
    forecastScore7d += 1
    drivers.push('24h mentions increasing')
  }

  if (recentMentions >= 6) {
    forecastScore24h += 2
    forecastScore7d += 3
    drivers.push('7d discussion volume elevated')
  } else if (recentMentions >= 3) {
    forecastScore7d += 2
    drivers.push('7d discussion above baseline')
  }

  if (sourceCount >= 4) {
    forecastScore24h += 1
    forecastScore7d += 2
    drivers.push('Source diversity widening')
  } else if (sourceCount >= 2) {
    forecastScore7d += 1
  }

  if (score <= 42) {
    forecastScore24h += 3
    forecastScore7d += 3
    drivers.push('Sentiment score already weak')
  } else if (score <= 55) {
    forecastScore24h += 1
    forecastScore7d += 2
    drivers.push('Sentiment under pressure')
  }

  if (lifetimeMentions >= 12 && recentMentions >= 4) {
    forecastScore7d += 1
  }

  function toLevel(value) {
    if (value >= 7) return 'high'
    if (value >= 4) return 'medium'
    return 'low'
  }

  const level24h = toLevel(forecastScore24h)
  const level7d = toLevel(forecastScore7d)
  const confidence = clamp(
    48
      + Math.min(sourceCount, 5) * 7
      + Math.min(recentMentions, 6) * 4
      + Math.min(lifetimeMentions, 10),
    52,
    92,
  )

  const summary =
    level24h === 'high' || level7d === 'high'
      ? 'Risk forecast indicates elevated monitoring need in the next 24h-7d.'
      : level24h === 'medium' || level7d === 'medium'
        ? 'Risk forecast suggests moderate monitoring in the next 24h-7d.'
        : 'Risk forecast remains stable unless new negative coverage appears.'

  return {
    level24h,
    level7d,
    confidence,
    drivers: drivers.slice(0, 3),
    summary,
  }
}

async function getCompanyMentionRows() {
  const result = await query(
    `
      SELECT
        ae.article_id,
        ae.mention_count,
        ae.sentiment_signal,
        ae.confidence,
        ae.raw_text,
        e.id AS entity_id,
        e.canonical_name,
        e.normalized_name,
        e.ticker,
        e.industry,
        e.source_mode,
        a.title,
        a.description_text,
        a.article_url,
        a.image_url,
        a.author_name,
        a.published_at,
        a.created_at,
        a.first_seen_at,
        a.last_seen_at,
        a.crawl_count,
        s.source_key,
        s.source_name
      FROM article_entities ae
      JOIN entities e ON e.id = ae.entity_id
      JOIN articles a ON a.id = ae.article_id
      JOIN rss_sources s ON s.id = a.source_id
      WHERE e.entity_type = 'company'
      ORDER BY COALESCE(a.published_at, a.created_at) DESC, ae.article_id DESC
    `,
  )

  return result.rows.map((row) => ({
    ...row,
    article: {
      id: row.article_id,
      source_key: row.source_key,
      source_name: row.source_name,
      title: row.title,
      description_text: row.description_text,
      article_url: row.article_url,
      image_url: row.image_url,
      author_name: row.author_name,
      published_at: row.published_at,
      created_at: row.created_at,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      crawl_count: row.crawl_count,
    },
  }))
}

function buildCompanyMetrics(entityRows) {
  const orderedRows = [...entityRows].sort(
    (left, right) =>
      new Date(right.article.published_at || right.article.created_at || 0).getTime()
      - new Date(left.article.published_at || left.article.created_at || 0).getTime(),
  )

  const latestRows = orderedRows.slice(0, 5)
  const latestArticle = latestRows[0]?.article || null
  const now = Date.now()
  const recentMentions = orderedRows.filter((row) => {
    const publishedAt = new Date(row.article.published_at || row.article.created_at || now).getTime()
    return now - publishedAt <= 7 * 24 * 60 * 60 * 1000
  }).length
  const last24hMentions = orderedRows.filter((row) => {
    const publishedAt = new Date(row.article.published_at || row.article.created_at || now).getTime()
    return now - publishedAt <= 24 * 60 * 60 * 1000
  }).length
  const lifetimeMentions = orderedRows.length
  const negativeSignals = orderedRows.filter((row) => Number(row.sentiment_signal || 0) < 0).length
  const totalSignal = orderedRows.reduce((sum, row) => sum + Number(row.sentiment_signal || 0), 0)
  const sourceCount = new Set(orderedRows.map((row) => row.article.source_key)).size
  const score = clamp(56 + recentMentions * 4 + totalSignal * 7 + Math.min(sourceCount, 4), 18, 92)
  const severity = detectSeverity(score, negativeSignals, recentMentions)
  const forecast = buildRiskForecast({
    score,
    negativeSignals,
    recentMentions,
    last24hMentions,
    sourceCount,
    lifetimeMentions,
  })
  const first = orderedRows[0]

  return {
    key: slugify(first.canonical_name),
    entityId: first.entity_id,
    name: first.canonical_name,
    industry: first.industry || 'General',
    ticker: first.ticker || null,
    score,
    sentimentLabel: summarizeSentiment(score),
    trend: getTrendLabel(last24hMentions, lifetimeMentions),
    risk: severity === 'high' ? 'Cao' : severity === 'medium' ? 'Trung bình' : 'Thấp',
    mentions: recentMentions,
    lifetimeMentions,
    last24hMentions,
    sourceCount,
    summary:
      latestArticle?.description_text
      || latestArticle?.title
      || 'Chưa có dữ liệu mô tả gần nhất cho doanh nghiệp này.',
    latestArticle,
    articles: latestRows.map((row) => row.article),
    negativeSignals,
    sourceModes: [...new Set(orderedRows.map((row) => row.source_mode).filter(Boolean))],
    lastSeenAt: latestArticle?.last_seen_at || latestArticle?.published_at || null,
    forecast,
    forecastRisk24h: forecast.level24h,
    forecastRisk7d: forecast.level7d,
    forecastConfidence: forecast.confidence,
    forecastDrivers: forecast.drivers,
    forecastSummary: forecast.summary,
  }
}

async function getTrackedCompanies() {
  const mentionRows = await getCompanyMentionRows()
  const grouped = new Map()

  for (const row of mentionRows) {
    const key = String(row.entity_id)
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key).push(row)
  }

  return [...grouped.values()]
    .map((rows) => buildCompanyMetrics(rows))
    .filter((company) =>
      company.lifetimeMentions >= 2
      || Boolean(company.ticker)
      || company.industry !== 'General'
      || company.sourceModes.includes('seed'),
    )
    .sort((left, right) => {
      if (right.mentions !== left.mentions) return right.mentions - left.mentions
      if (right.lifetimeMentions !== left.lifetimeMentions) return right.lifetimeMentions - left.lifetimeMentions
      return new Date(right.lastSeenAt || 0).getTime() - new Date(left.lastSeenAt || 0).getTime()
    })
}

async function getAlerts() {
  const companies = await getTrackedCompanies()

  return companies
    .filter((company) => company.negativeSignals > 0 || company.score <= 50 || company.mentions >= 2)
    .map((company) => {
      const severity = detectSeverity(company.score, company.negativeSignals, company.mentions)

      return {
        id: company.key,
        companyKey: company.key,
        companyName: company.name,
        severity,
        title:
          severity === 'high'
            ? `Rủi ro tăng cao quanh ${company.name}`
            : `Cần theo dõi thêm biến động của ${company.name}`,
        description: company.latestArticle?.title || company.summary,
        mentions: company.mentions,
        lifetimeMentions: company.lifetimeMentions,
        score: company.score,
        sentimentLabel: company.sentimentLabel,
        forecastRisk24h: company.forecastRisk24h,
        forecastRisk7d: company.forecastRisk7d,
        forecastConfidence: company.forecastConfidence,
        forecastDrivers: company.forecastDrivers,
        forecastSummary: company.forecastSummary,
        publishedAt: company.latestArticle?.published_at || null,
        articleUrl: company.latestArticle?.article_url || null,
      }
    })
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        const priority = { high: 3, medium: 2, low: 1 }
        return priority[right.severity] - priority[left.severity]
      }
      return new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime()
    })
}

async function getOverview() {
  const [companies, alerts, articles] = await Promise.all([
    getTrackedCompanies(),
    getAlerts(),
    listArticles({ limit: 16 }),
  ])

  const averageScore = companies.length
    ? Math.round(companies.reduce((sum, company) => sum + company.score, 0) / companies.length)
    : 0

  return {
    metrics: {
      trackedCompanies: companies.length,
      activeAlerts: alerts.length,
      averageSentiment: averageScore,
      trackedSources: new Set(companies.flatMap((company) => company.articles.map((article) => article.source_key))).size,
      knowledgeBase: companies.reduce((sum, company) => sum + company.lifetimeMentions, 0),
    },
    topCompany: companies[0] || null,
    latestAlerts: alerts.slice(0, 4),
    latestNews: articles.slice(0, 6),
  }
}

module.exports = {
  buildRiskForecast,
  getTrackedCompanies,
  getAlerts,
  getOverview,
}
