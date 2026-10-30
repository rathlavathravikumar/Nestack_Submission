'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, Article } from '@/lib/storage';

export interface RecoveryActionResult {
  success: boolean;
  error?: string;
  listInvalidated?: boolean;
}

export async function recoverArticleInvalidation(slug: string): Promise<RecoveryActionResult> {
  try {
    if (process.env.SIMULATE_INVALIDATION_FAILURE === 'true') {
      throw new Error('Cache invalidation is currently disabled by the failure simulation flag.');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { success: false, error: 'Invalid article slug.' };
    revalidateTag('articles', 'default');
    try {
      revalidateTag(`article:${slug}`, 'default');
    } catch (error) {
      return { success: false, listInvalidated: true, error: error instanceof Error ? error.message : 'Article cache invalidation failed.' };
    }
    await db.resolveInvalidationsRaw(slug);
    return { success: true, listInvalidated: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown cache invalidation error',
    };
  }
}

export interface PublishActionResult {
  success: boolean;
  partialFailure?: boolean;
  error?: string;
  article?: Article;
  listInvalidated?: boolean;
}

export async function publishArticle(
  prevState: PublishActionResult | null,
  formData: FormData
): Promise<PublishActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  const tag = ((formData.get('tag') as string) || 'engineering').trim().toLowerCase();

  if (!title || !body || title.length > 160 || body.length > 20_000) {
    return {
      success: false,
      error: 'Enter a title (1-160 characters) and body (1-20,000 characters).',
    };
  }

  if (!/^(engineering|performance|architecture)$/.test(tag)) {
    return { success: false, error: 'Choose a supported article topic.' };
  }

  // Derive URL-friendly slug
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = `${baseSlug || 'article'}-${crypto.randomUUID().slice(0, 8)}`;

  // Step 1: Write article to persistent storage
  let savedArticle: Article;
  try {
    savedArticle = await db.insertArticleRaw({
      title,
      slug,
      body,
      tag,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database insertion failed';
    return {
      success: false,
      error: `Storage write failure: ${message}`,
    };
  }

  // Step 2: Cache Invalidation (Can fail independently)
  const shouldSimulateFailure = process.env.SIMULATE_INVALIDATION_FAILURE === 'true';

  let invalidationFailed = false;
  let invalidationErrorMessage = '';
  let listInvalidated = false;

  try {
    if (shouldSimulateFailure) {
      throw new Error(
        'Simulated Tag Invalidation Failure: Cache cluster connection timeout on revalidateTag("articles").'
      );
    }

    // Invalidate the article collection tag
    revalidateTag('articles', 'default');
    listInvalidated = true;
    // Invalidate the individual article tag
    revalidateTag(`article:${savedArticle.slug}`, 'default');
  } catch (err: unknown) {
    invalidationFailed = true;
    invalidationErrorMessage =
      err instanceof Error ? err.message : 'Unknown cache invalidation error';

    // System recovery: Log the failed invalidation to the dead-letter queue
    try {
      await db.enqueueInvalidationRaw(savedArticle.slug, savedArticle.id);
    } catch {
      console.error('[PUBLISH] Could not persist invalidation recovery record.');
    }
  }

  // Handle the Partial Failure Case
  if (invalidationFailed) {
    // We return state to the publisher UI so they are clearly notified
    // what the reader will see and how to recover
    return {
      success: false,
      partialFailure: true,
      error: invalidationErrorMessage,
      article: savedArticle,
      listInvalidated,
    };
  }

  // Happy Path: Both write and invalidation succeeded -> Redirect to new article detail
  redirect(`/articles/${savedArticle.slug}`);
}
