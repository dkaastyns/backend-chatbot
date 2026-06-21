// ============================================================================
// DPRD Chatbot — Structured Logger Utility
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';

function formatEntry(entry: LogEntry): string {
  const color = LOG_COLORS[entry.level];
  const ts = DIM + entry.timestamp + RESET;
  const lvl = color + BOLD + entry.level.toUpperCase().padEnd(5) + RESET;
  const ctx = entry.context ? DIM + `[${entry.context}]` + RESET + ' ' : '';
  const msg = entry.message;
  const extra = entry.data !== undefined
    ? '\n' + DIM + JSON.stringify(entry.data, null, 2) + RESET
    : '';
  return `${ts} ${lvl} ${ctx}${msg}${extra}`;
}

function createEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: unknown,
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || 'debug';
  return levels.indexOf(level) >= levels.indexOf(minLevel);
}

export const logger = {
  debug(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('debug')) return;
    console.debug(formatEntry(createEntry('debug', message, context, data)));
  },

  info(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('info')) return;
    console.info(formatEntry(createEntry('info', message, context, data)));
  },

  warn(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('warn')) return;
    console.warn(formatEntry(createEntry('warn', message, context, data)));
  },

  error(message: string, context?: string, data?: unknown): void {
    if (!shouldLog('error')) return;
    console.error(formatEntry(createEntry('error', message, context, data)));
  },
};
