# kulturkalender-greifswald

JSON-to-API adapter project for Kulturkalender Greifswald event data.

## Purpose

This repository defines and implements a small, production-ready event import service that:

- fetches event data from the Kulturkalender Greifswald export feed,
- normalizes it into a stable internal event model,
- exposes it in API-friendly formats (JSON and ICS).

The project is intentionally designed to be easy to migrate into a future multi-source import engine.

## Current Status

This repository is currently documentation-first and in architecture/setup phase.

- Source definition: [docs/data-source.md](docs/data-source.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Tech choices: [docs/tech-stack.md](docs/tech-stack.md)
- Migration direction: [docs/future-patterns.md](docs/future-patterns.md)
- Setup checklist: [docs/setup.md](docs/setup.md)

## How To Use

### 1. Understand the target behavior

Start with:

1. [docs/data-source.md](docs/data-source.md)
2. [docs/architecture.md](docs/architecture.md)
3. [docs/tech-stack.md](docs/tech-stack.md)
4. [docs/setup.md](docs/setup.md)

### 2. Work with real source data locally

Use the fixture for mapper and contract tests:

- [fixtures/a869cfebea250bbfe04a1b623baaf338.json](fixtures/a869cfebea250bbfe04a1b623baaf338.json)

### 3. Contribute implementation

Follow contribution rules and documentation boundaries in:

- [CONTRIBUTING.md](CONTRIBUTING.md)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes.
