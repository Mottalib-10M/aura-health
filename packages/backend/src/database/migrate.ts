import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Configuration — read directly from env to avoid pulling in the full config
// module (which has strict validation that may fail in migration-only context)
// ---------------------------------------------------------------------------
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DB_PORT ?? 5432);
const DB_NAME = process.env.DB_NAME ?? 'uzavita';
const DB_USER = process.env.DB_USER ?? 'uzavita';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';

const MIGRATIONS_DIR = path.join(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), 'migrations');

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === 'production';

const pool = new pg.Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ...(isProd && { ssl: { rejectUnauthorized: false } }),
});

// ---------------------------------------------------------------------------
// Ensure the _migrations tracking table exists
// ---------------------------------------------------------------------------
async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(512) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ---------------------------------------------------------------------------
// Get list of already-applied migrations
// ---------------------------------------------------------------------------
async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query(`SELECT filename FROM _migrations ORDER BY filename`);
  return new Set(result.rows.map((r) => r.filename as string));
}

// ---------------------------------------------------------------------------
// Read available SQL migration files from disk (sorted alphabetically)
// ---------------------------------------------------------------------------
function getAvailableMigrations(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// ---------------------------------------------------------------------------
// Apply a single migration inside a transaction
// ---------------------------------------------------------------------------
async function applyMigration(filename: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      `INSERT INTO _migrations (filename) VALUES ($1)`,
      [filename],
    );
    await client.query('COMMIT');
    console.log(`  Applied: ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  FAILED:  ${filename}`);
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function up(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const available = getAvailableMigrations();
  const pending = available.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('All migrations are up to date.');
    return;
  }

  console.log(`Applying ${pending.length} pending migration(s)...`);
  for (const filename of pending) {
    await applyMigration(filename);
  }
  console.log('Done.');
}

async function status(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const available = getAvailableMigrations();

  console.log('Migration status:');
  console.log('─'.repeat(60));

  for (const filename of available) {
    const state = applied.has(filename) ? 'APPLIED' : 'PENDING';
    console.log(`  [${state}]  ${filename}`);
  }

  const pendingCount = available.filter((f) => !applied.has(f)).length;
  console.log('─'.repeat(60));
  console.log(`Total: ${available.length} | Applied: ${applied.size} | Pending: ${pendingCount}`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';

  try {
    switch (command) {
      case 'up':
        await up();
        break;
      case 'status':
        await status();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: npx tsx src/database/migrate.ts [up|status]');
        process.exit(1);
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
