import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, vi } from "vitest";

import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { KulturkalenderSourceFeedSchema } from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { NormalizedEventSchema } from "@/types/normalized-event.schema";

import { eventsToIcs, toIcsDateArray } from "./ics-formatter";

vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => venue ?? ""),
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

      expect(ics).toContain("DTSTART;TZID=Europe/Berlin:");
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
  });
});
