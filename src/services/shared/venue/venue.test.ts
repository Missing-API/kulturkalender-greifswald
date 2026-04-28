import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

import { parseVenueDetail } from "./helpers/parse-venue-detail";
import { normalizeVenueName, parseVenueIndex } from "./parse-venue-index";

function loadFixture(relativePath: string): string {
  const filePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(filePath, "utf8");
}

describe("Happy Path", () => {
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

  it("skips links without venue name text", () => {
    const html = `<html><body>
      <a href="/venues/99"></a>
      <a href="/venues/100">Valid</a>
    </body></html>`;
    const result = parseVenueIndex(html, "https://example.com/venues/");
    expect(result.size).toBe(1);
    expect(result.has("valid")).toBe(true);
  });

  it("skips links without numeric venue ID", () => {
    const html = `<html><body>
      <a href="/venues/about">About</a>
      <a href="/venues/200">Real Venue</a>
    </body></html>`;
    const result = parseVenueIndex(html, "https://example.com/venues/");
    expect(result.size).toBe(1);
    expect(result.has("real venue")).toBe(true);
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
});

describe("Edge Cases", () => {
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
    expect(result?.email).toBe("kultur@greifswald.de");
  });

  it("extracts address from venue 42 fixture (no phone)", () => {
    const html = loadFixture("fixtures/venues/42.html");
    const result = parseVenueDetail(html);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Kirche Wieck");
    expect(result?.location).toBe(
      "Kirche Wieck, Kirchstraße 1, 17493 Greifswald"
    );
    expect(result?.email).toBe("esg@pek.de");
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

  it("returns null email when venue has no mailto link", () => {
    const html = loadFixture("fixtures/venues/354.html");
    const result = parseVenueDetail(html);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Innenhof des Pommerschen Landesmuseums");
    expect(result?.location).toBe(
      "Innenhof des Pommerschen Landesmuseums, Rakower Straße 9, 17489 Greifswald"
    );
    expect(result?.email).toBeNull();
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
    expect(result?.email).toBeNull();
  });

  it("ignores search bar labels in full page HTML", () => {
    const html = `<html><body>
      <div class="searchBarItem">
        <span class="d-block fs-smaller searchBarItem-label">Date</span>
        <span class="d-block fs-larger searchBarItem-value text-truncate"></span>
      </div>
      <div class="searchBarItem">
        <span class="d-block fs-smaller searchBarItem-label">Venue</span>
        <span class="d-block searchBarItem-value text-truncate">All</span>
      </div>
      <div class="col-12 offset-0 col-md-5 offset-md-1">
        <div>
          <div>
            <span class="d-block fw-500">
              <a href="/venues/77">Alfried Krupp Wissenschaftskolleg</a>
            </span>
            <span class="d-block">Martin-Luther-Straße 14</span>
            <span class="d-block">17489 Greifswald</span>
            <span class="d-block">03834 420-5001</span>
          </div>
          <div class="mt-1">
            <span class="d-block"><a href="mailto:info@wiko-greifswald.de">E-Mail</a></span>
          </div>
        </div>
      </div>
    </body></html>`;
    const result = parseVenueDetail(html);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Alfried Krupp Wissenschaftskolleg");
    expect(result?.street).toBe("Martin-Luther-Straße 14");
    expect(result?.city).toBe("17489 Greifswald");
    expect(result?.location).toBe(
      "Alfried Krupp Wissenschaftskolleg, Martin-Luther-Straße 14, 17489 Greifswald"
    );
    expect(result?.location).not.toContain("Date");
    expect(result?.location).not.toContain("Venue");
  });
});
});
