/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from './api'; // Import the Hono app
import type { WorkerEnv } from './types/worker';

// Mock D1Database
class MockD1Database {
  private data: Map<string, any> = new Map();

  constructor() {
    this.data = new Map(); // Initialize data for each new instance
  }

  // Internal helper to simulate D1 read operations
  private async executeFirst(query: string, bindArgs: any[]): Promise<any | null> {
    // Simplified for 'SELECT ... WHERE email = ?'
    if (query.includes('SELECT') && query.includes('WHERE email = ?')) {
      const email = bindArgs[0];
      const result = Array.from(this.data.values()).find(sub => sub.email === email);
      // If the query includes specific fields (like getSubscriptionStatus), return only those
      if (query.includes('confirmed_at') || query.includes('confirm_token') || query.includes('name')) {
        return result ? {
          name: result.name,
          subscribed_at: result.subscribed_at,
          unsubscribed_at: result.unsubscribed_at,
          confirmed_at: result.confirmed_at,
          confirm_token: result.confirm_token
        } : null;
      }
      return result || null;
    }
    // Handle the confirmation token check
    if (query.includes('WHERE confirm_token = ?')) {
      const token = bindArgs[0];
      const result = Array.from(this.data.values()).find(sub => sub.confirm_token === token);
      return result || null;
    }
    // Generic query that might return an ID or similar if needed in other tests
    if (query.includes('SELECT id FROM subscriptions')) {
      const email = bindArgs[0];
      const result = Array.from(this.data.values()).find(sub => sub.email === email);
      return result ? { id: result.id } : null;
    }
    return null;
  }

  // Internal helper to simulate D1 write operations
  private async executeRun(query: string, bindArgs: any[]): Promise<any> {
    // console.log('MockD1Database.executeRun:', query, bindArgs);
    if (query.includes('INSERT INTO subscriptions')) {
      const [email, name, subscribed_at, number_of_issues_received, confirm_token] = bindArgs;
      const id = this.data.size + 1;
      this.data.set(email, {
        id,
        email,
        name: name || null,
        subscribed_at,
        unsubscribed_at: null,
        confirmed_at: null,
        confirm_token: confirm_token || null,
        latest_newsletter_sent: null,
        number_of_issues_received
      });
      return { meta: { changes: 1 } };
    } else if (query.includes('UPDATE subscriptions')) {
      // Logic for UPDATE based on query and bindArgs
      if (query.includes('SET unsubscribed_at = NULL') && query.includes('confirm_token') && query.includes('name = ?')) { // Re-subscribe with new confirm_token and name
        const [subscribed_at_re, confirm_token, name_re, email_re] = bindArgs;
        const existing = this.data.get(email_re);
        if (existing) {
          existing.unsubscribed_at = null;
          existing.subscribed_at = subscribed_at_re;
          existing.number_of_issues_received = 0;
          existing.confirmed_at = null; // Reset confirmation when re-subscribing
          existing.confirm_token = confirm_token; // Update token
          existing.name = name_re || null; // Update name
          this.data.set(email_re, existing);
          return { meta: { changes: 1 } };
        }
      } else if (query.includes('SET unsubscribed_at = NULL') && query.includes('confirm_token')) { // Re-subscribe with new confirm_token (fallback for old tests)
        const [subscribed_at_re, confirm_token, email_re] = bindArgs;
        const existing = this.data.get(email_re);
        if (existing) {
          existing.unsubscribed_at = null;
          existing.subscribed_at = subscribed_at_re;
          existing.number_of_issues_received = 0;
          existing.confirmed_at = null; // Reset confirmation when re-subscribing
          existing.confirm_token = confirm_token; // Update token
          this.data.set(email_re, existing);
          return { meta: { changes: 1 } };
        }
      } else if (query.includes('SET unsubscribed_at = NULL')) { // Re-subscribe without token (fallback for existing tests)
        const [subscribed_at_re, email_re] = bindArgs;
        const existing = this.data.get(email_re);
        if (existing) {
          existing.unsubscribed_at = null;
          existing.subscribed_at = subscribed_at_re;
          existing.number_of_issues_received = 0;
          this.data.set(email_re, existing);
          return { meta: { changes: 1 } };
        }
      } else if (query.includes('SET unsubscribed_at = ?') && query.includes('AND unsubscribed_at IS NULL')) { // Unsubscribe
        const [unsubscribed_at, email] = bindArgs;
        const existing = this.data.get(email);
        if (existing && existing.unsubscribed_at === null) { // Only unsubscribe if not already unsubscribed
          existing.unsubscribed_at = unsubscribed_at;
          this.data.set(email, existing);
          return { meta: { changes: 1 } };
        }
      } else if (query.includes('SET confirmed_at = ?') && query.includes('confirm_token = ?') && query.includes('confirmed_at IS NULL')) {
        // Confirm subscription
        const [confirmed_at, confirm_token] = bindArgs;
        // Find the record by confirmation token
        const entries = Array.from(this.data.entries());
        for (const [email, record] of entries) {
          if (record.confirm_token === confirm_token && record.confirmed_at === null) {
            record.confirmed_at = confirmed_at;
            record.confirm_token = null; // Remove token after confirmation
            this.data.set(email, record);
            return { meta: { changes: 1 } };
          }
        }
        return { meta: { changes: 0 } };
      }
      return { meta: { changes: 0 } };
    }
    return { meta: { changes: 0 } };
  }

