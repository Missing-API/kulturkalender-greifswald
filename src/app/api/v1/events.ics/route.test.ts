import { describe, it, expect, vi, beforeEach } from "vitest";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

const DUMMY_EVENTS: NormalizedEvent[] = [
  {
    id: "kulturkalender-1",
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
    tags: [],
    updated: "2026-04-27T00:00:00Z",
  },
  {
    id: "kulturkalender-2",
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
    tags: [],
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
    expect(count).toBe(2);
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

    it("includes DTSTART with TZID for Europe/Berlin", () => {
      expect(body).toMatch(/DTSTART;.*TZID=Europe\/Berlin:\d{8}T\d{6}/);
    });

    it("includes DURATION fallback when end is null", () => {
      expect(body).toContain("DURATION:PT2H");
    });

    it("includes LOCATION when present", () => {
      expect(body).toContain("LOCATION:Stadthalle Greifswald");
    });

    it("omits LOCATION when empty", () => {
      // Second event has empty location — count LOCATION occurrences
      const locationCount = (body.match(/^LOCATION:/gm) ?? []).length;
      expect(locationCount).toBe(1);
    });

    it("includes ORGANIZER with CN and MAILTO when present", () => {
      expect(body).toContain("CN=Kulturamt");
      expect(body).toContain("MAILTO:kultur@greifswald.de");
    });

    it("omits ORGANIZER when organizer is empty", () => {
      // Only one ORGANIZER line expected (from first event)
      const organizerCount = (body.match(/^ORGANIZER/gm) ?? []).length;
      expect(organizerCount).toBe(1);
    });

    it("includes CATEGORIES when category is set", () => {
      expect(body).toContain("CATEGORIES:Konzert");
    });

    it("omits CATEGORIES when category is empty", () => {
      const categoriesCount = (body.match(/^CATEGORIES:/gm) ?? []).length;
      expect(categoriesCount).toBe(1);
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
      expect(body).toContain("p-description");
      expect(body).toContain("A test event description");
    });

    it("includes image URL in HTML description when present", () => {
      expect(body).toContain("u-photo");
      expect(body).toContain("https://example.com/photo.jpg");
    });

    it("includes event link in HTML description", () => {
      expect(body).toContain("u-url");
      expect(body).toContain("https://example.com/event/1");
    });

    it("includes category tag in description", () => {
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
