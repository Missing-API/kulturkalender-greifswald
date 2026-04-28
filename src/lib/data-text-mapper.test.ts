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

  it("wraps plain text description in div with inner p tag", () => {
    const result = dataToHtml({ description: "Plain text" });
    expect(result).toContain('<div class="p-description"><p>Plain text</p></div>');
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
    expect(result).toContain('<div class="p-description"><p></p></div>');
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

  it("wraps output in full HTML document envelope", () => {
    const result = dataToHtml({ description: "Event" });
    expect(result).toMatch(/^<!DOCTYPE html><html><body>/);
    expect(result).toMatch(/<\/body><\/html>$/);
  });

  it("uses div container for description instead of p", () => {
    const result = dataToHtml({ description: "Event" });
    expect(result).toContain('<div class="p-description">');
    expect(result).toContain("</div>");
    // Should not use <p> as the outer wrapper
    expect(result).not.toMatch(/<p class="p-description">[^<]*<\/p>/);
  });

  it("splits double newlines into separate p elements", () => {
    const result = dataToHtml({
      description: "First paragraph.\n\nSecond paragraph.",
    });
    expect(result).toContain("<p>First paragraph.</p>");
    expect(result).toContain("<p>Second paragraph.</p>");
  });

  it("converts single newlines to br elements within paragraphs", () => {
    const result = dataToHtml({
      description: "Line one.\nLine two.",
    });
    expect(result).toContain("Line one.<br>Line two.");
  });

  it("handles mixed single and double newlines", () => {
    const result = dataToHtml({
      description: "Para 1 line 1.\nPara 1 line 2.\n\nPara 2.",
    });
    expect(result).toContain("<p>Para 1 line 1.<br>Para 1 line 2.</p>");
    expect(result).toContain("<p>Para 2.</p>");
  });
});
