# Spec: ICS Output Format

## Purpose

Define the exact ICS VEVENT field mapping, formatting conventions, and Google Calendar compatibility requirements for this project's `.ics` endpoint.

These conventions are derived from proven patterns in `allris-ics` and `kirche-mv-kalender`.

## ICS Library

Use the forked `ics` library from `https://github.com/schafevormfenster/ics.git` (supports `htmlContent` for `X-ALT-DESC`).

## VCALENDAR Properties

| Property | Value |
| :-- | :-- |
| VERSION | 2.0 |
| CALSCALE | GREGORIAN |
| METHOD | PUBLISH |
| PRODID | `kulturkalender-greifswald` |
| X-WR-CALNAME | `Kulturkalender Greifswald` |
| X-WR-TIMEZONE | `Europe/Berlin` |
| X-PUBLISHED-TTL | PT1H |

A full `VTIMEZONE` block for `Europe/Berlin` (with DAYLIGHT/STANDARD rules) must be injected after `METHOD:PUBLISH`.

## VEVENT Field Mapping

| ICS Property | Source | Notes |
| :-- | :-- | :-- |
| UID | `{normalizedEvent.id}` | Stable, deterministic. Format: `kulturkalender-{kumo_id}-{date}` |
| SUMMARY | `normalizedEvent.summary` | Trimmed, escaped |
| DTSTART;TZID=Europe/Berlin | `normalizedEvent.start` | Local time, format `YYYYMMDDTHHMMSS` |
| DTEND;TZID=Europe/Berlin | `normalizedEvent.end` or start + 2h | Fallback duration 2 hours when end is null |
| DESCRIPTION | Plain text via `dataToText()` | See description format below |
| X-ALT-DESC;FMTTYPE=text/html | HTML via `dataToHtml()` | See HTML description format below |
| LOCATION | `normalizedEvent.location` | Escaped |
| URL | `normalizedEvent.link` | Link to original event page |
| CATEGORIES | `normalizedEvent.category` | Source category used as tag label |
| ORGANIZER;CN={name} | `normalizedEvent.organizer` or fallback | Fallback: `Kulturkalender Greifswald` |
| STATUS | `normalizedEvent.status` mapped to ICS values | `confirmed` → `CONFIRMED`, `cancelled` → `CANCELLED`, `tentative` → `TENTATIVE` |
| DTSTAMP | `normalizedEvent.updated` | Last modification timestamp |
| LAST-MODIFIED | `normalizedEvent.updated` | Same as DTSTAMP |

## UID Format

Pattern: `kulturkalender-{kumo_id}-{date}` — slugified to contain only lowercase alphanumeric characters and hyphens.

Example: `kulturkalender-58362-2026-04-26`

Rules:

- UIDs must be stable across re-imports of the same event occurrence.
- Only characters `[a-z0-9-]` are allowed.
- Use a slugify function to sanitize components before joining.
- The `kumo_id` is numeric, so it is safe as-is. The `date` is ISO format with hyphens, also safe.
- If future sources introduce non-numeric IDs, slugify them (lowercase, replace non-alphanumeric with `-`, collapse consecutive hyphens, trim).

## Description Format (DESCRIPTION field)

Use `@schafevormfenster/data-text-mapper` `dataToText()` with this input shape:

```ts
const textWithData: TextWithData = {
  description: buildPlainDescription(event),  // subtitle + content joined
  url: event.link,
  tags: [event.category],                     // e.g. ["Ausstellung"] — source category used as tag
  scopes: deriveScopes(event),                // see Scope Derivation below
  image: event.image ?? undefined,
};
const icsDescription: string = dataToText(textWithData);
```

### Scope Derivation

Scopes use the vocabulary `"Ort" | "Umgebung" | "Region"` (same as `kirche-mv-kalender`).

Derivation rule for this adapter:

| Source `category` | Scope | Rationale |
| :-- | :-- | :-- |
| `"Umland"` | `"Region"` | Events outside Greifswald city, in the wider region |
| Any other value | omit scopes | Let downstream services determine scope from location/geo data |

When scope cannot be determined, pass `scopes: undefined` (omit the field). Downstream services in the Schafe-vorm-Fenster ecosystem will assign scope based on geocoding and community boundaries.

**Output format** (paragraphs separated by `\n\n`):

```text
{subtitle + content text}

{image URL if present}

{event link URL}

#Ausstellung @Region
```

When scopes is omitted, the last line contains only tags:

```text
{subtitle + content text}

{event link URL}

#Musik
```

## HTML Description Format (X-ALT-DESC)

Use `@schafevormfenster/data-text-mapper` `dataToHtml()` with the same `TextWithData` input.

**Output format** (microformat class names for downstream consumers):

```html
<p class="p-description">{subtitle + content text}</p>
<img class="u-photo" src="{image URL}" />
<p class="link"><a class="u-url" href="{event link}">{event link}</a></p>
<p class="taxonomy"><span class="p-category">#Ausstellung</span> <span class="p-scope">@Region</span></p>
```

When scopes is omitted (most events), the taxonomy line has only tags:

```html
<p class="taxonomy"><span class="p-category">#Musik</span></p>
```

