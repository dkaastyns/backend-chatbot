// ============================================================================
// DPRD Chatbot — Chat Controller (HTTP Request Handlers)
// ============================================================================

import type { Request, Response } from 'express';
import * as chatService from '../services/chat.service';
import { AppError } from '../types/index';
import type { ApiResponse, CreateSessionBody, SendMessageBody, SubmitFeedbackBody } from '../types/index';

/**
 * Helper untuk mengirim respons sukses dengan format konsisten.
 */
function sendSuccess<T>(res: Response, data: T, statusCode = 200, message?: string): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(body);
}

// ---------------------------------------------------------------------------
// Session Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/chat/sessions
 * Membuat sesi percakapan baru.
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateSessionBody;
  const session = await chatService.createSession(body);
  sendSuccess(res, session, 201, 'Sesi percakapan baru berhasil dibuat.');
}

/**
 * GET /api/v1/chat/sessions
 * Mengambil daftar sesi dengan paginasi.
 */
export async function listSessions(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const clientId = req.query.client_id as string | undefined;

  const result = await chatService.listSessions(page, limit, clientId);
  sendSuccess(res, result, 200);
}

/**
 * GET /api/v1/chat/sessions/:sessionId
 * Mengambil detail sesi beserta pesan.
 */
export async function getSessionDetail(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  const detail = await chatService.getSessionDetail(sessionId);
  sendSuccess(res, detail, 200);
}

/**
 * DELETE /api/v1/chat/sessions/:sessionId
 * Menghapus sesi dan semua pesan terkait.
 */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  await chatService.deleteSession(sessionId);
  sendSuccess(res, null, 200, 'Sesi berhasil dihapus.');
}

// ---------------------------------------------------------------------------
// Message Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/chat/sessions/:sessionId/messages
 * Mengirim pesan dan menerima jawaban AI.
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  const body = req.body as SendMessageBody;

  // Validasi input
  if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
    throw new AppError('Field "message" wajib diisi dan tidak boleh kosong.', 400);
  }

  if (body.message.length > 5000) {
    throw new AppError('Pesan terlalu panjang. Maksimal 5000 karakter.', 400);
  }

  const result = await chatService.sendMessage(sessionId, body.message.trim());
  sendSuccess(res, result, 201, 'Pesan berhasil diproses.');
}

// ---------------------------------------------------------------------------
// Feedback Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/chat/messages/:messageId/feedback
 * Mengirim feedback untuk jawaban AI.
 */
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const { messageId } = req.params as { messageId: string };
  const body = req.body as SubmitFeedbackBody;

  // Validasi rating
  if (!body.rating || typeof body.rating !== 'number') {
    throw new AppError('Field "rating" wajib diisi dan harus berupa angka.', 400);
  }

  if (body.rating < 1 || body.rating > 5) {
    throw new AppError('Rating harus bernilai antara 1 hingga 5.', 400);
  }

  const feedback = await chatService.submitFeedback(messageId, body);
  sendSuccess(res, feedback, 201, 'Terima kasih atas feedback Anda.');
}

// ---------------------------------------------------------------------------
// Topic Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/chat/topics
 * Mengambil daftar topik yang didukung.
 */
export async function listTopics(_req: Request, res: Response): Promise<void> {
  const topics = await chatService.listTopics();
  sendSuccess(res, topics, 200);
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/health
 * Health check endpoint.
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const { testConnection } = await import('../config/database');
  const dbConnected = await testConnection();

  const status = {
    status: dbConnected ? 'healthy' : 'degraded',
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    database: dbConnected ? 'connected' : 'disconnected',
    ai_service: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
    timestamp: new Date().toISOString(),
  };

  const httpStatus = dbConnected ? 200 : 503;
  sendSuccess(res, status, httpStatus);
}
