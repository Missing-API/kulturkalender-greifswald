# Architecture

## Goal

Build a production-ready single-source event import API for Kulturkalender Greifswald that already follows the same design boundaries as the future multi-source import engine.

## Scope

In scope now:

- Ingest one JSON feed from Kulturkalender Greifswald.
- Normalize events into one internal schema.
- Deliver JSON and ICS output through versioned API endpoints.
- Prepare clear boundaries for later extraction into shared engine modules.

Out of scope now:

- Multi-tenant source registration.
- Distributed crawl queue workers.
- Central shared database across many adapters.

## Architectural Style

Use a layered adapter architecture inside Next.js:

1. API Contract Layer (ts-rest + zod)
2. Application Layer (use cases and orchestration)
3. Adapter Layer (source-specific fetch and mapping)
4. Infrastructure Layer (HTTP client, cache, persistence, logging)
5. Delivery Layer (JSON DTO and ICS formatter)

This keeps source-specific logic isolated and makes migration to a registry-based multi-source engine straightforward.

## High-Level Components

### 1. Route Handlers (Next.js App Router)

- Provide HTTP endpoints under `app/api/.../route.ts`.
- Delegate all domain work to application services.
- Never contain parsing or mapping logic.

### 2. API Contracts and Validation

- Define request/response contracts using ts-rest + zod.
- Implement handlers with `@schafevormfenster/ts-rest-zod-handler`.
- Share schemas and DTOs between handler and service layers.

### 3. Source Adapter (Kulturkalender)

- Knows feed URL and source field semantics.
- Implements adapter methods (`getCatalog`, `getEvents`).
- Implements `getEventDetail` only when list data is incomplete; otherwise the adapter explicitly declares full-list capability.
- Uses source-specific mapping module to convert feed records to normalized events.

### 4. Normalization and Text Mapping

- Use `@schafevormfenster/data-text-mapper` for structured description assembly.
- Keep metadata (`category`, `organizer`, `tags`, `location`) as structured fields.
- Generate delivery-safe text representation from structured content.

### 5. ICS Delivery

- Convert normalized event list to ICS using a dedicated formatter module.
- Keep ICS generation separated from fetch logic.
- Apply the conventions defined in [specs/proven-adapter-conventions.md](specs/proven-adapter-conventions.md).

### 6. Caching and Incremental Updates

- Cache source feed response with TTL and stale-while-revalidate behavior.
- Track `kumo_updated_at` to support incremental refresh logic.
- Decouple client response latency from source availability by serving from cached normalized data.

## Proposed Internal Modules

```text
src/
  contracts/
    events.contract.ts
    events.schema.ts
  services/
    application/
      get-catalog.service.ts
      get-events.service.ts
      get-events-ics.service.ts
    adapters/
      kulturkalender/
        kulturkalender.adapter.ts
        kulturkalender.mapper.ts
        kulturkalender.types.ts
    shared/
      http/
      time/
      text/
      ics/
      cache/
  infrastructure/
    cache/
    logger/
  types/
    normalized-event.ts
app/
  api/
    v1/
      events/
      catalog/
```

## Core Flow

1. Client calls API endpoint.
2. Route handler validates query via zod contract.
3. Application service checks cache.
4. If stale/missing, adapter fetches source feed.
5. Mapper transforms source records to normalized events.
6. Service stores normalized result in cache/persistence.
7. Delivery layer returns JSON or ICS representation.

## Data and Domain Model

Recommended normalized event fields:

- `id` (stable source-derived identity)
- `summary`
- `description` (text generated from structured data)
- `start`, `end`, `timeZone`
- `location`
- `category`
- `organizer`
- `tags`
- `link`
- `image`
- `status`
- `source`
- `updated`

## Schema-First Domain Modeling (Mandatory)

Domain modeling in this repository is schema-first and must be implemented with zod.

### What must be modeled

1. Source model: schema for the incoming Kulturkalender JSON payload.
2. Delivery model: schema for the normalized event structure used for JSON and ICS output mapping.

Both models are required and must be versioned with the code.

### Where to define schemas

- Keep source schemas in adapter scope, e.g. `src/services/adapters/kulturkalender/kulturkalender.source.schema.ts`.
- Keep normalized delivery schemas in shared domain scope, e.g. `src/types/normalized-event.schema.ts`.
- Keep API DTO schemas in contract scope, e.g. `src/contracts/events.schema.ts`.

### Strictness rules

Use strict zod objects by default.

