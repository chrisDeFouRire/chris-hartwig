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
const postmarkClient = (env: WorkerEnv) => {
  if (!env.POSTMARK_API_TOKEN) {
    throw new Error('POSTMARK_API_TOKEN is not configured');
  }
  return new ServerClient(env.POSTMARK_API_TOKEN);
};

// Function to send confirmation email
async function sendConfirmationEmail(env: WorkerEnv, email: string, confirmToken: string, name?: string | null) {
  console.log('Initializing Postmark client');
  let client;
  try {
    client = postmarkClient(env);
    console.log('Postmark client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Postmark client:', error);
    throw error;
  }

  const confirmUrl = `${env.CANONICAL_URL}/confirm?token=${confirmToken}`;
  console.log('Sending confirmation email to:', email, 'with URL:', confirmUrl);

  const greeting = name ? `Hi ${name},` : 'Hi,';
  const welcomeText = name ? `Welcome to the Vibe Software Engineering newsletter, ${name}!` : 'Welcome to the Vibe Software Engineering newsletter!';

  try {
    const result = await client.sendEmail({
      From: 'chris@chris-hartwig.com', // Use your domain's noreply email
      To: email,
      Subject: 'Confirm your email subscription',
      HtmlBody: `
        <h2>${greeting}</h2>
        <br/>
        <p>${welcomeText}</p>
        <br/>
        <p>Please click the link below to confirm your email address:</p>
        <p><a href="${confirmUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Email</a></p>
        <br/>
        <p>If you didn't sign up for our newsletter, please ignore this email.</p>
      `,
      TextBody: `${greeting}\n\n${welcomeText}\n\nPlease click the following link to confirm your email address: ${confirmUrl}\n\nIf you didn't sign up for our newsletter, please ignore this email.`
    });
    console.log('Email sent successfully, result:', result);
  } catch (error) {
    console.error('Error sending email via Postmark:', error);
    throw error;
  }
}

// Health check endpoint
api.get('/health', (c) => {
  return c.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Subscribe to newsletter
api.post('/subscribe', async (c) => {
  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    console.error('Failed to parse request JSON:', error);
    return c.json({ message: 'Invalid JSON in request body' }, 400);
  }

  const { email, name } = requestBody;

  try {
    console.log('Starting subscription process for email:', email);

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

    console.log('Calling subscribe function for email:', email);
    await subscribe(c.env.DB, email, name);
    console.log('Subscribe function completed successfully');

    // Get the confirmation token for the newly created subscription
    console.log('Getting subscription status for email:', email);
    const subscriptionStatus = await getSubscriptionStatus(c.env.DB, email);
    console.log('Subscription status retrieved:', subscriptionStatus ? 'found' : 'not found');

    if (subscriptionStatus && subscriptionStatus.confirm_token) {
      console.log('Attempting to send confirmation email');
      try {
        // Send confirmation email
        await sendConfirmationEmail(c.env, email, subscriptionStatus.confirm_token, subscriptionStatus.name);
        console.log('Confirmation email sent successfully');
      } catch (error) {
        console.error('Failed to send confirmation email:', error);
        // Don't fail the subscription if email sending fails; the user can still confirm later
      }
    } else {
      console.log('No confirmation token found, skipping email send');
    }

    return c.json({ message }, 200);
  } catch (error: unknown) {
    console.error('Error in subscribe handler:', error);

    if (!(error instanceof SubscriptionError)) {
      console.error('Non-SubscriptionError caught, returning 500:', error);
      return c.json({ message: 'Internal server error during subscription' }, 500);
    }

    // Log the error for debugging
    console.log('SubscriptionError caught in subscribe handler:', error?.name, error?.message);

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
