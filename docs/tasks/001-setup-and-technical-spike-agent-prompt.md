# Task: Setup + Technical Spike (Agent Prompt)

Use this task as a direct prompt for an implementation agent.

## Mission

Create a first runnable spike version of this service that proves the complete vertical path:

1. local development setup,
2. clean build/test/lint pipeline,
3. API delivery for JSON and ICS,
4. Swagger/OpenAPI visibility,
5. CI/CD and production-readiness hooks.

The spike is not final product logic. The spike is a setup and platform proof that all layers work end-to-end.

## Hard Requirements

1. Use `pnpm` for all setup and scripts.
2. Use Next.js + TypeScript + Vitest stack from repository docs.
3. Implement both JSON and ICS outputs.
4. Provide a visible index page with links to API, Swagger docs, and sample ICS endpoint.
5. Use dummy data for the spike API payloads (no live source dependency required for the first pass).
6. Keep schema-first approach using zod.
7. Keep report outputs under `/reports` in XML/JUnit, JSON, and HTML formats.

## Required Deliverables

### A. Bootstrap and Tooling

- `package.json` with scripts from docs, including `check`.
- `tsconfig.json`, `next.config.*`, `next-env.d.ts`.
- ESLint flat config using `@schafevormfenster/eslint-config` profiles.
- Vitest config for unit tests.
- Vitest live config placeholder for `test:e2e:live`.
- `.env.example` with documented defaults.

### B. Minimal App and API Spike

- Index page at `/` with links to:
  - `/api/v1/events` (dummy JSON)
  - `/api/v1/events.ics` (dummy ICS)
  - `/api/docs` (Swagger UI)
  - `/api/docs/openapi.json`
- API endpoints:
  - `GET /api/v1/events`
  - `GET /api/v1/events.ics`
- Dummy data source module in code (in-memory list with at least 3 events).

### C. Contracts and Schemas

- Zod source schema (spike dummy source schema is acceptable).
- Zod normalized event schema.
- Zod API DTO schemas.
- Schema descriptions, strict mode, and deterministic transforms/defaults.

### D. Swagger/OpenAPI

- Generate and serve OpenAPI JSON for the spike endpoints.
- Serve Swagger UI page that renders the OpenAPI spec.

### E. Testing and Reports

- Unit tests for schema parse behavior and mapper transformation.
- One API-level test for JSON endpoint.
- One API-level test for ICS endpoint shape/content-type.
- Configure reporters so outputs are written under:
  - `/reports/tests/junit.xml`
  - `/reports/tests/results.json`
  - `/reports/tests/index.html`
  - `/reports/coverage/coverage-summary.json`
  - `/reports/coverage/index.html`
  - `/reports/coverage/cobertura.xml`

### F. CI/CD Spike

- Add `.github/workflows/ci.yml` with:
  - install (`pnpm install`)
  - `pnpm check`
  - artifact upload from `/reports`
- Keep deployment via Vercel Git integration (no custom deploy workflow).

## Suggested Implementation Order

1. Initialize dependencies with `pnpm`.
2. Set up scripts, TypeScript, ESLint, Vitest, report outputs.
3. Build minimal API + schemas + mapper + dummy data.
4. Add ICS serialization for dummy events.
5. Add Swagger/OpenAPI JSON + UI endpoint.
6. Build index page linking all spike endpoints.
7. Add tests and confirm `/reports` output.
8. Add CI workflow and verify commands.

## Acceptance Criteria (Definition of Done)

1. `pnpm install` succeeds.
2. `pnpm check` succeeds locally.
3. `pnpm test:coverage` writes coverage and test reports into `/reports` in required formats.
4. Visiting `/` shows a simple index page with working links.
5. `GET /api/v1/events` returns valid JSON list.
6. `GET /api/v1/events.ics` returns valid ICS response with `text/calendar` content type.
7. `GET /api/docs/openapi.json` returns OpenAPI JSON.
8. `GET /api/docs` renders Swagger UI.
9. CI workflow runs `pnpm check` and publishes `/reports` artifacts.

## Constraints

1. Keep the spike implementation small and clear.
2. Do not add production crawling logic in this task.
3. Do not depend on live external source for basic spike success.
4. Keep code aligned with docs in this repository.

## Handoff Output

At completion, provide:

1. File list created/changed.
2. Commands executed.
3. Test and build summary.
4. Remaining gaps for production hardening.
