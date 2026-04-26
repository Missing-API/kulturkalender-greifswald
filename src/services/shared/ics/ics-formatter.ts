import { createEvents, type EventAttributes } from "ics";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

 
/**
 * Converts normalized events to ICS calendar string.
 */
export function eventsToIcs(events: NormalizedEvent[]): string {
  const icsEvents: EventAttributes[] = events.map((event) => {
    const start = parseDateTime(event.start);
    return {
      uid: `${event.id}@kulturkalender-greifswald`,
      title: event.summary,
      description: event.description,
      start: start,
      duration: { hours: 2 },
      location: event.location,
      url: event.link,
      status: mapStatus(event.status),
      categories: event.category ? [event.category] : undefined,
      organizer: event.organizer
        ? { name: event.organizer }
        : undefined,
    };
  });

  const { error, value } = createEvents(icsEvents);
  if (error) {
    console.error("ICS generation failed", { error: error.message });
    throw new Error(`ICS generation failed: ${error.message}`);
  }
  return value ?? "";
}

function parseDateTime(
  isoString: string
): [number, number, number, number, number] {
  const d = new Date(isoString);
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
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
