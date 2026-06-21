// ============================================================================
// DPRD Chatbot — Express Application Factory
// ============================================================================

import express from 'express';
import cors from 'cors';
import { env } from './config/environment';
import { router } from './routes/chat.routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { rateLimiter } from './middlewares/rate-limiter.middleware';
import { logger } from './utils/logger';

// ---------------------------------------------------------------------------
// Create Express App
// ---------------------------------------------------------------------------

const app = express();

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

// CORS — izinkan semua origin untuk deployment Vercel
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-ID'],
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// Body Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
app.use('/api/', rateLimiter);

// Request Logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, 'HTTP');
  next();
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api/v1', router);

// Root endpoint — informasi API
app.get('/', (_req, res) => {
  res.json({
    name: 'DPRD Kota Semarang & Pemerintahan Indonesia — Chatbot API',
    version: '1.0.0',
    description: 'Backend API untuk chatbot yang menjawab pertanyaan seputar DPRD dan Pemerintahan Indonesia.',
    endpoints: {
      health:           'GET    /api/v1/health',
      create_session:   'POST   /api/v1/chat/sessions',
      list_sessions:    'GET    /api/v1/chat/sessions',
      session_detail:   'GET    /api/v1/chat/sessions/:sessionId',
      delete_session:   'DELETE /api/v1/chat/sessions/:sessionId',
      send_message:     'POST   /api/v1/chat/sessions/:sessionId/messages',
      submit_feedback:  'POST   /api/v1/chat/messages/:messageId/feedback',
      list_topics:      'GET    /api/v1/chat/topics',
    },
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Error Handling (harus di akhir setelah semua routes)
// ---------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
