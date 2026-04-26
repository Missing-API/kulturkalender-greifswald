# kulturkalender-greifswald Adapter

> JSON feed adapter for Kulturkalender Greifswald.

## Source

| Property       | Value                                                                                   |
| :------------- | :-------------------------------------------------------------------------------------- |
| **URL**        | `https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json` |
| **Venue List** | `https://www.kulturkalender.greifswald.de/venues/`                                      |
| **Strategy**   | Direct Feed (`fetch`)                                                                   |
| **Complexity** | Low — ideal first adapter                                                               |

## Local Fixture

`fixtures/a869cfebea250bbfe04a1b623baaf338.json`

## Behavior

| Method             | Description                         |
| :----------------- | :---------------------------------- |
| `getCatalog()`     | Single entry (one global JSON feed) |
| `getEvents()`      | Full events in list                 |
| `getEventDetail()` | Not implemented                     |

### Location Extraction

The JSON feed provides limited location data via the `venue` field (e.g., `"venue": "Kleine Rathausgalerie"`). To get complete address details, the adapter must:

1. Identify the venue from the feed.
2. Navigate to the venue overview and use the venue ID when present (e.g., `https://www.kulturkalender.greifswald.de/venues/230`).
3. Extract the address from the HTML fragment:

   ```html
   <div>
     <span class="d-block fw-500">
       <a href="/venues/230">Kleine Rathausgalerie</a>
     </span>
     <span class="d-block">Markt</span>
     <span class="d-block">17489 Greifswald</span>
     <span class="d-block">03834 8536 2101</span>
   </div>
   ```

4. Format the extracted spans into a single comma-separated string (e.g., "Kleine Rathausgalerie, Markt, 17489 Greifswald").

### Venue Enrichment Strategy: Build-Time Warm-Up + Runtime Lazy Fallback

**Decision:** Venue detail pages are fetched at build time and bundled as static data. At runtime, missing or failed venues are lazily fetched on-demand and cached for the function lifetime.

**Rationale:** The feed contains ~30 unique venues across ~800 events. Venue addresses are near-static. Build-time fetching covers the happy path (instant, no latency). Runtime lazy fetch handles edge cases: build-time timeouts, new venues appearing between deploys, partial prebuild failures.

#### Architecture

```text
scripts/warm-venues.ts              → prebuild script: fetches + parses all venues
src/data/venues.generated.json      → static output (gitignored, regenerated on each build)
src/services/shared/venue/lookup.ts → resolves venue: static map first, lazy fetch second
src/services/shared/venue/fetch.ts  → runtime single-venue fetch + parse (shared with prebuild)
src/services/shared/venue/cache.ts  → module-level in-memory Map for runtime-fetched venues
```

#### Two-Layer Resolution (Build + Runtime)

```text
Request arrives → event has venue "Neue Location"
  │
  ├─ Layer 1: Check venues.generated.json (static, instant)
  │   └─ HIT → return pre-formatted location string ✓
  │
  └─ Layer 2: Lazy runtime fetch (only on static miss)
      ├─ Check module-level runtime cache (in-memory Map)
      │   └─ HIT → return cached result ✓
      └─ MISS → fetch /venues/ index, find URL, fetch detail page
          ├─ SUCCESS → parse, cache in memory, return location ✓
          └─ FAIL (timeout/error) → use raw venue text, log warning ✓
```

#### Build-Time Warm-Up (Primary Path)

Build sequence:

1. `prebuild` script runs `scripts/warm-venues.ts`.
2. Script fetches `/venues/` index page, discovers all venue links.
3. Script fetches each venue detail page (batched, see below).
4. Script writes `src/data/venues.generated.json` with enriched address data.
5. `next build` bundles `venues.generated.json` as static import — zero runtime cost for known venues.
6. If prebuild fetch fails **entirely** (source fully offline), build fails explicitly.
7. If prebuild fetch **partially** fails (some venues timeout), build succeeds with partial data. Failed venues are logged and resolved lazily at runtime.

#### Runtime Lazy Fetch (Fallback Path)

When a venue is not in the static map at runtime:

1. Check module-level in-memory cache (`Map<string, VenueData>`). If hit, return immediately.
2. Fetch the `/venues/` index page to discover the venue URL (cache index in memory for function lifetime).
3. Fetch the venue detail page with timeout (5s) and no retry (keep API latency bounded).
4. On success: parse address, store in module-level cache, return enriched location.
5. On failure: use raw `venue` string from feed, set `locationSource = "feed-venue"`, emit structured warning.

Runtime lazy fetch constraints:

- Single venue fetch per cache miss (never bulk-fetch at runtime).
- Timeout: 5s per request (shorter than build-time; API latency budget is limited).
- No retries at runtime (fail fast, serve with fallback).
- Module-level cache persists across requests within the same serverless invocation (warm function).
- Cold start with unknown venue: first request pays ~500ms latency for the fetch; subsequent requests are instant.

#### Freshness and Self-Updating

The system is self-healing without scheduled redeploys:

