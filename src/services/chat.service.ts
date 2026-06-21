// ============================================================================
// DPRD Chatbot — Chat Service (Business Logic)
// ============================================================================

import { query, transaction } from '../config/database';
import { generateAIResponse } from './ai.service';
import { logger } from '../utils/logger';
import { AppError } from '../types/index';
import type {
  Session,
  Message,
  Feedback,
  Topic,
  SessionDetail,
  ChatReply,
  PaginatedResponse,
  AIContent,
  CreateSessionBody,
  SubmitFeedbackBody,
} from '../types/index';

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Membuat sesi percakapan baru.
 */
export async function createSession(body: CreateSessionBody = {} as CreateSessionBody): Promise<Session> {
  const { title, client_id, topic_id } = body || {};

  const result = await query<Session>(
    `INSERT INTO sessions (title, client_id, topic_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [
      title || 'Percakapan Baru',
      client_id || null,
      topic_id || null,
    ],
  );

  const session = result.rows[0]!;
  logger.info(`Sesi baru dibuat: ${session.id}`, 'ChatService');
  return session;
}

/**
 * Mengambil daftar sesi dengan paginasi.
 */
export async function listSessions(
  page = 1,
  limit = 20,
  clientId?: string,
): Promise<PaginatedResponse<Session>> {
  const offset = (page - 1) * limit;

  // Hitung total
  const countQuery = clientId
    ? 'SELECT COUNT(*) FROM sessions WHERE client_id = $1'
    : 'SELECT COUNT(*) FROM sessions';
  const countParams = clientId ? [clientId] : [];
  const countResult = await query<{ count: string }>(countQuery, countParams);
  const total = parseInt(countResult.rows[0]!.count, 10);

  // Ambil data
  const dataQuery = clientId
    ? `SELECT * FROM sessions WHERE client_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`
    : `SELECT * FROM sessions ORDER BY updated_at DESC LIMIT $1 OFFSET $2`;
  const dataParams = clientId
    ? [clientId, limit, offset]
    : [limit, offset];
  const dataResult = await query<Session>(dataQuery, dataParams);

  return {
    items: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mengambil detail sesi beserta semua pesan dan topik.
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  // Ambil sesi
  const sessionResult = await query<Session>(
    'SELECT * FROM sessions WHERE id = $1',
    [sessionId],
  );

  if (sessionResult.rows.length === 0) {
    throw new AppError(`Sesi dengan ID "${sessionId}" tidak ditemukan.`, 404);
  }

  const session = sessionResult.rows[0]!;

  // Ambil pesan
  const messagesResult = await query<Message>(
    'SELECT * FROM messages WHERE session_id = $1 ORDER BY sequence_number ASC',
    [sessionId],
  );

  // Ambil topik jika ada
  let topic: Topic | null = null;
  if (session.topic_id) {
    const topicResult = await query<Topic>(
      'SELECT * FROM topics WHERE id = $1',
      [session.topic_id],
    );
    topic = topicResult.rows[0] ?? null;
  }

  return {
    ...session,
    messages: messagesResult.rows,
    topic,
  };
}

/**
 * Menghapus sesi beserta semua pesan terkait.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const result = await query(
    'DELETE FROM sessions WHERE id = $1 RETURNING id',
    [sessionId],
  );

  if (result.rowCount === 0) {
    throw new AppError(`Sesi dengan ID "${sessionId}" tidak ditemukan.`, 404);
  }

  logger.info(`Sesi dihapus: ${sessionId}`, 'ChatService');
}

// ---------------------------------------------------------------------------
// Messages — Kirim Pesan & Terima Jawaban AI
// ---------------------------------------------------------------------------

/**
 * Mengirim pesan pengguna, memproses melalui AI, dan menyimpan keduanya.
 * Ini adalah fungsi utama chatbot.
 */
export async function sendMessage(
  sessionId: string,
  userMessageText: string,
): Promise<ChatReply> {
  // 1. Validasi sesi
  const sessionResult = await query<Session>(
    'SELECT * FROM sessions WHERE id = $1',
    [sessionId],
  );

  if (sessionResult.rows.length === 0) {
    throw new AppError(`Sesi dengan ID "${sessionId}" tidak ditemukan.`, 404);
  }

  // 2. Ambil riwayat pesan untuk konteks AI (maks 20 pesan terakhir)
  const historyResult = await query<Message>(
    `SELECT role, content FROM messages
     WHERE session_id = $1
     ORDER BY sequence_number ASC
     LIMIT 20`,
    [sessionId],
  );

  const historyContext: AIContent[] = historyResult.rows.map((msg) => ({
    role: msg.role as 'user' | 'model',
    parts: [{ text: msg.content }],
  }));

  // 3. Tentukan sequence number berikutnya
  const seqResult = await query<{ max_seq: number | null }>(
    'SELECT MAX(sequence_number) AS max_seq FROM messages WHERE session_id = $1',
    [sessionId],
  );
  let nextSeq = (seqResult.rows[0]?.max_seq ?? 0) + 1;

  // 4. Kirim ke AI dan simpan hasilnya dalam transaksi
  const result = await transaction(async (client) => {
    // Simpan pesan user
    const userMsgResult = await client.query<Message>(
      `INSERT INTO messages (session_id, role, content, sequence_number)
       VALUES ($1, 'user', $2, $3)
       RETURNING *`,
      [sessionId, userMessageText, nextSeq],
    );
    const userMessage = userMsgResult.rows[0]!;
    nextSeq++;

    // Kirim ke AI (Gemini / OpenRouter / Auto-fallback)
    const aiResult = await generateAIResponse(userMessageText, historyContext);

    // Simpan respons AI
    const aiMsgResult = await client.query<Message>(
      `INSERT INTO messages (session_id, role, content, sequence_number, processing_ms)
       VALUES ($1, 'model', $2, $3, $4)
       RETURNING *`,
      [sessionId, aiResult.text, nextSeq, aiResult.processingMs],
    );
    const aiResponse = aiMsgResult.rows[0]!;

    // Update judul sesi jika ini adalah pesan pertama
    if (nextSeq === 2) {
      const autoTitle = userMessageText.length > 60
        ? userMessageText.substring(0, 57) + '...'
        : userMessageText;
      await client.query(
        `UPDATE sessions SET title = $1 WHERE id = $2 AND title = 'Percakapan Baru'`,
        [autoTitle, sessionId],
      );
    }

    return {
      user_message: userMessage,
      ai_response: aiResponse,
      processing_ms: aiResult.processingMs,
      provider: aiResult.provider,
    };
  });

  logger.info(
    `Pesan diproses untuk sesi ${sessionId} dalam ${result.processing_ms}ms`,
    'ChatService',
  );

  return result;
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/**
 * Menyimpan feedback pengguna untuk sebuah pesan AI.
 */
export async function submitFeedback(
  messageId: string,
  body: SubmitFeedbackBody,
): Promise<Feedback> {
  // Validasi pesan ada dan merupakan respons AI
  const msgResult = await query<Message>(
    "SELECT * FROM messages WHERE id = $1 AND role = 'model'",
    [messageId],
  );

  if (msgResult.rows.length === 0) {
    throw new AppError(
      'Pesan tidak ditemukan atau bukan merupakan respons AI. Feedback hanya bisa diberikan untuk jawaban AI.',
      404,
    );
  }

  const message = msgResult.rows[0]!;

  // Validasi rating
  if (body.rating < 1 || body.rating > 5) {
    throw new AppError('Rating harus bernilai antara 1 hingga 5.', 400);
  }

  // Simpan feedback (upsert — satu feedback per pesan)
  const result = await query<Feedback>(
    `INSERT INTO feedback (message_id, session_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (message_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
     RETURNING *`,
    [messageId, message.session_id, body.rating, body.comment || null],
  );

  logger.info(
    `Feedback diterima untuk pesan ${messageId}: ${body.rating}/5`,
    'ChatService',
  );

  return result.rows[0]!;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/**
 * Mengambil daftar semua topik yang aktif.
 */
export async function listTopics(): Promise<Topic[]> {
  const result = await query<Topic>(
    'SELECT * FROM topics WHERE is_active = TRUE ORDER BY display_order ASC',
  );
  return result.rows;
}
