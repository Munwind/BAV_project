const test = require('node:test')
const assert = require('node:assert/strict')

function loadAiServiceWithMocks({ entityService, crawlerService, aiClient, env } = {}) {
  const aiServicePath = require.resolve('../src/services/ai-service')
  const entityServicePath = require.resolve('../src/services/entity-service')
  const crawlerServicePath = require.resolve('../src/services/crawler-service')
  const aiClientPath = require.resolve('../src/services/ai-client')
  const envPath = require.resolve('../src/config/env')

  delete require.cache[aiServicePath]
  delete require.cache[entityServicePath]
  delete require.cache[crawlerServicePath]
  delete require.cache[aiClientPath]
  delete require.cache[envPath]

  require.cache[entityServicePath] = {
    id: entityServicePath,
    filename: entityServicePath,
    loaded: true,
    exports: entityService || {},
  }
  require.cache[crawlerServicePath] = {
    id: crawlerServicePath,
    filename: crawlerServicePath,
    loaded: true,
    exports: crawlerService || {},
  }
  require.cache[aiClientPath] = {
    id: aiClientPath,
    filename: aiClientPath,
    loaded: true,
    exports: aiClient || {},
  }
  require.cache[envPath] = {
    id: envPath,
    filename: envPath,
    loaded: true,
    exports: {
      aiArticleLimit: 8,
      aiServiceUrl: 'http://localhost:8000',
      ...(env || {}),
    },
  }

  return require('../src/services/ai-service')
}

test('buildArticleContext fetches directly by entity when company context is resolved', async () => {
  let listArticlesCalled = 0
  let listArticlesForEntityCalled = 0

  const aiService = loadAiServiceWithMocks({
    entityService: {
      findCompanyEntityByText: async () => ({ id: 387, canonicalName: 'TPBank' }),
      listArticlesForEntity: async (entityId, options) => {
        listArticlesForEntityCalled += 1
        assert.equal(entityId, 387)
        assert.equal(options.limit, 80)
        return [
          { id: 1, title: 'Tin TPBank', description_text: 'TPB', source_name: 'CafeF' },
        ]
      },
    },
    crawlerService: {
      listArticles: async () => {
        listArticlesCalled += 1
        return []
      },
    },
    aiClient: {
      checkAiHealth: async () => ({ ok: true }),
      extractCompanyCandidates: async () => [],
    },
  })

  const result = await aiService.buildArticleContext({
    question: 'co tin tuc gi khong',
    companyName: 'TPBank',
    entityId: 387,
    contextMode: 'company',
  })

  assert.equal(listArticlesForEntityCalled, 1)
  assert.equal(listArticlesCalled, 0)
  assert.equal(result.articles.length, 1)
  assert.equal(result.retrievalContext.companyName, 'TPBank')
})