These microformat classes are intentional — they allow structured data extraction by downstream consumers (e.g., the data mapper used in the Schafe vorm Fenster ecosystem).

## Timezone Handling (Google Calendar Compatibility)

### Source times are local

The Kulturkalender feed provides times as bare `HH:MM` strings (e.g. `"15:00"`) and dates as `YYYY-MM-DD`. These are **local Europe/Berlin times** — they carry no UTC offset or timezone suffix. The normalized schema stores them as `"2026-04-26T15:00:00"` (no `Z`, no offset).

### Problem with the ics library

The `ics` library, when given `startInputType: "local"`, still outputs UTC-suffixed dates (`DTSTART:20260426T130000Z`) by converting from the system timezone. This causes timezone drift when imported into Google Calendar in other timezones.

### Required approach

1. Pass times as `startInputType: "local"` to prevent UTC conversion of the numeric array input.
2. **Post-process** the generated ICS string to ensure explicit TZID:
   - Inject full `VTIMEZONE` block for `Europe/Berlin` after `METHOD:PUBLISH`.
   - Replace `DTSTART:{date}T{time}Z` → `DTSTART;TZID=Europe/Berlin:{date}T{time}` (strip Z, add TZID parameter).
   - Replace `DTEND:{date}T{time}Z` → `DTEND;TZID=Europe/Berlin:{date}T{time}` (same).
   - Also handle the case where the library outputs without Z: `DTSTART:{date}T{time}` → `DTSTART;TZID=Europe/Berlin:{date}T{time}`.
3. Ensure `X-WR-TIMEZONE:Europe/Berlin` is present in VCALENDAR properties.

### Critical: never use `new Date()` for parsing

Do NOT parse local time strings with `new Date("2026-04-26T15:00:00")` — this interprets the string in the system's local timezone, which may differ on the server. Instead, parse the components directly:

```ts
// CORRECT: parse components from the ISO-like local string
function toIcsDateArray(localIso: string): number[] {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00:00").split(":").map(Number);
  return [year, month, day, hour, minute];
}
```

This guarantees the ICS output contains the exact local time from the source, regardless of server timezone.

### VTIMEZONE Block

```ics
BEGIN:VTIMEZONE
TZID:Europe/Berlin
X-LIC-LOCATION:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
```

## Date Array Format

The `ics` library expects dates as `[year, month, day, hour, minute]` arrays.

Parse directly from the local ISO string — never via `new Date()`:

```ts
// "2026-04-26T15:00:00" → [2026, 4, 26, 15, 0]
function toIcsDateArray(localIso: string): number[] {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00:00").split(":").map(Number);
  return [year, month, day, hour, minute];
}
```

Always use `startInputType: "local"` and `endInputType: "local"`.

## Default End Time

When `normalizedEvent.end` is `null`, compute a default end:

- If start has a non-midnight time component: `start + 2 hours`
- If start is midnight (all-day event): omit DTEND (use `VALUE=DATE` on DTSTART with `[year, month, day]` 3-element array)

## Categories (ICS CATEGORIES = tags)

The source `category` field (e.g. `"Ausstellung"`, `"Musik"`) is used as a **tag** in the description text (via `dataToText` `tags` array) and also set as the ICS `CATEGORIES` property for calendar app filtering.

Set as a single-element array: `[normalizedEvent.category]`.

The `ics` library joins arrays with comma for the `CATEGORIES` property.

Example output: `CATEGORIES:Ausstellung`

Note: The source `category` is semantically a tag/label, not a strict taxonomy category. It is passed through as-is from the Kulturkalender source feed. Downstream systems may reclassify.

## Organizer

Format for the `ics` library:

```ts
organizer: {
  name: event.organizer || "Kulturkalender Greifswald",
  email: "info@greifswald.de",
}
```

When `organizer` is empty/null, use the fallback name.

## Response Headers

| Header | Value |
| :-- | :-- |
| Content-Type | `text/calendar; charset=utf-8` |
| Content-Disposition | `inline; filename=kulturkalender-greifswald.ics` |

## ICS Event Input Shape (to ics library)

```ts
interface IcsEventInput {
  uid: string;
  title: string;
  description: string;           // plain text from dataToText()
  htmlContent?: string;          // HTML from dataToHtml() (forked ics only)
  start: number[];               // [year, month, day, hour, minute]
  startInputType: "local";
  end: number[];
  endInputType: "local";
  location: string;
  url: string;
  method: "PUBLISH";
  organizer: { name: string; email: string };
  categories: string[];
  productId: string;
  status: string;
  lastModified: number[];
}
```

## Text Escaping

The `ics` library handles escaping of special characters in DESCRIPTION, SUMMARY, and LOCATION:

- `\` → `\\`
- newlines → `\n`
- `;` → `\;`
- `,` → `\,`

Line folding at 75 characters is also handled by the library.

## Multi-Event Calendar

When returning multiple events, the library merges them into a single VCALENDAR with multiple VEVENTs. Post-processing (timezone injection, date fixing) applies to the merged output.

## Adoption

- Implementation location: `src/services/shared/ics/ics-formatter.ts`
- Test with fixture data to verify Google Calendar import compatibility.
- Validate output with [icalendar.org validator](https://icalendar.org/validator.html) during development.
