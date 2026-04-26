# Task: Production Implementation (Agent Prompt)

Use this task as a direct prompt for an implementation agent.

## Mission

Implement the full production Kulturkalender Greifswald adapter, replacing the existing spike with live feed fetching, venue enrichment, hardened ICS output, caching, logging, and contract-first API delivery.

The spike (M0 scaffolding) is already complete — schemas, dummy data, route handlers, tests, CI, and OpenAPI exist. This task builds production logic on top of that foundation.

## Guiding Principles

1. **TDD / Fixture-First**: Every functional block starts with fixtures and failing tests before implementation.
2. **Schema-First Validation**: No data flows without passing through zod schemas (source parse → map → delivery parse → output format).
3. **Quality Gate Per Block**: `pnpm check` (typecheck + lint + build + test) must pass after every functional block before proceeding.
4. **Incremental Delivery**: Each milestone produces a working, deployable state.

## Strategic Milestones

| # | Milestone | Summary |
| --- | --- | --- |
| M0 | Fixture Foundation, Dependencies & Schema Hardening | Install deps, download fixtures, add live-check metadata, harden schemas against real data |
| M1 | Source Adapter — Live Feed Fetch + Mapping | Replace dummy data, apply full mapper with edge cases |
| M2 | Venue Enrichment — Build-Time + Runtime | Two-layer venue resolution, cheerio parsing, `venues.generated.json` |
| M3 | ICS Output Hardening | `data-text-mapper` integration, forked `ics@2.41.1`, VTIMEZONE, TZID, snapshots |
| M4 | Infrastructure — Caching, Logging, Error Handling | Feed cache, event cache, structured logging, HTTP headers |
| M5 | Contract-First API Hardening | `ts-rest-zod-handler`, `rest-commons`, OpenAPI update |
| M6 | Live E2E + CI Hardening | Live plausibility tests, `test:integration`, CI artifacts |

---

## M0: Fixture Foundation, Dependencies & Schema Hardening

### F0-deps: Install All Missing Dependencies

Install before any other work. No feature work begins until `pnpm check` passes with new deps.

| Package | Install Command | Type | Used In | Notes |
| --- | --- | --- | --- | --- |
| `cheerio` | `pnpm add cheerio` | production | M2 | Venue HTML parsing |
| `@schafevormfenster/data-text-mapper` | `pnpm add @schafevormfenster/data-text-mapper` | production | M3 | ICS/JSON description assembly. Verify API (`dataToText`, `dataToHtml`, `TextWithData`) against `allris-ics` or `kirche-mv-kalender` during F3a |
| `@schafevormfenster/ts-rest-zod-handler` | `pnpm add @schafevormfenster/ts-rest-zod-handler` | production | M5 | Contract-first route handler wiring |
| `@schafevormfenster/rest-commons` | `pnpm add @schafevormfenster/rest-commons` | production | M5 | Shared REST schemas/utilities |
| `ics` (forked) | `pnpm add ics@https://github.com/schafevormfenster/ics.git` | production | M3 | **Replaces** npm `ics@^3.12.0`. Fork is v2.41.1 with `htmlContent`/`X-ALT-DESC` support. Branch: `master`. Adapt `ics-formatter.ts` to v2 API. |

**Quality gate**: `pnpm check` green after install. Fix any breakage from ics v3→v2 swap immediately.

### F0a: Feed Fixture Live-Check Metadata

