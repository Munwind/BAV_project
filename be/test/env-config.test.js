const test = require('node:test')
const assert = require('node:assert/strict')

function loadEnvWith(overrides) {
  const keys = Object.keys(overrides)
  const previous = new Map(keys.map((key) => [key, process.env[key]]))

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    const modulePath = require.resolve('../src/config/env')
    delete require.cache[modulePath]
    return require('../src/config/env')
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    const modulePath = require.resolve('../src/config/env')
    delete require.cache[modulePath]
  }
}

test('env config reads YouTube settings from process env', () => {
  const env = loadEnvWith({
    YOUTUBE_API_KEY: 'unit-test-key',
    YOUTUBE_SEARCH_MAX_RESULTS: '7',
    YOUTUBE_COMMENT_MAX_RESULTS: '33',
    YOUTUBE_LOOKBACK_HOURS: '72',
  })

  assert.equal(env.youtubeApiKey, 'unit-test-key')
  assert.equal(env.youtubeSearchMaxResults, 7)
  assert.equal(env.youtubeCommentMaxResults, 33)
  assert.equal(env.youtubeLookbackHours, 72)
})

test('env config clamps invalid YouTube limits to safe bounds', () => {
  const env = loadEnvWith({
    YOUTUBE_SEARCH_MAX_RESULTS: '999',
    YOUTUBE_COMMENT_MAX_RESULTS: '1',
    YOUTUBE_LOOKBACK_HOURS: '2',
  })

  assert.equal(env.youtubeSearchMaxResults, 10)
  assert.equal(env.youtubeCommentMaxResults, 5)
  assert.equal(env.youtubeLookbackHours, 24)
})
