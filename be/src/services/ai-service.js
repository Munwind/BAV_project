const env = require('../config/env')
const { checkAiHealth, extractCompanyCandidates } = require('./ai-client')
const { listArticles } = require('./crawler-service')
const { findCompanyEntityByText, listArticlesForEntity } = require('./entity-service')
const { normalizeText } = require('./sentiment-heuristics')

const SMALL_TALK_PATTERNS = [
  /\bban la ai\b/,
  /\bco the giup gi\b/,
  /\bco the lam gi\b/,
  /\bhuong dan\b/,
]
const SMALL_TALK_EXACT = ['xinchao', 'xincho', 'chao', 'chaoban', 'hello', 'hi', 'hey', 'alo']
const SMALL_TALK_PREFIXES = ['camon', 'thankyou', 'thanks']

function tokenizeQuestion(question) {
  return normalizeText(question).match(/[a-z0-9]{3,}/g) || []
}

function classifyInteractionMode(question) {
  const normalizedQuestion = normalizeText(question).trim()
  const compactQuestion = normalizedQuestion.replace(/\s+/g, '')

  if (!normalizedQuestion) {
    return 'smalltalk'
  }

  if (SMALL_TALK_EXACT.includes(compactQuestion)) {
    return 'smalltalk'
  }

  if (SMALL_TALK_PREFIXES.some((prefix) => compactQuestion.startsWith(prefix))) {
    return 'smalltalk'
  }

  if (SMALL_TALK_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return 'smalltalk'
  }

  return 'analysis'
}

function scoreArticle(article, keywords) {
  const haystack = normalizeText([article.title, article.description_text, article.source_name].join(' '))
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0)
}

function rankArticles(question, articles) {
  const keywords = tokenizeQuestion(question)
  if (!keywords.length) {
    return articles
  }

  return [...articles].sort((left, right) => scoreArticle(right, keywords) - scoreArticle(left, keywords))
}

function parseExplicitDate(question) {
  const match = question.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/)
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  if (!day || !month || !year || month > 12 || day > 31) {
    return null
  }

  const dateLabel = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+07:00`
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
  const dateTo = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}T00:00:00+07:00`

  return {
    dateLabel,
    dateFrom,
    dateTo,
  }
}

async function buildRetrievalPlan({ question, companyName, entityId, sourceKey, limit, contextMode }) {
  const explicitDate = parseExplicitDate(question)
  const nerCandidates = await extractCompanyCandidates(companyName || question)
  const detectedCompany = await findCompanyEntityByText({ entityId, companyName, question, nerCandidates })
  const interactionMode = classifyInteractionMode(question)

  return {
    sourceKey,
    limit: limit || env.aiArticleLimit,
    fetchLimit: detectedCompany ? Math.max(limit || env.aiArticleLimit, 80) : limit || env.aiArticleLimit,
    interactionMode,
    contextMode: contextMode || (detectedCompany ? 'company' : 'overview'),
    company: detectedCompany,
    companyName: detectedCompany?.canonicalName || null,
    dateLabel: explicitDate?.dateLabel || null,
    dateFrom: explicitDate?.dateFrom || null,
    dateTo: explicitDate?.dateTo || null,
  }
}

async function buildArticleContext({ question, sourceKey, limit, companyName, entityId, contextMode }) {
  const retrievalPlan = await buildRetrievalPlan({ question, sourceKey, limit, companyName, entityId, contextMode })

  if (retrievalPlan.interactionMode === 'smalltalk') {
    return {
      articles: [],
      retrievalContext: {
        contextMode: retrievalPlan.contextMode,
        interactionMode: retrievalPlan.interactionMode,
        companyName: retrievalPlan.companyName,
        requestedDate: retrievalPlan.dateLabel,
        sourceKey: retrievalPlan.sourceKey || null,
        matchedArticles: 0,
        usedFilters: {
          company: Boolean(retrievalPlan.companyName),
          exactDate: Boolean(retrievalPlan.dateLabel),
          source: Boolean(retrievalPlan.sourceKey),
        },
      },
    }
  }

  const filteredArticles = retrievalPlan.company
    ? await listArticlesForEntity(retrievalPlan.company.id, {
        limit: retrievalPlan.fetchLimit,
        sourceKey: retrievalPlan.sourceKey,
        dateFrom: retrievalPlan.dateFrom,
        dateTo: retrievalPlan.dateTo,
      })
    : await listArticles({
        limit: retrievalPlan.fetchLimit,
        sourceKey: retrievalPlan.sourceKey,
        dateFrom: retrievalPlan.dateFrom,
        dateTo: retrievalPlan.dateTo,
      })

  const articles = rankArticles(question, filteredArticles).slice(0, env.aiArticleLimit)

  return {
    articles,
    retrievalContext: {
      contextMode: retrievalPlan.contextMode,
      interactionMode: retrievalPlan.interactionMode,
      companyName: retrievalPlan.companyName,
      requestedDate: retrievalPlan.dateLabel,
      sourceKey: retrievalPlan.sourceKey || null,
      matchedArticles: articles.length,
      usedFilters: {
        company: Boolean(retrievalPlan.companyName),
        exactDate: Boolean(retrievalPlan.dateLabel),
        source: Boolean(retrievalPlan.sourceKey),
      },
    },
  }
}

async function askAi({ question, sourceKey, limit, locale, companyName, entityId, contextMode, history = [] }) {
  const { articles, retrievalContext } = await buildArticleContext({
    question,
    sourceKey,
    limit,
    companyName,
    entityId,
    contextMode,
  })

  const response = await fetch(`${env.aiServiceUrl}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      locale: locale || 'vi-VN',
      articles,
      retrieval_context: retrievalContext,
      history,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || data.error || 'AI service request failed')
  }

  return {
    ...data,
    contextCount: articles.length,
    retrievalContext,
  }
}

module.exports = {
  askAi,
  checkAiHealth,
  classifyInteractionMode,
  extractCompanyCandidates,
  buildArticleContext,
  buildRetrievalPlan,
}
