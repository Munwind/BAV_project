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

test('extractEntitiesFromArticle resolves ticker-only seeded aliases for TPB, TRA, and OIL', () => {
  const entities = extractEntitiesFromArticle({
    title: 'TPB, TRA va OIL dong loat duoc nha dau tu quan tam',
    description_text: 'Dong tien xoay quanh cac ma TPB TRA OIL trong phien gan day.',
  })

  assert.ok(entities.some((item) => item.canonicalName === 'TPBank' && item.ticker === 'TPB'))
  assert.ok(entities.some((item) => item.canonicalName === 'Traphaco' && item.ticker === 'TRA'))
  assert.ok(entities.some((item) => item.canonicalName === 'PVOIL' && item.ticker === 'OIL'))
})

test('extractEntitiesFromArticle uses youtube title and comment text with seed-only matching', () => {
  const entities = extractEntitiesFromArticle({
    sourceKey: 'youtube-vietstock-market-comments',
    title: '[YouTube] TTKD va TPB trong nhom ngan hang dang chu y',
    description_text: 'TPB dang duoc dinh gia re hon gia tri thuc te.',
    rawItem: { platform: 'youtube' },
  })

  assert.ok(entities.some((item) => item.canonicalName === 'TPBank'))
  assert.ok(!entities.some((item) => item.canonicalName === 'LIVE'))
  assert.ok(!entities.some((item) => item.canonicalName === 'YouTube'))
  assert.ok(!entities.some((item) => item.canonicalName === 'TTKD'))
})

test('extractEntitiesFromArticle does not match short ticker aliases inside normal words', () => {
  const entities = extractEntitiesFromArticle({
    sourceKey: 'youtube-cafef-stocks-comments',
    title: '[YouTube] TPB dang co dong luc moi',
    description_text: 'Trong luc cho keo thom thi cu sinh loi ma trien cho lanh.',
    rawItem: { platform: 'youtube' },
  })

  assert.ok(entities.some((item) => item.canonicalName === 'TPBank'))
  assert.ok(!entities.some((item) => item.canonicalName === 'Traphaco'))
})