- Build-time warm-up provides the baseline venue map at each deploy.
- Runtime lazy fetch automatically resolves any venue not in the static map (new venues, build-time timeouts, partial failures).
- Module-level cache means the lazy-fetched result is instant for all subsequent requests within the same function invocation.
- On the next regular deploy (code change, dependency update), the warm-up runs again and captures all venues that were previously resolved lazily.
- No cron, no deploy hooks, no scheduled rebuilds required.

#### Venue Index Discovery

- Fetch `https://www.kulturkalender.greifswald.de/venues/` once per build (prebuild) or once per function lifetime (runtime fallback).
- Parse all venue links matching `a[href^="/venues/"]`.
- Build `Map<string, { id: string; url: string }>` keyed by normalized venue name.
- Normalization rule for keys:
  - trim
  - lower-case
  - collapse multiple spaces to one

#### Venue Detail Page Parsing

Shared logic between build-time and runtime:

- Fetch venue detail URL with configurable timeout (build: 10s, runtime: 5s).
- Parse only the venue header/address block (do not parse full page content).
- Preferred extraction selectors:
  - `span.d-block.fw-500 a` for venue name
  - `span.d-block` for address/contact lines
- Remove empty lines and duplicate whitespace.
- Ignore non-address lines (phone, email, web links) for the `location` field.

#### Normalized Location String

- Keep at most: `name`, `street`, `postal code + city`.
- Join with comma and space as separator.
- Example output: `Kleine Rathausgalerie, Markt, 17489 Greifswald`
- Save original parsed lines in debug logs only (not in public API payload).

#### Batching Rules (Build-Time Fetches Only)

- Do not fetch all venue pages with unbounded `Promise.all`.
- Use bounded async batches:
  - `batchSize = 10`
  - `delayMs = 300` between batches
  - `retries = 1` for transient failures
- With ~30 venues: completes in ~1.5 seconds total.
- Continue with partial data when some venue pages fail (log failures, include successfully parsed venues).
- Runtime fetches are always single-venue (no batching at runtime).

#### Output Schema (venues.generated.json)

```json
{
  "generatedAt": "2026-04-26T18:00:00Z",
  "venues": {
    "kirche wieck": {
      "id": "42",
      "name": "Kirche Wieck",
      "street": "Kirchstraße 1",
      "city": "17493 Greifswald",
      "location": "Kirche Wieck, Kirchstraße 1, 17493 Greifswald",
      "url": "https://www.kulturkalender.greifswald.de/venues/42"
    }
  }
}
```

Keys are normalized venue names. The `location` field is the pre-formatted delivery string.

#### Merge Rule into Final Event

Location precedence:

1. Static map lookup (`venues.generated.json`) by normalized venue name → use `location` field
2. Runtime lazy fetch result (on static miss) → use parsed location
3. Original feed `venue` text (when both static and runtime fetch fail)
4. Empty string (last resort, when `venue` is null in feed)

Always best-effort; never fail the full event import because a venue page is unavailable.

### Image

Event images are fetched from the `image_link` attribute URL.

## Incremental Sync

Supported via `kumo_updated_at` field in JSON response.

## Data Mapping & Edge Cases

### Identity & Series

- `kumo_id`: Represents a recurring event series. Multiple entries with the same `kumo_id` belong to the same series.
- **Missing Unique Event IDs**: Individual occurrences do not have a unique stable ID. Changes or deletions (e.g., a single cancelled day in an exhibition) must be detected by comparing the full feed.
- **Deletions**: The feed does not provide a "deleted" flag. Events missing from the feed that were previously seen are treated as removed.

### Time & Duration

- `time`: Always interpreted as local German time (CET/CEST).
- No `duration` field exists in the feed. End times are not available; default assumptions (e.g., 2 hours) or manual extraction from `content` descriptions are necessary.

### Locations (Venues)

- `venue`: Often non-specific (e.g., "Alte Feuerwehr").
- **Address Extraction**: As noted above, the adapter must scrape the venue detail page (`/venues/{id}`) to get the full address (Street, ZIP, City).

### Categories & Organizers

- `category`: Values like "Umland" or "Extra" are broad. These are mapped to the internal standard taxonomy.
- `organiser`: Can be a person's name, an institution, or `null`.
  - **Null default**: When `organiser` is `null`, use `"Kulturkalender Greifswald"` as the fallback organiser.
  - **Source attribution**: To make import provenance explicit, append the source in brackets to all organiser values — e.g., `"Kustodie der Universität Greifswald (Kulturkalender Greifswald)"`. Alternatively, populate a dedicated `source` field with `"Kulturkalender Greifswald"` on every event record instead of modifying the organiser string.
- **VHS Integration**: Courses from "Volkshochschule Vorpommern-Greifswald" are already imported by Kulturkalender. To avoid duplicates with the direct `vhs-vg` adapter, entries where `organiser` or `venue` matches "Volkshochschule" are filtered or reconciled.

## SourceContext

No catalog-level context injection needed (events are self-contained).

## Related Requirements

Canonical local references for implementation:

- [architecture.md](architecture.md)
- [tech-stack.md](tech-stack.md)
- [specs/proven-adapter-conventions.md](specs/proven-adapter-conventions.md)
