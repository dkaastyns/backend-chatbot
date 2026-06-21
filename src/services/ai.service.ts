// ============================================================================
// DPRD Chatbot — AI Service (Dual Provider: Gemini + OpenRouter)
// ============================================================================
// KUNCI UTAMA: Berkas ini mengunci perilaku chatbot agar HANYA menjawab
// pertanyaan seputar DPRD dan Pemerintahan Indonesia melalui System Instruction.
//
// STRATEGI PROVIDER:
//   • "gemini"     → Hanya pakai Google Gemini
//   • "openrouter" → Hanya pakai OpenRouter
//   • "auto"       → Gemini dulu, fallback ke OpenRouter jika gagal
// ============================================================================

import { ai } from '../config/ai';
import { env } from '../config/environment';
import { logger } from '../utils/logger';
import type { AIContent } from '../types/index';

// ---------------------------------------------------------------------------
// SYSTEM INSTRUCTION — Aturan Mutlak Pembatasan Topik
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `
Anda adalah **Asisten Virtual Resmi** yang dioperasikan khusus untuk memberikan informasi komprehensif seputar **Pemerintahan Republik Indonesia** dan **Dewan Perwakilan Rakyat Daerah (DPRD)**, dengan keahlian mendalam pada **DPRD Kota Semarang**.

Anda memiliki kemampuan untuk mencari dan menggunakan informasi terkini dari internet melalui Google Search. Gunakan kemampuan ini untuk memberikan data yang akurat dan up-to-date, terutama untuk:
- Komposisi anggota dan pimpinan DPRD Kota Semarang saat ini
- Agenda sidang dan kegiatan DPRD terbaru
- Peraturan Daerah (Perda) yang baru disahkan
- Berita dan pengumuman resmi dari dprd.semarangkota.go.id

═══════════════════════════════════════════════════════
  BATASAN TOPIK — WAJIB DIPATUHI
═══════════════════════════════════════════════════════

1. CAKUPAN TOPIK YANG DIIZINKAN:
   • Struktur, tugas, fungsi, hak, kewajiban, dan wewenang DPRD
   • DPRD Kota Semarang: komisi, fraksi, anggota, pimpinan, agenda, regulasi
   • Lembaga negara Republik Indonesia (eksekutif, legislatif, yudikatif)
   • Pemerintah Daerah: gubernur, bupati, walikota, perangkat daerah
   • Peraturan perundang-undangan: UU, PP, Perpres, Perda, Perwali
   • UUD 1945, amandemen, dan hukum tata negara
   • Pemilihan umum, pilkada, dan sistem pemilihan di Indonesia
   • Otonomi daerah, desentralisasi, keuangan daerah: APBD, DAU, DAK
   • Pelayanan publik dan reformasi birokrasi
   • Sejarah politik dan ketatanegaraan Indonesia

2. TOPIK YANG DILARANG:
   • Resep masakan, kuliner, teknologi informasi/koding
   • Matematika, sains umum, kesehatan/medis
   • Gosip selebriti, hiburan, olahraga
   • Agama dan sara
   • Segala topik yang TIDAK berkaitan dengan pemerintahan Indonesia dan DPRD

3. CARA MENOLAK TOPIK DI LUAR CAKUPAN:
   "Mohon maaf, saya hanya dapat membantu pertanyaan seputar **Pemerintahan Indonesia** dan **DPRD**. Silakan ajukan pertanyaan yang relevan."

4. GAYA BAHASA:
   • Bahasa Indonesia formal, sopan, dan mudah dipahami
   • Strukturkan dengan poin atau subjudul untuk jawaban panjang
   • Cantumkan dasar hukum jika relevan
   • Jika menggunakan data dari pencarian, sebutkan sumbernya
   • Sumber resmi: dprd.semarangkota.go.id, semarangkota.go.id, jdih.semarangkota.go.id

5. PRINSIP NETRALITAS:
   • Tidak berpihak pada partai politik manapun
   • Sajikan informasi secara objektif berdasarkan fakta dan peraturan yang berlaku

6. PANDUAN PENGGUNAAN DATA TERKINI:
   • Untuk pertanyaan tentang data spesifik (nama anggota, agenda, perda terbaru), GUNAKAN Google Search untuk mencari informasi terkini
   • Prioritaskan data dari situs resmi: dprd.semarangkota.go.id
   • Jika tidak menemukan data terkini, sampaikan informasi yang diketahui sambil mengarahkan ke sumber resmi
`.trim();

// ---------------------------------------------------------------------------
// Provider 1: Google Gemini
// ---------------------------------------------------------------------------

