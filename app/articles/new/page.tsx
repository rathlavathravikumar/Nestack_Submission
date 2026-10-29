import { PublishForm } from '@/components/publish-form';
import Link from 'next/link';

export default function NewArticlePage() {
  return (
    <div>
      <div style={{ maxWidth: '640px', margin: '0 auto 20px' }}>
        <Link href="/articles" className="btn btn-secondary" style={{ fontSize: '13px' }}>
          &larr; Back to articles
        </Link>
        <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '16px' }}>Publish New Article</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Targeted invalidation updates the cache by tag without rebuilding or restarting the app.
        </p>
      </div>

      <PublishForm />
    </div>
  );
}
