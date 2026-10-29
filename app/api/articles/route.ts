import { NextRequest, NextResponse } from 'next/server';
import { getCachedArticles } from '@/lib/articles';

/**
 * Route Handler: GET /api/articles
 * Query param: ?tag=
 * Response: 200 with array of article summaries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagFilter = searchParams.get('tag') || undefined;

    const articles = await getCachedArticles(tagFilter);

    // Return article summaries as requested in the specification
    const summaries = articles.map(({ id, slug, title, tag, createdAt }) => ({
      id,
      slug,
      title,
      tag,
      createdAt,
    }));

    return NextResponse.json(summaries, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
