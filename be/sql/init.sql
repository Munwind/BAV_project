CREATE TABLE IF NOT EXISTS rss_sources (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  site_url TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  category TEXT,
  language_code TEXT DEFAULT 'vi',
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  guid TEXT NOT NULL UNIQUE,
  article_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description_html TEXT,
  description_text TEXT,
  image_url TEXT,
  author_name TEXT,
  published_at TIMESTAMPTZ,
  feed_title TEXT,
  feed_link TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
