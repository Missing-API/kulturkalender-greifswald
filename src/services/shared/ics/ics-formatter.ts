import { createEvents, type EventAttributes } from "ics";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

import { buildIcsDescription, buildIcsHtmlDescription } from "./build-ics-description";

const VTIMEZONE_BLOCK = `BEGIN:VTIMEZONE
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
END:VTIMEZONE`;

/**
 * Converts normalized events to ICS calendar string.
 * Applies VTIMEZONE injection and TZID post-processing for Google Calendar compatibility.
 */
export function eventsToIcs(events: NormalizedEvent[]): string {
  const icsEvents: EventAttributes[] = events.map((event) => ({
    uid: event.id,
    title: event.summary,
    description: buildIcsDescription(event),
    htmlContent: buildIcsHtmlDescription(event),
    start: toIcsDateArray(event.start),
    startInputType: "local" as const,
    duration: { hours: 2 },
    location: event.location,
    url: event.link,
    status: mapStatus(event.status),
    categories: event.category ? [event.category] : undefined,
    organizer: event.organizer
      ? { name: event.organizer }
      : undefined,
    productId: "kulturkalender-greifswald",
    calName: "Kulturkalender Greifswald",
  }));

  const { error, value } = createEvents(icsEvents);
  if (error) {
    throw new Error(`ICS generation failed: ${error.message}`);
  }

  return postProcessIcs(value ?? "");
}

/**
 * Parse local ISO datetime string directly into ICS date array.
 * NEVER uses new Date() to avoid timezone drift.
 */
export function toIcsDateArray(
  localIso: string
): [number, number, number, number, number] {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00:00").split(":").map(Number);
  return [year, month, day, hour, minute];
}

function mapStatus(
  status: "confirmed" | "tentative" | "cancelled"
): "CONFIRMED" | "TENTATIVE" | "CANCELLED" {
  const map = {
    confirmed: "CONFIRMED",
    tentative: "TENTATIVE",
    cancelled: "CANCELLED",
  } as const;
  return map[status];
}

/**
 * Post-process the ICS output:
 * 1. Inject VTIMEZONE block after METHOD:PUBLISH
 * 2. Add X-WR-TIMEZONE header
 * 3. Replace UTC-suffixed dates with TZID-qualified dates
 */
function postProcessIcs(ics: string): string {
  let result = ics;

  // Inject VTIMEZONE after METHOD:PUBLISH
  result = result.replace(
    "METHOD:PUBLISH",
    `METHOD:PUBLISH\r\nX-WR-TIMEZONE:Europe/Berlin\r\nX-PUBLISHED-TTL:PT1H\r\n${VTIMEZONE_BLOCK}`
  );

  // Replace DTSTART with Z suffix → DTSTART with TZID
  result = result.replaceAll(
    /DTSTART:(\d{8}T\d{6})Z/g,
    "DTSTART;TZID=Europe/Berlin:$1"
  );

  // Replace DTEND with Z suffix → DTEND with TZID
  result = result.replaceAll(
    /DTEND:(\d{8}T\d{6})Z/g,
    "DTEND;TZID=Europe/Berlin:$1"
  );

  // Handle case where library outputs without Z
  result = result.replaceAll(
    /DTSTART:(\d{8}T\d{6})(?!\r?\n)/g,
    "DTSTART;TZID=Europe/Berlin:$1"
  );

  result = result.replaceAll(
    /DTEND:(\d{8}T\d{6})(?!\r?\n)/g,
    "DTEND;TZID=Europe/Berlin:$1"
  );

  return result;
}
