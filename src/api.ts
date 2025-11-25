import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { WorkerEnv } from './types/worker';

// Create the API router
const api = new Hono<{ Bindings: WorkerEnv; }>();

// Add CORS middleware
api.use('*', cors());

// Health check endpoint
api.get('/health', (c) => {
  return c.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Add more API routes here as needed

export default api;