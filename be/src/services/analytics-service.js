const { query } = require('../db')
const { listArticles } = require('./crawler-service')
const { slugify } = require('./entity-service')
const { normalizeText } = require('./sentiment-heuristics')

const NEGATIVE_CUES = [
  'khoi to',
  'dieu tra',
  'rui ro',
  'ap luc',
  'thiet hai',
  'bat thuong',
  'giam',
  'khieu nai',
  'tranh cai',
  '2 so',
  'excel',
  'xu phat',
]

const TOPIC_PATTERNS = [
  { label: 'Tax and compliance', pattern: /\bthue\b|\bcuc thue\b|\bhoa don\b|\bso sach\b|\bcompliance\b/ },
  { label: 'Legal escalation', pattern: /\bkhoi to\b|\bdieu tra\b|\bcong an\b|\bphap ly\b/ },
  { label: 'Leadership controversy', pattern: /\bphat ngon\b|\btranh cai\b|\bsang lap\b|\blanh dao\b/ },
  { label: 'Consumer demand', pattern: /\bmua\b|\bkhach hang\b|\bgiao dich\b|\bgiay hen\b/ },
  { label: 'Market performance', pattern: /\bthi truong\b|\bchung khoan\b|\bdoanh thu\b|\bthuc thu\b/ },
  { label: 'Operations pressure', pattern: /\bexcel\b|\bvan hanh\b|\bchi phi\b|\bhe thong\b/ },
]

const TOPIC_STOPWORDS = new Set([
  'cong',
  'ty',
  'doanh',
  'nghiep',
  'thi',
  'truong',
  'sau',
  'thong',
  'tin',
  'nguoi',
  'nhieu',
  'nhung',
  'them',
  'cua',
  'sau',
  'trong',
  'voi',
  'tai',
  'cho',
  'mot',
  'nhung',
  'duoc',
  'dang',
  'nay',
  'kia',
  'la',
  'va',
])

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

function getTrendDelta(recentMentions, lifetimeMentions) {
  const olderMentions = Math.max(lifetimeMentions - recentMentions, 0)
  return recentMentions - olderMentions
}

function getTrendLabel(recentMentions, lifetimeMentions) {
  const delta = getTrendDelta(recentMentions, lifetimeMentions)
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return '0'
}

function calculateCompanyScore({
  recentMentions,
  totalSignal,
  sourceCount,
  trendDelta,
}) {
  return clamp(
    56
      + recentMentions * 4
      + totalSignal * 7
      + Math.min(sourceCount, 4)
      + trendDelta * 2,
    18,
    92,
  )
}

function splitSentences(value = '') {
  return String(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function findNegativeSnippet(article) {
  const candidates = splitSentences([article?.title, article?.description_text].filter(Boolean).join('. '))
  const matched = candidates.find((sentence) =>
    NEGATIVE_CUES.some((cue) => normalizeText(sentence).includes(cue)),
  )

  return matched || article?.title || article?.description_text || 'No negative evidence extracted.'
}

function buildTopicSummary(rows, companyName, limit = 4) {
  const topicScores = new Map()
  const fallbackTokens = new Map()
  const companyTokens = new Set(normalizeText(companyName).split(/\s+/).filter(Boolean))

  for (const row of rows) {
    const haystack = normalizeText([row.article?.title, row.article?.description_text].filter(Boolean).join(' '))
    for (const topic of TOPIC_PATTERNS) {
      if (topic.pattern.test(haystack)) {
        topicScores.set(topic.label, (topicScores.get(topic.label) || 0) + 1)
      }
    }

    for (const token of haystack.split(/\s+/)) {
      if (token.length < 4 || TOPIC_STOPWORDS.has(token) || companyTokens.has(token)) continue
      fallbackTokens.set(token, (fallbackTokens.get(token) || 0) + 1)
    }
  }

  const primaryTopics = [...topicScores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label]) => label)

  if (primaryTopics.length >= limit) {
    return primaryTopics
  }

  const fallback = [...fallbackTokens.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit - primaryTopics.length)
    .map(([token]) => token.charAt(0).toUpperCase() + token.slice(1))

  return [...primaryTopics, ...fallback]
}

