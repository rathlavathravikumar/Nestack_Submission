# Next.js Content Console

LIVE DEPLOYMENT: Not deployed (GitHub submission only)

> **Backend status:** The app supports PostgreSQL through `DATABASE_URL`, with local JSON as a development fallback. This folder does not contain database credentials, so a hosted database still needs to be provisioned and configured.

> **Live deployment:** Not deployed by this workspace session.
> **Technical Assessment**: Nestack Revision 2  
> **Candidate**: Ravi Kumar Rathlavath (`ravirathlavath79@gmail.com`)  
> **Repository**: `https://github.com/rathlavathravikumar/Nestack_Submission`  
> **Target Framework**: **Next.js 16.4.3** (App Router strictly, React 19, TypeScript)  
> **Live Deployment Link**: Not deployed yet.

---

---

## 1. Overview

This submission is a small article console built with Next.js App Router. It lists and filters articles, displays article detail pages with streamed comments, publishes new articles, and refreshes tagged cached reads after writes.

### Exact stack versions

- Next.js **16.4.3** (the exact version installed in this repository)
- React 19
- TypeScript 5.7
- Node.js 20 or newer (verified here on 24.18.0)
- npm 11 (verified here on 11.16.0)

## 2. Quickstart & Local Setup

### PostgreSQL Setup

1. Create a PostgreSQL database with your hosting provider.
2. Set `DATABASE_URL` in `.env.local` (and `DATABASE_SSL=true` if required by the provider).
3. Run `npm run db:migrate` to create the schema.
4. Run `npm run db:seed` to import the starter articles and comments from `data/db.json`.

When `DATABASE_URL` is blank, the app uses the local JSON file for development. Never commit `.env.local` or publish database credentials.

### Prerequisites
* **Node.js**: v20+ (tested on Node v24.18.0)
* **Package Manager**: `npm` (v11+) or `pnpm`

### Setup Instructions
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Copy .env.example to .env.local and set a private random REVALIDATION_SECRET
cp .env.example .env.local

# 3. Run automated tests (Vitest)
npm test

# 4. Run production build & start
npm run build
npm start
```
The application will be live at `http://localhost:3000`.

Do not deploy with an empty revalidation secret. Set `REVALIDATION_SECRET` and `DATABASE_URL` in your hosting provider's environment settings. To initialize a PostgreSQL database, run `npm run db:migrate` followed by `npm run db:seed` after configuring `.env.local`. Set `DATABASE_SSL=true` if your provider requires SSL.

---

## 3. Which Components are Client Components and Why?

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
     * Contains the interactive recovery button that invokes the `recoverArticleInvalidation` Server Action.

---

## 4. Which Caching Primitive Was Chosen and Why?

We selected **`unstable_cache` with tagged entries (`next/cache`)** paired with **`revalidateTag`**. It wraps both PostgreSQL queries and local JSON reads, so cache hits avoid calling the storage adapter in either mode:

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
1. **Decoupled from Synthetic HTTP**: `unstable_cache` wraps the storage queries directly.
2. **Underlying Data Source Protection**: Repeated requests can hit Next.js' tagged Data Cache without repeating the underlying query. Development cache behavior differs from production; verify with `npm run build && npm start` when demonstrating cache hits.
3. **Targeted Precision**: By tagging both the collection (`'articles'`) and individual slugs (`'article:${slug}'`), a publish invalidates exactly what changed without purging unrelated cache entries or rebuilding the site.
4. **List & Detail Synchronization**: Both the list query and detail query subscribe to relevant tags. When an article is published or edited, both views are invalidated together, ensuring the list and detail pages **never disagree**.

---

## 5. How a Publish Reaches Readers

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

## 6. Streaming the Slow Comments Panel

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

## 7. Write Path Under Partial Failure (Deep Dive)

### The Dual-Step Problem
A publishing pipeline consists of two steps that can fail independently:
1. **Write to Database**: State persistence.
2. **Invalidate Cache (`revalidateTag`)**: Cache synchronization.

### Simulating Invalidation Failure
Set the operator-controlled environment variable `SIMULATE_INVALIDATION_FAILURE=true` and restart the app before publishing. This environment setting deliberately fails only after the article write has completed; publishing inputs cannot activate the simulation.

### 1. What the Reader Sees:
* The article was written to the database, but because cache invalidation failed, the reader hitting `/articles` continues to receive the **stale, cached snapshot**.
* The system remains highly available and readable, but slightly out of sync (eventual consistency delayed).

### 2. What the Publisher Sees:
* The Server Action catches the invalidation error instead of crashing with an unhandled exception.
* The publisher remains on the page and receives a clear advisory alert banner:
  > **âš ï¸ Partial Failure Encountered**: Article #art-xxx was saved to persistent storage, but cache invalidation failed: *"Cache cluster connection timeout on revalidateTag('articles')"*.
  > Readers will see stale content until invalidation succeeds.
  > **Action Available**: [Recover: Revalidate Cached Article Tags]

