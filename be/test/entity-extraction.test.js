const test = require('node:test')
const assert = require('node:assert/strict')

const { extractEntitiesFromArticle } = require('../src/services/entity-service')

test('extractEntitiesFromArticle resolves seeded companies and ticker aliases', () => {
  const entities = extractEntitiesFromArticle({
    title: 'CTCP Traphaco (HOSE: TRA) dat muc tieu tang truong doanh thu nam 2026',
    description_text: 'Traphaco cho biet se tiep tuc tai cau truc kenh OTC va mo rong danh muc san pham.',
  })

  const traphaco = entities.find((item) => item.canonicalName === 'Traphaco')

  assert.ok(traphaco)
  assert.equal(traphaco.ticker, 'TRA')
  assert.equal(traphaco.entityType, 'company')
  assert.ok(traphaco.confidence >= 0.84)
})

test('extractEntitiesFromArticle ignores vague non-company phrases', () => {
  const entities = extractEntitiesFromArticle({
    title: 'Doanh nghiep dang duyet ke hoach kinh doanh quy 2',
    description_text: 'Thi truong viet nam ghi nhan bien dong nhung chua co ten cong ty cu the.',
  })

  assert.equal(entities.length, 0)
})

