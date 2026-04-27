import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, vi } from "vitest";

import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { KulturkalenderSourceFeedSchema } from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { NormalizedEventSchema } from "@/types/normalized-event.schema";

import { parseLocalIsoToDate, toIcsDateArray, mapStatus } from "./helpers/ics-date";
import { eventsToIcs } from "./ics-formatter";

vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => ({ location: venue ?? "", email: null })),
}));

function loadFixture(relativePath: string): unknown {
  const filePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function loadFixtureEvents(count: number) {
  const data = loadFixture("fixtures/a869cfebea250bbfe04a1b623baaf338.json");
  const feed = KulturkalenderSourceFeedSchema.parse(data);

  return Promise.all(
    feed.slice(0, count).map(async (raw) => {
      const mapped = await mapSourceToNormalized(raw);
      return NormalizedEventSchema.parse(mapped);
    })
  );
}

describe("ICS Formatter", () => {
  describe("Happy Path", () => {
    it("generates ICS from fixture events matching snapshot", async () => {
      const events = await loadFixtureEvents(3);
      const ics = eventsToIcs(events);
      // Strip DTSTAMP lines as they contain current time
      const stable = ics.replaceAll(/DTSTAMP:\d{8}T\d{6}Z/g, "DTSTAMP:REDACTED");
      expect(stable).toMatchSnapshot();
    });

    it("includes VTIMEZONE block", async () => {
      const events = await loadFixtureEvents(1);
      const ics = eventsToIcs(events);

      expect(ics).toContain("BEGIN:VTIMEZONE");
      expect(ics).toContain("TZID:Europe/Berlin");
      expect(ics).toContain("END:VTIMEZONE");
    });

    it("uses TZID on DTSTART instead of Z suffix", async () => {
      const events = await loadFixtureEvents(1);
      const ics = eventsToIcs(events);

      expect(ics).toContain("DTSTART;");
      expect(ics).toContain("TZID=Europe/Berlin:");
      expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
      // Uses DURATION:PT2H instead of DTEND when end is null
      expect(ics).toContain("DURATION:PT2H");
    });

    it("includes X-ALT-DESC with HTML content", async () => {
      const events = await loadFixtureEvents(1);
      const ics = eventsToIcs(events);

      expect(ics).toContain("X-ALT-DESC");
      expect(ics).toContain("FMTTYPE=text/html");
    });

    it("includes VCALENDAR properties", async () => {
      const events = await loadFixtureEvents(1);
      const ics = eventsToIcs(events);

      expect(ics).toContain("PRODID:kulturkalender-greifswald");
      expect(ics).toContain("X-WR-TIMEZONE:Europe/Berlin");
      expect(ics).toContain("X-PUBLISHED-TTL:PT1H");
    });

    it("includes data-text-mapper tags in DESCRIPTION", async () => {
      const events = await loadFixtureEvents(1);
      const ics = eventsToIcs(events);

      // data-text-mapper adds #category and URL to description
      expect(ics).toContain("DESCRIPTION:");
    });
  });

  describe("Edge Cases", () => {
    it("toIcsDateArray parses local ISO datetime correctly", () => {
      expect(toIcsDateArray("2026-03-29T02:00:00")).toEqual([2026, 3, 29, 2, 0]);
      expect(toIcsDateArray("2026-12-31T23:59:00")).toEqual([2026, 12, 31, 23, 59]);
    });

    it("toIcsDateArray handles midnight (missing time)", () => {
      expect(toIcsDateArray("2026-01-01T00:00:00")).toEqual([2026, 1, 1, 0, 0]);
    });

    it("toIcsDateArray defaults time when T part is absent", () => {
      expect(toIcsDateArray("2026-06-15")).toEqual([2026, 6, 15, 0, 0]);
    });

    it("parseLocalIsoToDate handles date-only string without time", () => {
      const date = parseLocalIsoToDate("2026-06-15");
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(5); // June = 5
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(0);
    });

    it("parseLocalIsoToDate parses full datetime", () => {
      const date = parseLocalIsoToDate("2026-03-29T14:30:00");
      expect(date.getUTCHours()).toBe(14);
      expect(date.getUTCMinutes()).toBe(30);
    });

    it("mapStatus covers all statuses", () => {
      expect(mapStatus("confirmed")).toBe("CONFIRMED");
      expect(mapStatus("tentative")).toBe("TENTATIVE");
      expect(mapStatus("cancelled")).toBe("CANCELLED");
    });

    it("omits location when empty string", () => {
      const event = {
        id: "test-1",
        summary: "No Location",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "",
        category: "",
        organizer: "Org",
        organizerEmail: null,
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).not.toContain("LOCATION:");
    });

    it("omits organizer when empty string", () => {
      const event = {
        id: "test-2",
        summary: "No Organizer",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "Somewhere",
        category: "Musik",
        organizer: "",
        organizerEmail: null,
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).not.toContain("ORGANIZER");
    });

    it("omits categories when no category", () => {
      const event = {
        id: "test-3",
        summary: "No Category",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "",
        category: "",
        organizer: "",
        organizerEmail: null,
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).not.toContain("CATEGORIES:");
    });

    it("uses venue email when organizerEmail is provided", () => {
      const event = {
        id: "test-4",
        summary: "With Email",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "Kirche Wieck",
        category: "Musik",
        organizer: "Kulturverein",
        organizerEmail: "kultur@greifswald.de",
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("MAILTO:kultur@greifswald.de");
    });

    it("falls back to default email when organizerEmail is null", () => {
      const event = {
        id: "test-5",
        summary: "No Email",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "Somewhere",
        category: "Musik",
        organizer: "Kulturverein",
        organizerEmail: null,
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("MAILTO:info@greifswald.de");
    });

    it("maps tentative status", () => {
      const event = {
        id: "test-6",
        summary: "Tentative",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "",
        category: "",
        organizer: "",
        organizerEmail: null,
        link: "https://example.com",
        image: null,
        status: "tentative" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("STATUS:TENTATIVE");
    });

    it("maps cancelled status", () => {
      const event = {
        id: "test-7",
        summary: "Cancelled",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "",
        category: "",
        organizer: "",
        organizerEmail: null,
        link: "https://example.com",
        image: null,
        status: "cancelled" as const,
        source: "kulturkalender-greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("STATUS:CANCELLED");
    });
  });
});
