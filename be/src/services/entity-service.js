const seeds = require('../config/watchlist')
const { query, withTransaction } = require('../db')
const { normalizeText, countOccurrences, getSentimentSignal } = require('./sentiment-heuristics')

const COMPANY_PREFIX_REGEX = /^(?:ctcp|công ty cổ phần|cong ty co phan|công ty cp|cong ty cp|công ty tnhh|cong ty tnhh|tập đoàn|tap doan|tổng công ty|tong cong ty|ngân hàng|ngan hang)\s+/i
const ORG_PATTERN = /\b(?:CTCP|Công ty Cổ phần|Công ty CP|Công ty TNHH|Tập đoàn|Tổng Công ty|Ngân hàng)\s+[A-ZÀ-ỴĐ][^,.;:\n()]{2,90}/gu
const TICKER_PATTERN = /([^()\n]{3,100})\((?:HOSE|HNX|UPCOM|UPCoM)\s*:\s*([A-Z]{2,5})\)/g
const UPPER_TICKER_PATTERN = /\((?:HOSE|HNX|UPCOM|UPCoM)\s*:\s*([A-Z]{2,5})\)/g
const STOP_PHRASES = ['quý', 'năm', 'thị trường', 'doanh nghiệp', 'kinh doanh', 'hoạt động', 'việt nam']
const CLAUSE_SPLIT_REGEX = /\s+(?:đã|vừa|được|sẽ|khi|sau|để|trong|tại|với|do|là|gây|bị)\s+/i
const INVALID_ENTITY_PATTERNS = [
  /\bhom nay\b/i,
  /\bco nguy co\b/i,
  /\bdang\b/i,
  /\bduyet\b/i,
  /\bto chuc\b/i,
  /\bgay\b/i,
  /\bnha nuoc\b/i,
  /\bgan \d+\b/i,
  /\bkhoan lo\b/i,
]

