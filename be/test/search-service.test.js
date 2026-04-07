const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)]
}

function mockModule(modulePath, exports) {
  require.cache[require.resolve(modulePath)] = {
    id: require.resolve(modulePath),
    filename: require.resolve(modulePath),
    loaded: true,
    exports,
  }
}

function loadSearchService({ analyticsMock, crawlerMock, dbMock, entityMock } = {}) {
  clearModule('../src/services/search-service')
  clearModule('../src/services/analytics-service')
  clearModule('../src/services/crawler-service')
  clearModule('../src/db')
  clearModule('../src/services/entity-service')

  mockModule('../src/services/analytics-service', analyticsMock || {
    getTrackedCompanies: async () => [],
    getAlerts: async () => [],
  })
  mockModule('../src/services/crawler-service', crawlerMock || {
    listArticles: async () => [],
  })
  mockModule('../src/db', dbMock || {
    query: async () => ({ rows: [] }),
  })
  mockModule('../src/services/entity-service', entityMock || {
    normalizeText: (value) => String(value || '').toLowerCase().trim(),
  })

  const service = require('../src/services/search-service')

  return {
    service,
    restore() {
      clearModule('../src/services/search-service')
      clearModule('../src/services/analytics-service')
      clearModule('../src/services/crawler-service')
      clearModule('../src/db')
      clearModule('../src/services/entity-service')
    },
  }
}

test('scoreTextMatch prioritizes exact match over includes', () => {
  const { service, restore } = loadSearchService()

  try {
    assert.ok(service.scoreTextMatch('PVOIL', 'PVOIL') > service.scoreTextMatch('PVOIL', 'Tong cong ty dau Viet Nam PVOIL'))
  } finally {
    restore()
  }
})

test('searchAll ranks ticker and alias matches for companies ahead of broader matches', async () => {
  const { service, restore } = loadSearchService({
    analyticsMock: {
      getTrackedCompanies: async () => [
        {
          key: 'pvoil',
          entityId: 1,
          name: 'PVOIL',
          industry: 'Energy',
          ticker: 'OIL',
          mentions: 5,
          forecastConfidence: 80,
          forecastRisk7d: 'high',
        },
        {
          key: 'petrolimex',
          entityId: 2,
          name: 'Petrolimex',
          industry: 'Energy',
          ticker: 'PLX',
          mentions: 3,
          forecastConfidence: 70,
          forecastRisk7d: 'medium',
        },
      ],
      getAlerts: async () => [
        {
          id: 'pvoil-alert',
          companyName: 'PVOIL',
          title: 'Rui ro tang cao quanh PVOIL',
          description: 'Negative coverage present',
          forecastRisk7d: 'high',
          score: 40,
        },
      ],
    },
    crawlerMock: {
      listArticles: async () => [
        {
          id: 10,
          title: 'PVOIL mo rong mang luoi cua hang',
          description_text: 'Ban tin moi ve PVOIL',
          source_name: 'CafeF',
          article_url: 'https://example.com/pvoil',
          published_at: '2026-04-07T10:00:00.000Z',
        },
      ],
    },
    dbMock: {
      query: async () => ({
        rows: [
          { entity_id: 1, alias: 'oil' },
          { entity_id: 1, alias: 'tong cong ty dau viet nam' },
        ],
      }),
    },
  })

  try {
    const byTicker = await service.searchAll('OIL')
    assert.equal(byTicker.companies[0]?.name, 'PVOIL')

    const byAlias = await service.searchAll('tong cong ty dau viet nam')
    assert.equal(byAlias.companies[0]?.name, 'PVOIL')
    assert.equal(byAlias.alerts[0]?.companyName, 'PVOIL')

    const byHeadline = await service.searchAll('mo rong mang luoi')
    assert.equal(byHeadline.articles[0]?.title, 'PVOIL mo rong mang luoi cua hang')
  } finally {
    restore()
  }
})
