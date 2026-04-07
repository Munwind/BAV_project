const fs = require('fs/promises')
const http = require('http')
const https = require('https')
const path = require('path')
const { constants, createHash } = require('crypto')
const Parser = require('rss-parser')
const { decode } = require('he')
const env = require('../config/env')
const crawlerSources = require('../config/crawler-sources')
const { query } = require('../db')
const { seedKnownEntities, syncArticleEntitiesForArticle } = require('./entity-service')

const parser = new Parser({
  headers: {
    'User-Agent': 'SentimentXBot/1.0 (+https://sentimentx.local)',
  },
})

function decodeBuffer(buffer, contentType = '') {
  const lowerType = String(contentType || '').toLowerCase()
  const bomUtf16Le = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe
  const bomUtf16Be = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff

  if (bomUtf16Le || lowerType.includes('utf-16')) {
    return buffer.toString('utf16le')
  }

  if (bomUtf16Be) {
    const swapped = Buffer.allocUnsafe(buffer.length)
    for (let index = 0; index < buffer.length; index += 2) {
      swapped[index] = buffer[index + 1]
      swapped[index + 1] = buffer[index]
    }
    return swapped.toString('utf16le')
  }

  return buffer.toString('utf8')
}

function stripHtml(value = '') {
  return decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

function sanitizeXml(xml = '') {
  return xml
    .replace(/&(?!#\d+;|#x[a-fA-F0-9]+;|[a-zA-Z][a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function fetchFeedXml(url, redirects = 0) {
  const client = url.startsWith('https:') ? https : http
  const agent = url.startsWith('https:')
    ? new https.Agent({
      secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
    })
    : undefined

  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        headers: {
          'User-Agent': 'SentimentXBot/1.0 (+https://sentimentx.local)',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        agent,
      },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume()
          if (redirects >= 5) {
            reject(new Error('Feed request exceeded redirect limit'))
            return
          }
          resolve(fetchFeedXml(response.headers.location, redirects + 1))
          return
        }

        if (response.statusCode && response.statusCode >= 400) {
          response.resume()
          reject(new Error(`Feed request failed with status ${response.statusCode}`))
          return
        }

        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve(decodeBuffer(Buffer.concat(chunks), response.headers['content-type'])))
        response.on('error', reject)
      },
    )

    request.setTimeout(env.feedRequestTimeoutMs, () => {
      request.destroy(new Error(`Feed request timed out after ${env.feedRequestTimeoutMs}ms`))
    })
    request.on('error', reject)
  })
}

function extractTagValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))
  return match ? decode(match[1].trim()) : null
}

function extractMetaContent(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return decode(match[1].trim())
    }
  }

  return null
}

function parseFeedXmlFallback(xml) {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
  const items = itemMatches.map((match) => {
    const itemXml = match[0]
    const title = extractTagValue(itemXml, 'title')
    const link = extractTagValue(itemXml, 'link')
    const guid = extractTagValue(itemXml, 'guid') || link
    const description = extractTagValue(itemXml, 'description')
    const pubDate = extractTagValue(itemXml, 'pubDate')

    return {
      title,
      link,
      guid,
      description,
      summary: description,
      content: description,
      pubDate,
      isoDate: pubDate ? new Date(pubDate).toISOString() : null,
    }
  })

  return {
    title: extractTagValue(xml, 'title') || 'RSS Feed',
    link: extractTagValue(xml, 'link') || null,
    items: items.filter((item) => item.title || item.link),
  }
}

async function parseFeedXml(xml) {
  const sanitized = sanitizeXml(xml)

  try {
    return await parser.parseString(sanitized)
  } catch (error) {
    return parseFeedXmlFallback(sanitized)
  }
}

function buildFallbackArticle(source, url, articleHtml) {
  const title = extractMetaContent(articleHtml, [
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /<meta\s+name="title"\s+content="([^"]+)"/i,
    /<title>([^<]+)<\/title>/i,
  ])
  const description = extractMetaContent(articleHtml, [
    /<meta\s+property="og:description"\s+content="([^"]+)"/i,
    /<meta\s+name="description"\s+content="([^"]+)"/i,
  ])
  const publishedAt =
    extractMetaContent(articleHtml, [
      /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
      /"datePublished":"([^"]+)"/i,
      /<meta\s+name="pubdate"\s+content="([^"]+)"/i,
    ])
    || new Date().toISOString()
  const imageUrl = extractMetaContent(articleHtml, [
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
  ])

  return {
    title: stripHtml(title || ''),
    link: url,
    guid: url,
    description: description || '',
    summary: description || '',
    content: description || '',
    pubDate: publishedAt,
    isoDate: new Date(publishedAt).toISOString(),
    imageUrl,
    sourceName: source.name,
  }
}

