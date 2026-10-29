export interface InvalidationFailureRecord {
  id: string;
  tag: string;
  slug: string;
  articleId: string;
  errorMessage: string;
  timestamp: string;
  resolved: boolean;
}

// Dead-letter queue stored in memory / system state for recovery
const deadLetterQueue: InvalidationFailureRecord[] = [];

export const invalidationQueue = {
  enqueue(record: Omit<InvalidationFailureRecord, 'id' | 'timestamp' | 'resolved'>): InvalidationFailureRecord {
    const entry: InvalidationFailureRecord = {
      ...record,
      id: `fail-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    deadLetterQueue.unshift(entry);
    console.warn(`[RECOVERY QUEUE] Enqueued failed invalidation for tag "${entry.tag}". Total pending: ${deadLetterQueue.filter(r => !r.resolved).length}`);
    return entry;
  },

  getAll(): InvalidationFailureRecord[] {
    return deadLetterQueue;
  },

  getPending(): InvalidationFailureRecord[] {
    return deadLetterQueue.filter((r) => !r.resolved);
  },

  markResolved(tag: string): number {
    let count = 0;
    for (const record of deadLetterQueue) {
      if (record.tag === tag && !record.resolved) {
        record.resolved = true;
        count++;
      }
    }
    return count;
  },
};
