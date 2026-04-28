import ical from "node-ical";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

const DUMMY_EVENTS: NormalizedEvent[] = [
  {
    id: "kulturkalender-1",
    seriesId: "kulturkalender-100",
    summary: "Test Event",
    description: "A test event description",
    start: "2026-05-01T19:00:00",
    end: null,
    timeZone: "Europe/Berlin",
    location: "Stadthalle Greifswald",
    category: "Konzert",
    organizer: "Kulturamt",
    organizerEmail: "kultur@greifswald.de",
    link: "https://example.com/event/1",
    image: "https://example.com/photo.jpg",
    status: "confirmed",
    source: "kulturkalender-greifswald",
    sourceName: "Kulturkalender Greifswald",
    tags: ["Kultur", "Konzert"],
    updated: "2026-04-27T00:00:00Z",
  },
  {
    id: "kulturkalender-2",
    seriesId: null,
    summary: "Cancelled Workshop",
    description: "Workshop that got cancelled",
    start: "2026-06-10T14:00:00",
    end: null,
    timeZone: "Europe/Berlin",
    location: "",
    category: "",
    organizer: "",
    organizerEmail: null,
    link: "https://example.com/event/2",
    image: null,
    status: "cancelled",
    source: "kulturkalender-greifswald",
    sourceName: "Kulturkalender Greifswald",
    tags: [],
    updated: "2026-04-27T00:00:00Z",
  },
  {
    id: "kulturkalender-3",
    seriesId: "kulturkalender-100",
    summary: "All-Day Exhibition",
    description: "A whole day exhibition",
    start: "2026-05-15",
    end: null,
    timeZone: "Europe/Berlin",
    location: "Pommersches Landesmuseum",
    category: "Ausstellung",
    organizer: "Museum",
    organizerEmail: null,
    link: "https://example.com/event/3",
    image: null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
    sourceName: "Kulturkalender Greifswald",
    tags: ["Kultur", "Ausstellung"],
    updated: "2026-04-27T00:00:00Z",
  },
];

