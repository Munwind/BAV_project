const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildDailyTrendsUrl,
  parseGoogleDailyTrendsPayload,
  stripGooglePrefix,
} = require('../src/services/google-trends-service')

test('stripGooglePrefix removes anti-XSSI prefix from trends response', () => {
  assert.equal(stripGooglePrefix(`)]}'\n{"ok":true}`), '{"ok":true}')
})

test('buildDailyTrendsUrl uses geo and locale query params', () => {
  const url = buildDailyTrendsUrl({ geo: 'VN', hl: 'vi' })

  assert.match(url, /trends\.google\.com\/trends\/api\/dailytrends/)
  assert.match(url, /geo=VN/)
  assert.match(url, /hl=vi/)
})

test('parseGoogleDailyTrendsPayload normalizes daily trend keywords', () => {
  const items = parseGoogleDailyTrendsPayload(
    {
      default: {
        trendingSearchesDays: [
          {
            trendingSearches: [
              {
                title: { query: 'gia vang hom nay' },
                formattedTraffic: '20K+',
                relatedQueries: [{ query: 'vang sjc' }, { query: 'gia vang 9999' }],
                articles: [{ title: 'Gia vang tang', source: 'Example News', url: 'https://example.test' }],
              },
            ],
          },
        ],
      },
    },
    3,
  )

  assert.equal(items.length, 1)
  assert.equal(items[0].keyword, 'gia vang hom nay')
  assert.equal(items[0].traffic, '20K+')
  assert.deepEqual(items[0].relatedQueries, ['vang sjc', 'gia vang 9999'])
  assert.equal(items[0].articles[0].source, 'Example News')
})
