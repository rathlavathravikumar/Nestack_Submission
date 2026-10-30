CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_tag_created_at_idx
  ON articles (lower(tag), created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id text PRIMARY KEY,
  article_slug text NOT NULL REFERENCES articles(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_article_created_at_idx
  ON comments (article_slug, created_at ASC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invalidation_outbox (
  id bigserial PRIMARY KEY,
  article_slug text NOT NULL,
  article_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'engineering';
