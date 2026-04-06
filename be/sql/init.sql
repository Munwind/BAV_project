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
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  crawl_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE articles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE articles ADD COLUMN IF NOT EXISTS crawl_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

CREATE TABLE IF NOT EXISTS entities (
  id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL DEFAULT 'company',
  industry TEXT,
  ticker TEXT,
  source_mode TEXT NOT NULL DEFAULT 'extracted',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id BIGSERIAL PRIMARY KEY,
  entity_id BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source_mode TEXT NOT NULL DEFAULT 'seed',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, normalized_alias)
);

ALTER TABLE entity_aliases ADD COLUMN IF NOT EXISTS source_mode TEXT NOT NULL DEFAULT 'seed';
ALTER TABLE entity_aliases ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000;

CREATE TABLE IF NOT EXISTS article_entities (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  entity_id BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  mention_count INTEGER NOT NULL DEFAULT 1,
  sentiment_signal INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_ticker ON entities(ticker);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_normalized_alias ON entity_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_article_entities_entity_id ON article_entities(entity_id);
