import 'server-only';
import { Pool } from 'pg';

const globalForPostgres = globalThis as typeof globalThis & { postgresPool?: Pool };

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when PostgreSQL storage is enabled.');
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_SIZE || 5),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

export const pool = process.env.DATABASE_URL
  ? globalForPostgres.postgresPool ?? createPool()
  : undefined;

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.postgresPool = pool;
}
