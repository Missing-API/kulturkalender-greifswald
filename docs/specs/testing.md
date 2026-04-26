# Spec: Testing

## Scope

This spec defines mandatory testing rules for this repository.

## Shift-Left Rules (Mandatory)

1. External feed behavior is tested locally first.
2. Fixtures cover positive, negative, and edge cases.
3. Schema parsing is tested before mapper and endpoint tests.
4. No feature is merged without local fixture coverage for affected paths.

## Fixture Rules (Mandatory)

### JSON Feed Fixtures

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

### Venue/Location HTML Fixtures

1. Base fixture source: `fixtures/venues/index.html` (venue list page).
2. Per-venue detail fixtures: `fixtures/venues/{id}.html` (e.g., `fixtures/venues/230.html`).
3. Derived fixtures represent:
   - valid venue with full address (name, street, postal code + city)
   - venue with minimal data (name only)
   - venue with phone/email/web lines to be filtered
   - malformed HTML structure
   - empty or missing address block
   - venue list page with multiple entries
4. Fixtures follow the actual HTML structure served by the source.
5. Fixture files are deterministic and committed to the repository.

### Fixture Lifecycle (All Sources)

1. Download real data from the live source.
2. Build fixture files from the downloaded data.
3. Compare fixtures with real data on a regular basis (see Live Parity Check).
4. Add metadata comments to each fixture documenting origin and verification date.

## Live Parity Check (Mandatory)

Fixtures are compared with live source payloads on a regular basis.

1. Run a live fetch comparison before major mapping/schema changes.
1. For every fixture file, include a top comment with last comparison metadata.
1. Comment format for JSON fixtures:

```text
LIVE-CHECK: 2026-04-26
SOURCE-URL: https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json
CHECKED-BY: <name-or-handle>
NOTES: schema-compatible, no new fields
```

1. Comment format for HTML fixtures:

```html
<!--
LIVE-CHECK: 2026-04-26
SOURCE-URL: https://www.kulturkalender.greifswald.de/venues/230
CHECKED-BY: <name-or-handle>
NOTES: address block structure unchanged
-->
```

## Required Test Layers

1. Schema tests: parse success/failure, defaults, transforms.
2. Mapper tests: source -> normalized event mapping correctness.
3. Venue HTML parsing tests: extract address from venue list and detail pages using HTML fixtures.
4. Adapter tests: fetch + parse + enrichment behavior with mocked HTTP.
5. Contract tests: API DTO responses against zod/ts-rest schemas.
6. Live e2e plausibility tests against source HTTP.

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
   - venue list page returns HTTP 200 and contains venue links
   - at least one venue detail page returns HTTP 200 and yields a parseable address block
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
