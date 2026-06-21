// ============================================================================
// DPRD Kota Semarang & Pemerintahan Indonesia — Chatbot Backend
// ============================================================================
// Entry Point — Menginisialisasi database, memulai Express server,
// dan menangani graceful shutdown.
// ============================================================================

import { app } from './src/app';
import { env } from './src/config/environment';
import { testConnection, closePool } from './src/config/database';
import { logger } from './src/utils/logger';

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏛️  DPRD Chatbot API — Pemerintahan Indonesia              ║
║   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━               ║
║   Chatbot khusus DPRD Kota Semarang &                        ║
║   Pemerintahan Republik Indonesia                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  console.log(BANNER);

  logger.info('Memulai server...', 'Bootstrap');
  logger.info(`Environment: ${env.NODE_ENV}`, 'Bootstrap');

  // 1. Test database connection
  logger.info('Menguji koneksi database...', 'Bootstrap');
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error(
      'Gagal terhubung ke database. Pastikan DATABASE_URL di .env sudah benar.',
      'Bootstrap',
    );
    process.exit(1);
  }

  // 2. Start Express server
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server berjalan di http://localhost:${env.PORT}`, 'Bootstrap');
    logger.info(`📡 API endpoint: http://localhost:${env.PORT}/api/v1`, 'Bootstrap');
    logger.info(`💚 Health check: http://localhost:${env.PORT}/api/v1/health`, 'Bootstrap');
    logger.info(`🤖 AI Model: ${env.AI_MODEL}`, 'Bootstrap');
  });

  // 3. Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} diterima — memulai graceful shutdown...`, 'Bootstrap');

    server.close(async () => {
      logger.info('HTTP server ditutup', 'Bootstrap');
      await closePool();
      logger.info('Semua koneksi ditutup. Selamat tinggal! 👋', 'Bootstrap');
      process.exit(0);
    });

    // Force shutdown setelah 10 detik
    setTimeout(() => {
      logger.error('Timeout! Force shutdown...', 'Bootstrap');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error('Kesalahan fatal saat startup', 'Bootstrap', error);
  process.exit(1);
});