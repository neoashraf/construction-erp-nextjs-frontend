# Construction ERP (Frontend)

Desktop-first web client for a project-centric construction ERP built for a
Bangladeshi construction group: accounting, project management, inventory,
purchasing, IPC billing and HR on one general ledger. It talks to the NestJS
REST API in the sibling repo `construction-erp-nestjs-backend`, always
through its own Next.js BFF; the browser never calls NestJS directly. The architecture follows ADR-0003
(`docs/decisions/0003-frontend-architecture.md` in the workspace repo).

## Stack

| Concern | Library (version locked in package-lock.json) |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19.2, TypeScript 5.9 (`strict`) |
| Styling | Tailwind CSS 3.4 + shadcn/ui-style primitives on Radix, lucide-react icons |
| Server state | TanStack Query 5 |
| Forms | react-hook-form 7 + zod 3 |
| Money / quantity | decimal.js 10 |
| API types | openapi-typescript 7 |
| Tests | Jest 29 + React Testing Library 16, Playwright 1.61 |
| Spreadsheet export | SheetJS (`xlsx` 0.20.3 from cdn.sheetjs.com) |

Node >= 20, npm.

## Screens and modules

81 routes, grouped by module. Almost every `page.tsx` is a thin wrapper that
renders a screen component from `src/features/<module>/`.

| Module | Screens |
|---|---|
| Auth | Login, change password |
| Dashboard | Role-scoped KPI tiles (post-login home) |
| Master data | Company settings, financial years, chart of accounts, cost centres, purposes, items, parties (list + detail), projects (list + detail), numbering series |
| Ledger | Journal entries, account ledger, trial balance, entry viewer |
| Period control | Period manager |
| Audit and security | Users, roles and permissions, per-user project assignment, audit log |
| Cost control | Budget vs actual, cost-centre profitability, over-budget alerts |
| Inventory | Stock journals (list + editor), stock ledger |
| Purchase | Purchase orders (list + editor), bills (list + detail), GRNs (list + entry), GRN-to-PO match |
| Requisitions | Requisitions (list + entry), approvals (worklist + detail), issues (worklist + detail) |
| Sales / IPC | IPC list, editor, viewer, IPC register, Mushak print preview |
| Receipts | List, editor, viewer |
| Payments | List, editor, viewer, open payables (the list opened on its Outstanding view) |
| Contra and journal | Voucher list, contra / journal voucher editor, opening-journal wizard |
| HR | Employees (list + detail), attendance, holidays, salary sheets (list + editor), payslips (list + document) |
| Reports | Catalogue, financial statements (P&L + balance sheet), trial balance and ledgers, project / IPC, requisition cost control, inventory, HR |
| Account | Profile, notifications, settings launcher (topbar gear) |

Also present: landing pages for Master data, Ledger and Audit, a 403 page, a
`/numbering` redirect to the numbering-series screen, and `/design`, a living
gallery of the tokens and primitives outside the app shell.

## Design system

- **Where the designs live.** Screen specs, prompts and design files are in the
  workspace repo under `docs/design/`. Screens were generated in Claude Design,
  exported as ZIP, and placed under `docs/design/design-files/<NN-module>/` as
  `.dc.html` files. `scripts/render-design-file.mjs` renders one of those files
  to PNG through Playwright Chromium so a built screen can be compared with it.
- **Tokens.** `src/styles/tokens.css` holds the real token values, in two
  layers:
  - *Brand layer*: primary navy `#1C2C4C`, accent lime `#A3CE3C` and the
    sidebar scale, taken from the client logo.
  - *Structural layer*: neutrals, status colours (success, warning,
    destructive, info, each with soft and ink tints), six chart colours,
    radius, shadow, motion and font stacks.

  A `[data-theme="dark"]` block exists but is provisional and not
  contrast-checked; the app ships light only. The tokens are local to this
  repo and not published as a shared package. The two-layer split is meant to
  let another client reskin by overriding the brand layer only.
- **Tailwind mapping.** `tailwind.config.ts` maps every colour, radius, shadow
  and font token to a utility (`bg-primary`, `text-accent-ink`,
  `bg-success-soft`, `rounded-card`, ...). An ESLint rule rejects raw hex
  colours in app code (the `/design` gallery is exempt).
- **What the tokens do not cover.** There is no custom spacing or type scale.
  Screens use Tailwind's default spacing plus arbitrary pixel values
  (`text-[13px]`, `px-[18px]`).
- **Fonts.** Inter, Hind Siliguri (so Bangla text never clips) and JetBrains
  Mono, self-hosted through `next/font`.
- **Components.** `src/components/ui/` has the shadcn/ui-style primitives:
  alert, avatar, badge, breadcrumb, button, card, checkbox, date-picker,
  dialog, dropdown-menu, empty-state, input, label, money-input,
  numeric-input, select, sheet, skeleton, switch, table, textarea and toast.
  `src/components/shell/` is the app shell: sidebar, topbar, nav drawer,
  command palette, breadcrumb, company / FY switcher, alerts bell and user
  menu.

## Architecture

```
src/
  app/
    (auth)/        login, change password (no shell)
    (app)/         role-guarded app shell + one segment per module
    (print)/       print layouts (Mushak IPC)
    api/           the BFF: auth, catch-all proxy, file/report endpoints
    design/        token + primitive gallery
  features/<module>/   components/ hooks/ api/ schemas/ types.ts
  components/      ui/ primitives, shell/, shared composites
  lib/             api/ auth/ bff/ config/ query/ nav/ money.ts format.ts
  providers/       query, session, company/FY, theme
  styles/          tokens.css
```

