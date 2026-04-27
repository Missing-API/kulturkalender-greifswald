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
    organizerEmail: null,
    link: "https://example.com/event/1",
    image: null,
    status: "confirmed",
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