### 3. What the Code Does & How the System Recovers:
* **Recovery record**: With PostgreSQL, a row is inserted into the durable `invalidation_outbox` table after an invalidation failure. Local JSON mode records the row in `data/db.json`; it has no multi-instance durability.
* **Self-Healing Recovery Path**: The publisher can click **"Recover: Revalidate Cached Article Tags"**. This invokes a server action that retries the collection and specific detail tags without exposing a secret in the browser.
* After both tags revalidate, the recovery record is marked resolved. This is an explicit retry through the `recoverArticleInvalidation` Server Action, not an automatic background worker.

### 4. What We Would Do Differently With More Time (Production Scale):
* **Atomic outbox write**: Insert the article and invalidation outbox event in one PostgreSQL transaction (the current implementation stores a recovery record immediately after the write, leaving a small crash window).
* **Reliable asynchronous worker**: Add a scheduled worker that retries outbox records with backoff.
* **Distributed Circuit Breaker & Fallback TTL**: Configure a background stale-while-revalidate fallback window (`expire` in `CacheLifeConfig`) so that if invalidations persistently fail, entries naturally refresh after a bounded TTL.

---

## 8. Routes & Actions Specification

| Kind | Path / Name | Input | Response / Behavior |
| :--- | :--- | :--- | :--- |
| **Route Handler** | `GET /api/articles` | Query: `?tag=` | `200 OK`: JSON array of article summaries (`id, slug, title, tag, createdAt`). |
| **Route Handler** | `POST /api/revalidate` | Body: `{ tag, secret }` | `200 OK`: `{ revalidated: true, tag }`; `401 Unauthorized` on missing, incorrect, or unset secret. |
| **Page (RSC)** | `/articles` | Query: `?tag=` | Cached list of articles with underlying DB read counter. |
| **Page (RSC)** | `/articles/[slug]` | Slug param | Cached article detail with streamed `<Suspense>` comments. |
| **Server Action**| `publishArticle` | `FormData: title, body, tag` | Validates and persists article, invalidates collection and detail tags, reports partial failure, redirects after success. |

---

## 9. Route Handler Tests (`POST /api/revalidate`)

Automated tests are located in `tests/revalidate.test.ts` using **Vitest**:

* `âœ“ returns 401 when secret is missing from request body`
* `âœ“ returns 401 when provided secret does not match REVALIDATION_SECRET`
* `âœ“ returns 401 when REVALIDATION_SECRET is unset in the environment (fails closed)`
* `âœ“ returns 400 when tag is missing`
* `âœ“ returns 200 and revalidates tag when valid secret and tag are provided`

Run tests with:
```bash
npm test
```

The endpoint accepts only the `articles` tag. It returns 400 for malformed JSON, non-object bodies, missing tags, or tags outside this allowlist; authentication is checked first for valid object payloads. It never accepts credentials in a URL.

## Deployment

1. Keep `.env.local`, database credentials, and the ZIP snapshot out of the repository.
2. Share the GitHub repository link through the assignment process.
3. Create a PostgreSQL database with a provider that supports persistent connections or its serverless pooler. Apply `npm run db:migrate` and `npm run db:seed` using the provider URL.
4. If deploying later, import the repository into Vercel. Set `DATABASE_URL`, `DATABASE_SSL`, and a strong random `REVALIDATION_SECRET` in the production environment. Set the database pool size to a provider-appropriate low value.
5. Deploy and verify `/articles`, publishing, and the API before adding a real deployment URL here.

## Known limitations and next improvements

- Local PostgreSQL persistence is configured and verified in this workspace; production deployment credentials still need to be configured in the hosting provider.
- JSON fallback is for local development only. Its recovery state and data are not shared across Vercel instances.
- The database outbox is durable, but retries require an operator action; there is no background worker.
- I would add transactionally inserted outbox rows, database-backed articles/comments tests, and a scheduled retry worker next.

---

## 10. Notes for the 20-Minute Technical Interview Call

* **Architecture Decision**: Why `unstable_cache` was preferred over synthetic internal `fetch` calls.
* **Fail-Closed Security**: `POST /api/revalidate` strictly validates that `process.env.REVALIDATION_SECRET` exists before comparing; it never falls back to allowing requests if the environment variable is unset.
* **Cache demonstration**: Use `npm run build && npm start`, request the same article/list twice, and observe that Next.js serves the tagged cached read. Development mode may bypass or vary cache behavior.
* **Resilience**: Demonstrating both happy path (instant publish + redirect) and partial failure path (graceful error capture + dead-letter queue + self-healing).
