# Spec: Testing

## Scope

This spec defines mandatory testing rules for this repository.

## Shift-Left Rules (Mandatory)

1. External feed behavior is tested locally first.
2. Fixtures cover positive, negative, and edge cases.
3. Schema parsing is tested before mapper and endpoint tests.
4. No feature is merged without local fixture coverage for affected paths.

## Fixture Rules (Mandatory)

1. Base fixture source: `fixtures/a869cfebea250bbfe04a1b623baaf338.json`.
2. Derived fixtures represent:
   - valid minimal record
   - valid complete record
   - malformed record
   - missing required fields
   - boundary date/time values
   - unknown category/organizer values
3. Fixtures follow the client source schema shape.
4. Fixture files are deterministic and committed to the repository.

## Live Parity Check (Mandatory)

Fixtures are compared with live source payloads on a regular basis.

1. Run a live fetch comparison before major mapping/schema changes.
2. For every fixture file, include a top comment with last comparison metadata.
3. Comment format:

```text
LIVE-CHECK: 2026-04-26
SOURCE-URL: https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json
CHECKED-BY: <name-or-handle>
NOTES: schema-compatible, no new fields
```

## Required Test Layers

1. Schema tests: parse success/failure, defaults, transforms.
2. Mapper tests: source -> normalized event mapping correctness.
3. Adapter tests: fetch + parse + enrichment behavior with mocked HTTP.
4. Contract tests: API DTO responses against zod/ts-rest schemas.
5. Live e2e plausibility tests against source HTTP.

## Live E2E Plausibility Tests (Mandatory)

Live-source e2e tests are part of this repository.

1. Command: `pnpm test:e2e:live`.
2. Execution policy:
   - run in CI on schedule and on-demand
   - do not block pull requests
3. Minimum plausibility assertions:
   - source endpoint returns HTTP 200
   - payload parses with source schema
   - mapped events parse with normalized schema
   - resulting event list is non-empty
   - event start times are parseable and timezone-consistent
4. E2E run outputs are written to `/reports` under the report contract.

## Command Contract

- `pnpm test`: unit + contract tests
- `pnpm test:integration`: integration tests (fixture or controlled network)
- CI runs both for PR validation.

## Report Contract (Mandatory)

1. All test and coverage reports are written only to `/reports`.
2. Required output formats are XML/JUnit, JSON, and HTML.
3. Minimum expected files:
   - `/reports/tests/junit.xml`
   - `/reports/tests/results.json`
   - `/reports/tests/index.html`
   - `/reports/coverage/coverage-summary.json`
   - `/reports/coverage/index.html`
   - `/reports/coverage/cobertura.xml`
4. CI artifact collection reads only from `/reports`.
