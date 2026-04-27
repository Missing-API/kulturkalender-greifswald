import { describe, expect, it } from "vitest";

import { dataToHtml, dataToText } from "./data-text-mapper";

describe("dataToText", () => {
  it("includes document URL when provided", () => {
    const result = dataToText({
      description: "Event",
      document: "https://example.com/doc.pdf",
    });
    expect(result).toContain("https://example.com/doc.pdf");
  });

  it("omits document when not provided", () => {
    const result = dataToText({ description: "Event" });
    expect(result).not.toContain("doc.pdf");
  });

  it("handles empty description", () => {
    const result = dataToText({ description: "" });
    expect(result).toBe("");
  });

  it("handles scopes without tags", () => {
    const result = dataToText({ description: "Event", scopes: ["Region"] });
    expect(result).toContain("@Region");
    expect(result).not.toContain("#");
  });

  it("handles tags without scopes", () => {
    const result = dataToText({ description: "Event", tags: ["Musik"] });
    expect(result).toContain("#Musik");
    expect(result).not.toContain("@");
  });
});

describe("dataToHtml", () => {
  it("preserves HTML description without wrapping", () => {
    const result = dataToHtml({ description: "<div>Already HTML</div>" });
    expect(result).toContain("<div>Already HTML</div>");
    expect(result).not.toContain('<p class="p-description">');
  });

  it("wraps plain text description in p tag", () => {
    const result = dataToHtml({ description: "Plain text" });
    expect(result).toContain('<p class="p-description">Plain text</p>');
  });

  it("includes document as attachment link", () => {
    const result = dataToHtml({
      description: "Event",
      document: "https://example.com/doc.pdf",
    });
    expect(result).toContain('<a class="u-document"');
    expect(result).toContain("https://example.com/doc.pdf");
  });

  it("omits document link when not provided", () => {
    const result = dataToHtml({ description: "Event" });
    expect(result).not.toContain("u-document");
  });

  it("includes image tag", () => {
    const result = dataToHtml({
      description: "Event",
      image: "https://example.com/img.jpg",
    });
    expect(result).toContain('<img class="u-photo"');
  });

  it("handles empty description", () => {
    const result = dataToHtml({ description: "" });
    expect(result).toContain('<p class="p-description"></p>');
  });

  it("handles scopes in taxonomy section", () => {
    const result = dataToHtml({
      description: "Event",
      scopes: ["Region"],
    });
    expect(result).toContain('<span class="p-scope">@Region</span>');
  });

  it("combines tags and scopes in taxonomy", () => {
    const result = dataToHtml({
      description: "Event",
      tags: ["Musik"],
      scopes: ["Region"],
    });
    expect(result).toContain('<span class="p-category">#Musik</span>');
    expect(result).toContain('<span class="p-scope">@Region</span>');
  });
});
