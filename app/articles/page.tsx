import Link from 'next/link';
import { getCachedArticles } from '@/lib/articles';
import { db } from '@/lib/storage';
import { invalidationQueue } from '@/lib/recovery-queue';

export const dynamic = 'force-static'; // Can be cached statically or revalidated on-demand

interface ArticlesPageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const { tag } = await searchParams;
  const articles = await getCachedArticles(tag);
  const metrics = db.getMetricsRaw();
  const pendingFailures = invalidationQueue.getPending();

  return (
    <div>
      {/* Pending Invalidation Warning (if any) */}
      {pendingFailures.length > 0 && (
        <div className="banner banner-warning">
          <strong>⚠️ Stale Cache Advisory:</strong> There are {pendingFailures.length} pending cache
          invalidation failure(s) recorded in the recovery dead-letter queue.
          Readers may observe stale data until resolved via <code>POST /api/revalidate</code>.
        </div>
      )}

      {/* Caching Architecture Status Card */}
      <div className="card" style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
              Tagged Cache Monitor (unstable_cache)
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Tag: <code>articles</code> | Underlying Raw DB Reads: <strong>{metrics.rawDbReads}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-cached">Cached RSC</span>
            <span className="badge badge-tag">Tag: articles</span>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
          Hitting this page repeatedly serves from the Next.js tagged cache without causing a second read of the underlying storage.
        </p>
      </div>

      {/* Article List Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Published Articles</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {articles.length} {articles.length === 1 ? 'article' : 'articles'} available in the catalog
          </p>
        </div>
        <Link href="/articles/new" className="btn btn-primary">
          Write New Article
        </Link>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <Link
          href="/articles"
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '12px', fontWeight: !tag ? 700 : 400 }}
        >
          All
        </Link>
        {['performance', 'architecture', 'engineering'].map((category) => (
          <Link
            key={category}
            href={`/articles?tag=${category}`}
            className="btn btn-secondary"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: tag === category ? 700 : 400,
            }}
          >
            #{category}
          </Link>
        ))}
      </div>

      {/* Article Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {articles.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#64748b' }}>No articles found for this tag.</p>
          </div>
        ) : (
          articles.map((article) => (
            <article key={article.id} className="card" style={{ marginBottom: 0 }}>
              <div className="meta-row">
                <span className="badge badge-tag">#{article.tag}</span>
                <span>•</span>
                <time dateTime={article.createdAt}>
                  {new Date(article.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0 10px' }}>
                <Link href={`/articles/${article.slug}`} style={{ color: 'inherit' }}>
                  {article.title}
                </Link>
              </h2>
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
                {article.body.length > 200 ? `${article.body.substring(0, 200)}...` : article.body}
              </p>
              <div>
                <Link href={`/articles/${article.slug}`} className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>
                  Read Article & Comments &rarr;
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
