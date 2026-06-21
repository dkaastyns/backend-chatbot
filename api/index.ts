// ============================================================================
// Vercel Serverless Entry Point
// ============================================================================
// File ini khusus untuk Vercel. Vercel membutuhkan kita melempar (export) 
// instance Express, bukan menjalankan app.listen().
// ============================================================================

import { app } from '../src/app';

export default app;
