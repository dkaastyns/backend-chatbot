// ============================================================================
// DPRD Chatbot — PostgreSQL Database Connection
// ============================================================================

import pg from 'pg';
import { env } from './environment';
import { logger } from '../utils/logger';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Connection Pool
// ---------------------------------------------------------------------------

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  // Serverless-friendly: pool kecil agar tidak melebihi batas koneksi Neon DB
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});

pool.on('connect', () => {
  logger.debug('Koneksi baru ke database dibuat', 'Database');
});

pool.on('error', (err) => {
  logger.error('Kesalahan tak terduga pada koneksi database', 'Database', err.message);
});

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query selesai dalam ${duration}ms — ${result.rowCount} baris`, 'Database');
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Query gagal setelah ${duration}ms`, 'Database', { text, error });
    throw error;
  }
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Menjalankan serangkaian operasi dalam satu transaksi database.
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Connection Test
// ---------------------------------------------------------------------------

export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW() AS server_time');
    logger.info(
      `Database terhubung — waktu server: ${result.rows[0]?.server_time}`,
      'Database',
    );
    return true;
  } catch (error) {
    logger.error('Gagal terhubung ke database', 'Database', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

export async function closePool(): Promise<void> {
  logger.info('Menutup koneksi database pool...', 'Database');
  await pool.end();
}

export { pool };
