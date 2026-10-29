import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { invalidationQueue } from '@/lib/recovery-queue';

/**
 * Route Handler: POST /api/revalidate
 * Input: JSON body { tag, secret }
 * Response: 200 { revalidated: true, tag }; 401 on bad or missing secret
 * 
 * Strict Constraint:
 * "POST /api/revalidate must reject a request without the correct secret with 401,
 * and must not fall back to allowing it when the secret is unset."
 */
export async function POST(request: NextRequest) {
  try {
    let body: { tag?: string; secret?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Bad Request: Invalid JSON body' },
        { status: 400 }
      );
    }

    const { tag, secret } = body;
    const configuredSecret = process.env.REVALIDATION_SECRET;

    // Fail closed: If REVALIDATION_SECRET is not configured or secret doesn't match -> 401
    if (!configuredSecret || !secret || secret !== configuredSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing secret' },
        { status: 401 }
      );
    }

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: Missing tag parameter' },
        { status: 400 }
      );
    }

    // Perform targeted tag revalidation
    revalidateTag(tag, 'default');

    // Resolve any pending failure in the recovery queue
    invalidationQueue.markResolved(tag);

    return NextResponse.json(
      {
        revalidated: true,
        tag,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
