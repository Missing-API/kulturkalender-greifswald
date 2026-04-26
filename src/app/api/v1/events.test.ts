import { describe, it, expect } from "vitest";

import { EventListResponseSchema } from "@/contracts/events.schemas";
import { getEvents } from "@/services/application/get-events.service";
import { eventsToIcs } from "@/services/shared/ics/ics-formatter";

describe("GET /api/v1/events", () => {
  it("returns a valid event list response", () => {
    const events = getEvents();
    const response = { events, count: events.length };
    const parsed = EventListResponseSchema.parse(response);

    expect(parsed.count).toBe(3);
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[0].id).toContain("kulturkalender-");
  });

  it("all events have required fields", () => {
    const events = getEvents();
    for (const event of events) {
      expect(event.id).toBeTruthy();
      expect(event.summary).toBeTruthy();
      expect(event.start).toBeTruthy();
      expect(event.link).toContain("https://");
      expect(event.source).toBe("kulturkalender-greifswald");
    }
  });
});

describe("GET /api/v1/events.ics", () => {
  it("produces valid ICS content", () => {
    const events = getEvents();
    const ics = eventsToIcs(events);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("contains event summaries in ICS output", () => {
    const events = getEvents();
    const ics = eventsToIcs(events);

    expect(ics).toContain("Mit Blick auf's Wasser");
    expect(ics).toContain("Galerie der Romantik");
  });

  it("ICS contains correct number of events", () => {
    const events = getEvents();
    const ics = eventsToIcs(events);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(eventCount).toBe(3);
  });
});
