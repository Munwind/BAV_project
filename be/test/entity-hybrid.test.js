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

function loadEntityService({ dbMock, aiClientMock } = {}) {
  clearModule('../src/services/entity-service')
  clearModule('../src/config/watchlist')
  clearModule('../src/services/ai-client')
  clearModule('../src/db')

  mockModule('../src/db', dbMock || {
    query: async () => ({ rows: [] }),
    withTransaction: async (callback) => callback({ query: async () => ({ rows: [] }) }),
  })
  mockModule('../src/services/ai-client', aiClientMock || {
    extractArticleEntities: async () => [],
  })

  const service = require('../src/services/entity-service')

  return {
    service,
    restore() {
      clearModule('../src/services/entity-service')
      clearModule('../src/services/ai-client')
      clearModule('../src/db')
    },
  }
}

test('resolveEntityCandidates prefers rule-based extraction and skips AI call', async () => {
  let aiCalls = 0
  const { service, restore } = loadEntityService({
    aiClientMock: {
      extractArticleEntities: async () => {
        aiCalls += 1
        return [{ name: 'Should Not Be Used', confidence: 0.9 }]
      },
    },
  })

  try {
    const result = await service.resolveEntityCandidates({
      title: 'CTCP Traphaco (HOSE: TRA) dat muc tieu tang truong doanh thu',
      description_text: 'Traphaco tiep tuc mo rong danh muc san pham.',
    })

    assert.equal(result.source, 'rule')
    assert.ok(result.candidates.some((item) => item.canonicalName === 'Traphaco'))
    assert.equal(aiCalls, 0)
  } finally {
    restore()
  }
})

test('resolveEntityCandidates uses cached AI payload before calling remote AI', async () => {
  let aiCalls = 0
  const dbMock = {
    query: async (sql) => {
      if (sql.includes('FROM ai_ner_cache')) {
        return {
          rows: [
            {
              response_payload: [
                { name: 'ROX Energy', ticker: null, aliases: ['ROX Group'], confidence: 0.92 },
              ],
            },
          ],
        }
      }

      return { rows: [] }
    },
    withTransaction: async (callback) => callback({ query: dbMock.query }),
  }

  const { service, restore } = loadEntityService({
    dbMock,
    aiClientMock: {
      extractArticleEntities: async () => {
        aiCalls += 1
        return []
      },
    },
  })

  try {
    const result = await service.resolveEntityCandidates(
      {
        title: 'Cap nhat doanh nghiep nganh nang luong',
        description_text: 'Ban tin nhac den mot doanh nghiep lon nhung khong neu ro ten trong noi dung crawl.',
      },
      { contentHash: 'cached-hash', runner: { query: dbMock.query } },
    )

    assert.equal(result.source, 'ai-cache')
    assert.equal(result.candidates.length, 1)
    assert.equal(result.candidates[0].canonicalName, 'ROX Energy')
    assert.equal(aiCalls, 0)
  } finally {
    restore()
  }
})

test('resolveEntityCandidates calls AI and normalizes response when no rule or cache match', async () => {
  const queries = []
  const dbMock = {
    query: async (sql, params) => {
      queries.push(sql)

      if (sql.includes('FROM ai_ner_cache')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO ai_ner_cache')) {
        assert.equal(params[0], 'new-hash')
        return { rows: [] }
      }

      return { rows: [] }
    },
    withTransaction: async (callback) => callback({ query: dbMock.query }),
  }

  const { service, restore } = loadEntityService({
    dbMock,
    aiClientMock: {
      extractArticleEntities: async () => [
        {
          name: 'Cong ty CP Fecon',
          ticker: 'FCN',
          aliases: ['Fecon'],
          confidence: 0.87,
        },
      ],
    },
  })

  try {
    const result = await service.resolveEntityCandidates(
      {
        title: 'Ke hoach moi cua doanh nghiep',
        description_text: 'Ban tin tom tat khong neu ro ten phap nhan trong noi dung goc.',
      },
      { contentHash: 'new-hash', runner: { query: dbMock.query } },
    )

    assert.equal(result.source, 'ai-ner')
    assert.equal(result.candidates.length, 1)
    assert.equal(result.candidates[0].canonicalName, 'Fecon')
    assert.equal(result.candidates[0].ticker, 'FCN')
    assert.ok(queries.some((sql) => sql.includes('INSERT INTO ai_ner_cache')))
  } finally {
    restore()
  }
})

test('syncArticleEntitiesForArticle skips unchanged articles already processed in DB', async () => {
  const seenQueries = []
  const runnerQuery = async (sql, params) => {
    seenQueries.push(sql)

    if (sql.includes('SELECT entity_extracted_hash, entity_extracted_at')) {
      return {
        rows: [
          {
            entity_extracted_hash: 'same-hash',
            entity_extracted_at: '2026-04-07T10:00:00.000Z',
          },
        ],
      }
    }

    throw new Error(`Unexpected query during skip path: ${sql}`)
  }

  const { service, restore } = loadEntityService({
    dbMock: {
      query: runnerQuery,
      withTransaction: async (callback) => callback({ query: runnerQuery }),
    },
    aiClientMock: {
      extractArticleEntities: async () => {
        throw new Error('AI should not be called for unchanged article')
      },
    },
  })

  try {
    const result = await service.syncArticleEntitiesForArticle({
      articleId: 42,
      article: {
        title: 'Bai bao da xu ly',
        description_text: 'Noi dung khong doi',
      },
      entityContentHash: 'same-hash',
      skipIfUnchanged: true,
    })

    assert.equal(result.skipped, true)
    assert.equal(result.source, 'db-skip')
    assert.equal(result.links.length, 0)
    assert.equal(seenQueries.length, 1)
  } finally {
    restore()
  }
})
