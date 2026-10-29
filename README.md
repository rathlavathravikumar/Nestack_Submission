# Next.js Content Console

> **Technical Assessment**: Nestack Revision 2  
> **Candidate**: Ravi Kumar Rathlavath (`ravirathlavath79@gmail.com`)  
> **Repository Name**: `RaviKumarRathlavath_Nestack_Submission`  
> **Target Framework**: **Next.js 16.4.3** (App Router strictly, React 19, TypeScript)  
> **Live Deployment Link**: `https://nextjs-content-console.vercel.app` *(or see deployment steps below)*

---

## Evaluation Contributors
Per instructions, add the following contributors to the private repository:
* `bishal@nestack.com`
* `sannidhya@nestack.com`
* `sanjay@nestack.com`

---

## 1. Quickstart & Local Setup

### Prerequisites
* **Node.js**: v20+ (tested on Node v24.18.0)
* **Package Manager**: `npm` (v11+) or `pnpm`

### Setup Instructions
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Copy .env.example to .env.local (already initialized with default secret)
cp .env.example .env.local

# 3. Run automated tests (Vitest)
npm test

# 4. Run production build & start
npm run build
npm start
```
The application will be live at `http://localhost:3000`.

---

## 2. Which Components are Client Components and Why?

In strict compliance with the **"Server Components by default"** rule, **every page and layout in this application is a React Server Component (RSC)**:

1. **`app/articles/page.tsx` (Server Component)**:
   * Directly fetches cached article data on the server.
   * Emits zero client bundle JavaScript for data orchestration.
2. **`app/articles/[slug]/page.tsx` (Server Component)**:
   * Server-renders the article title, body, and metadata immediately.
3. **`app/articles/[slug]/comments.tsx` (Server Component)**:
   * Awaits the deliberately slow comments data source (> 2.2s). Streamed via HTTP chunking directly to the browser.
4. **`components/publish-form.tsx` (`'use client'`) &mdash; The ONLY Client Component**:
   * **Justification**:
     * Requires React 19's `useActionState` to track form submission and pending states (`isPending`).
     * Manages client-side state for the interactive **"Simulate Invalidation Failure"** toggle.
     * Contains the interactive **"Force Revalidate Tag via API"** recovery button to test real-time cache self-healing.

---

## 3. Which Caching Primitive Was Chosen and Why?

We selected **`unstable_cache` with tagged entries (`next/cache`)** paired with **`revalidateTag`**:

```typescript
export const getCachedArticles = unstable_cache(
  async (tagFilter?: string): Promise<Article[]> => {
    return db.getArticlesRaw(tagFilter);
  },
  ['articles-list'],
  { tags: ['articles'] }
);

export const getCachedArticleBySlug = (slug: string) =>
  unstable_cache(
    async (s: string) => db.getArticleBySlugRaw(s),
    [`article-detail-${slug}`],
    { tags: ['articles', `article:${slug}`] }
  )(slug);
```

### Justification:
1. **Decoupled from Synthetic HTTP**: Unlike `fetch(..., { cache: 'force-cache', next: { tags } })` which introduces artificial HTTP loopbacks for local storage/databases, `unstable_cache` wraps pure database functions directly.
2. **Underlying Data Source Protection**: As evidenced by the storage layer's `rawDbReads` counter, when a reader visits `/articles` or `/articles/[slug]` multiple times, the underlying data source is **read exactly once**. All subsequent requests hit the tagged cache.
3. **Targeted Precision**: By tagging both the collection (`'articles'`) and individual slugs (`'article:${slug}'`), a publish invalidates exactly what changed without purging unrelated cache entries or rebuilding the site.
4. **List & Detail Synchronization**: Both the list query and detail query subscribe to relevant tags. When an article is published or edited, both views are invalidated together, ensuring the list and detail pages **never disagree**.

---

## 4. How a Publish Reaches Readers

1. **Submission**: Publisher submits title, body, and tag via the publishing form (`/articles/new`).
2. **Server Action**: The form invokes the server action `publishArticle(formData)`:
   * **Step A (Database Write)**: The article is inserted into persistent storage (`db.insertArticleRaw`).
   * **Step B (Tag Invalidation)**: The action triggers `revalidateTag('articles')` and `revalidateTag(\`article:${slug}\`)`.
   * **Step C (Client Navigation)**: Calls `redirect('/articles/${slug}')`.
3. **Reader Propagation**:
   * Next.js invalidates the cached payload for the `'articles'` tag.
   * When any reader requests `/articles`, Next.js detects the invalidated tag, executes one fresh read from the data source, and populates the cache with the new article.
   * **No restart, redeployment, or full site rebuild is required.**

---

## 5. Streaming the Slow Comments Panel

The comments panel simulates at least 2.2 seconds of latency to mimic a slow downstream microservice or legacy database:

```tsx
<article className="card">
  {/* Rendered and readable immediately */}
  <h1>{article.title}</h1>
  <div>{article.body}</div>

  {/* Comments panel streams in asynchronously */}
  <Suspense fallback={<CommentsSkeleton />}>
    <Comments slug={slug} />
  </Suspense>
</article>
```
* **Reader Experience**: The reader can immediately read the article title and body without delay. The comments section displays an animated skeleton and streams in once resolved over HTTP chunked transfer encoding.

---

## 6. Write Path Under Partial Failure (Deep Dive)

### The Dual-Step Problem
A publishing pipeline consists of two steps that can fail independently:
1. **Write to Database**: State persistence.
2. **Invalidate Cache (`revalidateTag`)**: Cache synchronization.

### Simulating Invalidation Failure
In `/articles/new`, check the box **"Simulate Invalidation Failure"** (or set `SIMULATE_INVALIDATION_FAILURE=true` in `.env.local`).

### 1. What the Reader Sees:
* The article was written to the database, but because cache invalidation failed, the reader hitting `/articles` continues to receive the **stale, cached snapshot**.
* The system remains highly available and readable, but slightly out of sync (eventual consistency delayed).

### 2. What the Publisher Sees:
* The Server Action catches the invalidation error instead of crashing with an unhandled exception.
* The publisher remains on the page and receives a clear advisory alert banner:
  > **⚠️ Partial Failure Encountered**: Article #art-xxx was saved to persistent storage, but cache invalidation failed: *"Cache cluster connection timeout on revalidateTag('articles')"*.
  > Readers will see stale content until invalidation succeeds.
  > **Action Available**: [Recover: Force Revalidate Tag via API]

### 3. What the Code Does & How the System Recovers:
* **Dead-Letter Recovery Queue (`lib/recovery-queue.ts`)**: The failure is captured in a resilient audit/recovery queue:
  ```typescript
  invalidationQueue.enqueue({
    tag: 'articles',
    slug: savedArticle.slug,
    articleId: savedArticle.id,
    errorMessage: err.message,
  });
  ```
* **Self-Healing Recovery Path**: The publisher can click **"Force Revalidate Tag via API"**, which issues an authenticated `POST /api/revalidate` call with `{ tag: 'articles', secret }`.
* Once revalidated, the tag is cleared, the queue marks the incident resolved, and readers immediately see the updated content.

### 4. What We Would Do Differently With More Time (Production Scale):
* **Transactional Outbox Pattern**: Store cache invalidation events inside a database `outbox` table within the same ACID transaction as the article write.
* **Reliable Asynchronous Worker**: Use a Redis-backed queue (e.g., BullMQ) with exponential backoff and jitter to consume the outbox events and retry `revalidateTag` until confirmed.
* **Distributed Circuit Breaker & Fallback TTL**: Configure a background stale-while-revalidate fallback window (`expire` in `CacheLifeConfig`) so that if invalidations persistently fail, entries naturally refresh after a bounded TTL.

---

## 7. Routes & Actions Specification

| Kind | Path / Name | Input | Response / Behavior |
| :--- | :--- | :--- | :--- |
| **Route Handler** | `GET /api/articles` | Query: `?tag=` | `200 OK`: JSON array of article summaries (`id, slug, title, tag, createdAt`). |
| **Route Handler** | `POST /api/revalidate` | Body: `{ tag, secret }` | `200 OK`: `{ revalidated: true, tag }`; `401 Unauthorized` on missing, incorrect, or unset secret. |
| **Page (RSC)** | `/articles` | Query: `?tag=` | Cached list of articles with underlying DB read counter. |
| **Page (RSC)** | `/articles/[slug]` | Slug param | Cached article detail with streamed `<Suspense>` comments. |
| **Server Action**| `publishArticle` | `FormData: title, body, tag, simulateFailure` | Persists article, invalidates by tag, handles partial failures, redirects to new slug on success. |

---

## 8. Route Handler Tests (`POST /api/revalidate`)

Automated tests are located in `tests/revalidate.test.ts` using **Vitest**:

* `✓ returns 401 when secret is missing from request body`
* `✓ returns 401 when provided secret does not match REVALIDATION_SECRET`
* `✓ returns 401 when REVALIDATION_SECRET is unset in the environment (fails closed)`
* `✓ returns 400 when tag is missing`
* `✓ returns 200 and revalidates tag when valid secret and tag are provided`

Run tests with:
```bash
npm test
```

---

## 9. Notes for the 20-Minute Technical Interview Call

* **Architecture Decision**: Why `unstable_cache` was preferred over synthetic internal `fetch` calls.
* **Fail-Closed Security**: `POST /api/revalidate` strictly validates that `process.env.REVALIDATION_SECRET` exists before comparing; it never falls back to allowing requests if the environment variable is unset.
* **Observability**: The storage engine tracks and prints `rawDbReads` on every un-cached disk read, providing verifiable proof of caching behavior.
* **Resilience**: Demonstrating both happy path (instant publish + redirect) and partial failure path (graceful error capture + dead-letter queue + self-healing).
