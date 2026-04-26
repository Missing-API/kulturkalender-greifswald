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

### Venue Lookup Spec (Concrete)

Use this exact lookup strategy for `venue` enrichment.

#### 1. Build a venue index once per sync run

- Fetch `https://www.kulturkalender.greifswald.de/venues/` once.
- Parse all venue links `a[href^="/venues/"]`.
- Build `Map<string, { id?: string; url: string }>` keyed by normalized venue name.
- Normalization rule for keys:
  - trim
  - lower-case
  - collapse multiple spaces to one

#### 2. Resolve venue URL for an event

Resolution order:

1. If event payload already contains a venue detail URL or id, use it directly.
2. Else lookup by normalized `venue` name in the prebuilt venue index.
3. If unresolved, keep original `venue` text as location fallback and mark `locationSource = "feed-venue"`.

#### 3. Fetch and parse venue detail page

- Fetch venue detail URL with timeout and one retry.
- Parse only the venue header/address block (do not parse full page content).
- Preferred extraction selectors:
  - `span.d-block.fw-500 a` for venue name
  - `span.d-block` for address/contact lines
- Remove empty lines and duplicate whitespace.
- Ignore obvious non-address lines for `location` (phone, email, web links).

#### 4. Build normalized location string

- Keep at most: `name`, `street`, `postal code + city`.
- Join with comma and space as separator.
- Example output: `Kleine Rathausgalerie, Markt, 17489 Greifswald`
- Save original parsed lines in debug logs only (not in public API payload).

#### 5. Cache venue detail lookups

- Cache key: `venue:{id}` or `venue:{normalized-name}`.
- TTL: 24h minimum.
- Use stale-while-revalidate when the selected cache layer supports it.
- If cache hit exists, skip network fetch.

#### 6. Batching rules for venue fetches

- Do not fetch all venue pages with unbounded `Promise.all`.
- Use bounded async batches:
  - `batchSize = 10`
  - `delayMs = 150-300` between batches
  - `retries = 1` for transient failures
- Continue with partial enrichment when some venue pages fail.

#### 7. Merge rule into final event

Location precedence:

1. Parsed venue detail address
2. Original feed `venue`
3. Empty string (last resort)

Always keep enrichment best-effort; never fail the full event import because a venue page is unavailable.

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