  prepare(query: string) {
    let boundArgs: any[] = [];

    return {
      bind: (...args: any[]) => {
        boundArgs = args;
        return {
          first: async (): Promise<any | null> => {
            return this.executeFirst(query, boundArgs);
          },
          run: async (): Promise<any> => {
            return this.executeRun(query, boundArgs);
          }
        };
      },
      // Also provide run/first directly for queries that don't need binding
      first: async (): Promise<any | null> => {
        return this.executeFirst(query, boundArgs);
      },
      run: async (): Promise<any> => {
        return this.executeRun(query, boundArgs);
      }
    };
  }
}

// Mock Env for Hono context
const mockEnv: WorkerEnv = {
  DB: new MockD1Database() as any, // Cast to any because MockD1Database doesn't fully implement D1Database interface
  POSTMARK_API_TOKEN: 'mock-postmark-token',
  CANONICAL_URL: 'https://chris-hartwig.com' as const,
  ASSETS: {
    fetch: vi.fn(),
    connect: vi.fn(),
  },
};

// Mock the postmark client to prevent actual email sending
vi.mock('postmark', () => ({
  ServerClient: class {
    sendEmail = vi.fn().mockResolvedValue({});
  },
}));

describe('Newsletter API', () => {
  let mockDB: MockD1Database;

  beforeEach(() => {
    // Reset the mock database before each test
    mockDB = new MockD1Database();
    mockEnv.DB = mockDB as any;
  });

  it('should subscribe a new email successfully', async () => {
    const req = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Successfully subscribed' });
    const subscribed = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('test@example.com').first();
    expect(subscribed).not.toBeNull();
    expect(subscribed.email).toBe('test@example.com');
    expect(subscribed.unsubscribed_at).toBeNull();
  });

  it('should subscribe a new email with name successfully', async () => {
    const req = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test-with-name@example.com', name: 'John Doe' }),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Successfully subscribed' });
    const subscribed = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('test-with-name@example.com').first();
    expect(subscribed).not.toBeNull();
    expect(subscribed.email).toBe('test-with-name@example.com');
    expect(subscribed.name).toBe('John Doe');
    expect(subscribed.unsubscribed_at).toBeNull();
  });

  it('should return 400 for invalid email on subscribe', async () => {
    const req = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' }),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'Invalid email address' });
  });

  it('should return 409 if email is already subscribed', async () => {
    // First subscription
    const req1 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    await api.fetch(req1, mockEnv);

    // Second subscription
    const req2 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await api.fetch(req2, mockEnv);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: 'Email already subscribed' });
  });

  it('should re-subscribe an unsubscribed email', async () => {
    // First subscribe
    const req1 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'resubscribe@example.com' }),
    });
    await api.fetch(req1, mockEnv);

    // Then unsubscribe
    const req2 = new Request('http://localhost/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'resubscribe@example.com' }),
    });
    await api.fetch(req2, mockEnv);

    const unsubscribed = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('resubscribe@example.com').first();
    expect(unsubscribed.unsubscribed_at).not.toBeNull();

    // Re-subscribe
    const req3 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'resubscribe@example.com' }),
    });
    const res = await api.fetch(req3, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Successfully re-subscribed' });

    const resubscribed = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('resubscribe@example.com').first();
    expect(resubscribed.unsubscribed_at).toBeNull();
    expect(resubscribed.number_of_issues_received).toBe(0);
  });

  it('should unsubscribe an email successfully', async () => {
    const req1 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unsubscribe@example.com' }),
    });
    await api.fetch(req1, mockEnv);

    const req2 = new Request('http://localhost/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unsubscribe@example.com' }),
    });
    const res = await api.fetch(req2, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Successfully unsubscribed' });

    const unsubscribed = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('unsubscribe@example.com').first();
    expect(unsubscribed).not.toBeNull();
    expect(unsubscribed.unsubscribed_at).not.toBeNull();
  });

  it('should return 400 for invalid email on unsubscribe', async () => {
    const req = new Request('http://localhost/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' }),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'Invalid email address' });
  });

  it('should return 404 if email not found on unsubscribe', async () => {
    const req = new Request('http://localhost/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Email not found' });
  });

  it('should return 409 if email is already unsubscribed', async () => {
    // First subscribe
    const req1 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alreadyunsubscribed@example.com' }),
    });
    await api.fetch(req1, mockEnv);

    // Then unsubscribe
    const req2 = new Request('http://localhost/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alreadyunsubscribed@example.com' }),
    });
    await api.fetch(req2, mockEnv); // First unsubscribe

    // Second unsubscribe
    const req3 = new Request('http://localhost/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alreadyunsubscribed@example.com' }),
    });
    const res = await api.fetch(req3, mockEnv); // Second unsubscribe
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: 'Email already unsubscribed' });
  });

  it('should confirm email subscription with valid token', async () => {
    // First subscribe to create a subscription with a confirmation token
    const req1 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'confirm@example.com' }),
    });
    const res1 = await api.fetch(req1, mockEnv);
    expect(res1.status).toBe(200);

    // Get the subscription to retrieve the confirmation token
    const subscription = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('confirm@example.com').first();
    expect(subscription).not.toBeNull();
    expect(subscription.confirm_token).not.toBeNull();
    expect(subscription.confirmed_at).toBeNull();

    // Now confirm the subscription with the token
    const req2 = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: subscription.confirm_token }),
    });
    const res2 = await api.fetch(req2, mockEnv);
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ message: 'Email confirmed successfully' });

    // Check that the subscription is now confirmed
    const updatedSubscription = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('confirm@example.com').first();
    expect(updatedSubscription).not.toBeNull();
    expect(updatedSubscription.confirmed_at).not.toBeNull();
    expect(updatedSubscription.confirm_token).toBeNull();
  });

  it('should return 404 for invalid confirmation token', async () => {
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token' }),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Invalid or expired confirmation token' });
  });

  it('should return 400 for missing confirmation token', async () => {
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await api.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'Confirmation token is required' });
  });

  it('should not confirm with already used token', async () => {
    // First subscribe to create a subscription with a confirmation token
    const req1 = new Request('http://localhost/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'already-confirmed@example.com' }),
    });
    const res1 = await api.fetch(req1, mockEnv);
    expect(res1.status).toBe(200);

    // Get the subscription to retrieve the confirmation token
    const subscription = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('already-confirmed@example.com').first();
    expect(subscription).not.toBeNull();
    expect(subscription.confirm_token).not.toBeNull();
    const token = subscription.confirm_token;

    // Confirm the subscription with the token
    const req2 = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const res2 = await api.fetch(req2, mockEnv);
    expect(res2.status).toBe(200);

    // Check that the token was cleared after confirmation
    const updatedSubscription = await mockDB.prepare('SELECT * FROM subscriptions WHERE email = ?').bind('already-confirmed@example.com').first();
    expect(updatedSubscription.confirm_token).toBeNull();

    // Try to confirm again with the same token (should be invalid now)
    const req3 = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const res3 = await api.fetch(req3, mockEnv);
    expect(res3.status).toBe(404);
  });
});