function cleanEntityName(value) {
  return String(value || '')
    .replace(COMPANY_PREFIX_REGEX, '')
    .split(CLAUSE_SPLIT_REGEX)[0]
    .replace(/\s*\((?:HOSE|HNX|UPCOM|UPCoM)\s*:\s*[A-Z]{2,5}\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-')
}

function isUsefulEntityName(value) {
  const normalized = normalizeText(value)
  if (!normalized || normalized.length < 4) {
    return false
  }

  if (STOP_PHRASES.includes(normalized)) {
    return false
  }

  if (INVALID_ENTITY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false
  }

  return normalized.split(' ').length <= 8
}

function mergeCandidate(target, candidate) {
  target.confidence = Math.max(target.confidence, candidate.confidence)
  target.mentionCount = Math.max(target.mentionCount, candidate.mentionCount || 1)
  target.rawText = target.rawText || candidate.rawText
  target.ticker = target.ticker || candidate.ticker || null
  target.industry = target.industry || candidate.industry || null
  target.sourceMode = target.sourceMode === 'seed' ? 'seed' : candidate.sourceMode
}

function buildSeedCandidates(text) {
  const normalizedText = normalizeText(text)

  return seeds
    .map((seed) => {
      const aliases = [seed.name, ...(seed.aliases || [])].filter(Boolean).map((item) => normalizeText(item))
      const mentionCount = aliases.reduce((max, alias) => Math.max(max, countOccurrences(normalizedText, alias)), 0)

      if (!mentionCount) {
        return null
      }

      return {
        canonicalName: seed.name,
        normalizedName: normalizeText(seed.name),
        entityType: 'company',
        industry: seed.industry || null,
        ticker: seed.ticker || null,
        confidence: 0.95,
        sourceMode: 'seed',
        rawText: seed.name,
        mentionCount,
      }
    })
    .filter(Boolean)
}

function buildRegexCandidates(text) {
  const candidates = []

  for (const match of text.matchAll(ORG_PATTERN)) {
    const rawText = match[0]
    const canonicalName = cleanEntityName(rawText)
    if (!isUsefulEntityName(canonicalName)) {
      continue
    }

    candidates.push({
      canonicalName,
      normalizedName: normalizeText(canonicalName),
      entityType: 'company',
      industry: null,
      ticker: null,
      confidence: 0.72,
      sourceMode: 'regex',
      rawText,
      mentionCount: 1,
    })
  }

  for (const match of text.matchAll(TICKER_PATTERN)) {
    const rawText = match[0]
    const canonicalName = cleanEntityName(match[1])
    const ticker = match[2]

    if (!isUsefulEntityName(canonicalName)) {
      continue
    }

    candidates.push({
      canonicalName,
      normalizedName: normalizeText(canonicalName),
      entityType: 'company',
      industry: null,
      ticker,
      confidence: 0.84,
      sourceMode: 'ticker-pattern',
      rawText,
      mentionCount: 1,
    })
  }

  for (const match of text.matchAll(UPPER_TICKER_PATTERN)) {
    const ticker = match[1]
    const seed = seeds.find((item) => item.ticker === ticker)
    if (!seed) {
      continue
    }

    candidates.push({
      canonicalName: seed.name,
      normalizedName: normalizeText(seed.name),
      entityType: 'company',
      industry: seed.industry || null,
      ticker: seed.ticker || null,
      confidence: 0.88,
      sourceMode: 'ticker-seed',
      rawText: ticker,
      mentionCount: 1,
    })
  }

  return candidates
}

function extractEntitiesFromArticle(article) {
  const text = [article.title, article.descriptionText || article.description_text || ''].filter(Boolean).join('. ')
  const candidates = [...buildSeedCandidates(text), ...buildRegexCandidates(text)]
  const deduped = new Map()

  for (const candidate of candidates) {
    const key = candidate.ticker ? `${candidate.normalizedName}:${candidate.ticker}` : candidate.normalizedName
    if (!deduped.has(key)) {
      deduped.set(key, candidate)
      continue
    }

    mergeCandidate(deduped.get(key), candidate)
  }

  return [...deduped.values()]
}

function isCandidateGroundedInArticle(articleText, candidate) {
  const normalizedArticleText = normalizeText(articleText)
  const rawText = normalizeText(candidate.rawText || '')
  const canonicalName = normalizeText(candidate.canonicalName || '')
  const ticker = normalizeText(candidate.ticker || '')

  if (rawText && normalizedArticleText.includes(rawText)) {
    return true
  }

  if (canonicalName && normalizedArticleText.includes(canonicalName)) {
    return true
  }

  return Boolean(ticker && articleText.includes(`:${candidate.ticker}`))
}

async function upsertEntityCandidate(candidate, runner = { query }) {
  const lookup = candidate.ticker
    ? await runner.query(
      `
        SELECT id, canonical_name, normalized_name, entity_type, industry, ticker
        FROM entities
        WHERE normalized_name = $1 OR ticker = $2
        ORDER BY CASE WHEN normalized_name = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [candidate.normalizedName, candidate.ticker],
    )
    : await runner.query(
      `
        SELECT id, canonical_name, normalized_name, entity_type, industry, ticker
        FROM entities
        WHERE normalized_name = $1
        LIMIT 1
      `,
      [candidate.normalizedName],
    )

  if (lookup.rows[0]) {
    const entity = lookup.rows[0]
    await runner.query(
      `
        UPDATE entities
        SET
          canonical_name = CASE
            WHEN confidence <= $4 THEN $2
            ELSE canonical_name
          END,
          industry = COALESCE(industry, $5),
          ticker = COALESCE(ticker, $3),
          confidence = GREATEST(confidence, $4),
          updated_at = NOW()
        WHERE id = $1
      `,
      [entity.id, candidate.canonicalName, candidate.ticker, candidate.confidence, candidate.industry],
    )

    return {
      id: entity.id,
      canonicalName: entity.canonical_name,
      normalizedName: entity.normalized_name,
      ticker: entity.ticker || candidate.ticker || null,
      industry: entity.industry || candidate.industry || null,
    }
  }

  const inserted = await runner.query(
    `
      INSERT INTO entities (
        canonical_name,
        normalized_name,
        entity_type,
        industry,
        ticker,
        source_mode,
        confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, canonical_name, normalized_name, ticker, industry
    `,
    [
      candidate.canonicalName,
      candidate.normalizedName,
      candidate.entityType,
      candidate.industry,
      candidate.ticker,
      candidate.sourceMode,
      candidate.confidence,
    ],
  )

  const entity = inserted.rows[0]
  return {
    id: entity.id,
    canonicalName: entity.canonical_name,
    normalizedName: entity.normalized_name,
    ticker: entity.ticker,
    industry: entity.industry,
  }
}

async function upsertEntityAlias(entityId, alias, { sourceMode = 'seed', confidence = 0.8 } = {}, runner = { query }) {
  const normalizedAlias = normalizeText(alias)

  if (!normalizedAlias) {
    return
  }

  await runner.query(
    `
      INSERT INTO entity_aliases (
        entity_id,
        alias,
        normalized_alias,
        source_mode,
        confidence
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (entity_id, normalized_alias)
      DO UPDATE SET
        alias = EXCLUDED.alias,
        source_mode = EXCLUDED.source_mode,
        confidence = GREATEST(entity_aliases.confidence, EXCLUDED.confidence),
        updated_at = NOW()
    `,
    [entityId, alias, normalizedAlias, sourceMode, confidence],
  )
}

async function syncArticleEntitiesForArticle({ articleId, article }) {
  return withTransaction(async (client) => {
    const runner = { query: client.query.bind(client) }
    const candidates = extractEntitiesFromArticle(article)
    const articleText = [article.title, article.descriptionText || article.description_text || ''].filter(Boolean).join('. ')

    await runner.query('DELETE FROM article_entities WHERE article_id = $1', [articleId])

    if (!candidates.length) {
      return []
    }

    const sentimentSignal = getSentimentSignal(`${article.title} ${article.descriptionText || article.description_text || ''}`)
    const links = []

    for (const candidate of candidates) {
      if (!isCandidateGroundedInArticle(articleText, candidate)) {
        continue
      }

      const entity = await upsertEntityCandidate(candidate, runner)
      await upsertEntityAlias(entity.id, candidate.canonicalName, {
        sourceMode: candidate.sourceMode,
        confidence: candidate.confidence,
      }, runner)

      if (candidate.rawText && normalizeText(candidate.rawText) !== normalizeText(candidate.canonicalName)) {
        await upsertEntityAlias(entity.id, candidate.rawText, {
          sourceMode: candidate.sourceMode,
          confidence: Math.max(candidate.confidence - 0.05, 0.5),
        }, runner)
      }

      if (candidate.ticker) {
        await upsertEntityAlias(entity.id, candidate.ticker, {
          sourceMode: 'ticker',
          confidence: 0.95,
        }, runner)
      }

      await runner.query(
        `
          INSERT INTO article_entities (
            article_id,
            entity_id,
            mention_count,
            sentiment_signal,
            confidence,
            raw_text
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (article_id, entity_id)
          DO UPDATE SET
            mention_count = EXCLUDED.mention_count,
            sentiment_signal = EXCLUDED.sentiment_signal,
            confidence = EXCLUDED.confidence,
            raw_text = EXCLUDED.raw_text,
            updated_at = NOW()
        `,
        [articleId, entity.id, candidate.mentionCount || 1, sentimentSignal, candidate.confidence, candidate.rawText],
      )

      links.push(entity)
    }

    return links
  })
}

async function seedKnownEntities() {
  for (const seed of seeds) {
    const normalizedName = normalizeText(seed.name)
    const result = await query(
      `
        INSERT INTO entities (
          canonical_name,
          normalized_name,
          entity_type,
          industry,
          ticker,
          source_mode,
          confidence
        )
        VALUES ($1, $2, 'company', $3, $4, 'seed', 0.9900)
        ON CONFLICT (normalized_name)
        DO UPDATE SET
          industry = COALESCE(entities.industry, EXCLUDED.industry),
          ticker = COALESCE(entities.ticker, EXCLUDED.ticker),
          confidence = GREATEST(entities.confidence, EXCLUDED.confidence),
          updated_at = NOW()
        RETURNING id
      `,
      [seed.name, normalizedName, seed.industry || null, seed.ticker || null],
    )

    const entityId = result.rows[0]?.id
    if (!entityId) {
      const existing = await query(
        `
          SELECT id
          FROM entities
          WHERE normalized_name = $1
          LIMIT 1
        `,
        [normalizedName],
      )
      if (existing.rows[0]?.id) {
        await upsertEntityAlias(existing.rows[0].id, seed.name, { sourceMode: 'seed', confidence: 0.99 })
        for (const alias of seed.aliases || []) {
          await upsertEntityAlias(existing.rows[0].id, alias, { sourceMode: 'seed', confidence: 0.98 })
        }
        if (seed.ticker) {
          await upsertEntityAlias(existing.rows[0].id, seed.ticker, { sourceMode: 'ticker', confidence: 0.99 })
        }
      }
      continue
    }

    await upsertEntityAlias(entityId, seed.name, { sourceMode: 'seed', confidence: 0.99 })
    for (const alias of seed.aliases || []) {
      await upsertEntityAlias(entityId, alias, { sourceMode: 'seed', confidence: 0.98 })
    }
    if (seed.ticker) {
      await upsertEntityAlias(entityId, seed.ticker, { sourceMode: 'ticker', confidence: 0.99 })
    }
  }
}

async function listEntityMentionsForArticleIds(articleIds, { entityType = 'company', entityId = null } = {}) {
  if (!articleIds.length) {
    return []
  }

  const params = [articleIds, entityType]
  let entityFilter = ''

  if (entityId) {
    params.push(entityId)
    entityFilter = `AND e.id = $${params.length}`
  }

  const result = await query(
    `
      SELECT
        ae.article_id,
        ae.mention_count,
        ae.sentiment_signal,
        ae.confidence,
        ae.raw_text,
        e.id AS entity_id,
        e.canonical_name,
        e.normalized_name,
        e.ticker,
        e.industry,
        e.entity_type,
        e.source_mode
      FROM article_entities ae
      JOIN entities e ON e.id = ae.entity_id
      WHERE ae.article_id = ANY($1::bigint[])
        AND e.entity_type = $2
        ${entityFilter}
    `,
    params,
  )

  return result.rows
}

async function findCompanyEntityByText({ entityId, companyName, question }) {
  if (entityId) {
    const byId = await query(
      `
        SELECT id, canonical_name, normalized_name, ticker, industry
        FROM entities
        WHERE entity_type = 'company'
          AND id = $1
        LIMIT 1
      `,
      [entityId],
    )

    if (byId.rows[0]) {
      const row = byId.rows[0]
      return {
        id: row.id,
        canonicalName: row.canonical_name,
        normalizedName: row.normalized_name,
        ticker: row.ticker,
        industry: row.industry,
      }
    }
  }

  if (companyName) {
    const normalizedCompanyName = normalizeText(companyName)
    const exact = await query(
      `
        SELECT id, canonical_name, normalized_name, ticker, industry
        FROM entities
        WHERE entity_type = 'company'
          AND normalized_name = $1
        LIMIT 1
      `,
      [normalizedCompanyName],
    )

    if (exact.rows[0]) {
      const row = exact.rows[0]
      return {
        id: row.id,
        canonicalName: row.canonical_name,
        normalizedName: row.normalized_name,
        ticker: row.ticker,
        industry: row.industry,
      }
    }

    const aliasMatch = await query(
      `
        SELECT e.id, e.canonical_name, e.normalized_name, e.ticker, e.industry
        FROM entity_aliases ea
        JOIN entities e ON e.id = ea.entity_id
        WHERE e.entity_type = 'company'
          AND ea.normalized_alias = $1
        ORDER BY ea.confidence DESC, e.updated_at DESC
        LIMIT 1
      `,
      [normalizedCompanyName],
    )

    if (aliasMatch.rows[0]) {
      const row = aliasMatch.rows[0]
      return {
        id: row.id,
        canonicalName: row.canonical_name,
        normalizedName: row.normalized_name,
        ticker: row.ticker,
        industry: row.industry,
      }
    }
  }

  const candidates = [companyName, question].filter(Boolean).map((value) => normalizeText(value))
  if (!candidates.length) {
    return null
  }

  const result = await query(
    `
      SELECT id, canonical_name, normalized_name, ticker, industry
      FROM entities
      WHERE entity_type = 'company'
      ORDER BY updated_at DESC
      LIMIT 500
    `,
  )

  const matched = result.rows.find((row) =>
    candidates.some((candidate) =>
      candidate.includes(row.normalized_name)
      || (row.ticker && candidate.includes(normalizeText(row.ticker))),
    ),
  )

  if (!matched) {
    return null
  }

  return {
    id: matched.id,
    canonicalName: matched.canonical_name,
    normalizedName: matched.normalized_name,
    ticker: matched.ticker,
    industry: matched.industry,
  }
}

async function reindexAllArticleEntities() {
  const result = await query(
    `
      SELECT
        id,
        title,
        description_text,
        published_at
      FROM articles
      ORDER BY published_at DESC NULLS LAST, created_at DESC
    `,
  )

  for (const article of result.rows) {
    await syncArticleEntitiesForArticle({
      articleId: article.id,
      article: {
        title: article.title,
        description_text: article.description_text,
        publishedAt: article.published_at,
      },
    })
  }

  return result.rows.length
}

module.exports = {
  slugify,
  normalizeText,
  extractEntitiesFromArticle,
  seedKnownEntities,
  syncArticleEntitiesForArticle,
  listEntityMentionsForArticleIds,
  findCompanyEntityByText,
  reindexAllArticleEntities,
}