- **Feature-by-module.** 18 modules under `src/features/`: audit,
  contra-journal, cost-control, dashboard, hr, inventory, ledger, master-data,
  notifications, numbering, payments, period, profile, purchase, receipts,
  reports, requisitions, sales-ipc. Each has `components/`, `hooks/`, `api/`
  and `types.ts`; all but dashboard and notifications also have `schemas/`.
- **BFF.** Route handlers under `src/app/api/`:
  - `auth/login`, `auth/refresh`, `auth/logout`, `auth/me`
  - a catch-all proxy (`[...path]`) to NestJS
  - `audit-logs/export`, `reports/[name]`, `profile/image`,
    `notifications/ws-ticket`

  Login stores the access token, refresh token and safe user in httpOnly
  cookies; the refresh cookie lives 7 days. The proxy attaches the bearer
  from the cookie. On a `TOKEN_EXPIRED` 401, or when the access cookie has
  already expired but the refresh cookie remains, it refreshes, rotates the
  cookies and retries once. If refresh fails it clears the cookies and returns
  401.

  CSRF uses SameSite cookies plus a double-submit token: POST, PUT, PATCH and
  DELETE must send an `x-csrf-token` header matching the `ze_csrf` cookie.

  One exception to "tokens stay server-side": `GET /api/notifications/ws-ticket`
  returns the access token to client JS so the notifications WebSocket can
  authenticate. The code marks this as a Phase 1 shim pending a short-lived
  ticket from NestJS. Notifications use a bare browser WebSocket, not a
  socket.io client.
- **Mock backend.** With `USE_MOCK_NESTJS=true` the BFF routes to an
  in-process mock (`src/lib/bff/mock-nestjs.ts`) that answers for every module
  with sample data. The Playwright suite runs against it. Never enable it in
  production.
- **Auth and roles.** `src/lib/auth/` holds the role list (Admin, Project
  Manager, Site Engineer, Store Keeper, Accounts Team / Accounts Manager, HR
  Manager), the module map, project scope and the server-side guards. The
  `(app)` layout sends unauthenticated visitors to `/login`; module and
  resource checks send a role without access to `/403`. The backend remains
  the source of truth for permissions.
- **API client.** `src/lib/api/client.ts` is the single configured client. It
  targets the BFF, sends cookies, maps the error envelope to a typed
  `ApiError` and types pagination. Each feature's `api/` folder wraps it with
  hand-written request and response types that mirror the API contracts in
  the workspace (`docs/api-contracts/`).

  `npm run api:generate` builds `src/lib/api/generated/schema.ts` from
  `openapi/openapi.json`, which is still the committed auth-only snapshot from
  the scaffold (4 `/auth/*` paths). It has not been regenerated from the
  backend's live Swagger. The generated file is never hand-edited.
- **Import boundaries (lint-enforced).** `eslint-plugin-boundaries` stops one
  feature importing another and stops `components/`, `lib/` and `providers/`
  importing any feature. `src/components/shell/alerts-bell.tsx` has a recorded
  exception. `no-restricted-imports` keeps the generated client inside
  `src/lib/api/`. `localStorage` and `sessionStorage` are banned globals.
- **Money.** `src/lib/money.ts` does all money and quantity arithmetic in
  decimal.js: money at scale 4 (`Decimal(18,4)`), quantity at scale 3, Taka
  formatting and amount-in-words. Never JS floats. `money-input` and
  `numeric-input` only filter keystrokes; values stay strings until
  `lib/money` parses them. Dates display as `DD/MM/YYYY`; phones are E.164
  (`src/lib/format.ts`).

## Testing

| Suite | Location | Files | Command |
|---|---|---|---|
| Unit (Jest) | `test/unit/` | 32 | `npm test` |
| Component (Jest + RTL) | `test/components/` | 77 | `npm test` |
| End-to-end (Playwright) | `test/e2e/` | 65 | `npm run test:e2e` |

`npm test` runs the unit and component suites together. `npm run test:e2e`
builds the app, starts it with `USE_MOCK_NESTJS=true` and runs Playwright
against it, so no live backend is needed.

CI (`.github/workflows/deploy.yml`) runs `npm run typecheck`, `npm run lint`
and `npm test` on pushes to `dev` and `main`, then deploys with Docker
Compose on self-hosted runners.

## Getting started

```bash
npm install
cp .env.example .env.local      # then edit values
npm run dev                     # http://localhost:4000
```

To run without a live NestJS backend, add `USE_MOCK_NESTJS=true` to
`.env.local`. The mock's demo users are `admin@ze.test` (Admin) and
`pm@ze.test` (Project Manager), password `Passw0rd!`. They exist only in the
mock, not in the real backend.

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Dev server on port 4000 |
| `npm run build` / `npm start` | Production build / serve on port 4000 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the import-boundary and no-raw-hex rules |
| `npm test` | Jest unit + component tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run api:generate` | Regenerate the typed client from `openapi/openapi.json` |
| `npm run format` | Prettier |

## Environment

Validated at boot by zod (`src/lib/config/`); the app fails fast on a bad
value. See `.env.example`.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | public | The app's own origin, for absolute BFF URLs during SSR and tests |
| `NESTJS_API_BASE_URL` | server only | NestJS API base, e.g. `http://localhost:3000/api` |
| `AUTH_CSRF_SECRET` | server only | Required, at least 16 characters. Validated at boot but not currently read by the CSRF code |
| `AUTH_COOKIE_SECURE` | server only | `true` in production (https) |
| `AUTH_COOKIE_SAMESITE` | server only | `lax` or `strict` |
| `USE_MOCK_NESTJS` | server only | `true` routes the BFF to the in-process mock. Default `false` |

## Status

Phase 1 went live in August 2026 with the client's accounts team. All 18
feature modules listed above are built, including the flat 11-section
sidebar and the settings gear.
