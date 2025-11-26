import { Hono } from 'hono';
import { cors } from 'hono/cors';
// import { ServerClient } from 'postmark';
import type { WorkerEnv } from './types/worker';
import { subscribe, SubscriptionError, unsubscribe } from './lib/subscription';

// Create the API router
const api = new Hono<{ Bindings: WorkerEnv; }>();

// Add CORS middleware
api.use('*', cors());

// Initialize Postmark client (for later use, not sending yet)
// The API token will be provided via Cloudflare Worker secrets (POSTMARK_API_TOKEN)
// const postmarkClient = (env: WorkerEnv) => new ServerClient(env.POSTMARK_API_TOKEN);

// Health check endpoint
api.get('/health', (c) => {
  return c.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Subscribe to newsletter
api.post('/subscribe', async (c) => {
  const { email } = await c.req.json();

  try {
    // Check if email is already subscribed to determine the appropriate message
    const existingSubscription = await c.env.DB.prepare(
      'SELECT unsubscribed_at FROM subscriptions WHERE email = ?'
    ).bind(email).first();

    let message = 'Successfully subscribed';
    if (existingSubscription) {
      if (existingSubscription.unsubscribed_at !== null) {
        message = 'Successfully re-subscribed';
      }
    }

    await subscribe(c.env.DB, email);
    return c.json({ message }, 200);
  } catch (error: unknown) {
    if (!(error instanceof SubscriptionError)) {
      return c.json({ message: 'Internal server error during subscription' }, 500);
    }

    // Log the error for debugging
    console.log('Error caught in subscribe handler:', error?.name, error?.message);

    if (error && typeof error === 'object') {
      if (error.name === 'ValidationError') {
        return c.json({ message: error.message }, 400);
      } else if (error.name === 'ConflictError') {
        return c.json({ message: error.message }, 409);
      } else if (error.name === 'InternalError') {
        return c.json({ message: error.message }, 500);
      }
    }

    return c.json({ message: 'Internal server error during subscription' }, 500);
  }
});

// Unsubscribe from newsletter
api.post('/unsubscribe', async (c) => {
  const { email } = await c.req.json();

  try {
    await unsubscribe(c.env.DB, email);
    return c.json({ message: 'Successfully unsubscribed' }, 200);
  } catch (error: unknown) {
    if (!(error instanceof SubscriptionError)) {
      return c.json({ message: 'Internal server error during unsubscription' }, 500);
    }

    // Log the error for debugging
    console.log('Error caught in unsubscribe handler:', error?.name, error?.message);

    if (error && typeof error === 'object') {
      if (error.name === 'ValidationError') {
        return c.json({ message: error.message }, 400);
      } else if (error.name === 'NotFoundError') {
        return c.json({ message: error.message }, 404);
      } else if (error.name === 'ConflictError') {
        return c.json({ message: error.message }, 409);
      } else if (error.name === 'InternalError') {
        return c.json({ message: error.message }, 500);
      }
    }

    return c.json({ message: 'Internal server error during unsubscription' }, 500);
  }
});

export default api;