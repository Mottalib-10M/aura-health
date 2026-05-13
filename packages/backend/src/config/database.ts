import pg from 'pg';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------
export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  // In production, enable SSL
  ...(config.server.isProd && {
    ssl: { rejectUnauthorized: true },
  }),
});

// Log pool-level events
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

// ---------------------------------------------------------------------------
// Helper: run a parameterized query and return the rows
// ---------------------------------------------------------------------------
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = performance.now();
  try {
    const result = await pool.query<T>(text, params);
    const durationMs = Math.round(performance.now() - start);
    logger.debug({ query: text.slice(0, 120), durationMs, rows: result.rowCount }, 'SQL query executed');
    return result;
  } catch (err) {
    logger.error({ err, query: text.slice(0, 120) }, 'SQL query failed');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helper: run inside an explicit transaction
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown helper
// ---------------------------------------------------------------------------
export async function closeDatabasePool(): Promise<void> {
  logger.info('Closing PostgreSQL connection pool');
  await pool.end();
}
