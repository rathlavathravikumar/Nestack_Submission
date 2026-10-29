export function CommentsSkeleton() {
  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Comments</h3>
        <span className="badge" style={{ backgroundColor: '#fef08a', color: '#854d0e' }}>
          Streaming (2s delay simulation)...
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: '16px', marginBottom: 0 }}>
            <div className="skeleton" style={{ width: '140px', height: '14px', marginBottom: '10px' }} />
            <div className="skeleton" style={{ width: '100%', height: '12px', marginBottom: '6px' }} />
            <div className="skeleton" style={{ width: '75%', height: '12px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
