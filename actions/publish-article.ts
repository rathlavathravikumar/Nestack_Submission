'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, Article } from '@/lib/storage';
import { invalidationQueue } from '@/lib/recovery-queue';

export interface PublishActionResult {
  success: boolean;
  partialFailure?: boolean;
  error?: string;
  article?: Article;
}

export async function publishArticle(
  prevState: PublishActionResult | null,
  formData: FormData
): Promise<PublishActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  const tag = ((formData.get('tag') as string) || 'engineering').trim().toLowerCase();
  const simulateFailureParam = formData.get('simulateFailure');

  if (!title || !body) {
    return {
      success: false,
      error: 'Both title and body are required to publish an article.',
    };
  }

  // Derive URL-friendly slug
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = `${baseSlug || 'article'}-${Date.now().toString().slice(-4)}`;

  // Step 1: Write article to persistent storage
  let savedArticle: Article;
  try {
    savedArticle = db.insertArticleRaw({
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
  const shouldSimulateFailure =
    simulateFailureParam === 'on' ||
    simulateFailureParam === 'true' ||
    process.env.SIMULATE_INVALIDATION_FAILURE === 'true';

  let invalidationFailed = false;
  let invalidationErrorMessage = '';

  try {
    if (shouldSimulateFailure) {
      throw new Error(
        'Simulated Tag Invalidation Failure: Cache cluster connection timeout on revalidateTag("articles").'
      );
    }

    // Invalidate the article collection tag
    revalidateTag('articles', 'default');
    // Invalidate the individual article tag
    revalidateTag(`article:${savedArticle.slug}`, 'default');
  } catch (err: unknown) {
    invalidationFailed = true;
    invalidationErrorMessage =
      err instanceof Error ? err.message : 'Unknown cache invalidation error';

    // System recovery: Log the failed invalidation to the dead-letter queue
    invalidationQueue.enqueue({
      tag: 'articles',
      slug: savedArticle.slug,
      articleId: savedArticle.id,
      errorMessage: invalidationErrorMessage,
    });
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
    };
  }

  // Happy Path: Both write and invalidation succeeded -> Redirect to new article detail
  redirect(`/articles/${savedArticle.slug}`);
}
