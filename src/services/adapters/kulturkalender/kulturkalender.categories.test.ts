import { describe, it, expect } from "vitest";

import { mapCategory, mapCategoryToTags } from "./kulturkalender.categories";

describe("mapCategory", () => {
  describe("Happy Path", () => {
    it.each([
      ["Ausstellung", "Kultur & Tourismus"],
      ["Bühne", "Kultur & Tourismus"],
      ["Fest", "Kultur & Tourismus"],
      ["Film", "Kultur & Tourismus"],
      ["Kinder und Jugendliche", "Kultur & Tourismus"],
      ["Kunst", "Kultur & Tourismus"],
      ["Literatur", "Kultur & Tourismus"],
      ["Musik", "Kultur & Tourismus"],
      ["Online/ on Air/ on TV", "Kultur & Tourismus"],
      ["Party", "Kultur & Tourismus"],
      ["Umland", "Kultur & Tourismus"],
      ["Vortrag", "Kultur & Tourismus"],
    ])('maps "%s" → "%s"', (source, expected) => {
      expect(mapCategory(source)).toBe(expected);
    });
  });

  describe("Edge Cases", () => {
    it('maps "Extra" to empty string', () => {
      expect(mapCategory("Extra")).toBe("");
    });

    it("returns empty string for unknown categories", () => {
      expect(mapCategory("Unbekannt")).toBe("");
      expect(mapCategory("")).toBe("");
    });
  });
});

describe("mapCategoryToTags", () => {
  describe("Happy Path", () => {
    it.each([
      ["Ausstellung", ["Kultur", "Ausstellung"]],
      ["Bühne", ["Kultur", "Bühne"]],
      ["Fest", ["Kultur", "Gemeindeleben", "Fest"]],
      ["Film", ["Kultur", "Film"]],
      ["Kinder und Jugendliche", ["Kultur", "Bildung", "Kinder", "Jugendliche"]],
      ["Kunst", ["Kultur", "Kunst"]],
      ["Literatur", ["Kultur", "Literatur"]],
      ["Musik", ["Kultur", "Musik"]],
      ["Online/ on Air/ on TV", ["Kultur"]],
      ["Party", ["Kultur", "Gemeindeleben", "Party"]],
      ["Umland", ["Tourismus", "Umland"]],
      ["Vortrag", ["Kultur", "Bildung", "Vortrag"]],
    ])('maps source "%s" → tags %j', (source, expected) => {
      expect(mapCategoryToTags(source)).toEqual(expected);
    });
  });

  describe("Edge Cases", () => {
    it("returns empty array for unmapped categories", () => {
      expect(mapCategoryToTags("Extra")).toEqual([]);
      expect(mapCategoryToTags("Unbekannt")).toEqual([]);
      expect(mapCategoryToTags("")).toEqual([]);
    });

    it("returns only hashtag-safe tags (no whitespace)", () => {
      for (const tag of mapCategoryToTags("Kinder und Jugendliche")) {
        expect(tag).not.toMatch(/\s/);
      }
    });
  });
});
