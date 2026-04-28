import {
  generateIcsCalendar,
  type IcsCalendar,
  type IcsEvent,
  type IcsTimezone,
} from "ts-ics";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

import { buildIcsDescription, buildIcsHtmlDescription } from "./build-ics-description";
import { isAllDay, mapStatus, toIcsDateObject, toIcsAllDayEnd } from "./helpers/ics-date";

type AltDescNonStandard = { altDesc: string };

const EUROPE_BERLIN_TIMEZONE: IcsTimezone<AltDescNonStandard> = {
  id: "Europe/Berlin",
  props: [
    {
      type: "DAYLIGHT",
      start: new Date(Date.UTC(1970, 2, 29, 2, 0, 0)),
      offsetFrom: "+0100",
      offsetTo: "+0200",
      name: "CEST",
      recurrenceRule: {
        frequency: "YEARLY",
        byMonth: [2],
        byDay: [{ day: "SU", occurrence: -1 }],
      },
    },
    {
      type: "STANDARD",
      start: new Date(Date.UTC(1970, 9, 25, 3, 0, 0)),
      offsetFrom: "+0200",
      offsetTo: "+0100",
      name: "CET",
      recurrenceRule: {
        frequency: "YEARLY",
        byMonth: [9],
        byDay: [{ day: "SU", occurrence: -1 }],
      },
    },
  ],
};

const DEFAULT_ORGANIZER_EMAIL = "info@greifswald.de";

/**
 * Converts normalized events to ICS calendar string using ts-ics.
 */
export function eventsToIcs(events: NormalizedEvent[]): string {
  const now = new Date();

  const icsEvents: IcsEvent<AltDescNonStandard>[] = events.map((event) => ({
    uid: event.id,
    summary: event.summary,
    description: buildIcsDescription(event),
    start: toIcsDateObject(event.start),
    stamp: { date: now },
    ...(isAllDay(event.start)
      ? { end: toIcsAllDayEnd(event.start) }
      : { duration: { hours: 2 } }),
    location: event.location || undefined,
    url: event.link,
    status: mapStatus(event.status),
    categories: event.tags.length > 0 ? event.tags : undefined,
    organizer: event.organizer
      ? { name: event.organizer, email: event.organizerEmail || DEFAULT_ORGANIZER_EMAIL }
      : undefined,
    nonStandard: {
      altDesc: buildIcsHtmlDescription(event),
    },
  }));

  const calendar: IcsCalendar<AltDescNonStandard> = {
    version: "2.0",
    prodId: "kulturkalender-greifswald",
    method: "PUBLISH",
    name: "Kulturkalender Greifswald",
    timezones: [EUROPE_BERLIN_TIMEZONE],
    events: icsEvents,
    nonStandard: {
      altDesc: "", // calendar-level placeholder (not used)
    },
  };

  let ics = generateIcsCalendar<AltDescNonStandard>(calendar, {
    nonStandard: {
      altDesc: {
        name: "X-ALT-DESC",
        generate: (v) =>
          v ? { value: v, options: { FMTTYPE: "text/html" } } : null,
      },
    },
  });

  // Inject X-WR-TIMEZONE and X-PUBLISHED-TTL after METHOD:PUBLISH
  ics = ics.replace(
    "METHOD:PUBLISH\r\n",
    "METHOD:PUBLISH\r\nX-WR-TIMEZONE:Europe/Berlin\r\nX-PUBLISHED-TTL:PT1H\r\n",
  );

  // Quote ORGANIZER CN values that contain RFC 5545 special characters
  ics = ics.replaceAll(
    /ORGANIZER;CN=([^":][^:]*?)(:\s*MAILTO:)/g,
    (_match, cn: string, mailto: string) =>
      /[,;]/.test(cn)
        ? `ORGANIZER;CN="${cn}"${mailto}`
        : `ORGANIZER;CN=${cn}${mailto}`,
  );

  // Inject RELATED-TO for series events (RFC 5545 §3.8.4.5)
  for (const event of events) {
    if (event.seriesId) {
      ics = ics.replace(
        `UID:${event.id}\r\n`,
        `UID:${event.id}\r\nRELATED-TO:${event.seriesId}\r\n`,
      );
    }
  }

  return ics;
}