async function parseListingFallback(source) {
  if (!source.fallbackListingUrl) {
    return []
  }

  const html = await fetchFeedXml(source.fallbackListingUrl)
  const matches = [...html.matchAll(/https:\/\/baodautu\.vn\/[^"'\\s>]+-d\d+\.html/g)]
  const urls = [...new Set(matches.map((match) => match[0]))].slice(0, 18)
  const items = []

  for (const url of urls) {
    try {
      const articleHtml = await fetchFeedXml(url)
      items.push(buildFallbackArticle(source, url, articleHtml))
    } catch (_error) {
      continue
    }
  }

  return items
}

function normalizeImageUrl(item) {
  if (item.enclosure?.url) return item.enclosure.url
  if (item.image?.url) return item.image.url

  const description = item.content || item['content:encoded'] || item.summary || item.description || ''
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : null
}

function normalizeArticle(source, item, feedMeta) {
  const descriptionHtml =
    item.content || item['content:encoded'] || item.summary || item.description || item.contentSnippet || ''

  return {
    sourceKey: source.key,
    sourceName: source.name,
    sourceSiteUrl: source.siteUrl,
    sourceCategory: source.category,
    feedTitle: feedMeta.title || source.name,
    feedLink: feedMeta.link || source.rssUrl,
    title: stripHtml(item.title || ''),
    descriptionHtml,
    descriptionText: stripHtml(descriptionHtml),
    articleUrl: item.link || item.guid || null,
    guid: item.guid || item.link || null,
    imageUrl: item.imageUrl || normalizeImageUrl(item),
    authorName: item.creator || item.author || null,
    publishedAt: item.isoDate || item.pubDate || null,
    rawItem: item,
  }
}

function computeEntityContentHash(article) {
  const content = JSON.stringify({
    title: String(article?.title || '').trim(),
    descriptionText: String(article?.descriptionText || article?.description_text || '').trim(),
  })

  return createHash('sha256').update(content).digest('hex')
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, '..', '..', 'sql', 'init.sql')
  const schemaSql = await fs.readFile(schemaPath, 'utf8')
  await query(schemaSql)
  await seedKnownEntities()
}

async function upsertSource(source) {
  const result = await query(
    `
      INSERT INTO rss_sources (
        source_key,
        source_name,
        site_url,
        rss_url,
        category,
        language_code
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_key)
      DO UPDATE SET
        source_name = EXCLUDED.source_name,
        site_url = EXCLUDED.site_url,
        rss_url = EXCLUDED.rss_url,
        category = EXCLUDED.category,
        language_code = EXCLUDED.language_code,
        updated_at = NOW()
      RETURNING id
    `,
    [source.key, source.name, source.siteUrl, source.rssUrl, source.category, source.language],
  )

  return result.rows[0].id
}

async function upsertArticle(sourceId, article) {
  const entityContentHash = computeEntityContentHash(article)
  const result = await query(
    `
      INSERT INTO articles (
        source_id,
        guid,
        article_url,
        title,
        description_html,
        description_text,
        image_url,
        author_name,
        published_at,
        feed_title,
        feed_link,
        raw_payload,
        entity_extracted_hash,
        first_seen_at,
        last_seen_at,
        crawl_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NULL, NOW(), NOW(), 1)
      ON CONFLICT (guid)
      DO UPDATE SET
        article_url = EXCLUDED.article_url,
        title = EXCLUDED.title,
        description_html = EXCLUDED.description_html,
        description_text = EXCLUDED.description_text,
        image_url = EXCLUDED.image_url,
        author_name = EXCLUDED.author_name,
        published_at = EXCLUDED.published_at,
        feed_title = EXCLUDED.feed_title,
        feed_link = EXCLUDED.feed_link,
        raw_payload = EXCLUDED.raw_payload,
        entity_extracted_hash = CASE
          WHEN articles.entity_extracted_hash IS DISTINCT FROM $13 THEN NULL
          ELSE articles.entity_extracted_hash
        END,
        entity_extracted_at = CASE
          WHEN articles.entity_extracted_hash IS DISTINCT FROM $13 THEN NULL
          ELSE articles.entity_extracted_at
        END,
        entity_extraction_source = CASE
          WHEN articles.entity_extracted_hash IS DISTINCT FROM $13 THEN NULL
          ELSE articles.entity_extraction_source
        END,
        last_seen_at = NOW(),
        crawl_count = articles.crawl_count + 1,
        updated_at = NOW()
      RETURNING id, entity_extracted_hash, entity_extracted_at
    `,
    [
      sourceId,
      article.guid,
      article.articleUrl,
      article.title,
      article.descriptionHtml,
      article.descriptionText,
      article.imageUrl,
      article.authorName,
      article.publishedAt,
      article.feedTitle,
      article.feedLink,
      JSON.stringify(article.rawItem),
      entityContentHash,
    ],
  )

  const row = result.rows[0]
  return {
    id: row.id,
    entityContentHash,
    entityAlreadyProcessed: row.entity_extracted_hash === entityContentHash && Boolean(row.entity_extracted_at),
  }
}

async function crawlSingleFeed(source) {
  const sourceId = await upsertSource(source)
  const xml = await fetchFeedXml(source.rssUrl)
  const feed = await parseFeedXml(xml)
  let feedItems = feed.items || []

  if (!feedItems.length && source.fallbackListingUrl) {
    feedItems = await parseListingFallback(source)
  }

  const items = feedItems.map((item) => normalizeArticle(source, item, feed))
  const results = await mapWithConcurrency(items, env.entityExtractionConcurrency, async (article) => {
    if (!article.guid || !article.articleUrl || !article.title) {
      return { stored: 0, skipped: 0 }
    }

    const articleRecord = await upsertArticle(sourceId, article)
    const syncResult = await syncArticleEntitiesForArticle({
      articleId: articleRecord.id,
      article,
      entityContentHash: articleRecord.entityContentHash,
      skipIfUnchanged: articleRecord.entityAlreadyProcessed,
    })

    return {
      stored: 1,
      skipped: syncResult?.skipped ? 1 : 0,
    }
  })

  const storedCount = results.reduce((sum, item) => sum + item.stored, 0)
  const skippedEntityCount = results.reduce((sum, item) => sum + item.skipped, 0)

  await query('UPDATE rss_sources SET last_crawled_at = NOW() WHERE id = $1', [sourceId])

  return {
    sourceKey: source.key,
    sourceName: source.name,
    fetchedCount: items.length,
    storedCount,
    skippedEntityCount,
  }
}

async function crawlAllFeeds() {
  const runs = []

  for (const source of crawlerSources) {
    try {
      const result = await crawlSingleFeed(source)
      runs.push(result)
    } catch (error) {
      runs.push({
        sourceKey: source.key,
        sourceName: source.name,
        fetchedCount: 0,
        storedCount: 0,
        error: error.message,
      })
    }
  }

  return {
    totalSources: runs.length,
    totalStored: runs.reduce((sum, item) => sum + item.storedCount, 0),
    runs,
  }
}

async function listArticles({ limit = 25, sourceKey, search, dateFrom, dateTo } = {}) {
  const cappedLimit = Math.min(Math.max(limit, 1), 500)
  const params = []
  const conditions = []

  if (sourceKey) {
    params.push(sourceKey)
    conditions.push(`s.source_key = $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    conditions.push(
      `(a.title ILIKE $${params.length} OR COALESCE(a.description_text, '') ILIKE $${params.length} OR COALESCE(a.author_name, '') ILIKE $${params.length})`,
    )
  }

  if (dateFrom) {
    params.push(dateFrom)
    conditions.push(`COALESCE(a.published_at, a.created_at) >= $${params.length}`)
  }

  if (dateTo) {
    params.push(dateTo)
    conditions.push(`COALESCE(a.published_at, a.created_at) < $${params.length}`)
  }

  params.push(cappedLimit)

  const result = await query(
    `
      SELECT
        a.id,
        s.source_key,
        s.source_name,
        a.title,
        a.description_text,
        a.article_url,
        a.image_url,
        a.author_name,
        a.published_at,
        a.created_at
      FROM articles a
      JOIN rss_sources s ON s.id = a.source_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
      LIMIT $${params.length}
    `,
    params,
  )

  return result.rows
}

async function listSources() {
  const result = await query(
    `
      SELECT
        id,
        source_key,
        source_name,
        site_url,
        rss_url,
        category,
        language_code,
        last_crawled_at,
        created_at,
        updated_at
      FROM rss_sources
      ORDER BY source_name ASC
    `,
  )

  return result.rows
}

function getCrawlerSources() {
  return crawlerSources
}

module.exports = {
  initializeDatabase,
  crawlAllFeeds,
  listArticles,
  listSources,
  getCrawlerSources,
}
