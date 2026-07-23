# Deploy To Cloudflare Workers (D1)

This project is configured to deploy on Cloudflare Workers via OpenNext with Cloudflare D1.

## Architecture

- Runtime: Cloudflare Workers + OpenNext adapter.
- Database: Cloudflare D1.
- ORM: Prisma (`engineType = "client"`) + D1 adapter.

## 1. Install dependencies

- `bun install`

## 2. Prepare environment variables

Create a local env file:

1. Copy `.env.example` to `.env`.
2. Fill required values:
   - `DATABASE_URL` (local Prisma/CLI URL, usually SQLite file URL)
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`

Note:
- At runtime on Cloudflare, the app uses the D1 binding from `wrangler.jsonc` (`vmg_lms_db`).
- `DATABASE_URL` is still needed for local Prisma CLI commands (`prisma generate`, `prisma db push`, etc.).

## 3. Configure D1 binding in Wrangler

In `wrangler.jsonc`, keep/update this block:

- `binding`: `vmg_lms_db`
- `database_name`: your D1 DB name
- `database_id`: your D1 DB id

## 4. Create/apply schema on D1

Use D1 migrations (recommended for production):

- `npx wrangler d1 migrations create vmg_lms_db <migration_name>`
- `npx wrangler d1 migrations apply vmg_lms_db --remote`

For local setup with Prisma SQL push:

- `bun run db:generate`
- `bun run db:push`

## 5. Login to Cloudflare

- `npx wrangler login`

## 6. Local Cloudflare runtime preview

- `bun run preview`

This runs your app in a Workers-compatible runtime.

## 7. Deploy

- `bun run deploy`

## Notes

- OpenNext currently builds successfully with `middleware.ts` in this codebase.
- Next.js may print a deprecation warning about middleware -> proxy; this warning does not block deployment.
