import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pool } from './database';

export interface Article {
  id: string;
  slug: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  articleSlug: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface InvalidationRecord {
  id: number;
  articleSlug: string;
  articleId: string;
  createdAt: string;
}

interface LocalDatabase {
  articles: Article[];
  comments: Comment[];
  metrics?: { rawDbReads: number; rawDbWrites: number };
}

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  tag: string;
  created_at: Date | string;
}

interface CommentRow {
  id: string;
  article_slug: string;
  author: string;
  content: string;
  created_at: Date | string;
}

function toArticle(row: ArticleRow): Article {
  return { id: row.id, slug: row.slug, title: row.title, body: row.body, tag: row.tag, createdAt: new Date(row.created_at).toISOString() };
}

function toComment(row: CommentRow): Comment {
  return { id: row.id, articleSlug: row.article_slug, author: row.author, content: row.content, createdAt: new Date(row.created_at).toISOString() };
}

const dataFile = path.join(process.cwd(), 'data', 'db.json');
let localData: LocalDatabase | undefined;

function localDb(): LocalDatabase {
  if (localData) return localData;
  localData = JSON.parse(fs.readFileSync(dataFile, 'utf8')) as LocalDatabase;
  localData.metrics ??= { rawDbReads: 0, rawDbWrites: 0 };
  return localData;
}

const isPostgres = Boolean(process.env.DATABASE_URL);

function postgres() {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return pool;
}

export const db = {
  async getArticlesRaw(tagFilter?: string): Promise<Article[]> {
    if (isPostgres) {
      const result = tagFilter
        ? await postgres().query<ArticleRow>('SELECT * FROM articles WHERE lower(tag) = lower($1) ORDER BY created_at DESC', [tagFilter])
        : await postgres().query<ArticleRow>('SELECT * FROM articles ORDER BY created_at DESC');
      return result.rows.map(toArticle);
    }
    const data = localDb();
    data.metrics!.rawDbReads += 1;
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    return (tagFilter ? data.articles.filter((article) => article.tag.toLowerCase() === tagFilter.toLowerCase()) : data.articles).map((article) => ({ ...article }));
  },

  async getArticleBySlugRaw(slug: string): Promise<Article | null> {
    if (isPostgres) {
      const result = await postgres().query<ArticleRow>('SELECT * FROM articles WHERE slug = $1 LIMIT 1', [slug]);
      return result.rows[0] ? toArticle(result.rows[0]) : null;
    }
    const local = localDb();
    local.metrics!.rawDbReads += 1;
    fs.writeFileSync(dataFile, JSON.stringify(local, null, 2), 'utf8');
    const article = local.articles.find((item) => item.slug === slug);
    return article ? { ...article } : null;
  },

  async insertArticleRaw(article: Omit<Article, 'id' | 'createdAt'>): Promise<Article> {
    const id = `art-${randomUUID()}`;
    if (isPostgres) {
      const result = await postgres().query<ArticleRow>(
        'INSERT INTO articles (id, slug, title, body, tag) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [id, article.slug, article.title, article.body, article.tag]
      );
      return toArticle(result.rows[0]);
    }
    const data = localDb();
    if (data.articles.some((item) => item.slug === article.slug)) throw new Error('An article with this URL already exists.');
    const saved = { ...article, id, createdAt: new Date().toISOString() };
    data.articles.unshift(saved);
    data.metrics!.rawDbWrites += 1;
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    return saved;
  },

  async getCommentsForArticleRaw(slug: string): Promise<Comment[]> {
    if (isPostgres) {
      const result = await postgres().query<CommentRow>('SELECT * FROM comments WHERE article_slug = $1 ORDER BY created_at ASC', [slug]);
      return result.rows.map(toComment);
    }
    return localDb().comments.filter((comment) => comment.articleSlug === slug).map((comment) => ({ ...comment }));
  },

  async getMetricsRaw(): Promise<{ rawDbReads: number; rawDbWrites: number }> {
    if (isPostgres) {
      return { rawDbReads: 0, rawDbWrites: 0 };
    }
    return { ...(localDb().metrics ?? { rawDbReads: 0, rawDbWrites: 0 }) };
  },

  async enqueueInvalidationRaw(articleSlug: string, articleId: string): Promise<void> {
    if (isPostgres) {
      await postgres().query('INSERT INTO invalidation_outbox (article_slug, article_id) VALUES ($1, $2)', [articleSlug, articleId]);
      return;
    }
    const data = localDb() as LocalDatabase & { invalidationOutbox?: InvalidationRecord[] };
    data.invalidationOutbox ??= [];
    data.invalidationOutbox.unshift({ id: Date.now(), articleSlug, articleId, createdAt: new Date().toISOString() });
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
  },

  async resolveInvalidationsRaw(articleSlug?: string): Promise<void> {
    if (isPostgres) {
      await postgres().query('UPDATE invalidation_outbox SET resolved_at = now() WHERE resolved_at IS NULL AND ($1::text IS NULL OR article_slug = $1)', [articleSlug ?? null]);
      return;
    }
    const data = localDb() as LocalDatabase & { invalidationOutbox?: (InvalidationRecord & { resolvedAt?: string })[] };
    for (const entry of data.invalidationOutbox ?? []) {
      if (!entry.resolvedAt && (!articleSlug || entry.articleSlug === articleSlug)) entry.resolvedAt = new Date().toISOString();
    }
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
  },
};
