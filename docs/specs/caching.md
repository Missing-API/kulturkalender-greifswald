# Spec: Caching

## Scope

This spec defines mandatory caching behavior.

## Cache Layers (Mandatory)

1. Source feed cache.
2. Venue index cache.
3. Venue detail cache.
4. Derived normalized event cache.

## Cache Key Rules (Mandatory)

- Feed: `feed:kulturkalender:global`
- Venue index: `venue:index`
- Venue detail by id: `venue:id:{id}`
- Venue detail by normalized name: `venue:name:{normalizedName}`
- Normalized events: `events:normalized:{hashOfQuery}`

## TTL Rules (Mandatory)

- Feed cache TTL: 1h
- Venue index TTL: 24h
- Venue detail TTL: 24h
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