vi.mock("@/services/application/get-events.service", () => ({
  getEvents: vi.fn(async () => DUMMY_EVENTS),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Dynamic import so mocks are applied first
const { GET } = await import("./route");

describe("GET /api/v1/events.ics (route handler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Happy Path", () => {
  it("returns 200 with text/calendar content type", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
  });

  it("returns valid ICS body with VCALENDAR envelope", async () => {
    const response = await GET();
    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("END:VEVENT");
  });

  it("includes the event summary in ICS output", async () => {
    const response = await GET();
    const body = await response.text();
    expect(body).toContain("Test Event");
  });

  it("sets Content-Disposition header for file download", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="events.ics"',
    );
  });

  it("includes correct number of VEVENT blocks", async () => {
    const response = await GET();
    const body = await response.text();
    const count = (body.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(3);
  });
  });

  describe("ICS VEVENT Field Content", () => {
    let body: string;

    beforeEach(async () => {
      const response = await GET();
      body = await response.text();
    });

    it("uses event id as UID", () => {
      expect(body).toContain("UID:kulturkalender-1");
      expect(body).toContain("UID:kulturkalender-2");
    });

    it("includes SUMMARY for each event", () => {
      expect(body).toContain("SUMMARY:Test Event");
      expect(body).toContain("SUMMARY:Cancelled Workshop");
    });

    it("includes DTSTART with TZID for timed events", () => {
      expect(body).toMatch(/DTSTART;.*TZID=Europe\/Berlin:\d{8}T\d{6}/);
    });

    it("includes DURATION:PT2H fallback for timed events", () => {
      expect(body).toContain("DURATION:PT2H");
    });

    it("uses DTSTART;VALUE=DATE for all-day events", () => {
      expect(body).toMatch(/DTSTART;VALUE=DATE:20260515/);
    });

    it("omits DURATION for all-day events", () => {
      // Extract the all-day VEVENT block
      const unfolded = body.replaceAll(/\r\n[ \t]/g, "");
      const lines = unfolded.split("\r\n");
      const startIdx = lines.indexOf("UID:kulturkalender-3");
      const endIdx = lines.indexOf("END:VEVENT", startIdx);
      const block = lines.slice(startIdx, endIdx);
      expect(block.find((l) => l.startsWith("DURATION:"))).toBeUndefined();
    });

    it("includes LOCATION when present", () => {
      expect(body).toContain("LOCATION:Stadthalle Greifswald");
    });

    it("omits LOCATION when empty", () => {
      // Second event has empty location — count LOCATION occurrences
      const locationCount = (body.match(/^LOCATION:/gm) ?? []).length;
      expect(locationCount).toBe(2);
    });

    it("includes ORGANIZER with CN and MAILTO when present", () => {
      expect(body).toContain("CN=Kulturamt");
      expect(body).toContain("MAILTO:kultur@greifswald.de");
    });

    it("omits ORGANIZER when organizer is empty", () => {
      // Only two ORGANIZER lines expected (events 1 and 3, not event 2)
      const organizerCount = (body.match(/^ORGANIZER/gm) ?? []).length;
      expect(organizerCount).toBe(2);
    });

    it("includes CATEGORIES from event tags", () => {
      expect(body).toContain("CATEGORIES:Kultur,Konzert");
    });

    it("omits CATEGORIES when tags are empty", () => {
      const categoriesCount = (body.match(/^CATEGORIES:/gm) ?? []).length;
      expect(categoriesCount).toBe(2);
    });

    it("maps status correctly to ICS STATUS", () => {
      expect(body).toContain("STATUS:CONFIRMED");
      expect(body).toContain("STATUS:CANCELLED");
    });

    it("includes URL for each event", () => {
      expect(body).toContain("URL:https://example.com/event/1");
      expect(body).toContain("URL:https://example.com/event/2");
    });

    it("includes DESCRIPTION with event text", () => {
      expect(body).toContain("DESCRIPTION:");
      expect(body).toContain("A test event description");
    });

    it("includes X-ALT-DESC with HTML content type", () => {
      expect(body).toContain("X-ALT-DESC;FMTTYPE=text/html:");
    });

    it("includes HTML description with microformat markup", () => {
      // Unfold ICS continuation lines before checking content
      const unfolded = body.replaceAll(/\r\n[ \t]/g, "");
      expect(unfolded).toContain("p-description");
      expect(unfolded).toContain("A test event description");
    });

    it("includes image URL in HTML description when present", () => {
      const unfolded = body.replaceAll(/\r\n[ \t]/g, "");
      expect(unfolded).toContain("u-photo");
      expect(unfolded).toContain("https://example.com/photo.jpg");
    });

    it("includes event link in HTML description", () => {
      const unfolded = body.replaceAll(/\r\n[ \t]/g, "");
      expect(unfolded).toContain("u-url");
      expect(unfolded).toContain("https://example.com/event/1");
    });

    it("includes category-derived hashtag tags in description", () => {
      expect(body).toContain("#Kultur");
      expect(body).toContain("#Konzert");
    });

    it("includes VTIMEZONE block for Europe/Berlin", () => {
      expect(body).toContain("BEGIN:VTIMEZONE");
      expect(body).toContain("TZID:Europe/Berlin");
      expect(body).toContain("END:VTIMEZONE");
    });

    it("includes VCALENDAR properties", () => {
      expect(body).toContain("PRODID:kulturkalender-greifswald");
      expect(body).toContain("X-WR-TIMEZONE:Europe/Berlin");
      expect(body).toContain("X-PUBLISHED-TTL:PT1H");
      expect(body).toContain("METHOD:PUBLISH");
    });

    it("includes RELATED-TO for series events", () => {
      // Events 1 and 3 share seriesId "kulturkalender-100"
      const unfolded = body.replaceAll(/\r\n[ \t]/g, "");
      const relatedLines = unfolded.split("\r\n").filter((l) =>
        l.startsWith("RELATED-TO:")
      );
      expect(relatedLines).toHaveLength(2);
      expect(relatedLines[0]).toBe("RELATED-TO:kulturkalender-100");
    });

    it("omits RELATED-TO for non-series events", () => {
      // Event 2 has seriesId: null — extract its VEVENT block
      const unfolded = body.replaceAll(/\r\n[ \t]/g, "");
      const lines = unfolded.split("\r\n");
      const uidIdx = lines.indexOf("UID:kulturkalender-2");
      const endIdx = lines.indexOf("END:VEVENT", uidIdx);
      const block = lines.slice(uidIdx, endIdx);
      expect(block.find((l) => l.startsWith("RELATED-TO:"))).toBeUndefined();
    });
  });

  describe("ICS Round-Trip (parse-back validation)", () => {
    let parsed: ReturnType<typeof ical.sync.parseICS>;

    beforeEach(async () => {
      const response = await GET();
      const body = await response.text();
      parsed = ical.sync.parseICS(body);
    });

    it("parses without errors and contains VEVENTs", () => {
      const events = Object.values(parsed).filter((c) => c?.type === "VEVENT");
      expect(events).toHaveLength(3);
    });

    it("round-trips all-day event as date-only start", () => {
      const ev = parsed["kulturkalender-3"] as ical.VEvent;
      // node-ical sets dateOnly for VALUE=DATE
      expect((ev.start as ical.DateWithTimeZone).dateOnly).toBe(true);
    });

    it("round-trips UID correctly", () => {
      expect(parsed["kulturkalender-1"]).toBeDefined();
      expect(parsed["kulturkalender-2"]).toBeDefined();
    });

    it("round-trips SUMMARY correctly", () => {
      const ev = parsed["kulturkalender-1"] as ical.VEvent;
      expect(ev.summary).toBe("Test Event");
    });

    it("round-trips DTSTART with correct date", () => {
      const ev = parsed["kulturkalender-1"] as ical.VEvent;
      const start = new Date(ev.start);
      // 2026-05-01T19:00 Europe/Berlin = 2026-05-01T17:00 UTC (CEST)
      expect(start.toISOString()).toBe("2026-05-01T17:00:00.000Z");
    });

    it("round-trips LOCATION correctly", () => {
      const ev = parsed["kulturkalender-1"] as ical.VEvent;
      expect(ev.location).toBe("Stadthalle Greifswald");
    });

    it("round-trips STATUS correctly", () => {
      const ev1 = parsed["kulturkalender-1"] as ical.VEvent;
      const ev2 = parsed["kulturkalender-2"] as ical.VEvent;
      expect(ev1.status).toBe("CONFIRMED");
      expect(ev2.status).toBe("CANCELLED");
    });

    it("round-trips URL correctly", () => {
      const ev = parsed["kulturkalender-1"] as ical.VEvent;
      expect(ev.url).toBe("https://example.com/event/1");
    });

    it("round-trips DESCRIPTION containing event text", () => {
      const ev = parsed["kulturkalender-1"] as ical.VEvent;
      expect(ev.description).toContain("A test event description");
    });
  });

  describe("Error Handling", () => {
  it("returns 500 when getEvents throws", async () => {
    const { getEvents } = await import(
      "@/services/application/get-events.service"
    );
    vi.mocked(getEvents).mockRejectedValueOnce(new Error("upstream failed"));

    const response = await GET();
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toMatch(/upstream failed/i);
  });

  it("returns generic message when non-Error is thrown", async () => {
    const { getEvents } = await import(
      "@/services/application/get-events.service"
    );
    vi.mocked(getEvents).mockRejectedValueOnce("string-error");

    const response = await GET();
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toMatch(/internal server error/i);
  });
  });
});
