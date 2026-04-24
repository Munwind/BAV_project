const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildActionableBrief,
  buildCompanyExplanationSignature,
  buildNarrative,
  buildRiskForecast,
  buildSourceSplit,
  buildWhatChanged,
  calculateCompanyScore,
  getTrendDelta,
} = require('../src/services/analytics-service')

test('buildRiskForecast returns low risk for quiet coverage', () => {
  const forecast = buildRiskForecast({
    score: 74,
    negativeSignals: 0,
    recentMentions: 1,
    last24hMentions: 0,
    sourceCount: 1,
    lifetimeMentions: 2,
  })

  assert.equal(forecast.level24h, 'low')
  assert.equal(forecast.level7d, 'low')
  assert.ok(forecast.confidence >= 52)
})

test('buildRiskForecast returns medium/high risk when pressure builds', () => {
  const forecast = buildRiskForecast({
    score: 49,
    negativeSignals: 2,
    recentMentions: 5,
    last24hMentions: 2,
    sourceCount: 3,
    lifetimeMentions: 9,
  })

  assert.equal(forecast.level24h, 'medium')
  assert.equal(forecast.level7d, 'high')
  assert.ok(forecast.drivers.length > 0)
})

test('buildRiskForecast returns high risk for acute negative spike', () => {
  const forecast = buildRiskForecast({
    score: 34,
    negativeSignals: 4,
    recentMentions: 8,
    last24hMentions: 5,
    sourceCount: 5,
    lifetimeMentions: 15,
  })

  assert.equal(forecast.level24h, 'high')
  assert.equal(forecast.level7d, 'high')
  assert.match(forecast.summary, /Risk forecast/i)
})

test('calculateCompanyScore penalizes stale 24h trend', () => {
  const staleTrendDelta = getTrendDelta(0, 6)
  const activeTrendDelta = getTrendDelta(4, 6)

  const staleScore = calculateCompanyScore({
    recentMentions: 6,
    totalSignal: -2,
    sourceCount: 3,
    trendDelta: staleTrendDelta,
  })

  const activeScore = calculateCompanyScore({
    recentMentions: 6,
    totalSignal: -2,
    sourceCount: 3,
    trendDelta: activeTrendDelta,
  })

  assert.equal(staleTrendDelta, -6)
  assert.equal(activeTrendDelta, 2)
  assert.equal(staleScore, 57)
  assert.equal(activeScore, 73)
  assert.ok(staleScore < activeScore)
})

test('buildActionableBrief returns analyst-oriented next steps', () => {
  const forecast = buildRiskForecast({
    score: 47,
    negativeSignals: 2,
    recentMentions: 6,
    last24hMentions: 3,
    sourceCount: 3,
    lifetimeMentions: 8,
  })

  const brief = buildActionableBrief({
    companyName: 'Bao Tin Minh Chau',
    score: 47,
    forecast,
    negativeSignals: 2,
    sourceContributions: [{ sourceName: 'CafeF' }],
    changes24h: {
      last24hMentions: 3,
      previous24hMentions: 1,
      mentionDelta: 2,
      negativeMentions24h: 2,
      summary: '3 mentions arrived in the last 24h, up 2 versus the prior 24h window.',
    },
    topTopics: ['Tax and compliance'],
    negativeRatio: 0.5,
  })

  assert.match(brief.whyThisMatters, /Bao Tin Minh Chau/i)
  assert.match(brief.whatChanged24h, /24h/i)
  assert.match(brief.recommendedAction, /analyst review|track/i)
})

test('buildCompanyExplanationSignature changes when article evidence changes', () => {
  const baseRows = [
    {
      article_id: 101,
      mention_count: 1,
      sentiment_signal: -1,
      confidence: 0.9,
      article_entity_updated_at: '2026-04-17T10:00:00.000Z',
    },
  ]

  const changedRows = [
    {
      ...baseRows[0],
      sentiment_signal: 1,
    },
  ]

  assert.notEqual(
    buildCompanyExplanationSignature(baseRows),
    buildCompanyExplanationSignature(changedRows),
  )
})

test('buildSourceSplit separates news and youtube coverage', () => {
  const split = buildSourceSplit([
    { source_key: 'vnexpress-business', sentiment_signal: -1, article: { source_key: 'vnexpress-business' } },
    { source_key: 'youtube-cafef-stocks-comments', sentiment_signal: 1, article: { source_key: 'youtube-cafef-stocks-comments' } },
    { source_key: 'youtube-cafef-stocks-comments', sentiment_signal: -1, article: { source_key: 'youtube-cafef-stocks-comments' } },
  ])

  assert.equal(split.length, 2)
  assert.equal(split.find((item) => item.channel === 'youtube')?.mentions, 2)
  assert.equal(split.find((item) => item.channel === 'news')?.negativeMentions, 1)
})

test('buildWhatChanged summarizes 24h movement with source and topic context', () => {
  const block = buildWhatChanged({
    companyName: 'Petrolimex',
    score: 54,
    changes24h: {
      last24hMentions: 4,
      previous24hMentions: 1,
      mentionDelta: 3,
      negativeMentions24h: 2,
      summary: '4 mentions arrived in the last 24h, up 3 versus the prior 24h window.',
    },
    sourceContributions: [{ sourceName: 'CafeF' }],
    topTopics: ['Market performance'],
  })

  assert.match(block.headline, /Petrolimex/i)
  assert.equal(block.strongestSource, 'CafeF')
  assert.equal(block.leadTopic, 'Market performance')
})

test('buildNarrative creates a concise narrative summary for the company', () => {
  const narrative = buildNarrative({
    companyName: 'Petrolimex',
    topTopics: ['Operations pressure'],
    sourceContributions: [{ sourceName: 'Vietstock' }],
    sourceSplit: [{ label: 'YouTube' }],
    negativeSignals: 2,
    forecast: { level7d: 'high' },
  })

  assert.match(narrative.title, /Operations pressure/i)
  assert.match(narrative.summary, /Petrolimex/i)
  assert.equal(narrative.pressure, 'downside pressure')
})
