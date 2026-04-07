const test = require('node:test')
const assert = require('node:assert/strict')

const { buildRiskForecast } = require('../src/services/analytics-service')

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
