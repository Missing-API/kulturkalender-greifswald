import { describe, expect, it, vi } from "vitest";

import type { NormalizedEvent } from "@/types/normalized-event.schema";

vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => ({ location: venue ?? "", email: null })),
}));

import { buildIcsDescription, buildIcsHtmlDescription } from "./build-ics-description";

function makeEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: "test-1",
    seriesId: null,
    summary: "Test",
    description: "Hello world",
    start: "2026-05-01T10:00:00",
    end: null,
    timeZone: "Europe/Berlin",
    location: "",
    category: "Kultur & Tourismus",
    organizer: "",
    organizerEmail: null,
    link: "https://example.com",
    image: null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
    sourceName: "Kulturkalender Greifswald",
    tags: ["Kultur", "Tourismus"],
    updated: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildIcsDescription", () => {
  describe("Happy Path", () => {
    it("includes description text", () => {
      const result = buildIcsDescription(makeEvent());
      expect(result).toContain("Hello world");
    });

    it("includes tags as hashtags in description", () => {
      const result = buildIcsDescription(makeEvent({ tags: ["Kultur", "Musik"] }));
      expect(result).toContain("#Kultur");
      expect(result).toContain("#Musik");
    });

    it("includes @Region scope for Umland category", () => {
      const result = buildIcsDescription(makeEvent({ category: "Umland" }));
      expect(result).toContain("@Region");
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

    it("includes organizer line when organizer is set", () => {
      const result = buildIcsDescription(makeEvent({ organizer: "Kulturamt" }));
      expect(result).toContain("Veranstalter: Kulturamt");
    });
  });

  describe("Edge Cases", () => {
    it("omits tag line when tags are empty", () => {
      const result = buildIcsDescription(makeEvent({ tags: [] }));
      expect(result).not.toContain("#");
    });

    it("omits scope for non-Umland categories", () => {
      const result = buildIcsDescription(makeEvent({ category: "Kultur & Tourismus" }));
      expect(result).not.toContain("@Region");
    });

    it("omits organizer line when organizer is empty", () => {
      const result = buildIcsDescription(makeEvent({ organizer: "" }));
      expect(result).not.toContain("Veranstalter");
    });
  });
});

describe("buildIcsHtmlDescription", () => {
  describe("Happy Path", () => {
    it("wraps description in div with inner p tag when no HTML", () => {
      const result = buildIcsHtmlDescription(makeEvent());
      expect(result).toContain('<div class="p-description"><p>Hello world</p></div>');
    });

    it("preserves existing HTML in description within div", () => {
      const result = buildIcsHtmlDescription(
        makeEvent({ description: "<p>Already HTML</p>" }),
      );
      expect(result).toContain("<p>Already HTML</p>");
      // Should use div wrapper, not p
      expect(result).toContain('<div class="p-description">');
      expect(result).not.toContain('<p class="p-description">');
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

    it("includes taxonomy section with tags", () => {
      const result = buildIcsHtmlDescription(makeEvent({ tags: ["Kultur", "Musik"] }));
      expect(result).toContain('<span class="p-category">#Kultur</span>');
      expect(result).toContain('<span class="p-category">#Musik</span>');
    });

    it("includes scope in taxonomy for Umland", () => {
      const result = buildIcsHtmlDescription(makeEvent({ category: "Umland" }));
      expect(result).toContain('<span class="p-scope">@Region</span>');
    });

    it("includes organizer in HTML description", () => {
      const result = buildIcsHtmlDescription(makeEvent({ organizer: "Kulturamt" }));
      expect(result).toContain("Veranstalter: Kulturamt");
    });
  });

  describe("Edge Cases", () => {
    it("omits organizer from HTML when organizer is empty", () => {
      const result = buildIcsHtmlDescription(makeEvent({ organizer: "" }));
      expect(result).not.toContain("Veranstalter");
    });
  });
});
