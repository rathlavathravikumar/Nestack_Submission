import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next/cache so revalidateTag doesn't throw outside Next runtime
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));

import { POST } from '@/app/api/revalidate/route';
import { revalidateTag } from 'next/cache';

describe('POST /api/revalidate Route Handler', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.REVALIDATION_SECRET = 'valid-test-secret-123';
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 401 when secret is missing from the request body', async () => {
    const req = new NextRequest('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'articles' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('returns 401 when provided secret does not match REVALIDATION_SECRET', async () => {
    const req = new NextRequest('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'articles', secret: 'wrong-secret' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('returns 401 when REVALIDATION_SECRET environment variable is unset (fails closed)', async () => {
    delete process.env.REVALIDATION_SECRET;

    const req = new NextRequest('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'articles', secret: 'any-secret' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('returns 400 when tag is missing from validly authenticated request', async () => {
    const req = new NextRequest('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'valid-test-secret-123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing tag/i);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('returns 200 and revalidates tag when valid secret and tag are provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'articles', secret: 'valid-test-secret-123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      revalidated: true,
      tag: 'articles',
    });
    expect(revalidateTag).toHaveBeenCalledWith('articles', 'default');
  });
});
