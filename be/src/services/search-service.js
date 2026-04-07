const { query } = require('../db')
const { getTrackedCompanies, getAlerts } = require('./analytics-service')
const { listArticles } = require('./crawler-service')
const { normalizeText } = require('./entity-service')

function scoreTextMatch(queryText, candidate, { exact = 120, prefix = 90, includes = 60 } = {}) {
  if (!candidate) return 0

  const normalizedQuery = normalizeText(queryText)
  const normalizedCandidate = normalizeText(candidate)

  if (!normalizedQuery || !normalizedCandidate) return 0
  if (normalizedCandidate === normalizedQuery) return exact
  if (normalizedCandidate.startsWith(normalizedQuery)) return prefix
  if (normalizedCandidate.includes(normalizedQuery)) return includes
  return 0
}

async function getAliasMap(entityIds) {
  if (!entityIds.length) {
    return new Map()
  }

  const result = await query(
    `
      SELECT entity_id, alias
      FROM entity_aliases
      WHERE entity_id = ANY($1::bigint[])
    `,
    [entityIds],
  )

  const aliasMap = new Map()
  for (const row of result.rows) {
    const key = String(row.entity_id)
    if (!aliasMap.has(key)) {
      aliasMap.set(key, [])
    }
    aliasMap.get(key).push(row.alias)
  }

  return aliasMap
}

function rankCompanies(items, aliasMap, queryText) {
  return items
    .map((company) => {
      const aliases = aliasMap.get(String(company.entityId)) || []
      const aliasScore = aliases.reduce((best, alias) => Math.max(best, scoreTextMatch(queryText, alias, {
        exact: 100,
        prefix: 78,
        includes: 54,
      })), 0)
      const tickerScore = scoreTextMatch(queryText, company.ticker, {
        exact: 110,
        prefix: 85,
        includes: 70,
      })
      const nameScore = scoreTextMatch(queryText, company.name, {
        exact: 120,
        prefix: 92,
        includes: 64,
      })
      const industryScore = scoreTextMatch(queryText, company.industry, {
        exact: 35,
        prefix: 24,
        includes: 16,
      })
      const totalScore = Math.max(nameScore, tickerScore, aliasScore, industryScore)
        + Math.min(company.forecastConfidence || 0, 95) / 10
        + Math.min(company.mentions || 0, 10)

      return {
        ...company,
        _score: totalScore,
      }
    })
    .filter((item) => item._score > 0)
    .sort((left, right) => {
      if (right._score !== left._score) return right._score - left._score
      if ((right.forecastConfidence || 0) !== (left.forecastConfidence || 0)) {
        return (right.forecastConfidence || 0) - (left.forecastConfidence || 0)
      }
      return (right.mentions || 0) - (left.mentions || 0)
    })
}

function rankAlerts(items, queryText) {
  return items
    .map((alert) => {
      const totalScore =
        scoreTextMatch(queryText, alert.companyName, { exact: 100, prefix: 80, includes: 60 })
        + scoreTextMatch(queryText, alert.title, { exact: 80, prefix: 64, includes: 44 })
        + scoreTextMatch(queryText, alert.description, { exact: 28, prefix: 20, includes: 14 })
        + (alert.forecastRisk7d === 'high' ? 16 : alert.forecastRisk7d === 'medium' ? 8 : 2)

      return {
        ...alert,
        _score: totalScore,
      }
    })
    .filter((item) => item._score > 0)
    .sort((left, right) => {
      if (right._score !== left._score) return right._score - left._score
      return (right.score || 0) - (left.score || 0)
    })
}

function rankArticles(items, queryText) {
  return items
    .map((article) => {
      const totalScore =
        scoreTextMatch(queryText, article.title, { exact: 90, prefix: 72, includes: 52 })
        + scoreTextMatch(queryText, article.description_text, { exact: 24, prefix: 16, includes: 12 })
        + scoreTextMatch(queryText, article.source_name, { exact: 12, prefix: 8, includes: 5 })

      return {
        ...article,
        _score: totalScore,
      }
    })
    .filter((item) => item._score > 0)
    .sort((left, right) => {
      if (right._score !== left._score) return right._score - left._score
      return new Date(right.published_at || right.created_at || 0).getTime()
        - new Date(left.published_at || left.created_at || 0).getTime()
    })
}

async function searchAll(queryText, { companyLimit = 5, alertLimit = 4, articleLimit = 6 } = {}) {
  const trimmedQuery = String(queryText || '').trim()
  if (trimmedQuery.length < 2) {
    return {
      companies: [],
      alerts: [],
      articles: [],
    }
  }

  const [companies, alerts, articles] = await Promise.all([
    getTrackedCompanies(200),
    getAlerts(80),
    listArticles({ limit: 20, search: trimmedQuery }),
  ])

  const aliasMap = await getAliasMap(companies.map((item) => Number(item.entityId)).filter(Boolean))

  return {
    companies: rankCompanies(companies, aliasMap, trimmedQuery).slice(0, companyLimit),
    alerts: rankAlerts(alerts, trimmedQuery).slice(0, alertLimit),
    articles: rankArticles(articles, trimmedQuery).slice(0, articleLimit),
  }
}

module.exports = {
  scoreTextMatch,
  searchAll,
}
