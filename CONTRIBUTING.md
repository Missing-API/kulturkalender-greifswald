# Contributing

## Goal

Keep this repository implementation-ready for a single-source adapter while preserving an easy migration path to the future multi-source import engine.

## Read Before Changing Code

Read these documents in this order:

1. [README.md](README.md)
2. [docs/data-source.md](docs/data-source.md)
3. [docs/architecture.md](docs/architecture.md)
4. [docs/tech-stack.md](docs/tech-stack.md)
5. [docs/setup.md](docs/setup.md)
6. [docs/specs/testing.md](docs/specs/testing.md)
7. [docs/specs/logging.md](docs/specs/logging.md)
8. [docs/specs/caching.md](docs/specs/caching.md)
9. [docs/future-patterns.md](docs/future-patterns.md)

## Documentation Boundaries (No Duplication)

Use each file for one responsibility only:

- [README.md](README.md): purpose, short project description, how to use this repo.
- [CONTRIBUTING.md](CONTRIBUTING.md): contributor workflow, rules, and quality expectations.
- [AGENTS.md](AGENTS.md): short index for agent/tooling behavior, primarily references.
- [docs/data-source.md](docs/data-source.md): source-specific behavior and edge cases.
- [docs/architecture.md](docs/architecture.md): system/module design and flow.
- [docs/tech-stack.md](docs/tech-stack.md): dependency and tool decisions.
- [docs/setup.md](docs/setup.md): actionable implementation bootstrap checklist.
- [docs/specs/testing.md](docs/specs/testing.md): test strategy and fixture policy.
- [docs/specs/logging.md](docs/specs/logging.md): structured logging policy.
- [docs/specs/caching.md](docs/specs/caching.md): cache key, TTL, and header policy.
- [docs/future-patterns.md](docs/future-patterns.md): migration and future compatibility principles.

When a topic already has a canonical location, link to it instead of repeating it.

## Implementation Patterns

Follow these patterns for all code contributions:

- Contract-first APIs with ts-rest + zod.
- Thin route handlers; business logic in services.
- Source-specific logic isolated in adapter modules.
- Shared parsing/formatting utilities for reusable logic.
- Keep normalized event schema consistent across outputs.
- Use `@schafevormfenster/*` modules where applicable.

## Change Checklist

Before opening a PR:

1. Verify changed behavior against [docs/data-source.md](docs/data-source.md).
2. Ensure architectural boundaries remain aligned with [docs/architecture.md](docs/architecture.md).
3. Keep stack changes consistent with [docs/tech-stack.md](docs/tech-stack.md).
4. Check migration compatibility against [docs/future-patterns.md](docs/future-patterns.md).
5. Update only the canonical documentation file(s) for your change.

## Testing Expectations

- Add unit tests for mapper and normalization changes.
- Prefer fixture-based tests using [fixtures/a869cfebea250bbfe04a1b623baaf338.json](fixtures/a869cfebea250bbfe04a1b623baaf338.json).
- Keep API contract and validation behavior covered.
- Keep output formatting deterministic (including ICS if touched).
