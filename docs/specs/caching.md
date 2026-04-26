# Spec: Caching

## Scope

This spec defines mandatory caching behavior.

## Cache Layers (Mandatory)

1. Source feed cache (runtime, in-memory or HTTP-level).
2. Venue data (build-time static JSON + runtime lazy fallback with module-level cache).
3. Derived normalized event cache (runtime, in-memory).

## Venue Data: Build-Time Static + Runtime Lazy Fallback

Venue enrichment uses a two-layer approach:

- **Layer 1:** Build-time warm-up writes `src/data/venues.generated.json` (bundled, instant).
- **Layer 2:** Runtime lazy fetch for venues missing from the static map (module-level in-memory cache, persists for function lifetime).

No external cache (KV/Redis) required. No scheduled redeploys required. The system is self-healing: runtime lazy fetch covers new venues and build-time failures automatically.

See [data-source.md](../data-source.md) for the full venue enrichment spec.

## Cache Key Rules (Mandatory)

- Feed: `feed:kulturkalender:global`
- Normalized events: `events:normalized:{hashOfQuery}`

## TTL Rules (Mandatory)

- Feed cache TTL: 1h
- Normalized events TTL: 15m

Serve stale data during revalidation when supported by cache layer.
Serve stale data on transient upstream failure when supported by cache layer.

## HTTP Cache Header Rules (Mandatory)

For public API responses:

- `Cache-Control: s-maxage=900, stale-while-revalidate=3600`
- For ICS responses, apply the same policy unless endpoint-specific policy is documented.

## Invalidation Rules (Mandatory)

1. Invalidate normalized event cache when source `kumo_updated_at` indicates new data.
2. Invalidate venue detail cache when parser schema changes or venue markup changes are detected.
3. Keep cache invalidation explicit in code paths; no hidden side effects.

## Observability Rules (Mandatory)

Log cache metrics per request/run:

- hit count
- miss count
- stale-serve count
- revalidation duration
