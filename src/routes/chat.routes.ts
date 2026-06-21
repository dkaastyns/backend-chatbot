// ============================================================================
// DPRD Chatbot — API Routes
// ============================================================================

import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';

const router = Router();

// ---------------------------------------------------------------------------
// Health Check & Root
// ---------------------------------------------------------------------------
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'DPRD Chatbot API v1 is Running...',
    timestamp: new Date().toISOString()
  });
});
router.get('/health', chatController.healthCheck);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
router.post('/chat/sessions',                           chatController.createSession);
router.get('/chat/sessions',                            chatController.listSessions);
router.get('/chat/sessions/:sessionId',                 chatController.getSessionDetail);
router.delete('/chat/sessions/:sessionId',              chatController.deleteSession);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
router.post('/chat/sessions/:sessionId/messages',       chatController.sendMessage);

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
router.post('/chat/messages/:messageId/feedback',       chatController.submitFeedback);

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------
router.get('/chat/topics',                              chatController.listTopics);

export { router };
