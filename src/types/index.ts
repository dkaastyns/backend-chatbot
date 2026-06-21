// ============================================================================
// DPRD Chatbot — TypeScript Type Definitions
// ============================================================================

// ---------------------------------------------------------------------------
// Database Entities
// ---------------------------------------------------------------------------

export interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface Session {
  id: string;
  title: string;
  client_id: string | null;
  topic_id: string | null;
  is_active: boolean;
  message_count: number;
  last_message_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  token_count: number | null;
  sequence_number: number;
  processing_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface Feedback {
  id: string;
  message_id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'model';

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface CreateSessionBody {
  title?: string;
  client_id?: string;
  topic_id?: string;
}

export interface SendMessageBody {
  message: string;
}

export interface SubmitFeedbackBody {
  rating: number;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface SessionDetail extends Session {
  messages: Message[];
  topic?: Topic | null;
}

export interface ChatReply {
  user_message: Message;
  ai_response: Message;
  processing_ms: number;
  provider: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  database: 'connected' | 'disconnected';
  ai_service: 'configured' | 'not_configured';
  timestamp: string;
}

// ---------------------------------------------------------------------------
// AI Service Types
// ---------------------------------------------------------------------------

export interface AIContentPart {
  text: string;
}

export interface AIContent {
  role: 'user' | 'model';
  parts: AIContentPart[];
}

// ---------------------------------------------------------------------------
// Application Error
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
