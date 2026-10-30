import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/storage';

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Bad Request: Expected a JSON object' }, { status: 400 });
    }
    const { tag, secret } = body as { tag?: unknown; secret?: unknown };
    const configuredSecret = process.env.REVALIDATION_SECRET;

    // Fail closed: If REVALIDATION_SECRET is not configured or secret doesn't match -> 401
    if (!configuredSecret?.trim() || typeof secret !== 'string' || !secret || secret !== configuredSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing secret' },
        { status: 401 }
      );
    }

    if (tag === undefined || tag === null || tag === '') {
      return NextResponse.json({ error: 'Bad Request: Missing tag parameter' }, { status: 400 });
    }
    if (typeof tag !== 'string' || !['articles'].includes(tag)) {
      return NextResponse.json(
        { error: 'Bad Request: Unsupported tag' },
        { status: 400 }
      );
    }

    // Perform targeted tag revalidation
    try {
      revalidateTag(tag, 'default');
    } catch {
      console.error('[REVALIDATE] Tag invalidation failed');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    try {
      await db.resolveInvalidationsRaw();
    } catch {
      console.error('[REVALIDATE] Cache refreshed, but recovery records could not be resolved.');
    }


    return NextResponse.json(
      {
        revalidated: true,
        tag,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('[REVALIDATE] Tag invalidation failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
