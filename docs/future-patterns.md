# Future Patterns (Migration Direction)

This repository starts as a focused single-source adapter for Kulturkalender Greifswald and is built so it can later be moved into a multi-source crawl-store-deliver engine with minimal refactoring.

Primary reference:

- `/Users/jan-henrik.hempel/Projects/eventification-api/docs/concepts/accepted/multi-source-import-engine.md`

## North Star

Follow these architecture principles now, even for one source:

1. Adapter-first design: isolate source-specific extraction and mapping logic behind an adapter interface.
2. Crawl-store-deliver flow: decouple source fetch speed from API response speed via storage and cache.
3. Normalized event schema: map source data to one internal schema used by JSON and ICS delivery.
4. Contract-first APIs: use ts-rest + zod contracts that are reused in a larger service.
5. Shared utilities over copy-paste: parsing, date handling, text formatting, and ICS conversion live in reusable modules.

## Compatibility Checklist

Use this checklist for all new features in this repo:

- No endpoint depends on direct live-fetch-only behavior.
- Source-specific selectors, URL logic, and quirks stay in adapter files only.
- DTOs and API payloads are validated with zod and exposed via ts-rest contracts.
- Event text shaping uses `@schafevormfenster/data-text-mapper`.
- Time parsing and flexible range input align with `@schafevormfenster/rest-commons` patterns.
- Handler wiring uses `@schafevormfenster/ts-rest-zod-handler`.

## Migration Strategy

Planned migration to multi-source engine can happen in phases:

1. Extract adapter and mapper as portable modules.
2. Replace in-memory/cache-first persistence with shared DB persistence.
3. Keep ts-rest contracts stable so clients are unaffected.
4. Register adapter in a future adapter factory/registry.
5. Move crawl scheduling from app-local cron to central queue workers.
