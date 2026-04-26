import { describe, it, expect } from "vitest";

import { NormalizedEventSchema } from "@/types/normalized-event.schema";

import { mapSourceToNormalized } from "./kulturkalender.mapper";
import {
  KulturkalenderSourceEventSchema,
} from "./kulturkalender.source.schema";

const validSourceEvent = {
  kumo_link: "https://www.kulturkalender.greifswald.de/events/12345?start_on=2026-05-01",
  kumo_id: 12_345,
  kumo_updated_at: "2026-01-15T10:00:00.000+01:00",
  category: "Konzert",
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

describe("mapSourceToNormalized", () => {
  it("maps source event to normalized shape", () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = mapSourceToNormalized(source);

    expect(mapped.id).toBe("kulturkalender-12345-2026-05-01");
    expect(mapped.summary).toBe("Test Event");
    expect(mapped.start).toBe("2026-05-01T19:30:00");
    expect(mapped.location).toBe("Stadthalle");
    expect(mapped.organizer).toBe("Test Organiser");
  });

  it("uses midnight when time is empty", () => {
    const source = KulturkalenderSourceEventSchema.parse({
      ...validSourceEvent,
      time: "",
    });
    const mapped = mapSourceToNormalized(source);
    expect(mapped.start).toBe("2026-05-01T00:00:00");
  });

  it("builds description from subtitle and content", () => {
    const source = KulturkalenderSourceEventSchema.parse(validSourceEvent);
    const mapped = mapSourceToNormalized(source);
    expect(mapped.description).toContain("A test subtitle");
    expect(mapped.description).toContain("Event description content.");
  });
});

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
