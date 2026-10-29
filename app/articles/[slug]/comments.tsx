import { getSlowComments } from '@/lib/articles';

interface CommentsProps {
  slug: string;
}

export async function Comments({ slug }: CommentsProps) {
  // Awaits deliberately slow data source (at least 2.2 seconds)
  const comments = await getSlowComments(slug);

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Comments ({comments.length})</h3>
        <span className="badge badge-cached">Streamed RSC</span>
      </div>

      {comments.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
          No comments posted for this article yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="card"
              style={{ padding: '16px', marginBottom: 0, backgroundColor: '#fcfcfd' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>{comment.author}</strong>
                <time style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
