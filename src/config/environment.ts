// ============================================================================
// DPRD Chatbot — Environment Variable Validation
// ============================================================================

import 'dotenv/config';

interface EnvironmentVariables {
  // Required
  GEMINI_API_KEY: string;
  DATABASE_URL: string;

  // OpenRouter (Backup AI)
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  OPENROUTER_BASE_URL: string;

  // AI Provider Strategy
  AI_PROVIDER: 'gemini' | 'openrouter' | 'auto';

  // Optional with defaults
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  AI_MODEL: string;
  AI_TEMPERATURE: number;
  CORS_ORIGIN: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Variabel lingkungan "${key}" wajib diisi. ` +
      `Silakan periksa file .env Anda. Lihat .env.example sebagai referensi.`
    );
  }
  return value.trim();
}

function getOptionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function parseIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function parseFloatEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? fallback : parsed;
}

export const env: EnvironmentVariables = {
  GEMINI_API_KEY:           getRequiredEnv('GEMINI_API_KEY'),
  DATABASE_URL:             getRequiredEnv('DATABASE_URL'),

  // OpenRouter
  OPENROUTER_API_KEY:       getOptionalEnv('OPENROUTER_API_KEY', ''),
  OPENROUTER_MODEL:         getOptionalEnv('OPENROUTER_MODEL', 'openai/gpt-oss-120b:free'),
  OPENROUTER_BASE_URL:      getOptionalEnv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),

  // AI Provider
  AI_PROVIDER:              getOptionalEnv('AI_PROVIDER', 'auto') as EnvironmentVariables['AI_PROVIDER'],

  PORT:                     parseIntEnv('PORT', 3000),
  NODE_ENV:                 getOptionalEnv('NODE_ENV', 'development') as EnvironmentVariables['NODE_ENV'],
  LOG_LEVEL:                getOptionalEnv('LOG_LEVEL', 'debug'),
  RATE_LIMIT_WINDOW_MS:     parseIntEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  RATE_LIMIT_MAX_REQUESTS:  parseIntEnv('RATE_LIMIT_MAX_REQUESTS', 30),
  AI_MODEL:                 getOptionalEnv('AI_MODEL', 'gemini-2.5-flash'),
  AI_TEMPERATURE:           parseFloatEnv('AI_TEMPERATURE', 0.2),
  CORS_ORIGIN:              getOptionalEnv('CORS_ORIGIN', '*'),
};
