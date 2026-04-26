import { describe, it, expect } from "vitest";

import { config } from "@/config";
import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { KulturkalenderSourceFeedSchema } from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { NormalizedEventSchema } from "@/types/normalized-event.schema";

const TIMEOUT = 15_000;

describe("Live: Feed source", () => {
  it("returns HTTP 200", async () => {
    const response = await fetch(config.feedUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  }, TIMEOUT);

  it("payload parses with source schema", async () => {
    const response = await fetch(config.feedUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await response.json();
    const feed = KulturkalenderSourceFeedSchema.parse(data);
    expect(feed.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("event list is non-empty", async () => {
    const response = await fetch(config.feedUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await response.json();
    const feed = KulturkalenderSourceFeedSchema.parse(data);
    expect(feed.length).toBeGreaterThan(10);
  }, TIMEOUT);

  it("mapped events parse with normalized schema", async () => {
    const response = await fetch(config.feedUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await response.json();
    const feed = KulturkalenderSourceFeedSchema.parse(data);

    const first10 = feed.slice(0, 10);
    for (const raw of first10) {
      const mapped = await mapSourceToNormalized(raw);
      const normalized = NormalizedEventSchema.parse(mapped);
      expect(normalized.id).toBeTruthy();
      expect(normalized.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    }
  }, TIMEOUT);
});

describe("Live: Venue source", () => {
  it("venue list page returns HTTP 200 and contains venue links", async () => {
    const response = await fetch(config.venuesBaseUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    expect(response.ok).toBe(true);

    const html = await response.text();
    expect(html).toContain('/venues/');
  }, TIMEOUT);

  it("at least one venue detail page returns HTTP 200", async () => {
    const listResponse = await fetch(config.venuesBaseUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const html = await listResponse.text();

    const match = /href="(\/venues\/\d+)"/.exec(html);
    expect(match).not.toBeNull();

    const origin = new URL(config.venuesBaseUrl).origin;
    const detailUrl = `${origin}${match?.[1]}`;
    const detailResponse = await fetch(detailUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    expect(detailResponse.ok).toBe(true);
  }, TIMEOUT);
});
