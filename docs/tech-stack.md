# Tech Stack

## Runtime and Package Management

- Node.js: 24 LTS
- Package manager: pnpm
- Framework: Next.js (latest stable)
- Language: TypeScript (strict mode)

## Core API Stack

- Contract-first API: `@ts-rest/core` + `@ts-rest/next`
- Validation and parsing: `zod`
- Handler integration: `@schafevormfenster/ts-rest-zod-handler`
- Shared REST schemas/utilities: `@schafevormfenster/rest-commons`

## Domain and Mapping

- Structured text and metadata transformation: `@schafevormfenster/data-text-mapper`

Use this package to keep semantic metadata in a structured form and generate deterministic text output for JSON and ICS responses.

## Source and Calendar Processing

Source parsing modules:

- Feed parsing (ICS input when needed): `node-ical`
- ICS generation: `ts-ics`
- HTML scraping (venue details fallback): `cheerio`

The adapter delivers both JSON and ICS outputs, so ICS-related modules are part of the baseline stack.

## Quality and Linting

- ESLint config baseline: `@schafevormfenster/eslint-config`
- Custom ESLint rules: `@schafevormfenster/eslint-plugin` (transitive dependency of the config)
- Type checks: `tsc --noEmit`
- Formatting policy: no formatter dependency is added in initial setup; formatting is handled by lint rules.

Recommended ESLint flat-config composition for this project:

1. `@schafevormfenster/eslint-config/next`
2. `@schafevormfenster/eslint-config/rest`
3. `@schafevormfenster/eslint-config/logging`
4. `@schafevormfenster/eslint-config/caching`
5. `@schafevormfenster/eslint-config/architecture`
6. `@schafevormfenster/eslint-config/vitest` (when tests are added)

This gives early guardrails for API contracts, logging discipline, and caching rules.

### Mandatory: Read and Apply ESLint Rule Documentation

The `@schafevormfenster/eslint-plugin` ships with detailed rule documentation and coding instruction guides. **All contributors (human and AI agents) must read the relevant guides before writing or reviewing code.** The rules are authoritative for this project.

#### Rules Reference

Read the full rules reference for an overview of all rules, their severity, and which config enables them:

```text
node_modules/@schafevormfenster/eslint-config/docs/RULES_REFERENCE.md
```

#### Instruction Guides

The following instruction guides apply to this project's active ESLint configs. Read each guide that is relevant to the code you are writing or reviewing:

| Guide | Relevant Config | Path in `node_modules/@schafevormfenster/eslint-plugin/` |
| ----- | --------------- | -------------------------------------------------------- |
| REST service design | `/rest` | `docs/instructions/rest-service-design-guide.md` |
| Logging standards | `/logging` | `docs/instructions/logging-guide.md` |
| Caching strategies | `/caching` | `docs/instructions/caching-guide.md` |
| Architecture layers | `/architecture` | `docs/instructions/client-service-coordinator-guide.md` |
| Testing standards | `/vitest` | `docs/instructions/testing-standards-guide.md` |
| Unit test env vars | `/vitest` | `docs/instructions/unit-test-env-vars-guide.md` |
| General coding | all | `docs/instructions/coding-guide.md` |

#### Individual Rule Documentation

Each custom rule has its own documentation file:

```text
node_modules/@schafevormfenster/eslint-plugin/docs/rules/<rule-name>.md
```

When an ESLint rule violation is reported, read the corresponding rule doc to understand the intent and correct fix.

#### Online References

- npm: <https://www.npmjs.com/package/@schafevormfenster/eslint-plugin>
- Source: <https://github.com/schafe-vorm-fenster/commons/tree/main/packages/eslint-plugin>

## Testing

- Unit and integration tests: `vitest`
- API contract tests: ts-rest contract assertions + zod schema validation
- Fixture-based tests: use `fixtures/a869cfebea250bbfe04a1b623baaf338.json`
- ICS snapshot tests for output stability

Mandatory report policy:

1. All test and coverage reports are written under `/reports`.
2. Report outputs include XML/JUnit format, JSON format, and HTML format.
3. CI uploads report artifacts from `/reports` only.

## Deployment and Scheduling

- Deploy target: Vercel Serverless (primary production target)
- Crawl refresh trigger: scheduled cron (platform scheduler)
- Response acceleration: HTTP cache headers + application cache

## CI/CD

- CI runner: GitHub Actions
- CI scope: keep minimal (`lint`, `typecheck`, `test`) on pull requests
- CD trigger: push/merge to `main` deploys via Vercel Git integration
- Default strategy: no custom deploy workflow in Actions

Recommended minimal workflow split:

1. `ci.yml`: PR checks only
2. Vercel-managed deployment from `main`

## Environment Variables

Application defaults are defined so the app runs without any environment variables.

- `KULTURKALENDER_FEED_URL` default: `https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json`
- `REQUEST_TIMEOUT_MS` default: `10000`
- `CACHE_TTL_SECONDS` default: `3600`
- `CACHE_STALE_WHILE_REVALIDATE_SECONDS` default: `600`
- `LOG_LEVEL` default: `info`
- `DEFAULT_TIMEZONE` default: `Europe/Berlin`

## Suggested Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "check": "pnpm typecheck && pnpm lint && pnpm test",
    "check:full": "pnpm typecheck && pnpm lint && pnpm build && pnpm test",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e:live": "vitest run --config vitest.live.config.ts"
  }
}
```

## Dependency Policy

1. Prefer established modules from `@schafevormfenster/*` where available.
2. Keep adapter-specific dependencies isolated behind service interfaces.
3. Avoid direct dependency usage inside route handlers.
4. Keep source-specific parsing libraries replaceable by wrapper utilities.

## Proven Conventions

Implementation conventions are documented in [specs/proven-adapter-conventions.md](specs/proven-adapter-conventions.md).

## Why This Stack

This stack keeps the service lightweight for a single source today, while aligning with the migration target in [future-patterns.md](future-patterns.md):

- contract-first APIs for reuse,
- strict boundary between adapter and delivery,
- shared schema and mapper utilities,
- deterministic JSON/ICS delivery and validation-focused processing patterns.
