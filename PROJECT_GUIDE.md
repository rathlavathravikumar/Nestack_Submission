# Project Guide

## What this project is

A Next.js article publishing app. Readers can browse articles, filter by topic, and open detail pages with streamed comments. Publishers can submit articles through a server action.

## Folder map

- `app/` — pages, layout, and API routes.
- `actions/` — server actions for publishing and cache recovery.
- `components/` — interactive form and loading UI.
- `lib/` — article caching, PostgreSQL connection/storage, local JSON fallback, and recovery queue.
- `db/migrations/` — versioned PostgreSQL schema migrations.
- `scripts/` — database migration and seed commands.
- `data/db.json` — local development data and PostgreSQL seed source.
- `tests/` — Vitest coverage for the revalidation endpoint.
- `README.md` — assessment details, setup, and architecture.
- `RaviKumarRathlavath_Nestack_Submission.zip` — preserved source snapshot.

## Backend status

The app supports PostgreSQL using `DATABASE_URL`, with JSON as a local-development fallback. No live database credentials are configured in this folder, so hosted PostgreSQL is not connected yet. Set `DATABASE_URL`, then run `npm run db:migrate` and `npm run db:seed`.

## PostgreSQL setup

1. Create a PostgreSQL database with a provider of your choice.
2. Add its private connection URL to `.env.local` as `DATABASE_URL`.
3. Set `DATABASE_SSL=true` if your provider requires TLS.
4. Run `npm run db:migrate` to create the tables and indexes.
5. Run `npm run db:seed` to copy the starter articles and comments from `data/db.json`.

Numbered SQL migrations live in `db/migrations/`. Seed imports are safe to repeat and upsert by article slug/comment ID.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`; set `REVALIDATION_SECRET` and, for PostgreSQL, `DATABASE_URL`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

Use `npm test` for the current tests and `npm run build` to check a production build.