function buildSourceContributions(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const key = row.article?.source_key || row.article?.source_name || 'unknown'
    if (!grouped.has(key)) {
      grouped.set(key, {
        sourceKey: row.article?.source_key || 'unknown',
        sourceName: row.article?.source_name || 'Unknown source',
        mentionCount: 0,
        negativeCount: 0,
        totalSignal: 0,
        confidenceTotal: 0,
      })
    }

    const source = grouped.get(key)
    source.mentionCount += 1
    source.totalSignal += Number(row.sentiment_signal || 0)
    source.confidenceTotal += Number(row.confidence || 0)
    if (Number(row.sentiment_signal || 0) < 0) {
      source.negativeCount += 1
    }
  }

  return [...grouped.values()]
    .map((item) => ({
      sourceKey: item.sourceKey,
      sourceName: item.sourceName,
      mentionCount: item.mentionCount,
      negativeCount: item.negativeCount,
      weightedImpact: item.totalSignal,
      averageConfidence: clamp(Math.round((item.confidenceTotal / Math.max(item.mentionCount, 1)) * 100), 0, 100),
    }))
    .sort((left, right) => {
      if (right.negativeCount !== left.negativeCount) return right.negativeCount - left.negativeCount
      if (right.mentionCount !== left.mentionCount) return right.mentionCount - left.mentionCount
      return right.averageConfidence - left.averageConfidence
    })
}

function buildKeyArticles(rows, now) {
  return [...rows]
    .sort((left, right) => {
      const leftAge = now - new Date(left.article?.published_at || left.article?.created_at || now).getTime()
      const rightAge = now - new Date(right.article?.published_at || right.article?.created_at || now).getTime()
      const leftImpact = (Number(left.sentiment_signal || 0) < 0 ? 6 : 2) + (leftAge <= 24 * 60 * 60 * 1000 ? 3 : 0) + Number(left.mention_count || 0)
      const rightImpact = (Number(right.sentiment_signal || 0) < 0 ? 6 : 2) + (rightAge <= 24 * 60 * 60 * 1000 ? 3 : 0) + Number(right.mention_count || 0)
      return rightImpact - leftImpact
    })
    .slice(0, 4)
    .map((row) => ({
      id: row.article?.id,
      title: row.article?.title || 'Untitled article',
      sourceName: row.article?.source_name || 'Unknown source',
      articleUrl: row.article?.article_url || null,
      publishedAt: row.article?.published_at || row.article?.created_at || null,
      sentimentSignal: Number(row.sentiment_signal || 0),
      modelConfidence: clamp(Math.round(Number(row.confidence || 0) * 100), 0, 100),
      negativeSnippet: findNegativeSnippet(row.article),
      mentionCount: Number(row.mention_count || 1),
    }))
}

function buildChanges24h({ rows, now, last24hMentions, negativeSignals }) {
  const window24h = 24 * 60 * 60 * 1000
  const previous24hMentions = rows.filter((row) => {
    const publishedAt = new Date(row.article?.published_at || row.article?.created_at || now).getTime()
    const age = now - publishedAt
    return age > window24h && age <= window24h * 2
  }).length
  const negativeMentions24h = rows.filter((row) => {
    const publishedAt = new Date(row.article?.published_at || row.article?.created_at || now).getTime()
    return now - publishedAt <= window24h && Number(row.sentiment_signal || 0) < 0
  }).length
  const mentionDelta = last24hMentions - previous24hMentions
  const summary =
    last24hMentions === 0
      ? 'No new mentions landed in the last 24h; current risk is being sustained by earlier 7d coverage.'
      : mentionDelta > 0
        ? `${last24hMentions} mentions arrived in the last 24h, up ${mentionDelta} versus the prior 24h window.`
        : mentionDelta < 0
          ? `${last24hMentions} mentions arrived in the last 24h, down ${Math.abs(mentionDelta)} versus the prior 24h window.`
          : `${last24hMentions} mentions arrived in the last 24h, flat versus the prior 24h window.`

  return {
    last24hMentions,
    previous24hMentions,
    mentionDelta,
    negativeMentions24h,
    carriedNegativeSignals: Math.max(negativeSignals - negativeMentions24h, 0),
    summary,
  }
}

