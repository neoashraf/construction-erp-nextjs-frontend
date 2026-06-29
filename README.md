# Zakir Enterprise — Construction ERP (Frontend)

Responsive, **desktop-first** web client for the Construction ERP, talking to the
NestJS REST API. Standalone repo (ADR-0003 F10). This is the **scaffold** — the
chassis + app shell + cross-cutting plumbing every later per-screen brief bolts
onto. **No screens and no design system ship here** (design tokens are placeholder
`TODO`).

Built to **[ADR-0003](../../docs/decisions/0003-frontend-architecture.md)** and the
`frontend-author/nextjs-author` skill.

## Stack

Next.js 15 (App Router / RSC) · React 19 · TypeScript (`strict`) · Tailwind +
shadcn/ui · TanStack Query · react-hook-form + zod · decimal.js · openapi-typescript
(generated client) · Jest + RTL + Playwright · npm.

## Getting started

```bash
npm install
cp .env.example .env.local      # then edit values
npm run dev                     # http://localhost:3000
```

`USE_MOCK_NESTJS=true` in `.env.local` routes the BFF to an in-process mock auth
backend so you can run the app and the e2e without a live NestJS. Demo users:
`admin@ze.test` / `pm@ze.test`, password `Passw0rd!`.

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint incl. the **import-boundary** rule |
| `npm test` | Jest unit + component |
| `npm run test:e2e` | Playwright e2e (auth flow) |
| `npm run api:generate` | Regenerate the typed API client from `openapi/openapi.json` |
| `npm run format` | Prettier |

## Architecture (feature-by-module + typed api/domain layer)

```
src/
  app/
    (auth)/                  public group, no shell — auth-flow plumbing (login)
    (app)/                   role-based app shell (sidebar/topbar) + module segments (empty)
    api/                     the BFF: auth/login·refresh·logout·me + a catch-all proxy
  features/<module>/         components/ hooks/ api/ schemas/ types.ts  (empty skeleton)
  components/                shadcn/ui primitives + shared composites + the app shell
  lib/
    api/                     generated client + configured apiClient + ApiError + pagination
    auth/                    roles + capability map, route guards, project-scope, session
    bff/                     server-only: cookie bridge, CSRF, NestJS upstream (+ mock), proxy
    query/                   QueryClient + defaults + namespaced keys
    config/                  typed env (zod, fail-fast); server-only vs public split
    forms/                   RHF + zod sample pattern
    money.ts  format.ts      decimal.js money/qty (৳) + DD/MM/YYYY / E.164 / Bangla-safe
  providers/                 Query, session, company/FY, theme (React context)
  styles/ tokens.css         PLACEHOLDER design tokens (TODO — later design system)
test/  unit/ components/ e2e/ msw/
```

### Non-negotiables (see the skill §0)

- **Backend contract is canonical** — the client binds to `docs/api-contracts/` +
  overview §6 (error envelope, pagination). The generated client is regenerated,
  never hand-edited.
- **httpOnly-cookie auth** — access + refresh tokens live only in httpOnly cookies
  the Next.js BFF sets; never in client JS / localStorage. The proxy does
  refresh-on-401 + cookie rotation + one retry; CSRF via SameSite + double-submit.
- **Single role per user** — route guards + a capability map enforce role + project
  scope (defence-in-depth; the backend is the source of truth).
- **Exact money** — `Decimal(18,4)` money / `(18,3)` qty via decimal.js. Never float.
- **Import boundaries (lint-enforced)** — `features/<a>` must not import
  `features/<b>`; only `lib/api/` imports the generated client.

## The typed API client

`npm run api:generate` reads `openapi/openapi.json` (a committed snapshot of the
auth slice of the contract, since the backend's live Swagger doc doesn't exist
yet) and writes `src/lib/api/generated/schema.ts`. **Repoint the script at the
backend's OpenAPI URL once it ships** — see `src/lib/api/generated/README.md`.

## What's intentionally NOT here

Screens / pages, the real design system (tokens are `TODO`), per-module endpoint
bindings beyond auth, a monorepo / shared-types package, Redux / GraphQL / offline.
Those are later per-screen briefs / phases.