- For object schemas, use `.strict()`.
- Any deviation is documented as an architecture decision.
- Reject unknown keys for normalized delivery schemas.
- Use narrow enums/literals where possible instead of broad strings.
- Model field presence explicitly with nullable fields and explicit field-presence definitions instead of permissive unions.

### Description rules

Schemas must be self-documenting.

- Add `.describe(...)` to all public/contract fields.
- Add clear meaning, format expectations, and fallback behavior in descriptions.
- Keep descriptions in English and implementation-oriented.

### Defaults and transformations

Defaults and transforms are allowed and encouraged when they reduce mapper complexity.

- Use `.default(...)` for stable fallback values (for example status/timezone/source labels).
- Use `.transform(...)` for normalization (trim, whitespace cleanup, date coercion, field reshaping).
- Keep transforms deterministic and side-effect free.
- Never hide critical data loss in transforms; log dropped/invalid input where relevant.

### Validation pipeline (required order)

1. Parse source payload with Source schema.
2. Map to normalized event candidate.
3. Parse mapped event with Delivery schema.
4. Only then map to output formats (JSON DTO / ICS event).

No event is delivered without successful validation of both source and delivery models.

### Minimal schema pattern

```ts
import { z } from "zod";

export const KulturkalenderSourceEventSchema = z
  .object({
    kumo_id: z.string().describe("Recurring series identifier from source"),
    title: z.string().min(1).describe("Raw source event title"),
    time: z.string().describe("Local event time string from source feed"),
    venue: z.string().nullable().describe("Venue label from source"),
    kumo_updated_at: z.string().describe("Source update timestamp"),
  })
  .strict();

export const NormalizedEventSchema = z
  .object({
    id: z.string().min(1).describe("Stable event identity in this adapter"),
    summary: z.string().min(1).describe("Normalized event title"),
    location: z.string().default("").describe("Normalized location text"),
    timeZone: z
      .string()
      .default("Europe/Berlin")
      .describe("IANA timezone used for event times"),
    status: z
      .enum(["confirmed", "tentative", "cancelled"])
      .default("confirmed")
      .describe("Normalized event status"),
  })
  .strict()
  .transform((event) => ({
    ...event,
    summary: event.summary.trim(),
    location: event.location.trim(),
  }));
```

### Testing obligations for schemas

- Add unit tests for schema parse success/failure cases.
- Add tests for defaulting and transformation behavior.
- Add regression tests for known malformed source examples.

## Error Handling

- Distinguish validation errors (400), source unavailability (502/503), and internal errors (500).
- Return typed error payloads via ts-rest contracts.
- Add retry with backoff for transient source/network failures.

## Observability

- Structured logs with request id, source URL, fetch duration, item count, mapping failures.
- Metrics to include: fetch success rate, cache hit ratio, mapping error count, API latency.
- Keep instrumentation wrappers in shared infrastructure utilities.

Detailed operational rules are defined in:

- [specs/logging.md](specs/logging.md)
- [specs/caching.md](specs/caching.md)

## Production Runtime

- Primary runtime target is Vercel Serverless Functions.
- API endpoints run as stateless serverless handlers (no long-lived process assumptions).
- Use cache-first access patterns so cold starts do not cause unnecessary source load.
- Use Vercel Cron only for lightweight refresh triggers, not for long-running jobs.

## CI/CD

Keep CI/CD intentionally minimal:

1. GitHub Actions runs fast checks on pull requests (`lint`, `typecheck`, `test`).
2. Push/merge to `main` triggers production deployment via Vercel Git integration.
3. Do not add custom deploy orchestration in GitHub Actions. Use Vercel Git integration for deployment.

This gives low maintenance overhead while preserving deployment reliability.

## Testing Strategy

- Unit tests: mapper and normalization functions.
- Contract tests: endpoint schema conformance.
- Integration tests: fixture-based source import using `fixtures/a869cfebea250bbfe04a1b623baaf338.json`.
- Snapshot tests for ICS output stability.

Detailed testing rules are defined in [specs/testing.md](specs/testing.md).

## Migration Readiness

To keep migration to multi-source engine easy:

- Keep adapter interface compatible with `getCatalog/getEvents/getEventDetail` semantics.
- Keep route handlers thin and free of source logic.
- Keep shared parsing and formatting utilities generic.
- Avoid direct coupling between HTTP layer and adapter internals.

See [future-patterns.md](future-patterns.md) for the target direction.

Cross-repository proven conventions are specified in [specs/proven-adapter-conventions.md](specs/proven-adapter-conventions.md).
