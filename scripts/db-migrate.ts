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

async function main() {
  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running migrations.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = path.join(process.cwd(), 'db', 'migrations');
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (exists.rowCount) continue;
      const sql = await fs.readFile(path.join(directory, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
