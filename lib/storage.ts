import fs from 'fs';
import path from 'path';

export interface Article {
  id: string;
  slug: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  articleSlug: string;
  author: string;
  content: string;
  createdAt: string;
}

interface DatabaseSchema {
  articles: Article[];
  comments: Comment[];
  metrics: {
    rawDbReads: number;
    rawDbWrites: number;
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-1',
    slug: 'nextjs-caching-deep-dive',
    title: 'Deep Dive into Next.js 16 App Router Caching',
    body: 'The App Router fundamentally redesigns how server rendering and caching interact. Instead of rebuilding entire pages or serving purely dynamic responses on every hit, fine-grained tagged caching allows high-concurrency content consoles to scale efficiently. Reads are cached with tags, and writes invalidate only the specific tags affected.',
    tag: 'performance',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'art-2',
    slug: 'tag-based-invalidation-patterns',
    title: 'High-Throughput Tag-Based Invalidation Strategies',
    body: 'In modern content delivery networks and edge-rendering setups, tag-based cache invalidation (revalidateTag) guarantees that readers receive instant updates without triggering a full rebuild of the website or flushing unrelated cache entries.',
    tag: 'architecture',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'art-3',
    slug: 'streaming-and-suspense-at-scale',
    title: 'Streaming React Server Components with Suspense',
    body: 'When pages contain slow third-party integrations, comments, or analytics panels, streaming enables the core article to render and be readable in milliseconds while secondary panels resolve asynchronously over the wire.',
    tag: 'engineering',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'comm-1',
    articleSlug: 'nextjs-caching-deep-dive',
    author: 'Sarah Chen (Staff Engineer)',
    content: 'Tagged invalidation with unstable_cache solved our stale-data problem across all edge nodes!',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'comm-2',
    articleSlug: 'nextjs-caching-deep-dive',
    author: 'Alex Rivera (SRE)',
    content: 'The ability to stream slow panels while keeping core text instantly readable is a game changer for perceived performance.',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'comm-3',
    articleSlug: 'tag-based-invalidation-patterns',
    author: 'Marcus Vance',
    content: 'Great breakdown. Tagging by entity slug and collection prevents entire site purges.',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: DatabaseSchema = {
      articles: INITIAL_ARTICLES,
      comments: INITIAL_COMMENTS,
      metrics: {
        rawDbReads: 0,
        rawDbWrites: 0,
      },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content) as DatabaseSchema;
  } catch {
    const fallback: DatabaseSchema = {
      articles: INITIAL_ARTICLES,
      comments: INITIAL_COMMENTS,
      metrics: { rawDbReads: 0, rawDbWrites: 0 },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeDb(data: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Underlying raw data source operations.
 * These methods directly perform disk I/O and track read/write counts.
 * When properly wrapped in Next.js caching primitives, calls here are intercepted on cache hits!
 */
export const db = {
  getArticlesRaw(tagFilter?: string): Article[] {
    const data = ensureDb();
    data.metrics.rawDbReads += 1;
    writeDb(data);
    console.log(`[DATA SOURCE] Raw read triggered! Total raw reads: ${data.metrics.rawDbReads}`);

    if (tagFilter) {
      return data.articles.filter(
        (a) => a.tag.toLowerCase() === tagFilter.toLowerCase()
      );
    }
    return data.articles;
  },

  getArticleBySlugRaw(slug: string): Article | null {
    const data = ensureDb();
    data.metrics.rawDbReads += 1;
    writeDb(data);
    console.log(`[DATA SOURCE] Raw read for slug "${slug}" triggered! Total raw reads: ${data.metrics.rawDbReads}`);

    const found = data.articles.find((a) => a.slug === slug);
    return found || null;
  },

  insertArticleRaw(article: Omit<Article, 'id' | 'createdAt'>): Article {
    const data = ensureDb();
    data.metrics.rawDbWrites += 1;

    const newArticle: Article = {
      ...article,
      id: `art-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    // Prepend new article so it appears at top of lists
    data.articles.unshift(newArticle);
    writeDb(data);
    console.log(`[DATA SOURCE] Raw write for article "${newArticle.slug}". Total raw writes: ${data.metrics.rawDbWrites}`);
    return newArticle;
  },

  getCommentsForArticleRaw(slug: string): Comment[] {
    const data = ensureDb();
    return data.comments.filter((c) => c.articleSlug === slug);
  },

  getMetricsRaw(): { rawDbReads: number; rawDbWrites: number } {
    const data = ensureDb();
    return data.metrics;
  },
};
