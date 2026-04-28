import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, vi } from "vitest";

import { NormalizedEventSchema } from "@/types/normalized-event.schema";

import { isVhsEvent, mapSourceToNormalized } from "./kulturkalender.mapper";
import {
  KulturkalenderSourceEventSchema,
  KulturkalenderSourceFeedSchema,
} from "./kulturkalender.source.schema";

vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => ({ location: venue ?? "", email: null })),
}));

const validSourceEvent = {
  kumo_link: "https://www.kulturkalender.greifswald.de/events/12345?start_on=2026-05-01",
  kumo_id: 12_345,
  kumo_updated_at: "2026-01-15T10:00:00.000+01:00",
  category: "Musik",
  venue: "Stadthalle",
  title: "Test Event",
  subtitle: "A test subtitle",
  content: "Event description content.",
  image: "https://example.com/image.jpg",
  image_link: "https://example.com/image.jpg",
  image_credits: "Test Credits",
  time: "19:30",
  date: "2026-05-01",
  time_venue: "19:30 / Stadthalle",
  organiser: "Test Organiser",
};

function loadFixture(relativePath: string): unknown {
  const filePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("Happy Path", () => {
describe("KulturkalenderSourceEventSchema", () => {
  it("parses a valid source event", () => {
    const result = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    expect(result.kumo_id).toBe(12_345);
    expect(result.title).toBe("Test Event");
  });

  it("rejects missing required fields", () => {
    const invalid = { ...validSourceEvent, title: "" };
    expect(() => KulturkalenderSourceEventSchema.parse(invalid)).toThrow();
  });

  it("rejects unknown fields in strict mode", () => {
    const withExtra = { ...validSourceEvent, unknown_field: "foo" };
    expect(() => KulturkalenderSourceEventSchema.parse(withExtra)).toThrow();
  });

  it("accepts null for nullable fields", () => {
    const withNulls = {
      ...validSourceEvent,
      venue: null,
      subtitle: null,
      content: null,
      image: null,
      image_link: null,
      image_credits: null,
      time_venue: null,
      organiser: null,
    };
    const result = KulturkalenderSourceEventSchema.parse(withNulls);
    expect(result.venue).toBeNull();
  });
});

describe("Full fixture validation", () => {
  it("parses the entire real feed fixture without error", () => {
    const data = loadFixture("fixtures/a869cfebea250bbfe04a1b623baaf338.json");
    const result = KulturkalenderSourceFeedSchema.parse(data);
    expect(result.length).toBe(800);
  });

  it("maps and validates all 800 real events through full pipeline", async () => {
    const data = loadFixture("fixtures/a869cfebea250bbfe04a1b623baaf338.json");
    const feed = KulturkalenderSourceFeedSchema.parse(data);

    const normalized = await Promise.all(
      feed.map(async (raw) => {
        const mapped = await mapSourceToNormalized(raw);
        return NormalizedEventSchema.parse(mapped);
      })
    );

    expect(normalized).toHaveLength(800);
    for (const event of normalized) {
      expect(event.id).toBeTruthy();
      expect(event.summary).toBeTruthy();
      expect(event.start).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/);
      expect(event.source).toBe("kulturkalender-greifswald");
    }
  });
});

describe("Derived fixture: valid-minimal", () => {
  it("parses minimal event with all nullable fields null", () => {
    const data = loadFixture("fixtures/derived/valid-minimal.json");
    const feed = KulturkalenderSourceFeedSchema.parse(data);
    expect(feed).toHaveLength(1);
    expect(feed[0].venue).toBeNull();
    expect(feed[0].organiser).toBeNull();
    expect(feed[0].time).toBe("");
  });

  it("maps minimal event with fallback defaults", async () => {
    const data = loadFixture("fixtures/derived/valid-minimal.json") as unknown[];
    const source = KulturkalenderSourceEventSchema.parse(data[0]);
    const mapped = await mapSourceToNormalized(source);
    const normalized = NormalizedEventSchema.parse(mapped);

    expect(normalized.organizer).toBe("");
    expect(normalized.location).toBe("");
    expect(normalized.start).toBe("2026-01-01");
    expect(normalized.tags).toEqual([]);
    expect(normalized.sourceName).toBe("Kulturkalender Greifswald");
  });
});

describe("Derived fixture: valid-complete", () => {
  it("parses and maps complete event with all fields populated", async () => {
    const data = loadFixture("fixtures/derived/valid-complete.json") as unknown[];
    const source = KulturkalenderSourceEventSchema.parse(data[0]);
    const mapped = await mapSourceToNormalized(source);
    const normalized = NormalizedEventSchema.parse(mapped);

    expect(normalized.organizer).toBe("Kulturverein Greifswald e.V.");
    expect(normalized.location).toBe("Stadthalle Greifswald");
    expect(normalized.start).toBe("2026-06-15T19:30:00");
    expect(normalized.category).toBe("Kultur & Tourismus");
    expect(normalized.description).toContain("Ein Abend voller Klassik und Jazz");
  });
});

describe("Derived fixture: boundary-dates", () => {
  it("handles DST transition, year boundary, and midnight dates", async () => {
    const data = loadFixture("fixtures/derived/boundary-dates.json") as unknown[];
    const events = await Promise.all(
      data.map(async (raw) => {
        const source = KulturkalenderSourceEventSchema.parse(raw);
        const mapped = await mapSourceToNormalized(source);
        return NormalizedEventSchema.parse(mapped);
      })
    );

    expect(events).toHaveLength(3);
    expect(events[0].start).toBe("2026-03-29T02:00:00");
    expect(events[1].start).toBe("2026-12-31T23:00:00");
    expect(events[2].start).toBe("2026-01-01T00:00:00");
  });
});

describe("VHS event filtering (isVhsEvent)", () => {
  it("detects VHS events by organiser", () => {
    const data = loadFixture("fixtures/derived/vhs-overlap.json") as unknown[];
    for (const raw of data) {
      const source = KulturkalenderSourceEventSchema.parse(raw);
      expect(isVhsEvent(source)).toBe(true);
    }
  });

  it("detects VHS events by venue", () => {
    const source = KulturkalenderSourceEventSchema.parse({
      ...validSourceEvent,
      venue: "Volkshochschule Greifswald",
      organiser: "Someone Else",
    });
    expect(isVhsEvent(source)).toBe(true);
  });

  it("does not flag non-VHS events", () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    expect(isVhsEvent(source)).toBe(false);
  });
});

describe("mapSourceToNormalized", () => {
  it("maps source event to normalized shape", async () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = await mapSourceToNormalized(source);

    expect(mapped.id).toBe("kulturkalender-12345-2026-05-01");
    expect(mapped.seriesId).toBe("kulturkalender-12345");
    expect(mapped.summary).toBe("Test Event");
    expect(mapped.start).toBe("2026-05-01T19:30:00");
    expect(mapped.location).toBe("Stadthalle");
    expect(mapped.organizer).toBe("Test Organiser");
  });

  it("maps source category to rural category", async () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.category).toBe("Kultur & Tourismus");
  });

  it("maps 'Extra' category to empty string", async () => {
    const source = KulturkalenderSourceEventSchema.parse({
      ...validSourceEvent,
      category: "Extra",
    });
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.category).toBe("");
  });

  it("returns date-only string when time is empty (all-day event)", async () => {
    const source = KulturkalenderSourceEventSchema.parse({
      ...validSourceEvent,
      time: "",
    });
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.start).toBe("2026-05-01");
  });

  it("builds description from subtitle and content", async () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.description).toContain("A test subtitle");
    expect(mapped.description).toContain("Event description content.");
  });

  it("falls back to venue when organiser is null", async () => {
    const source = KulturkalenderSourceEventSchema.parse({
      ...validSourceEvent,
      organiser: null,
    });
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.organizer).toBe("Stadthalle");
  });

  it("falls back to empty string when both organiser and venue are null", async () => {
    const source = KulturkalenderSourceEventSchema.parse({
      ...validSourceEvent,
      organiser: null,
      venue: null,
    });
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.organizer).toBe("");
  });

  it("always sets sourceName to Kulturkalender Greifswald", async () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.sourceName).toBe("Kulturkalender Greifswald");
  });

  it("includes category-derived display tags", async () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = await mapSourceToNormalized(source);
    expect(mapped.tags).toEqual(["Kultur", "Musik"]);
  });
});
});

describe("Edge Cases", () => {
describe("NormalizedEventSchema", () => {
  it("applies defaults and transforms", () => {
    const input = {
      id: "test-1",
      summary: "  Trimmed Title  ",
      start: "2026-05-01T19:30:00",
      link: "https://example.com",
      updated: "2026-01-01T00:00:00Z",
    };
    const result = NormalizedEventSchema.parse(input);
    expect(result.summary).toBe("Trimmed Title");
    expect(result.status).toBe("confirmed");
    expect(result.timeZone).toBe("Europe/Berlin");
    expect(result.source).toBe("kulturkalender-greifswald");
    expect(result.tags).toEqual([]);
  });

  it("rejects events without id", () => {
    const invalid = {
      summary: "No ID",
      start: "2026-05-01T19:30:00",
      link: "https://example.com",
      updated: "2026-01-01T00:00:00Z",
    };
    expect(() => NormalizedEventSchema.parse(invalid)).toThrow();
  });
});
});
