// Helper to validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

/**
 * Subscribe an email to the newsletter
 * Handles both new subscriptions and re-subscriptions
 */
export async function subscribe(db: D1Database, email: string): Promise<void> {
  if (!email || !isValidEmail(email)) {
    throw new ValidationError('Invalid email address');
  }

  const now = new Date().toISOString();

  // Check if already subscribed or unsubscribed
  const existingSubscription = await db.prepare(
    'SELECT id, unsubscribed_at FROM subscriptions WHERE email = ?'
  ).bind(email).first() as ExistingSubscription | null;

  if (existingSubscription) {
    if (existingSubscription.unsubscribed_at === null) {
      throw new ConflictError('Email already subscribed');
    } else {
      // Re-subscribe: clear unsubscribed_at, update subscribed_at, reset issue count
      await db.prepare(
        'UPDATE subscriptions SET unsubscribed_at = NULL, subscribed_at = ?, number_of_issues_received = 0 WHERE email = ?'
      ).bind(now, email).run();
    }
  } else {
    try {
      // New subscription - only wrap the actual INSERT in try-catch
      await db.prepare(
        'INSERT INTO subscriptions (email, subscribed_at, number_of_issues_received) VALUES (?, ?, ?)'
      ).bind(email, now, 0).run();
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

interface SubscriptionRecord {
  subscribed_at: string | null;
  unsubscribed_at: string | null;
}

/**
 * Get subscription status for an email
 */
export async function getSubscriptionStatus(db: D1Database, email: string): Promise<{
  subscribed: boolean;
  unsubscribed_at: string | null;
  subscribed_at: string | null;
} | null> {
  try {
    const result = await db.prepare(
      'SELECT subscribed_at, unsubscribed_at FROM subscriptions WHERE email = ?'
    ).bind(email).first<SubscriptionRecord>();

    if (!result) {
      return null;
    }

    return {
      subscribed: result.unsubscribed_at === null,
      unsubscribed_at: result.unsubscribed_at,
      subscribed_at: result.subscribed_at as string
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw new InternalError('Internal server error while fetching subscription status');
  }
}
