# Spec: Proven Adapter Conventions

## Purpose

This spec defines mandatory adapter conventions for this repository.

Use these conventions as mandatory defaults.
Deviations are only allowed with a documented architecture decision in this repository.

## 1. Be Gentle To Source Systems

Convention:

Treat external sources as fragile and rate-limited by default.

Required behavior:

- Use bounded concurrency for detail fetches.
- Add short delays between requests or batches.
- Retry transient failures once with small backoff.
- Prefer batching over unbounded `Promise.all` for large source lists.

### Batching Decision Rules (Mandatory)

Use the following strategy by workload type:

| Workload | Strategy | Default |
| :-- | :-- | :-- |
| Single source feed fetch (`getEvents`) | Single request | no batching |
| Venue/detail enrichment for multiple items | Bounded async batches | `batchSize = 10`, `delayMs = 150-300` |
| Multiple source URLs / catalogs | Bounded async batches | `batchSize = 5-10`, `delayMs = 200-500` |
| Retry behavior | One retry per failed request | backoff `500-1500ms` |

Never use unbounded `Promise.all(items.map(...))` for network fetches where `items.length` can grow beyond a small fixed number.

### Reference Pattern: 10-Stack Async Batch

```ts
const batchSize = 10;
const delayMs = 200;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  const results = await Promise.allSettled(
    batch.map((item) => fetchWithRetry(item, { retries: 1 }))
  );

  // merge results, keep partial success
  consume(results);

  if (i + batchSize < items.length) {
    await wait(delayMs);
  }
}
```

Implementation notes:

- Keep batches deterministic (stable input ordering).
- Continue on partial failures and log them with enough context.
- If response status indicates hard rate limit (e.g. 429), increase `delayMs` dynamically.
- For serverless request paths, reduce batch size before raising timeout.

Why:

This protects external systems and keeps import runs stable.

## 2. Cache Aggressively, Serve Predictably

Convention:

Decouple ingestion cost from API response speed with layered caching.

Required behavior:

- Cache source fetch results (TTL at least hours, often one day).
- Use stale-while-revalidate or stale-if-error semantics.
- Cache expensive catalog/source lookups separately from event payload transformations.
- Return cache headers on API responses.

Why:

Cache-first delivery reduces source load and keeps API latency stable.

## 3. Normalize Broken Upstream Data

Convention:

Assume source data quality issues and normalize before delivery.

Required behavior:

- Clean malformed or noisy HTML before mapping to output.
- Normalize location strings (separator fixes, whitespace cleanup).
- Repair common text defects (missing spaces, inconsistent formatting).
- Guard against invalid date ranges and fallback to safe defaults.

Why:

Real sources contain malformed ICS lines, unstable formatting, and inconsistent location/description fields.

## 4. Enrich Events From Detail Pages When Valuable

Convention:

If list/feed data is incomplete, enrich events using detail pages during ingestion.

Required behavior:

- Keep enrichment best-effort and fault-tolerant.
- Continue with base event data when enrichment fails.
- Use deterministic merge rules when detail data overrides list data.
- Keep enrichment bounded (throttled concurrency + retries).

Why:

Detail-page enrichment materially improves output quality when list data is incomplete.

## 5. Keep Timezone Handling Explicit

Convention:

Treat Europe/Berlin time handling as explicit logic, not implicit Date defaults.

Required behavior:

- Parse local event times with timezone-aware conversion.
- Ensure ICS output consistently represents intended local times.
- Apply stable fallback duration when end times are missing.
- Keep timezone constants centralized.

Why:

Timezone drift and malformed source date data are recurring production issues.

## 6. Build Rich But Deterministic Event Descriptions

Convention:

Use structured metadata and deterministic text rendering for descriptions.

Required behavior:

- Build description payloads with `@schafevormfenster/data-text-mapper`.
- Include semantic metadata (`tags`, `scopes`, `categories`, `url`) in a consistent structure.
- Keep organizer/source attribution stable and explicit.

Why:

This improves downstream usability while retaining compatibility with ICS consumers.

## 7. Keep Route Handlers Thin

Convention:

Route handlers orchestrate; adapters and services do the data work.

Required behavior:

- Validate inputs early.
- Delegate fetch/map/enrich logic to service/adapter modules.
- Keep response generation and cache headers explicit.

Why:

This pattern keeps code maintainable and supports migration into a registry-driven multi-source engine.

## 8. Design For Serverless Constraints

Convention:

Assume serverless limits for runtime, memory, and cold starts.

Required behavior:

- Avoid long unbounded processing loops in request path.
- For browser automation, reduce resources (block images/media) and keep page usage minimal.
- Make network and parsing behavior resilient to partial failures.

Why:

Stable behavior on Vercel/serverless needs explicit resource and timeout discipline.

## 9. Test the Transformation Layer First

Convention:

Mapper and normalizer behavior must be testable with fixtures and deterministic expectations.

Required behavior:

- Add unit tests for cleaning/mapping utilities.
- Use fixture-driven tests for source-specific edge cases.
- Add integration tests for full feed-to-output flows where feasible.

Why:

Most data quality bugs happen at parsing/normalization boundaries, not in basic routing.

## Adoption In This Repository

These conventions are normative for this repository.

- Architecture alignment: [../architecture.md](../architecture.md)
- Stack alignment: [../tech-stack.md](../tech-stack.md)
- Source-specific rules: [../data-source.md](../data-source.md)
