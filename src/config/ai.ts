// ============================================================================
// DPRD Chatbot — Google Gemini AI Client Configuration
// ============================================================================

import { GoogleGenAI } from '@google/genai';
import { env } from './environment';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Singleton AI Client
// ---------------------------------------------------------------------------

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

logger.info(`AI client diinisialisasi — model default: ${env.AI_MODEL}`, 'AI');

export { ai };
