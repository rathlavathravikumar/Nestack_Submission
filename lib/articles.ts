import { unstable_cache } from 'next/cache';
import { db, Article, Comment } from './storage';

/**
 * CACHED ARTICLE READS
 * 
 * We use Next.js `unstable_cache` with explicit `tags`.
 * 
 * Justification:
 * 1. Encapsulates underlying database / storage calls without requiring synthetic HTTP fetch overhead.
 * 2. Provides deterministic tag-level revalidation via `revalidateTag(tag)`.
 * 3. Hitting the same page twice serves from cache and does NOT trigger `db.getArticlesRaw()`.
 */

export const getCachedArticles = (tagFilter?: string): Promise<Article[]> => {
  const key = tagFilter ? `articles-${tagFilter.toLowerCase()}` : 'articles-all';
  const fetcher = unstable_cache(
    async (filter?: string): Promise<Article[]> => {
      return db.getArticlesRaw(filter);
    },
    ['articles-list', key],
    {
      tags: ['articles'],
    }
  );
  return fetcher(tagFilter);
};

export const getCachedArticleBySlug = (slug: string): Promise<Article | null> => {
  const fetcher = unstable_cache(
    async (s: string): Promise<Article | null> => {
      return db.getArticleBySlugRaw(s);
    },
    ['article-detail', slug],
    {
      tags: ['articles', `article:${slug}`],
    }
  );

  return fetcher(slug);
};

/**
 * DELIBERATELY SLOW COMMENTS SOURCE
 * Simulates at least 2 seconds delay as strictly required by:
 * "3. Streaming a slow panel: The article detail page carries a comments panel backed
 * by a deliberately slow source (simulate at least 2 seconds)."
 */
export async function getSlowComments(slug: string): Promise<Comment[]> {
  // Simulate network/database latency of 2.2 seconds
  await new Promise((resolve) => setTimeout(resolve, 2200));
  return db.getCommentsForArticleRaw(slug);
}
