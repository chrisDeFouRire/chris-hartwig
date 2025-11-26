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
      const [email, subscribed_at, number_of_issues_received] = bindArgs;
      const id = this.data.size + 1;
      this.data.set(email, {
        id,
        email,
        subscribed_at,
        unsubscribed_at: null,
        latest_newsletter_sent: null,
        number_of_issues_received
      });
      return { meta: { changes: 1 } };
    } else if (query.includes('UPDATE subscriptions')) {
      // Logic for UPDATE based on query and bindArgs
      if (query.includes('SET unsubscribed_at = NULL')) { // Re-subscribe
        const [subscribed_at_re, email_re] = bindArgs;
        const existing = this.data.get(email_re);
        if (existing) {
          existing.unsubscribed_at = null;
          existing.subscribed_at = subscribed_at_re;
          existing.number_of_issues_received = 0;
          this.data.set(email_re, existing);
          return { meta: { changes: 1 } };
        }
      } else if (query.includes('SET unsubscribed_at = ?')) { // Unsubscribe
        const [unsubscribed_at, email] = bindArgs;
        const existing = this.data.get(email);
        if (existing && existing.unsubscribed_at === null) { // Only unsubscribe if not already unsubscribed
          existing.unsubscribed_at = unsubscribed_at;
          this.data.set(email, existing);
          return { meta: { changes: 1 } };
        }
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
  ASSETS: {
    fetch: vi.fn(),
    connect: vi.fn(),
  },
};

// Mock the postmark client to prevent actual email sending
vi.mock('postmark', () => {
  return {
    ServerClient: vi.fn(() => ({
      sendEmail: vi.fn(),
    })),
  };
});

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
});
