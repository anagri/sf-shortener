# sf-shortener — instructions for coding agents

This repository is built by an automated software factory. Work only on the ticket in TICKET.md.

## Commands
- Install: `npm ci`
- Test (Vitest inside workerd, local D1 with migrations applied): `npm test`
- Typecheck: `npm run typecheck`
- Local dev server: `npm run dev` (http://localhost:8787); local migrations: `npm run db:migrate:local`

## Stack
Cloudflare Workers + Hono (`src/index.ts`), D1 binding `DB`, static files in `public/`
(served before the Worker except `/api/*`). Endpoints `/healthz` and `/version` must keep working.

## Rules
1. Test first: write or extend a failing test in `test/unit/`, then make it pass. `npm test` and `npm run typecheck` must pass before you commit.
2. Schema changes: add a NEW file `migrations/NNNN_<name>.sql` (next number). Never edit or delete a migration that already exists on `main`.
3. Use prepared statements with `.bind()` for every D1 query. Never build SQL by string concatenation.
4. Never deploy, never run `wrangler deploy`, `wrangler versions`, `wrangler secret` or remote D1 commands. The factory deploys.
5. Never modify `AGENTS.md`, `CLAUDE.md`, `docs/SPEC.md` or anything under `.github/`. CI rejects such PRs.
6. Commit on your ticket branch, push, open a PR whose body contains `Closes #<issue>`, then write `.factory/DONE.json`
   `{ticket, status: done|stuck|needs-human, summary, commit_sha, pr, tests_cmd, tests_passed}` and stop.
7. There are hidden acceptance checks run against the deployed preview. Implement the ticket's acceptance criteria faithfully; do not guess at or search for those checks.