Add `LIVE-CHECK` metadata comment to the top of `fixtures/a869cfebea250bbfe04a1b623baaf338.json` (as a separate `.meta` file since JSON doesn't support comments):

Create `fixtures/a869cfebea250bbfe04a1b623baaf338.meta`:

```text
LIVE-CHECK: 2026-04-26
SOURCE-URL: https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json
CHECKED-BY: agent
NOTES: schema-compatible, no new fields
```

Verify the source schema parses the entire real fixture (all ~800 events) without error.

### F0b: Download Venue HTML Fixtures

Download and commit:

- `fixtures/venues/index.html` — venue list page from `https://www.kulturkalender.greifswald.de/venues/`
- `fixtures/venues/230.html` — example venue detail page
- `fixtures/venues/42.html` — another venue for variety

Add `.meta` files with `LIVE-CHECK` metadata for each.

### F0c: Derive Edge-Case JSON Fixtures

Create derived fixtures in `fixtures/derived/`:

- `valid-minimal.json` — single event with all nullable fields as null, empty time
- `valid-complete.json` — single event with all fields populated
- `malformed-missing-title.json` — event missing required `title`
- `malformed-extra-fields.json` — event with unknown fields (strict mode rejection)
- `boundary-dates.json` — events with edge-case dates (DST transition, year boundary, midnight)
- `vhs-overlap.json` — event with organiser containing "Volkshochschule"

### F0d: Derive Venue HTML Edge-Case Fixtures

Create in `fixtures/venues/derived/`:

- `minimal-name-only.html` — venue with only name, no address spans
- `full-address.html` — venue with name, street, postal+city
- `with-phone-email.html` — venue with phone/email lines to filter
- `malformed-structure.html` — broken/missing expected elements
- `empty-address-block.html` — address block present but empty

### F0e: Harden Source Schema

Validate `KulturkalenderSourceEventSchema` against the full real fixture. Fix any mismatches:

- Confirm all nullable fields are correctly modeled
- Add `.transform()` for whitespace normalization where needed
- Confirm `.strict()` rejects unknown fields
- Write tests: parse full fixture, parse each derived fixture (expect success/failure appropriately)

### F0f: Harden Normalized Event Schema

- Review nullable field modeling
- Tighten enums where possible
- Ensure transforms are deterministic and side-effect free
- Write tests for defaults and transforms

### F0g: Harden API DTO Schema

- Align with normalized schema changes from F0f
- Ensure strict mode

### F0h: Add `VENUES_BASE_URL` Environment Variable

Add to `.env.example`:

```text
VENUES_BASE_URL=https://www.kulturkalender.greifswald.de/venues/
```

Create a config module (e.g., `src/config.ts`) that exports env vars with defaults:

```ts
export const config = {
  feedUrl: process.env.KULTURKALENDER_FEED_URL ?? "https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json",
  venuesBaseUrl: process.env.VENUES_BASE_URL ?? "https://www.kulturkalender.greifswald.de/venues/",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? "10000"),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? "3600"),
  cacheStaleWhileRevalidateSeconds: Number(process.env.CACHE_STALE_WHILE_REVALIDATE_SECONDS ?? "600"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? "Europe/Berlin",
};
```

---

## M1: Source Adapter — Live Feed Fetch + Mapping

### F1a: Live Feed Fetch Module

Create `src/services/adapters/kulturkalender/kulturkalender.adapter.ts`:

- Fetch from `config.feedUrl` with `config.requestTimeoutMs` timeout
- One retry on transient failure (5xx, network error) with 500ms backoff
- Parse response with `KulturkalenderSourceFeedSchema`
- Return typed array of source events
- Follow proven adapter conventions (be gentle to source systems)

Tests: mock HTTP, assert timeout/retry/parse behavior.

### F1b: Full Mapper with Edge Cases

Enhance `kulturkalender.mapper.ts`:

1. **Organizer fallback**: When `organiser` is null, use `"Kulturkalender Greifswald"`.
2. **VHS soft-tag**: When `organiser` or `venue` contains "Volkshochschule" (case-insensitive), add metadata tag `vhs-overlap`. Do NOT filter the event out.
3. **Category mapping**: Map source categories to internal taxonomy (pass-through for now, document mapping table).
4. **Empty time handling**: Already done (midnight fallback), verify with fixture tests.
5. **Description assembly**: Integrate `@schafevormfenster/data-text-mapper` (see M3, but prepare hookpoint now).

Tests: fixture-driven tests for each edge case using derived fixtures from F0c.

### F1c: Wire Live Adapter into Service

Replace dummy data import in `get-events.service.ts` with live adapter call:

- Call adapter to fetch feed
- Map each event through mapper
- Validate through `NormalizedEventSchema`
- Return validated events

Keep the validation pipeline: source parse → map → delivery parse.

---

## M2: Venue Enrichment — Build-Time Warm-Up + Runtime Lazy Fallback

### F2a: Venue Index HTML Parser

Create `src/services/shared/venue/parse-venue-index.ts`:

- Parse venue list HTML using `cheerio`
- Extract all links matching `a[href^="/venues/"]`
- Build `Map<string, { id: string; url: string }>` keyed by normalized venue name
- Normalization: trim, lower-case, collapse multiple spaces to one

Tests: parse `fixtures/venues/index.html`, assert expected venues extracted.

### F2b: Venue Detail Page Parser

Create `src/services/shared/venue/parse-venue-detail.ts`:

- Parse venue detail HTML with `cheerio`
- Extract address from `span.d-block` elements
- Filter out phone/email/web lines
- Format: `"Name, Street, PostalCode City"`

Tests: parse each venue HTML fixture, assert correct/filtered output.

### F2c: Build-Time Warm-Up Script

Create `scripts/warm-venues.ts`:

- Fetch venue index from `config.venuesBaseUrl`
- Discover all venue links
- Fetch each detail page in bounded batches (`batchSize=10`, `delayMs=300`, `retries=1`, timeout 10s)
- Parse address for each
- Write `src/data/venues.generated.json` with schema from data-source spec
- If full fetch fails: build fails explicitly
- If partial fetch fails: build succeeds with partial data, log failures

Add `prebuild` script to `package.json`: `"prebuild": "tsx scripts/warm-venues.ts"`

### F2d: Static Import

- Import `venues.generated.json` in venue lookup module
- Add to `.gitignore` (regenerated on each build)

### F2e: Runtime Lazy Venue Fetch

Create `src/services/shared/venue/fetch.ts`:

- Single-venue fetch with 5s timeout, no retry
- Module-level in-memory `Map<string, VenueData>` cache
- On failure: return null (caller uses raw venue text)

### F2f: Two-Layer Venue Lookup

Create `src/services/shared/venue/lookup.ts`:

Resolution order:

1. Static map (`venues.generated.json`) by normalized venue name
2. Runtime lazy fetch (on static miss)
3. Original feed `venue` text (when both fail)
4. Empty string (when `venue` is null)

### F2g: Integrate into Mapper

Update mapper to call venue lookup for location enrichment. Set `locationSource` metadata for observability.

---

## M3: ICS Output Hardening

### F3a: Verify and Integrate `@schafevormfenster/data-text-mapper`

1. Inspect `allris-ics` or `kirche-mv-kalender` repos to verify API shape of `dataToText()`, `dataToHtml()`, `TextWithData` interface (especially `scopes` vocabulary).
2. Integrate into mapper for description assembly:
   - Build `TextWithData` with description, url, tags (category), scopes (derive from category per ICS spec), image.
   - Generate plain text description via `dataToText()`.
   - Generate HTML description via `dataToHtml()`.

### F3b: Rewrite ICS Formatter for Forked `ics@2.41.1`

Critical changes:

1. **Remove `new Date()` parsing** — replace with `toIcsDateArray()` that splits ISO string directly.
2. **Use `htmlContent`** attribute for X-ALT-DESC output.
3. **Add `startInputType: "local"`** to prevent UTC conversion.
4. **Post-process ICS string**:
   - Inject VTIMEZONE block for `Europe/Berlin` after `METHOD:PUBLISH`
   - Replace `DTSTART:{date}T{time}Z` → `DTSTART;TZID=Europe/Berlin:{date}T{time}`
   - Replace `DTEND:{date}T{time}Z` → `DTEND;TZID=Europe/Berlin:{date}T{time}`
5. **Set VCALENDAR properties**: PRODID `kulturkalender-greifswald`, X-WR-CALNAME, X-WR-TIMEZONE, X-PUBLISHED-TTL.
6. **Fallback duration**: 2 hours when `end` is null.

### F3c: UID Format

Pattern: `kulturkalender-{kumo_id}-{date}` — only `[a-z0-9-]` characters.

### F3d: ICS Snapshot Tests

- Generate ICS from fixture events
- Snapshot the output
- Assert VTIMEZONE present, TZID on DTSTART/DTEND, no trailing `Z`, X-ALT-DESC present

---

## M4: Infrastructure — Caching, Logging, Error Handling

### F4a: Feed Cache Layer

Create `src/infrastructure/cache/feed-cache.ts`:

- In-memory cache with key `feed:kulturkalender:global`
- TTL: 1 hour
- Stale-while-revalidate: serve stale, trigger background refresh
- Stale-if-error: serve stale on upstream failure

### F4b: Normalized Event Cache

- Key: `events:normalized:{hashOfQuery}`
- TTL: 15 minutes
- Invalidate when `kumo_updated_at` indicates new data

### F4c: Structured JSON Logger

Create `src/infrastructure/logger/index.ts`:

Fields per spec: `level`, `message`, `requestId`, `component`, `operation`, `durationMs`, `sourceUrl`.

Level rules:

- `debug`: cache hit/miss details
- `info`: fetch/processing summaries
- `warn`: recoverable issues (retry, partial enrichment failure)
- `error`: non-recoverable failures

### F4d: Wire Logging

Add structured log calls to adapter fetch, venue enrichment, cache operations, schema validation failures.

### F4e: HTTP Cache Headers

Update route handlers:

- JSON endpoint: `Cache-Control: s-maxage=900, stale-while-revalidate=3600`
- ICS endpoint: same policy

---

## M5: Contract-First API Hardening

### F5a: Wire `@schafevormfenster/ts-rest-zod-handler`

Replace raw `NextResponse` handlers with `ts-rest-zod-handler` factory pattern. Contracts enforce validation at route level.

### F5b: Integrate `@schafevormfenster/rest-commons`

Apply shared REST schemas/utilities where applicable (time parsing, flexible range input).

### F5c: Update OpenAPI Spec

Regenerate OpenAPI JSON reflecting enriched contracts, query parameters, error responses.

---

## M6: Live E2E + CI Hardening

### F6a: Live E2E Plausibility Tests

Implement in `vitest.live.config.ts` scope:

- Source endpoint returns HTTP 200
- Payload parses with source schema
- Mapped events parse with normalized schema
- Event list is non-empty
- Event start times are parseable and timezone-consistent
- Venue list page returns HTTP 200 and contains venue links
- At least one venue detail page returns HTTP 200 and yields parseable address

### F6b: Add `test:integration` Script

Add to `package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

### F6c: CI Workflow Updates

- Add scheduled live-test workflow (weekly cron, on-demand)
- Do not block PRs on live tests
- Artifact upload from `/reports`

---

## Dependency Matrix & Network Plan

| Block | Dependencies | Parallel Potential |
| --- | --- | --- |
| **F0-deps** | None | **Must run first** |
| **F0a** | F0-deps | High |
| **F0b** | F0-deps | High (parallel with F0a) |
| **F0c** | F0a | Medium |
| **F0d** | F0b | Medium (parallel with F0c) |
| **F0e** | F0a | High (parallel with F0c) |
| **F0f** | F0e | Medium |
| **F0g** | F0f | Low |
| **F0h** | F0-deps | High (parallel with F0a) |
| **F1a** | F0e | High |
| **F1b** | F0e, F0c | High (parallel with F1a) |
| **F1c** | F1a, F1b | Low |
| **F2a** | F0b, F0d, F0h | High (parallel with F1) |
| **F2b** | F2a | Medium |
| **F2c** | F2a, F2b | Low |
| **F2d** | F2c | Low |
| **F2e** | F2b | Medium (parallel with F2c) |
| **F2f** | F2d, F2e | Low |
| **F2g** | F2f, F1b | Low |
| **F3a** | F0-deps, F1b | Medium |
| **F3b** | F3a | Low |
| **F3c** | F3b | High (parallel) |
| **F3d** | F3b | Low |
| **F4a** | F1c | Medium |
| **F4b** | F4a | Low |
| **F4c** | None | High (parallel with anything) |
| **F4d** | F4c, F4a | Low |
| **F4e** | F4b | High |
| **F5a** | F0g, F0-deps, F1c | Medium |
| **F5b** | F5a | Low |
| **F5c** | F5a | High (parallel with F5b) |
| **F6a** | F1c, F2f | Medium |
| **F6b** | F6a | Low |
| **F6c** | F6b | Low |

---

## Quality Gates (TDD Discipline Per Block)

Every functional block follows this mandatory sequence:

1. **Fixture first** — Create or select the fixture covering the block's input.
2. **Schema test** — Write failing test asserting parse success/failure against the fixture.
3. **Implementation** — Write the minimum code to pass.
4. **Edge-case tests** — Add tests for derived fixtures (malformed, missing, boundary).
5. **`pnpm check` gate** — All types, lint, build, and tests must pass before moving to the next block.

---

## Milestone Gate Conditions

| Milestone | Definition of Done |
| --- | --- |
| M0 | All deps installed. Feed fixture has `LIVE-CHECK` metadata. Source schema parses full real fixture without error. All edge-case fixtures have corresponding failing→passing tests. `pnpm check` green. |
| M1 | `getEvents()` fetches live feed, maps, validates through full pipeline. Fixture-driven tests cover organizer fallback, VHS soft-tag, empty time, all category values. `pnpm check` green. |
| M2 | `warm-venues.ts` produces `venues.generated.json` from HTML fixtures. Venue lookup resolves static + lazy paths. All venue HTML fixture edge cases tested. `pnpm check` green. |
| M3 | ICS output matches snapshot. No `new Date()` in ICS path. VTIMEZONE block present. TZID on DTSTART/DTEND. `htmlContent` produces X-ALT-DESC. `data-text-mapper` integration correct. `pnpm check` green. |
| M4 | Cache hit/miss/stale metrics logged. Feed served from cache on second call. HTTP response headers match spec. Structured logs validate against logging spec. `pnpm check` green. |
| M5 | Route handlers use `ts-rest-zod-handler` factory. Contract violations return typed 400 errors. OpenAPI spec reflects all endpoints. `pnpm check` green. |
| M6 | `pnpm test:e2e:live` passes all plausibility assertions. CI publishes `/reports` artifacts. `pnpm check` green. |

---

## VHS Dedup Decision: Soft Tag (Not Filter)

Events where `organiser` or `venue` matches "Volkshochschule" (case-insensitive) are **not filtered out**. Instead:

- Mark with a `vhs-overlap` metadata tag during mapping.
- Downstream consumers decide on dedup.
- The adapter preserves all events.

---

## Confirmed Dependency Details

| Package | Source | Version | Notes |
| --- | --- | --- | --- |
| Forked `ics` | `https://github.com/schafevormfenster/ics.git` (branch: `master`) | 2.41.1 | Supports `htmlContent` for `X-ALT-DESC;FMTTYPE=text/html`. No npm release — git install only. **Replaces** npm `ics@^3.12.0` — adapt `ics-formatter.ts` to v2 API. |
| `@schafevormfenster/data-text-mapper` | npm | latest | API: `dataToText()`, `dataToHtml()`, `TextWithData` input. Verify against `allris-ics` or `kirche-mv-kalender` during F3a. |
| `@schafevormfenster/ts-rest-zod-handler` | npm | latest | Route handler factory for ts-rest contracts. |
| `@schafevormfenster/rest-commons` | npm | latest | Shared REST schemas/utilities. |
| `cheerio` | npm | latest | HTML parsing for venue enrichment. |

---

## Environment Variables

Add to `.env.example`:

```text
KULTURKALENDER_FEED_URL=https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json
VENUES_BASE_URL=https://www.kulturkalender.greifswald.de/venues/
REQUEST_TIMEOUT_MS=10000
CACHE_TTL_SECONDS=3600
CACHE_STALE_WHILE_REVALIDATE_SECONDS=600
LOG_LEVEL=info
DEFAULT_TIMEZONE=Europe/Berlin
```

All have in-code defaults — app runs without any env vars.

---

## Existing Code Context

| File | Status | Notes |
| --- | --- | --- |
| `src/services/application/get-events.service.ts` | Replace dummy import | Single wiring point for live adapter |
| `src/services/adapters/kulturkalender/kulturkalender.mapper.ts` | Enhance | Add organizer fallback, VHS soft-tag, data-text-mapper, venue hookpoint |
| `src/services/shared/ics/ics-formatter.ts` | Rewrite | Uses `new Date()` (forbidden), uses npm ics v3 (replace with fork v2), missing VTIMEZONE/TZID/X-ALT-DESC |
| `src/services/adapters/kulturkalender/kulturkalender.source.schema.ts` | Validate | Verify against full fixture |
| `src/contracts/events.contract.ts` | Extend | Add ICS endpoint contract, query params |
| `fixtures/a869cfebea250bbfe04a1b623baaf338.json` | Add metadata | Missing `LIVE-CHECK` |

---

## Canonical Documentation References

- Source behavior: [docs/data-source.md](../data-source.md)
- Architecture: [docs/architecture.md](../architecture.md)
- Tech stack: [docs/tech-stack.md](../tech-stack.md)
- ICS output spec: [docs/specs/ics-output.md](../specs/ics-output.md)
- Testing spec: [docs/specs/testing.md](../specs/testing.md)
- Caching spec: [docs/specs/caching.md](../specs/caching.md)
- Logging spec: [docs/specs/logging.md](../specs/logging.md)
- Adapter conventions: [docs/specs/proven-adapter-conventions.md](../specs/proven-adapter-conventions.md)
- Future patterns: [docs/future-patterns.md](../future-patterns.md)
- Contributing rules: [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

## Constraints

1. Keep the validation pipeline non-negotiable: source parse → map → delivery parse → output format.
2. Never use `new Date()` for parsing local time strings in ICS path.
3. Never filter VHS events — soft-tag only.
4. Follow proven adapter conventions (bounded concurrency, retry once, fail gracefully).
5. Keep code aligned with all canonical docs in this repository.
6. Do not add production logic without corresponding fixture-driven tests.
