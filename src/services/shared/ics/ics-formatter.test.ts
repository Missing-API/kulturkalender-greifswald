import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, vi } from "vitest";

import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { KulturkalenderSourceFeedSchema } from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { NormalizedEventSchema } from "@/types/normalized-event.schema";

import { isAllDay, parseLocalIsoToDate, toIcsDateArray, mapStatus } from "./helpers/ics-date";
import { foldLine } from "./helpers/ics-fold";
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

    it("uses DTSTART;VALUE=DATE for all-day fixture events", async () => {
      const events = await loadFixtureEvents(1);
      const ics = eventsToIcs(events);

      // First fixture event has time="" → all-day
      expect(ics).toContain("DTSTART;VALUE=DATE:");
      expect(ics).not.toMatch(/DTSTART;VALUE=DATE-TIME/);
      expect(ics).not.toContain("DURATION:");
    });

    it("uses TZID on DTSTART for timed fixture events", async () => {
      const events = await loadFixtureEvents(3);
      const ics = eventsToIcs(events);

      // Third fixture event has time="15:00" → timed
      expect(ics).toContain("DTSTART;");
      expect(ics).toContain("TZID=Europe/Berlin:");
      expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
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

  describe("DESCRIPTION and HTML Description Format", () => {
    const event = {
      id: "format-test-1",
      seriesId: null,
      summary: "Format Test",
      description: "First paragraph.\n\nSecond paragraph.\nWith a line break.",
      start: "2026-05-01T10:00:00",
      end: null,
      timeZone: "Europe/Berlin",
      location: "Stadthalle Greifswald",
      category: "Konzert",
      organizer: "Kulturamt",
      organizerEmail: "kultur@greifswald.de",
      link: "https://example.com/event/1",
      image: "https://example.com/photo.jpg",
      status: "confirmed" as const,
      source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
      tags: [],
      updated: "2026-01-01T00:00:00Z",
    };

    it("DESCRIPTION uses plain text with escaped newlines", () => {
      const ics = eventsToIcs([event]);

      // DESCRIPTION must be plain text — no HTML tags
      // Unfold ICS continuation lines to inspect content
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const descLine = unfolded.split("\r\n").find((l) => l.startsWith("DESCRIPTION:"));
      expect(descLine).toBeDefined();
      expect(descLine).not.toContain("<p");
      expect(descLine).not.toContain("<html");
      expect(descLine).not.toContain("<body");
      // Should contain literal \n for line breaks (ICS escaped newline)
      expect(descLine).toContain(String.raw`\n`);
    });

    it("X-ALT-DESC contains full HTML document with DOCTYPE and body", () => {
      const ics = eventsToIcs([event]);

      // Unfold ICS continuation lines
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const altDescLine = unfolded.split("\r\n").find((l) => l.startsWith("X-ALT-DESC;"));
      expect(altDescLine).toBeDefined();
      expect(altDescLine).toContain("FMTTYPE=text/html");
      expect(altDescLine).toContain("<!DOCTYPE html>");
      expect(altDescLine).toContain("<html>");
      expect(altDescLine).toContain("<body>");
      expect(altDescLine).toContain("</body>");
      expect(altDescLine).toContain("</html>");
    });

    it("X-ALT-DESC uses div container instead of p for description", () => {
      const ics = eventsToIcs([event]);

      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const altDescLine = unfolded.split("\r\n").find((l) => l.startsWith("X-ALT-DESC;"));
      expect(altDescLine).toBeDefined();
      expect(altDescLine).toContain('<div class="p-description">');
      expect(altDescLine).toContain("</div>");
    });

    it("X-ALT-DESC splits paragraphs into separate p elements", () => {
      const ics = eventsToIcs([event]);

      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const altDescLine = unfolded.split("\r\n").find((l) => l.startsWith("X-ALT-DESC;"))!;
      // Two paragraphs separated by \n\n → two <p> tags
      expect(altDescLine).toContain("<p>First paragraph.</p>");
      expect(altDescLine).toContain("<p>Second paragraph.");
    });

    it("X-ALT-DESC converts single newlines to <br> within paragraphs", () => {
      const ics = eventsToIcs([event]);

      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const altDescLine = unfolded.split("\r\n").find((l) => l.startsWith("X-ALT-DESC;"))!;
      // Single \n within paragraph → <br>
      expect(altDescLine).toContain("Second paragraph.<br>With a line break.");
    });

    it("DESCRIPTION;ALTREP is NOT present (single DESCRIPTION per RFC 5545)", () => {
      const ics = eventsToIcs([event]);

      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const altrepLine = unfolded.split("\r\n").find((l) =>
        l.startsWith('DESCRIPTION;ALTREP=')
      );
      expect(altrepLine).toBeUndefined();
    });

    it("has exactly one DESCRIPTION property per VEVENT", () => {
      const ics = eventsToIcs([event]);

      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const descLines = unfolded.split("\r\n").filter((l) =>
        l.startsWith("DESCRIPTION")
      );
      // Only DESCRIPTION: (plain text) — no DESCRIPTION;ALTREP
      expect(descLines).toHaveLength(1);
      expect(descLines[0]).toMatch(/^DESCRIPTION:/);
    });
  });

  describe("All-Day Events", () => {
    const allDayEvent = {
      id: "allday-1",
      seriesId: null,
      summary: "All-Day Exhibition",
      description: "Open all day",
      start: "2026-05-15",
      end: null,
      timeZone: "Europe/Berlin",
      location: "Museum",
      category: "Ausstellung",
      organizer: "Museum Team",
      organizerEmail: null,
      link: "https://example.com/event/allday",
      image: null,
      status: "confirmed" as const,
      source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
      tags: [],
      updated: "2026-01-01T00:00:00Z",
    };

    const timedEvent = {
      id: "timed-1",
      seriesId: null,
      summary: "Evening Concert",
      description: "A concert at 20:00",
      start: "2026-05-15T20:00:00",
      end: null,
      timeZone: "Europe/Berlin",
      location: "Stadthalle",
      category: "Konzert",
      organizer: "Org",
      organizerEmail: null,
      link: "https://example.com/event/timed",
      image: null,
      status: "confirmed" as const,
      source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
      tags: [],
      updated: "2026-01-01T00:00:00Z",
    };

    it("uses DTSTART;VALUE=DATE for all-day events (no T in start)", () => {
      const ics = eventsToIcs([allDayEvent]);
      expect(ics).toContain("DTSTART;VALUE=DATE:20260515");
      expect(ics).not.toMatch(/DTSTART;VALUE=DATE-TIME/);
    });

    it("omits DURATION for all-day events", () => {
      const ics = eventsToIcs([allDayEvent]);
      expect(ics).not.toContain("DURATION:");
    });

    it("does not include TZID on all-day DTSTART", () => {
      const ics = eventsToIcs([allDayEvent]);
      // DATE values must not have TZID
      expect(ics).not.toMatch(/DTSTART;.*TZID.*:20260515/);
    });

    it("keeps DTSTART;VALUE=DATE-TIME with TZID for timed events", () => {
      const ics = eventsToIcs([timedEvent]);
      expect(ics).toMatch(/DTSTART;VALUE=DATE-TIME;TZID=Europe\/Berlin:20260515T200000/);
    });

    it("keeps DURATION:PT2H for timed events", () => {
      const ics = eventsToIcs([timedEvent]);
      expect(ics).toContain("DURATION:PT2H");
    });

    it("handles mixed timed and all-day events correctly", () => {
      const ics = eventsToIcs([allDayEvent, timedEvent]);
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const lines = unfolded.split("\r\n");

      // All-day event: VALUE=DATE, no DURATION
      const allDayStart = lines.find((l) => l === "DTSTART;VALUE=DATE:20260515");
      expect(allDayStart).toBeDefined();

      // Timed event: VALUE=DATE-TIME with TZID, DURATION
      const timedStart = lines.find((l) =>
        l.startsWith("DTSTART;VALUE=DATE-TIME;TZID=Europe/Berlin:20260515T200000")
      );
      expect(timedStart).toBeDefined();
    });
  });

  describe("Series / RELATED-TO", () => {
    const seriesEvent1 = {
      id: "series-1-2026-05-01",
      seriesId: "series-1",
      summary: "Series Event Day 1",
      description: "Part of a series",
      start: "2026-05-01T10:00:00",
      end: null,
      timeZone: "Europe/Berlin",
      location: "Somewhere",
      category: "Ausstellung",
      organizer: "Org",
      organizerEmail: null,
      link: "https://example.com/event/s1d1",
      image: null,
      status: "confirmed" as const,
      source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
      tags: [],
      updated: "2026-01-01T00:00:00Z",
    };

    const oneOffEvent = {
      id: "oneoff-1",
      seriesId: null,
      summary: "One-Off Event",
      description: "Not part of a series",
      start: "2026-05-01T14:00:00",
      end: null,
      timeZone: "Europe/Berlin",
      location: "Elsewhere",
      category: "Konzert",
      organizer: "Org",
      organizerEmail: null,
      link: "https://example.com/event/oneoff",
      image: null,
      status: "confirmed" as const,
      source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
      tags: [],
      updated: "2026-01-01T00:00:00Z",
    };

    it("includes RELATED-TO for events with seriesId", () => {
      const ics = eventsToIcs([seriesEvent1]);
      expect(ics).toContain("RELATED-TO:series-1");
    });

    it("omits RELATED-TO for events without seriesId", () => {
      const ics = eventsToIcs([oneOffEvent]);
      expect(ics).not.toContain("RELATED-TO:");
    });

    it("includes RELATED-TO only in the correct VEVENT block", () => {
      const ics = eventsToIcs([seriesEvent1, oneOffEvent]);
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const lines = unfolded.split("\r\n");

      // Series event block should have RELATED-TO
      const seriesUidIdx = lines.indexOf("UID:series-1-2026-05-01");
      const seriesEndIdx = lines.indexOf("END:VEVENT", seriesUidIdx);
      const seriesBlock = lines.slice(seriesUidIdx, seriesEndIdx);
      expect(seriesBlock.find((l) => l === "RELATED-TO:series-1")).toBeDefined();

      // One-off event block should not have RELATED-TO
      const oneOffUidIdx = lines.indexOf("UID:oneoff-1");
      const oneOffEndIdx = lines.indexOf("END:VEVENT", oneOffUidIdx);
      const oneOffBlock = lines.slice(oneOffUidIdx, oneOffEndIdx);
      expect(oneOffBlock.find((l) => l.startsWith("RELATED-TO:"))).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("isAllDay detects date-only strings", () => {
      expect(isAllDay("2026-05-15")).toBe(true);
      expect(isAllDay("2026-12-31")).toBe(true);
    });

    it("isAllDay returns false for datetime strings", () => {
      expect(isAllDay("2026-05-15T10:00:00")).toBe(false);
      expect(isAllDay("2026-05-15T00:00:00")).toBe(false);
    });

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
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).not.toContain("LOCATION:");
    });

    it("omits organizer when empty string", () => {
      const event = {
        id: "test-2",
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).not.toContain("ORGANIZER");
    });

    it("omits categories when no category", () => {
      const event = {
        id: "test-3",
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).not.toContain("CATEGORIES:");
    });

    it("uses venue email when organizerEmail is provided", () => {
      const event = {
        id: "test-4",
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("MAILTO:kultur@greifswald.de");
    });

    it("falls back to default email when organizerEmail is null", () => {
      const event = {
        id: "test-5",
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("MAILTO:info@greifswald.de");
    });

    it("maps tentative status", () => {
      const event = {
        id: "test-6",
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("STATUS:TENTATIVE");
    });

    it("maps cancelled status", () => {
      const event = {
        id: "test-7",
        seriesId: null,
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
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      expect(ics).toContain("STATUS:CANCELLED");
    });
  });

  describe("RFC 5545 Line Folding", () => {
    it("foldLine returns short lines unchanged", () => {
      expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
    });

    it("foldLine returns 75-byte lines unchanged", () => {
      const line = "X".repeat(75);
      expect(foldLine(line)).toBe(line);
    });

    it("foldLine splits at 75 octets with CRLF+SPACE continuation", () => {
      const line = "A".repeat(150);
      const folded = foldLine(line);
      const parts = folded.split("\r\n");
      expect(parts.length).toBe(3);
      expect(parts[0]).toHaveLength(75);
      expect(parts[1]).toMatch(/^ /); // starts with space
      expect(parts[1]).toHaveLength(75); // space + 74 chars
      expect(parts[2]).toMatch(/^ /);
    });

    it("foldLine counts bytes not characters for multi-byte UTF-8", () => {
      // ü = 2 bytes in UTF-8, so 40 ü = 80 bytes > 75
      const line = "ü".repeat(40);
      const folded = foldLine(line);
      const parts = folded.split("\r\n");
      expect(parts.length).toBeGreaterThan(1);
      // Each raw line must be ≤ 75 bytes
      const encoder = new TextEncoder();
      for (const part of parts) {
        expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
      }
    });

    it("foldLine does not split inside multi-byte characters", () => {
      // Mix ASCII + multi-byte: 70 ASCII + 3 ü (6 bytes) = 76 bytes → must fold
      const line = "A".repeat(70) + "üüü";
      const folded = foldLine(line);
      const unfolded = folded.replaceAll(/\r\n[ \t]/g, "");
      expect(unfolded).toBe(line);
    });

    it("foldLine round-trips: unfolding recovers original", () => {
      const original = 'DESCRIPTION;ALTREP="CID:<test>":<!DOCTYPE html><html><body>' + "A".repeat(200) + "</body></html>";
      const folded = foldLine(original);
      const unfolded = folded.replaceAll(/\r\n[ \t]/g, "");
      expect(unfolded).toBe(original);
    });

    it("DESCRIPTION;ALTREP lines are properly folded under 75 bytes", () => {
      const event = {
        id: "fold-test-1",
        seriesId: null,
        summary: "Fold Test",
        description: "A long description that will generate HTML content exceeding seventy five characters per line easily.",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "Stadthalle",
        category: "Konzert",
        organizer: "Test Org",
        organizerEmail: null,
        link: "https://example.com/event/1",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");

      // DESCRIPTION;ALTREP should no longer be present
      const altrepLine = unfolded.split("\r\n").find((l) => l.startsWith('DESCRIPTION;ALTREP='));
      expect(altrepLine).toBeUndefined();
    });

    it("quotes ORGANIZER CN when it contains commas", () => {
      const event = {
        id: "cn-test-1",
        seriesId: null,
        summary: "CN Quoting Test",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "",
        category: "",
        organizer: "Alice, Bob",
        organizerEmail: "test@example.com",
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const orgLine = unfolded.split("\r\n").find((l) => l.startsWith("ORGANIZER;"));
      expect(orgLine).toBeDefined();
      // CN must be double-quoted when it contains commas
      expect(orgLine).toContain('CN="Alice, Bob"');
      expect(orgLine).toContain("MAILTO:test@example.com");
    });

    it("does not quote ORGANIZER CN without special characters", () => {
      const event = {
        id: "cn-test-2",
        seriesId: null,
        summary: "CN No Quote Test",
        description: "",
        start: "2026-05-01T10:00:00",
        end: null,
        timeZone: "Europe/Berlin",
        location: "",
        category: "",
        organizer: "Simple Name",
        organizerEmail: "test@example.com",
        link: "https://example.com",
        image: null,
        status: "confirmed" as const,
        source: "kulturkalender-greifswald",
      sourceName: "Kulturkalender Greifswald",
        tags: [],
        updated: "2026-01-01T00:00:00Z",
      };
      const ics = eventsToIcs([event]);
      const unfolded = ics.replaceAll(/\r\n[ \t]/g, "");
      const orgLine = unfolded.split("\r\n").find((l) => l.startsWith("ORGANIZER;"));
      expect(orgLine).toBeDefined();
      // CN without special chars should NOT be quoted
      expect(orgLine).toContain("CN=Simple Name");
      expect(orgLine).not.toContain('CN="');
    });
  });
});
