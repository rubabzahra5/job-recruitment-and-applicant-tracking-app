# HirePakistan

Job recruitment + applicant tracking system (ATS) for Pakistan.

> Foundation scaffold (Phase 1). Route shells, shared libraries, database schema,
> and tooling are in place; feature pages are built in later phases.

## Stack (pinned, verified Oct 2026)

| Package            | Version  |
| ------------------ | -------- |
| next               | 15.5.27  |
| react / react-dom  | 19.3.0   |
| typescript         | 5.9.3    |
| tailwindcss        | 4.3.3    |
| @supabase/ssr      | 0.12.7   |
| @supabase/supabase-js | 2.117.3 |
| zod                | 4.6.5    |
| react-hook-form    | 7.89.0   |
| @hookform/resolvers| 5.9.1    |
| vitest             | 5.0.3    |
| @testing-library/react | 16.3.3 |
| jsdom              | 30.1.2   |
| playwright / @playwright/test | 1.64.0 |
| eslint             | 9.39.5   |
| tsx                | 4.23.15  |

Full pin list: `package.json` (exact versions, no ranges).

## Quick start

```bash
cp .env.example .env   # fill in Supabase credentials
npm install
npm run dev
```

## Scripts

| Script                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start dev server                                     |
| `npm run build`         | Production build                                     |
| `npm run typecheck`     | `tsc --noEmit`                                       |
| `npm run lint`          | ESLint                                               |
| `npm test`              | Vitest unit/integration tests                        |
| `npm run test:e2e`      | Playwright end-to-end tests                          |
| `npm run bootstrap-admin` | One-time super-admin provisioning (server-only)    |
| `npm run seed`          | Dev seed data (requires `SEED_CONFIRM=yes`)          |
| `npm run db:validate`   | Apply migrations against a throwaway local Postgres  |

## Project layout

```
app/
  (public)/        public marketing + job board routes
  (candidate)/candidate/   candidate portal routes
  (employer)/employer/     employer portal routes
  (admin)/control-center/  super-admin routes
components/ui/    accessible design-system primitives
lib/              supabase clients, env, auth, rbac, domain libs
supabase/migrations/  versioned SQL schema (0001…0009)
scripts/          bootstrap-admin, seed, migration validation
tests/            vitest suites
e2e/              playwright specs
docs/             developer docs
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only (`lib/supabase/admin.ts` imports
  `server-only` and throws if ever bundled for the browser).
- Route protection in `middleware.ts` is redirect-only; real authorization
  happens server-side per page/action via `lib/rbac.ts`.
- There is no public super-admin registration. The first super admin is created
  with `npm run bootstrap-admin` (typed confirmation required); disable or
  delete the script afterwards.

## Docs

- `docs/DEVELOPMENT.md` — local development guide
- `docs/SCHEMA.md` — database schema overview
- `FOUNDATION_SUMMARY.md` — Phase 1 build report
