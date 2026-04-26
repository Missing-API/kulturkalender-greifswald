# Spec: Logging

## Scope

This spec defines mandatory logging behavior.

## Log Format (Mandatory)

Use structured JSON logs with these required fields:

- `level` (`debug|info|warn|error`)
- `message`
- `requestId`
- `component` (for example `adapter.kulturkalender`)
- `operation` (for example `fetchFeed`, `parseVenue`, `mapEvent`)
- `durationMs` (when applicable)
- `sourceUrl` (when network involved)

## Level Rules (Mandatory)

- `debug`: detailed flow and cache hit/miss details
- `info`: successful fetch/processing summaries
- `warn`: recoverable issues (retry, partial enrichment failure)
- `error`: non-recoverable failures per request/run

## Event Rules (Mandatory)

Always log:

1. Feed fetch start/end and duration.
2. Venue enrichment batch start/end and failed item count.
3. Retry attempts and final retry outcome.
4. Schema validation failures with field paths.
5. Cache hit/miss and stale-serve behavior.

## Safety Rules (Mandatory)

- Do not log full raw payloads.
- Do not log secrets or credentials.
- Truncate long external HTML/content snippets in error logs.
