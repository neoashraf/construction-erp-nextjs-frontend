# Generated API types — DO NOT EDIT

`schema.ts` is produced by `npm run api:generate` (openapi-typescript) from
`openapi/openapi.json`. **Never hand-edit it** — re-run the generator instead
(skill §3, ADR-0003 F6).

## Regenerating

```bash
npm run api:generate
```

## Pointing at the live backend

Today the generator reads the committed `openapi/openapi.json` (the auth slice of
the contract, from `docs/api-contracts/05-audit-security.md`) because the NestJS
backend's live Swagger doc does not exist yet. Once it ships, repoint the
`api:generate` script in `package.json` at the backend's OpenAPI URL, e.g.:

```jsonc
"api:generate": "openapi-typescript http://localhost:4000/api-json -o ./src/lib/api/generated/schema.ts"
```

The configured `apiClient` and the `ApiError`/pagination mappers in
`src/lib/api/` are hand-written and stable; only this file is generated.
