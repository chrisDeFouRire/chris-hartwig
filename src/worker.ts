import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { WorkerEnv } from './types/worker';

// Create the Hono app
const app = new Hono<{ Bindings: WorkerEnv; }>();

// Add CORS middleware
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main fetch handler that combines API routes and static asset serving
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // Create a new Hono instance for this request
    const apiRoutes = new Hono<{ Bindings: WorkerEnv; }>();

    // Mount the API routes
    apiRoutes.route('/api', app);

    // Try to handle the request with the API routes first
    const apiResponse = await apiRoutes.fetch(request, env, ctx);

    // If we get a 404 from the API routes and it's not an API request,
    // try to serve static assets
    if (apiResponse.status === 404 && !request.url.includes('/api')) {
      try {
        // Attempt to serve static assets from the ASSETS binding
        return await env.ASSETS.fetch(request);
      } catch {
        // If asset serving fails, return a 404
        return new Response('Not Found', { status: 404 });
      }
    }

    return apiResponse;
  },
}