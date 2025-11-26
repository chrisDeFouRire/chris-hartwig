import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ServerClient } from 'postmark';
import type { WorkerEnv } from './types/worker';
import { subscribe, SubscriptionError, unsubscribe, getSubscriptionStatus, confirmSubscription } from './lib/subscription';

// Create the API router
const api = new Hono<{ Bindings: WorkerEnv; }>();

// Add CORS middleware
api.use('*', cors());

// Initialize Postmark client
const postmarkClient = (env: WorkerEnv) => new ServerClient(env.POSTMARK_API_TOKEN);

// Function to send confirmation email
async function sendConfirmationEmail(env: WorkerEnv, email: string, confirmToken: string) {
  const client = postmarkClient(env);

  const confirmUrl = `${env.CANONICAL_URL}/confirm?token=${confirmToken}`;

  await client.sendEmail({
    From: 'chris@chris-hartwig.com', // Use your domain's noreply email
    To: email,
    Subject: 'Confirm your email subscription',
    HtmlBody: `
      <h2>Welcome to the newsletter!</h2>
      <p>Please click the link below to confirm your email address:</p>
      <p><a href="${confirmUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Email</a></p>
      <p>If you didn't sign up for our newsletter, please ignore this email.</p>
    `,
    TextBody: `Welcome to the newsletter! Please click the following link to confirm your email address: ${confirmUrl}\n\nIf you didn't sign up for our newsletter, please ignore this email.`
  });
}

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
      'SELECT unsubscribed_at, confirm_token FROM subscriptions WHERE email = ?'
    ).bind(email).first();

    let message = 'Successfully subscribed';
    if (existingSubscription) {
      if (existingSubscription.unsubscribed_at !== null) {
        message = 'Successfully re-subscribed';
      }
    }

    await subscribe(c.env.DB, email);

    // Get the confirmation token for the newly created subscription
    const subscriptionStatus = await getSubscriptionStatus(c.env.DB, email);
    if (subscriptionStatus && subscriptionStatus.confirm_token) {
      try {
        // Send confirmation email
        await sendConfirmationEmail(c.env, email, subscriptionStatus.confirm_token);
      } catch (error) {
        console.error('Failed to send confirmation email:', error);
        // Don't fail the subscription if email sending fails; the user can still confirm later
      }
    }

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

// Confirm email subscription
api.post('/confirm', async (c) => {
  const { token } = await c.req.json();

  if (!token) {
    return c.json({ message: 'Confirmation token is required' }, 400);
  }

  try {
    await confirmSubscription(c.env.DB, token);
    return c.json({ message: 'Email confirmed successfully' }, 200);
  } catch (error: unknown) {
    if (!(error instanceof SubscriptionError)) {
      return c.json({ message: 'Internal server error during email confirmation' }, 500);
    }

    // Log the error for debugging
    console.log('Error caught in confirm handler:', error?.name, error?.message);

    if (error && typeof error === 'object') {
      if (error.name === 'ValidationError') {
        return c.json({ message: error.message }, 400);
      } else if (error.name === 'NotFoundError') {
        return c.json({ message: error.message }, 404);
      } else if (error.name === 'InternalError') {
        return c.json({ message: error.message }, 500);
      }
    }

    return c.json({ message: 'Internal server error during email confirmation' }, 500);
  }
});

export default api;