function buildActionableBrief({
  companyName,
  score,
  forecast,
  negativeSignals,
  sourceContributions,
  changes24h,
  topTopics,
  negativeRatio,
}) {
  const primarySource = sourceContributions[0]?.sourceName || 'the current coverage mix'
  const topicLabel = topTopics[0] || 'recent negative coverage'
  const whyThisMatters =
    forecast.level7d === 'high'
      ? `${companyName} is showing concentrated downside pressure from ${primarySource}, with ${Math.round(negativeRatio * 100)}% negative mentions and a ${forecast.level7d} 7d risk outlook.`
      : `${companyName} is still neutral-to-watchlist, but ${topicLabel.toLowerCase()} is keeping the monitoring burden elevated across ${sourceContributions.length} sources.`

  const whatChanged24h =
    changes24h.last24hMentions === 0
      ? changes24h.summary
      : `${changes24h.summary} ${changes24h.negativeMentions24h} of those mentions were negative, keeping the score at ${score}.`

  let recommendedAction = 'Keep the company on the watchlist and refresh the analyst note after the next crawl.'
  if (forecast.level24h === 'high' || forecast.level7d === 'high') {
    recommendedAction = `Escalate ${companyName} for analyst review, verify the claims in ${primarySource}, and prepare a response brief around ${topicLabel.toLowerCase()}.`
  } else if (negativeSignals > 0 || changes24h.last24hMentions > 0) {
    recommendedAction = `Track ${companyName} for another 24h cycle, validate whether ${topicLabel.toLowerCase()} persists, and notify the comms owner if negative coverage broadens.`
  }

  return {
    whyThisMatters,
    whatChanged24h,
    recommendedAction,
  }
}

function buildExplainability({
  rows,
  companyName,
  now,
  score,
  negativeSignals,
  last24hMentions,
  forecast,
}) {
  const keyArticles = buildKeyArticles(rows, now)
  const negativeArticles = keyArticles.filter((item) => item.sentimentSignal < 0).slice(0, 3)
  const sourceContributions = buildSourceContributions(rows)
  const averageModelConfidence = clamp(
    Math.round(rows.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / Math.max(rows.length, 1) * 100),
    0,
    100,
  )
  const topTopics = buildTopicSummary(rows, companyName)
  const negativeRatio = rows.length ? negativeSignals / rows.length : 0
  const changes24h = buildChanges24h({ rows, now, last24hMentions, negativeSignals })
  const scoreBreakdown = [
    { label: 'Sentiment score', value: score, direction: score <= 55 ? 'negative' : 'positive' },
    { label: 'Negative ratio', value: `${Math.round(negativeRatio * 100)}%`, direction: negativeRatio >= 0.4 ? 'negative' : 'neutral' },
    { label: '24h change', value: changes24h.mentionDelta >= 0 ? `+${changes24h.mentionDelta}` : `${changes24h.mentionDelta}`, direction: changes24h.mentionDelta > 0 ? 'negative' : 'neutral' },
    { label: 'Forecast confidence', value: forecast.confidence, direction: 'positive' },
  ]

  return {
    keyArticles,
    negativeArticles,
    sourceContributions,
    averageModelConfidence,
    strongestSource: sourceContributions[0]?.sourceName || null,
    topTopics,
    negativeRatio: Math.round(negativeRatio * 100),
    changes24h,
    scoreBreakdown,
  }
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
  const first = orderedRows[0]
  const trendDelta = getTrendDelta(last24hMentions, lifetimeMentions)
  const score = calculateCompanyScore({
    recentMentions,
    totalSignal,
    sourceCount,
    trendDelta,
  })
  const severity = detectSeverity(score, negativeSignals, recentMentions)
  const forecast = buildRiskForecast({
    score,
    negativeSignals,
    recentMentions,
    last24hMentions,
    sourceCount,
    lifetimeMentions,
  })
  const explainability = buildExplainability({
    rows: orderedRows,
    companyName: first.canonical_name,
    now,
    score,
    negativeSignals,
    last24hMentions,
    forecast,
  })
  const actionable = buildActionableBrief({
    companyName: first.canonical_name,
    score,
    forecast,
    negativeSignals,
    sourceContributions: explainability.sourceContributions,
    changes24h: explainability.changes24h,
    topTopics: explainability.topTopics,
    negativeRatio: explainability.negativeRatio / 100,
  })

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
    negativeRatio: explainability.negativeRatio,
    sourceModes: [...new Set(orderedRows.map((row) => row.source_mode).filter(Boolean))],
    lastSeenAt: latestArticle?.last_seen_at || latestArticle?.published_at || null,
    topTopics: explainability.topTopics,
    explainability,
    actionable,
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
        negativeSignals: company.negativeSignals,
        negativeRatio: company.negativeRatio,
        topTopics: company.topTopics,
        sentimentLabel: company.sentimentLabel,
        actionable: company.actionable,
        explainability: company.explainability,
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
  buildActionableBrief,
  buildRiskForecast,
  calculateCompanyScore,
  getTrackedCompanies,
  getAlerts,
  getTrendDelta,
  getOverview,
}
