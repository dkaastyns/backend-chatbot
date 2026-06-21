// ============================================================================
// DPRD Chatbot — Global Error Handler Middleware
// ============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/index';
import { logger } from '../utils/logger';

/**
 * Express global error handling middleware.
 * Menangkap semua error dan mengembalikan respons JSON yang konsisten.
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Tentukan status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  // Log error
  if (statusCode >= 500) {
    logger.error(
      `[${statusCode}] ${err.message}`,
      'ErrorHandler',
      { stack: err.stack, isOperational },
    );
  } else {
    logger.warn(`[${statusCode}] ${err.message}`, 'ErrorHandler');
  }

  // Kirim respons
  res.status(statusCode).json({
    success: false,
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Middleware untuk menangkap route yang tidak ditemukan (404).
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new AppError(`Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`, 404));
}
