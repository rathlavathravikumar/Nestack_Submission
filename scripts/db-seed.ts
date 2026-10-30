import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadLocalEnvironment() {
  try {
    const contents = fsSync.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* Environment can be supplied by the shell instead. */ }
}

interface SeedData {
  articles: { id: string; slug: string; title: string; body: string; tag: string; createdAt: string }[];
  comments: { id: string; articleSlug: string; author: string; content: string; createdAt: string }[];
}

async function main() {
  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before importing seed data.');
  const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'db.json'), 'utf8')) as SeedData;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const article of data.articles) {
      await client.query(
        `INSERT INTO articles (id, slug, title, body, tag, created_at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, tag = EXCLUDED.tag`,
        [article.id, article.slug, article.title, article.body, article.tag, article.createdAt]
      );
    }
    for (const comment of data.comments) {
      await client.query(
        `INSERT INTO comments (id, article_slug, author, content, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET author = EXCLUDED.author, content = EXCLUDED.content`,
        [comment.id, comment.articleSlug, comment.author, comment.content, comment.createdAt]
      );
    }
    await client.query('COMMIT');
    console.log(`Imported ${data.articles.length} articles and ${data.comments.length} comments.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
