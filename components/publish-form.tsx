'use client';

import { useActionState, useState } from 'react';
import { publishArticle, PublishActionResult, recoverArticleInvalidation } from '@/actions/publish-article';
import Link from 'next/link';

export function PublishForm() {
  const [state, formAction, isPending] = useActionState<PublishActionResult | null, FormData>(
    publishArticle,
    null
  );

  const [revalidating, setRevalidating] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Recovery action triggered directly from publisher UI
  async function handleManualRecovery() {
    setRevalidating(true);
    setRecoverySuccess(null);
    setRecoveryError(null);
    try {
      const result = await recoverArticleInvalidation(state?.article?.slug || '');
      if (result.success) {
        setRecoverySuccess('Successfully revalidated the article list and detail tags.');
      } else {
        setRecoveryError(`${result.listInvalidated ? 'The article list was refreshed, but its detail cache was not. ' : ''}${result.error || 'Revalidation failed.'}`);
      }
    } catch (e: unknown) {
      setRecoveryError(e instanceof Error ? e.message : 'Revalidation failed.');
    } finally {
      setRevalidating(false);
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Partial Failure Warning Banner */}
      {state?.partialFailure && (
        <div className="banner banner-warning" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <strong style={{ fontSize: '15px' }}>Partial Failure Encountered</strong>
          </div>
          <p style={{ marginBottom: '10px', fontSize: '14px', lineHeight: 1.5 }}>
            <strong>What happened:</strong> The article was safely written to persistent storage (ID:{' '}
            <code>{state.article?.id}</code>), but the cache invalidation step failed:
            <br />
            <em style={{ color: '#b45309' }}>&quot;{state.error}&quot;</em>
          </p>

          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
            <div><strong>What readers may see:</strong> Cached article lists or pages may remain stale until revalidation succeeds.</div>
            <div style={{ marginTop: '4px' }}><strong>Recovery:</strong> Retry the collection invalidation below, or retry the article-specific invalidation after the collection succeeds.</div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleManualRecovery}
              disabled={revalidating}
              className="btn btn-primary"
              style={{ fontSize: '13px', backgroundColor: '#d97706' }}
            >
              {revalidating ? 'Triggering Revalidation...' : '              Recover: Revalidate Cached Article Tags'}
            </button>

            {state.article && (
              <Link
                href={`/articles/${state.article.slug}`}
                className="btn btn-secondary"
                style={{ fontSize: '13px' }}
              >
                Inspect Direct Article URL &rarr;
              </Link>
            )}
          </div>

          {recoverySuccess && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#ecfdf5', color: '#065f46', borderRadius: '6px', fontSize: '13px' }}>
              ✓ {recoverySuccess}
            </div>
          )}
          {recoveryError && <div role="alert" className="banner banner-danger" style={{ marginTop: '12px', marginBottom: 0 }}>{recoveryError}</div>}
        </div>
      )}

      {/* General Validation Error */}
      {state && !state.success && !state.partialFailure && (
        <div className="banner banner-danger" style={{ marginBottom: '24px' }}>
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {/* Publishing Form */}
      <div className="card">
        <form action={formAction}>
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Article Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="e.g., Scaling Next.js with Edge Caching"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tag" className="form-label">
              Article Tag / Topic
            </label>
            <select id="tag" name="tag" className="form-select">
              <option value="engineering">engineering</option>
              <option value="performance">performance</option>
              <option value="architecture">architecture</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="body" className="form-label">
              Article Body
            </label>
            <textarea
              id="body"
              name="body"
              rows={7}
              required
              placeholder="Write the full content of the article..."
              className="form-textarea"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/articles" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary"
              style={{ minWidth: '150px' }}
            >
              {isPending ? 'Publishing...' : 'Publish Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
