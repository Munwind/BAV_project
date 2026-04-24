const env = require('../config/env')

async function readJsonResponse(response) {
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || data.error || 'AI service request failed')
  }

  return data
}

async function checkAiHealth() {
  const response = await fetch(`${env.aiServiceUrl}/health`)
  return readJsonResponse(response)
}

async function extractCompanyCandidates(text, { locale = 'vi-VN', model } = {}) {
  const normalizedText = String(text || '').trim()
  if (normalizedText.length < 3) {
    return []
  }

  try {
    const response = await fetch(`${env.aiServiceUrl}/ner/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: normalizedText,
        locale,
        model,
      }),
    })

    const data = await readJsonResponse(response)
    return Array.isArray(data.companies) ? data.companies : []
  } catch (_error) {
    return []
  }
}

async function extractArticleEntities(article, { locale = 'vi-VN', model } = {}) {
  const payload = {
    title: String(article?.title || '').trim(),
    description_text: String(article?.descriptionText || article?.description_text || '').trim(),
    locale,
    model,
  }

  if (payload.title.length < 3 && payload.description_text.length < 3) {
    return []
  }

  try {
    const response = await fetch(`${env.aiServiceUrl}/ner/extract-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await readJsonResponse(response)
    return Array.isArray(data.companies) ? data.companies : []
  } catch (_error) {
    return []
  }
}

async function explainCompanyScore(payload, { model } = {}) {
  const response = await fetch(`${env.aiServiceUrl}/explain-score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      model: model || payload?.model,
    }),
  })

  return readJsonResponse(response)
}

module.exports = {
  checkAiHealth,
  explainCompanyScore,
  extractCompanyCandidates,
  extractArticleEntities,
}
