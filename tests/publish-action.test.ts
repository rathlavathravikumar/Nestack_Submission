import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertArticleRaw: vi.fn(),
  enqueueInvalidationRaw: vi.fn(),
  revalidateTag: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));

vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/storage', () => ({
  db: { insertArticleRaw: mocks.insertArticleRaw, enqueueInvalidationRaw: mocks.enqueueInvalidationRaw, resolveInvalidationsRaw: vi.fn() },
}));
vi.mock('@/lib/recovery-queue', () => ({ invalidationQueue: { enqueue: vi.fn(), markResolved: vi.fn() } }));

import { publishArticle } from '@/actions/publish-article';

describe('publishArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SIMULATE_INVALIDATION_FAILURE;
    mocks.insertArticleRaw.mockResolvedValue({ id: 'art-1', slug: 'hello-world-12345678', title: 'Hello World', body: 'Body', tag: 'engineering', createdAt: new Date().toISOString() });
  });

  it('persists, invalidates collection and detail tags, then redirects', async () => {
    const form = new FormData();
    form.set('title', 'Hello World'); form.set('body', 'Body'); form.set('tag', 'engineering');
    await expect(publishArticle(null, form)).rejects.toThrow(/^NEXT_REDIRECT:/);
    expect(mocks.insertArticleRaw).toHaveBeenCalledOnce();
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
    expect(mocks.revalidateTag).toHaveBeenCalledWith('articles', 'default');
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it('reports saved article when cache invalidation fails after the write', async () => {
    process.env.SIMULATE_INVALIDATION_FAILURE = 'true';
    const form = new FormData();
    form.set('title', 'Hello World'); form.set('body', 'Body'); form.set('tag', 'engineering');
    const result = await publishArticle(null, form);
    expect(mocks.insertArticleRaw).toHaveBeenCalledOnce();
    expect(result.partialFailure).toBe(true);
    expect(result.article?.id).toBe('art-1');
    expect(mocks.enqueueInvalidationRaw).toHaveBeenCalledWith(result.article?.slug, 'art-1');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('validates title and body before storage', async () => {
    const form = new FormData(); form.set('title', ' '); form.set('body', 'Body');
    const result = await publishArticle(null, form);
    expect(result.success).toBe(false);
    expect(mocks.insertArticleRaw).not.toHaveBeenCalled();
  });
});
