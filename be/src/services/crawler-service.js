const fs = require('fs/promises')
const path = require('path')
const Parser = require('rss-parser')
const { decode } = require('he')
const crawlerSources = require('../config/crawler-sources')
const { query } = require('../db')

const parser = new Parser({
  headers: {
    'User-Agent': 'SentimentXBot/1.0 (+https://sentimentx.local)',
  },
})

function stripHtml(value = '') {
  return decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
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
    imageUrl: normalizeImageUrl(item),
    authorName: item.creator || item.author || null,
    publishedAt: item.isoDate || item.pubDate || null,
    rawItem: item,
  }
}

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, '..', '..', 'sql', 'init.sql')
  const schemaSql = await fs.readFile(schemaPath, 'utf8')
  await query(schemaSql)
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
  await query(
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
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
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
        updated_at = NOW()
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
    ],
  )
}

async function crawlSingleFeed(source) {
  const sourceId = await upsertSource(source)
  const feed = await parser.parseURL(source.rssUrl)
  const items = (feed.items || []).map((item) => normalizeArticle(source, item, feed))
  let storedCount = 0

  for (const article of items) {
    if (!article.guid || !article.articleUrl || !article.title) {
      continue
    }

    await upsertArticle(sourceId, article)
    storedCount += 1
  }

  await query('UPDATE rss_sources SET last_crawled_at = NOW() WHERE id = $1', [sourceId])

  return {
    sourceKey: source.key,
    sourceName: source.name,
    fetchedCount: items.length,
    storedCount,
  }
}

async function crawlAllFeeds() {
  const runs = []

  for (const source of crawlerSources) {
    const result = await crawlSingleFeed(source)
    runs.push(result)
  }

  return {
    totalSources: runs.length,
    totalStored: runs.reduce((sum, item) => sum + item.storedCount, 0),
    runs,
  }
}

async function listArticles({ limit = 25, sourceKey } = {}) {
  const cappedLimit = Math.min(Math.max(limit, 1), 100)

  if (sourceKey) {
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
        WHERE s.source_key = $1
        ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
        LIMIT $2
      `,
      [sourceKey, cappedLimit],
    )

    return result.rows
  }

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
      ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
      LIMIT $1
    `,
    [cappedLimit],
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
