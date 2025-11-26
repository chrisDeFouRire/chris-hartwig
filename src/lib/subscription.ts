import { randomBytes } from 'crypto';

// Helper to validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Helper to generate a random confirmation token
export function generateConfirmationToken(): string {
  return randomBytes(32).toString('hex');
}

// Custom error types for subscription operations
export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export class ValidationError extends SubscriptionError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends SubscriptionError {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends SubscriptionError {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InternalError extends SubscriptionError {
  constructor(message: string) {
    super(message);
    this.name = 'InternalError';
  }
}

export interface ExistingSubscription {
  id: number;
  unsubscribed_at: string | null;
}

export interface SubscriptionRecord {
  id: number;
  email: string;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
  confirmed_at: string | null;
  confirm_token: string | null;
}

/**
 * Subscribe an email to the newsletter
 * Handles both new subscriptions and re-subscriptions
 */
export async function subscribe(db: D1Database, email: string): Promise<void> {
  if (!email || !isValidEmail(email)) {
    throw new ValidationError('Invalid email address');
  }

  const now = new Date().toISOString();
  const confirmToken = generateConfirmationToken();

  // Check if already subscribed or unsubscribed
  const existingSubscription = await db.prepare(
    'SELECT id, unsubscribed_at, confirmed_at FROM subscriptions WHERE email = ?'
  ).bind(email).first() as ExistingSubscription | null;

  if (existingSubscription) {
    if (existingSubscription.unsubscribed_at === null) {
      throw new ConflictError('Email already subscribed');
    } else {
      // Re-subscribe: clear unsubscribed_at, update subscribed_at, reset issue count, generate new token
      await db.prepare(
        'UPDATE subscriptions SET unsubscribed_at = NULL, subscribed_at = ?, number_of_issues_received = 0, confirmed_at = NULL, confirm_token = ? WHERE email = ?'
      ).bind(now, confirmToken, email).run();
    }
  } else {
    try {
      // New subscription - only wrap the actual INSERT in try-catch
      await db.prepare(
        'INSERT INTO subscriptions (email, subscribed_at, number_of_issues_received, confirm_token) VALUES (?, ?, ?, ?)'
      ).bind(email, now, 0, confirmToken).run();
    } catch (error: unknown) {
      console.error('Subscription error:', error);
      // D1 unique constraint error for email
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError('Email already subscribed');
      }
      throw new InternalError('Internal server error during subscription');
    }
  }
}

/**
 * Unsubscribe an email from the newsletter
 */
export async function unsubscribe(db: D1Database, email: string): Promise<void> {
  if (!email || !isValidEmail(email)) {
    throw new ValidationError('Invalid email address');
  }

  // First check if email exists and what its status is
  const existing = await db.prepare('SELECT id, unsubscribed_at FROM subscriptions WHERE email = ?').bind(email).first();

  if (!existing) {
    throw new NotFoundError('Email not found');
  }

  if (existing.unsubscribed_at !== null) {
    throw new ConflictError('Email already unsubscribed');
  }

  try {
    const now = new Date().toISOString();

    // Perform the actual unsubscribe operation
    const result = await db.prepare(
      'UPDATE subscriptions SET unsubscribed_at = ? WHERE email = ? AND unsubscribed_at IS NULL'
    ).bind(now, email).run();

    // Double-check that the operation was successful
    if (result.meta.changes === 0) {
      // This could happen in a race condition, but we've already verified the status
      throw new InternalError('Internal server error during unsubscription');
    }
  } catch (error) {
    console.error('Unsubscription error:', error);
    throw new InternalError('Internal server error during unsubscription');
  }
}

/**
 * Get subscription status for an email
 */
export async function getSubscriptionStatus(db: D1Database, email: string): Promise<{
  subscribed: boolean;
  unsubscribed_at: string | null;
  subscribed_at: string | null;
  confirmed_at: string | null;
  confirm_token: string | null;
} | null> {
  try {
    const result = await db.prepare(
      'SELECT subscribed_at, unsubscribed_at, confirmed_at, confirm_token FROM subscriptions WHERE email = ?'
    ).bind(email).first<SubscriptionRecord>();

    if (!result) {
      return null;
    }

    return {
      subscribed: result.unsubscribed_at === null,
      unsubscribed_at: result.unsubscribed_at,
      subscribed_at: result.subscribed_at as string,
      confirmed_at: result.confirmed_at,
      confirm_token: result.confirm_token
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw new InternalError('Internal server error while fetching subscription status');
  }
}

/**
 * Confirm subscription via token
 */
export async function confirmSubscription(db: D1Database, confirmToken: string): Promise<void> {
  if (!confirmToken) {
    throw new ValidationError('Invalid confirmation token');
  }

  try {
    const now = new Date().toISOString();

    // Update the subscription to mark it as confirmed
    const result = await db.prepare(
      'UPDATE subscriptions SET confirmed_at = ?, confirm_token = NULL WHERE confirm_token = ? AND confirmed_at IS NULL'
    ).bind(now, confirmToken).run();

    // Check if any rows were affected
    if (result.meta.changes === 0) {
      throw new NotFoundError('Invalid or expired confirmation token');
    }
  } catch (error) {
    console.error('Error confirming subscription:', error);
    if (error instanceof SubscriptionError) {
      throw error;
    }
    throw new InternalError('Internal server error during subscription confirmation');
  }
}

/**
 * Check if email is confirmed
 */
export async function isEmailConfirmed(db: D1Database, email: string): Promise<boolean> {
  try {
    const result = await db.prepare(
      'SELECT confirmed_at FROM subscriptions WHERE email = ?'
    ).bind(email).first<{ confirmed_at: string | null }>();

    if (!result) {
      return false;
    }

    return result.confirmed_at !== null;
  } catch (error) {
    console.error('Error checking email confirmation:', error);
    throw new InternalError('Internal server error while checking email confirmation');
  }
}