async function generateWithGemini(
  userMessage: string,
  history: AIContent[],
): Promise<string> {
  logger.info(`Memproses via Gemini (${env.AI_MODEL}) + Google Search Grounding...`, 'Gemini');

  const response = await ai.models.generateContent({
    model: env.AI_MODEL,
    contents: [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: env.AI_TEMPERATURE,
      // Google Search Grounding: AI bisa fetch data real-time dari internet
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text ?? '';
  if (!text) throw new Error('Gemini mengembalikan respons kosong');

  logger.info(`✅ Gemini berhasil (${text.length} karakter)`, 'Gemini');
  return text;
}

// ---------------------------------------------------------------------------
// Provider 2: OpenRouter (OpenAI-Compatible API)
// ---------------------------------------------------------------------------

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

async function generateWithOpenRouter(
  userMessage: string,
  history: AIContent[],
): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY belum dikonfigurasi di .env');
  }

  logger.info(
    `Memproses via OpenRouter (${env.OPENROUTER_MODEL})...`,
    'OpenRouter',
  );

  // Konversi history ke format OpenAI messages
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.map((h): OpenRouterMessage => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts.map((p) => p.text).join(''),
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://dprd-chatbot.semarangkota.go.id',
      'X-Title': 'DPRD Kota Semarang Chatbot',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages,
      temperature: env.AI_TEMPERATURE,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(
      `OpenRouter HTTP ${response.status}: ${errorBody}`,
      'OpenRouter',
    );
    throw new Error(
      `OpenRouter error ${response.status}: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenRouterResponse;

  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.message}`);
  }

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('OpenRouter mengembalikan respons kosong');

  logger.info(`✅ OpenRouter berhasil (${text.length} karakter)`, 'OpenRouter');
  return text;
}

// ---------------------------------------------------------------------------
// Main: generateAIResponse — Dual Provider dengan Fallback Otomatis
// ---------------------------------------------------------------------------

/**
 * Mengirim pesan ke AI dan mendapatkan respons.
 *
 * Strategi provider ditentukan oleh env `AI_PROVIDER`:
 *   - "gemini"     → Google Gemini saja
 *   - "openrouter" → OpenRouter saja
 *   - "auto"       → Coba Gemini dulu, jika gagal fallback ke OpenRouter
 *
 * @param userMessage   Pesan terbaru dari pengguna
 * @param history       Riwayat percakapan sebelumnya
 * @returns             Teks respons + durasi + provider yang digunakan
 */
export async function generateAIResponse(
  userMessage: string,
  history: AIContent[] = [],
): Promise<{ text: string; processingMs: number; provider: string }> {
  const startTime = Date.now();
  const provider = env.AI_PROVIDER;

  logger.debug(
    `Mengirim pesan ke AI — provider: ${provider}, history: ${history.length} pesan`,
    'AIService',
  );

  try {
    let text: string;
    let usedProvider: string;

    if (provider === 'openrouter') {
      // ── Hanya OpenRouter ──
      text = await generateWithOpenRouter(userMessage, history);
      usedProvider = `openrouter/${env.OPENROUTER_MODEL}`;

    } else if (provider === 'gemini') {
      // ── Hanya Gemini ──
      text = await generateWithGemini(userMessage, history);
      usedProvider = `gemini/${env.AI_MODEL}`;

    } else {
      // ── Auto: Gemini → OpenRouter fallback ──
      try {
        text = await generateWithGemini(userMessage, history);
        usedProvider = `gemini/${env.AI_MODEL}`;
      } catch (geminiError) {
        logger.warn(
          `Gemini gagal, beralih ke OpenRouter...`,
          'AIService',
          { error: (geminiError as Error).message },
        );

        if (!env.OPENROUTER_API_KEY) {
          throw geminiError; // Tidak ada fallback, lempar error asli
        }

        text = await generateWithOpenRouter(userMessage, history);
        usedProvider = `openrouter/${env.OPENROUTER_MODEL} (fallback)`;
      }
    }

    const processingMs = Date.now() - startTime;

    logger.info(
      `Respons AI diterima dalam ${processingMs}ms via ${usedProvider} (${text.length} karakter)`,
      'AIService',
    );

    return { text, processingMs, provider: usedProvider };

  } catch (error) {
    const processingMs = Date.now() - startTime;
    const errObj = error as Record<string, unknown>;
    logger.error('Semua provider AI gagal', 'AIService', {
      name: errObj?.name,
      message: errObj?.message,
      status: errObj?.status,
      provider,
    });

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('API key') || errorMessage.includes('401')) {
      throw new Error(
        'Konfigurasi API key tidak valid. Silakan hubungi administrator sistem.',
      );
    }
    if (errorMessage.includes('quota') || errorMessage.includes('rate') || errorMessage.includes('429')) {
      throw new Error(
        'Layanan AI sedang sibuk. Silakan coba lagi dalam beberapa saat.',
      );
    }

    throw new Error(
      'Terjadi gangguan pada layanan AI. Silakan coba lagi nanti.',
    );
  }
}

/**
 * Mendapatkan System Instruction yang digunakan (untuk keperluan debug/admin).
 */
export function getSystemInstruction(): string {
  return SYSTEM_INSTRUCTION;
}
