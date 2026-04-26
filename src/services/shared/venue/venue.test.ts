import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

import { parseVenueDetail } from "./parse-venue-detail";
import { normalizeVenueName, parseVenueIndex } from "./parse-venue-index";

function loadFixture(relativePath: string): string {
  const filePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(filePath, "utf8");
}

describe("parseVenueIndex", () => {
  it("extracts venue entries from index HTML", () => {
    const html = loadFixture("fixtures/venues/index.html");
    const result = parseVenueIndex(
      html,
      "https://www.kulturkalender.greifswald.de/venues/"
    );

    expect(result.size).toBe(4);
    expect(result.get("kleine rathausgalerie")).toEqual({
      id: "230",
      name: "Kleine Rathausgalerie",
      url: "https://www.kulturkalender.greifswald.de/venues/230",
    });
    expect(result.get("kirche wieck")).toEqual({
      id: "42",
      name: "Kirche Wieck",
      url: "https://www.kulturkalender.greifswald.de/venues/42",
    });
  });

  it("returns empty map for HTML without venue links", () => {
    const result = parseVenueIndex(
      "<html><body></body></html>",
      "https://example.com/venues/"
    );
    expect(result.size).toBe(0);
  });
});

describe("normalizeVenueName", () => {
  it("trims, lowercases, and collapses spaces", () => {
    expect(normalizeVenueName("  Kirche   Wieck  ")).toBe("kirche wieck");
  });

  it("handles single word", () => {
    expect(normalizeVenueName("Universität")).toBe("universität");
  });
});

describe("parseVenueDetail", () => {
  it("extracts full address from venue 230 fixture", () => {
    const html = loadFixture("fixtures/venues/230.html");
    const result = parseVenueDetail(html);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Kleine Rathausgalerie");
    expect(result?.street).toBe("Markt");
    expect(result?.city).toBe("17489 Greifswald");
    expect(result?.location).toBe(
      "Kleine Rathausgalerie, Markt, 17489 Greifswald"
    );
  });

  it("extracts address from venue 42 fixture (no phone)", () => {
    const html = loadFixture("fixtures/venues/42.html");
    const result = parseVenueDetail(html);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Kirche Wieck");
    expect(result?.location).toBe(
      "Kirche Wieck, Kirchstraße 1, 17493 Greifswald"
    );
  });

  it("filters out phone numbers from address", () => {
    const html = loadFixture("fixtures/venues/230.html");
    const result = parseVenueDetail(html);

    expect(result?.location).not.toContain("03834");
  });

  it("returns null for empty HTML", () => {
    const result = parseVenueDetail("<html><body></body></html>");
    expect(result).toBeNull();
  });

  it("returns name-only location when no address spans", () => {
    const html = `<html><body>
      <div>
        <span class="d-block fw-500"><a href="/venues/99">Solo Venue</a></span>
      </div>
    </body></html>`;
    const result = parseVenueDetail(html);

    expect(result).not.toBeNull();
    expect(result?.location).toBe("Solo Venue");
    expect(result?.street).toBeUndefined();
  });
});
