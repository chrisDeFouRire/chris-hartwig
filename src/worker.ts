import { Hono } from 'hono';
import type { WorkerEnv } from './types/worker';
import api from './api';

// Create the main Hono app
const app = new Hono<{ Bindings: WorkerEnv; }>();

// Mount the API routes under the /api prefix
app.route('/api', api);

// Main fetch handler that combines API routes and static asset serving
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // Handle the request with the main app which includes both API and non-API routes
    const response = await app.fetch(request, env, ctx);

    // If the response is a 404 and the request is not for an API endpoint,
    // try to serve static assets
    if (response.status === 404 && !request.url.includes('/api')) {
      try {
        // Attempt to serve static assets from the ASSETS binding
        return await env.ASSETS.fetch(request);
      } catch {
        // If asset serving fails, return a 404
        return new Response('Not Found', { status: 404 });
      }
    }

    return response;
  },
}
