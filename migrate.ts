// ============================================================================
// DPRD Chatbot — Database Migration Runner
// ============================================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL belum diatur di file .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    console.log('🔌 Menghubungkan ke database...');
    const client = await pool.connect();
    console.log('✅ Terhubung ke database.\n');

    // Baca file migrasi
    const migrationPath = resolve(import.meta.dirname ?? '.', 'migrations', '001_initial_schema.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Menjalankan migrasi: 001_initial_schema.sql');
    console.log('━'.repeat(50));

    await client.query(sql);

    console.log('━'.repeat(50));
    console.log('✅ Migrasi berhasil dijalankan!\n');

    // Verifikasi tabel
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📋 Tabel yang tersedia:');
    for (const row of tablesResult.rows) {
      console.log(`   • ${row.table_name}`);
    }

    // Verifikasi topics seed data
    const topicsResult = await client.query('SELECT COUNT(*) AS count FROM topics');
    console.log(`\n🏷️  Topik yang di-seed: ${topicsResult.rows[0]?.count} topik`);

    client.release();
    console.log('\n🎉 Database siap digunakan!');
  } catch (error) {
    console.error('\n❌ Migrasi gagal:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
