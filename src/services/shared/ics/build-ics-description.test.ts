import { describe, expect, it, vi } from "vitest";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => ({ location: venue ?? "", email: null })),
}));

import { buildIcsDescription, buildIcsHtmlDescription } from "./build-ics-description";

function makeEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: "test-1",
    summary: "Test",
    description: "Hello world",
    start: "2026-05-01T10:00:00",
    end: null,
    timeZone: "Europe/Berlin",
    location: "",
    category: "Musik",
    organizer: "",
    organizerEmail: null,
    link: "https://example.com",
    image: null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
    tags: [],
    updated: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildIcsDescription", () => {
  it("includes description text", () => {
    const result = buildIcsDescription(makeEvent());
    expect(result).toContain("Hello world");
  });

  it("includes category as tag", () => {
    const result = buildIcsDescription(makeEvent({ category: "Konzert" }));
    expect(result).toContain("#Konzert");
  });

  it("omits tag line when no category", () => {
    const result = buildIcsDescription(makeEvent({ category: "" }));
    expect(result).not.toContain("#");
  });

  it("includes @Region scope for Umland category", () => {
    const result = buildIcsDescription(makeEvent({ category: "Umland" }));
    expect(result).toContain("@Region");
  });

  it("omits scope for non-Umland categories", () => {
    const result = buildIcsDescription(makeEvent({ category: "Musik" }));
    expect(result).not.toContain("@Region");
  });

  it("includes image URL when present", () => {
    const result = buildIcsDescription(
      makeEvent({ image: "https://example.com/photo.jpg" }),
    );
    expect(result).toContain("https://example.com/photo.jpg");
  });

  it("includes event link", () => {
    const result = buildIcsDescription(makeEvent());
    expect(result).toContain("https://example.com");
  });
});

describe("buildIcsHtmlDescription", () => {
  it("wraps description in p tag when no HTML", () => {
    const result = buildIcsHtmlDescription(makeEvent());
    expect(result).toContain('<p class="p-description">Hello world</p>');
  });

  it("preserves existing HTML in description", () => {
    const result = buildIcsHtmlDescription(
      makeEvent({ description: "<p>Already HTML</p>" }),
    );
    expect(result).toContain("<p>Already HTML</p>");
    // Should not double-wrap
    expect(result).not.toContain('<p class="p-description"><p>');
  });

  it("includes img tag when image present", () => {
    const result = buildIcsHtmlDescription(
      makeEvent({ image: "https://example.com/photo.jpg" }),
    );
    expect(result).toContain('<img class="u-photo" src="https://example.com/photo.jpg"');
  });

  it("includes link tag", () => {
    const result = buildIcsHtmlDescription(makeEvent());
    expect(result).toContain('<a class="u-url"');
  });

  it("includes taxonomy section with category", () => {
    const result = buildIcsHtmlDescription(makeEvent({ category: "Konzert" }));
    expect(result).toContain('<span class="p-category">#Konzert</span>');
  });

  it("includes scope in taxonomy for Umland", () => {
    const result = buildIcsHtmlDescription(makeEvent({ category: "Umland" }));
    expect(result).toContain('<span class="p-scope">@Region</span>');
  });
});
