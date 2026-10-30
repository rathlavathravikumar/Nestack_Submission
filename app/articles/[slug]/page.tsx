import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCachedArticleBySlug } from '@/lib/articles';
import { Comments } from './comments';
import { CommentsSkeleton } from '@/components/comments-skeleton';

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = true;

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const article = await getCachedArticleBySlug(slug);

  if (!article) {
    notFound();
  }


  return (
    <div>
      {/* Top Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <Link href="/articles" className="btn btn-secondary" style={{ fontSize: '13px' }}>
          &larr; Back to all articles
        </Link>
      </div>

      {/* Caching Status Metadata */}
      <div className="card" style={{ backgroundColor: '#f8fafc', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge badge-cached">Cached RSC Detail</span>
            <span className="badge badge-tag">Tag: article:{slug}</span>
          </div>
        </div>
      </div>

      {/* Primary Article Body - Rendered and Readable Immediately */}
      <article className="card" style={{ padding: '32px' }}>
        <div className="meta-row" style={{ marginBottom: '14px' }}>
          <span className="badge badge-tag">#{article.tag}</span>
          <span>•</span>
          <time dateTime={article.createdAt}>
            {new Date(article.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.3, marginBottom: '20px' }}>
          {article.title}
        </h1>

        <div style={{ fontSize: '16px', lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-line' }}>
          {article.body}
        </div>

        {/* Slow Comments Panel Streamed Inside Suspense Boundary */}
        <Suspense fallback={<CommentsSkeleton />}>
          <Comments slug={slug} />
        </Suspense>
      </article>
    </div>
  );
}
