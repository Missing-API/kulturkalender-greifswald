import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, vi } from "vitest";

import { EventListResponseSchema } from "@/contracts/events.schema";
import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import {
  KulturkalenderSourceFeedSchema,
} from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { eventsToIcs } from "@/services/shared/ics/ics-formatter";
import { NormalizedEventSchema } from "@/types/normalized-event.schema";

vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => ({ location: venue ?? "", email: null })),
}));

async function loadFixtureEvents() {
  const filePath = path.resolve(process.cwd(), "fixtures/a869cfebea250bbfe04a1b623baaf338.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const feed = KulturkalenderSourceFeedSchema.parse(data);

  return Promise.all(
    feed.slice(0, 10).map(async (raw) => {
      const mapped = await mapSourceToNormalized(raw);
      return NormalizedEventSchema.parse(mapped);
    })
  );
}

describe("Happy Path", () => {
describe("GET /api/v1/events", () => {
  it("returns a valid event list response from fixture data", async () => {
    const events = await loadFixtureEvents();
    const response = { events, count: events.length };
    const parsed = EventListResponseSchema.parse(response);

    expect(parsed.count).toBe(10);
    expect(parsed.events).toHaveLength(10);
    expect(parsed.events[0].id).toContain("kulturkalender-");
  });

  it("all events have required fields", async () => {
    const events = await loadFixtureEvents();
    for (const event of events) {
      expect(event.id).toBeTruthy();
      expect(event.summary).toBeTruthy();
      expect(event.start).toBeTruthy();
      expect(event.link).toContain("https://");
      expect(event.source).toBe("kulturkalender-greifswald");
      expect(event.tags).toBeDefined();
    }
  });
});

describe("GET /api/v1/events.ics", () => {
  it("produces valid ICS content", async () => {
    const events = await loadFixtureEvents();
    const ics = eventsToIcs(events);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("contains event summaries in ICS output", async () => {
    const events = await loadFixtureEvents();
    const ics = eventsToIcs(events);

    expect(ics).toContain(events[0].summary);
  });

  it("ICS contains correct number of events", async () => {
    const events = await loadFixtureEvents();
    const ics = eventsToIcs(events);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(eventCount).toBe(10);
  });
});
});

describe("Edge Cases", () => {
  it("empty event list produces valid ICS with no VEVENTs", () => {
    const ics = eventsToIcs([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
