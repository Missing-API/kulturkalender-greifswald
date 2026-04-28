import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as cacheModule from "@/lib/cache";
import type { NormalizedEvent } from "@/types/normalized-event.schema";

import { getEvents } from "./get-events.service";

vi.mock("@/services/adapters/kulturkalender/kulturkalender.adapter");
vi.mock("@/services/adapters/kulturkalender/kulturkalender.mapper");
vi.mock("@/services/shared/venue/lookup", () => ({
  resolveVenueLocation: vi.fn(async (venue: string | null) => ({ location: venue ?? "", email: null })),
}));

const adapterModule = await import("@/services/adapters/kulturkalender/kulturkalender.adapter");
const mockFetchFeed = vi.mocked(adapterModule.fetchFeed);
const mapperModule = await import("@/services/adapters/kulturkalender/kulturkalender.mapper");
const mockMapSourceToNormalized = vi.mocked(mapperModule.mapSourceToNormalized);
const mockIsVhsEvent = vi.mocked(mapperModule.isVhsEvent);

function makeSourceEvent(overrides: Record<string, unknown> = {}) {
  return {
    kumo_link: "https://example.com/event/1",
    kumo_id: 1,
    kumo_updated_at: "2026-01-15T10:00:00.000+01:00",
    category: "Musik",
    venue: "Theater",
    title: "Test Event",
    subtitle: null,
    content: "Description",
    image: null,
    image_link: null,
    image_credits: null,
    time: "20:00",
    date: "2026-06-01",
    time_venue: "20:00 Theater",
    organiser: "Organizer",
    ...overrides,
  };
}

function makeNormalizedEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: "kulturkalender-1-2026-06-01",
    seriesId: "kulturkalender-1",
    summary: "Test Event",
    description: "Description",
    start: "2026-06-01T20:00:00+02:00",
    end: null,
    timeZone: "Europe/Berlin",
    location: "Theater",
    category: "Musik",
    organizer: "Organizer",
    organizerEmail: null,
    link: "https://example.com/event/1",
    image: null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
    sourceName: "Kulturkalender Greifswald",
    tags: [],
    updated: "2026-01-15T10:00:00.000+01:00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear the in-memory cache between tests
  vi.spyOn(cacheModule, "cacheGet");
  vi.spyOn(cacheModule, "cacheSet");
  vi.spyOn(cacheModule, "cacheDelete");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getEvents – normalized event cache", () => {
  describe("Happy Path", () => {
  it("fetches and caches on first call (cache miss)", async () => {
    const sourceEvent = makeSourceEvent();
    const normalized = makeNormalizedEvent();

    // source: simulated empty cache + single-event feed from kulturkalender adapter
    vi.mocked(cacheModule.cacheGet).mockReturnValue(null);
    mockFetchFeed.mockResolvedValue([sourceEvent]);
    mockMapSourceToNormalized.mockResolvedValue(normalized);

    const events = await getEvents();

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("kulturkalender-1-2026-06-01");
    expect(cacheModule.cacheSet).toHaveBeenCalledWith(
      "events:normalized:global",
      expect.objectContaining({
        events: [normalized],
        maxUpdatedAt: "2026-01-15T10:00:00.000+01:00",
      }),
      15 * 60 * 1000,
    );
  });

  it("returns cached data on fresh cache hit (no fetch)", async () => {
    const normalized = makeNormalizedEvent();

    // source: simulated fresh cache hit with single normalized event
    vi.mocked(cacheModule.cacheGet).mockReturnValue({
      data: { events: [normalized], maxUpdatedAt: "2026-01-15T10:00:00.000+01:00" },
      stale: false,
    });

    const events = await getEvents();

    expect(events).toEqual([normalized]);
    expect(mockFetchFeed).not.toHaveBeenCalled();
    expect(mockMapSourceToNormalized).not.toHaveBeenCalled();
  });

  it("revalidates and refreshes TTL when stale but feed unchanged", async () => {
    const normalized = makeNormalizedEvent();
    const cachedData = { events: [normalized], maxUpdatedAt: "2026-01-15T10:00:00.000+01:00" };

    // source: simulated stale cache + unchanged feed (same kumo_updated_at)
    vi.mocked(cacheModule.cacheGet).mockReturnValue({
      data: cachedData,
      stale: true,
    });
    mockFetchFeed.mockResolvedValue([
      makeSourceEvent({ kumo_updated_at: "2026-01-15T10:00:00.000+01:00" }),
    ]);

    const events = await getEvents();

    expect(events).toEqual([normalized]);
    // Should refresh TTL with existing data, not re-map
    expect(cacheModule.cacheSet).toHaveBeenCalledWith(
      "events:normalized:global",
      cachedData,
      15 * 60 * 1000,
    );
    expect(mockMapSourceToNormalized).not.toHaveBeenCalled();
  });

  it("invalidates and re-maps when stale and feed has newer kumo_updated_at", async () => {
    const oldNormalized = makeNormalizedEvent({ summary: "Old Event" });
    const newNormalized = makeNormalizedEvent({ summary: "New Event" });

    // source: simulated stale cache + updated feed (newer kumo_updated_at)
    vi.mocked(cacheModule.cacheGet).mockReturnValue({
      data: { events: [oldNormalized], maxUpdatedAt: "2026-01-15T10:00:00.000+01:00" },
      stale: true,
    });
    // source: simulated stale cache + updated feed with newer kumo_updated_at
    mockFetchFeed.mockResolvedValue([
      makeSourceEvent({ kumo_updated_at: "2026-04-20T12:00:00.000+02:00" }),
    ]);
    mockMapSourceToNormalized.mockResolvedValue(newNormalized);

    const events = await getEvents();

    expect(events).toEqual([newNormalized]);
    expect(cacheModule.cacheDelete).toHaveBeenCalledWith("events:normalized:global");
    expect(cacheModule.cacheSet).toHaveBeenCalledWith(
      "events:normalized:global",
      expect.objectContaining({
        events: [newNormalized],
        maxUpdatedAt: "2026-04-20T12:00:00.000+02:00",
      }),
      15 * 60 * 1000,
    );
  });

  it("filters out VHS events to avoid duplication with direct VHS import", async () => {
    const regularSource = makeSourceEvent();
    const vhsSource = makeSourceEvent({
      kumo_id: 99,
      organiser: "Volkshochschule Vorpommern-Greifswald",
    });
    const normalized = makeNormalizedEvent();

    // source: simulated empty cache + feed with regular and VHS events
    vi.mocked(cacheModule.cacheGet).mockReturnValue(null);
    mockFetchFeed.mockResolvedValue([regularSource, vhsSource]);
    mockIsVhsEvent
      // source: regular event passes VHS check, VHS event is filtered
      .mockReturnValueOnce(false)  // regular event passes
      .mockReturnValueOnce(true);  // VHS event filtered out
    mockMapSourceToNormalized.mockResolvedValue(normalized);

    const events = await getEvents();

    expect(events).toHaveLength(1);
    expect(mockMapSourceToNormalized).toHaveBeenCalledTimes(1);
  });

  it("picks the latest kumo_updated_at across multiple feed items", async () => {
    const source1 = makeSourceEvent({ kumo_updated_at: "2026-01-01T00:00:00.000+01:00" });
    const source2 = makeSourceEvent({
      kumo_updated_at: "2026-04-20T12:00:00.000+02:00",
      kumo_id: 2,
      kumo_link: "https://example.com/event/2",
    });
    const norm1 = makeNormalizedEvent({ id: "kulturkalender-1-2026-06-01" });
    const norm2 = makeNormalizedEvent({ id: "kulturkalender-2-2026-06-01" });

    // source: simulated empty cache + multi-event feed with different timestamps
    vi.mocked(cacheModule.cacheGet).mockReturnValue(null);
    mockFetchFeed.mockResolvedValue([source1, source2]);
    mockMapSourceToNormalized.mockResolvedValueOnce(norm1).mockResolvedValueOnce(norm2);

    await getEvents();

    expect(cacheModule.cacheSet).toHaveBeenCalledWith(
      "events:normalized:global",
      expect.objectContaining({ maxUpdatedAt: "2026-04-20T12:00:00.000+02:00" }),
      15 * 60 * 1000,
    );
  });
  });

  describe("Edge Cases", () => {
  it("serves stale data on transient upstream failure", async () => {
    const normalized = makeNormalizedEvent();

    // source: simulated stale cache + network failure from adapter
    vi.mocked(cacheModule.cacheGet).mockReturnValue({
      data: { events: [normalized], maxUpdatedAt: "2026-01-15T10:00:00.000+01:00" },
      stale: true,
    });
    mockFetchFeed.mockRejectedValue(new Error("Network error"));

    const events = await getEvents();

    expect(events).toEqual([normalized]);
  });
  });

  describe("Error Handling", () => {
  it("throws when no cache and upstream fails", async () => {
    // source: simulated empty cache + network failure
    vi.mocked(cacheModule.cacheGet).mockReturnValue(null);
    mockFetchFeed.mockRejectedValue(new Error("Network error"));

    await expect(getEvents()).rejects.toThrow("Network error");
  });

  it("handles non-Error throw from upstream", async () => {
    // source: simulated empty cache + non-Error rejection
    vi.mocked(cacheModule.cacheGet).mockReturnValue(null);
    mockFetchFeed.mockRejectedValue("string-error");

    await expect(getEvents()).rejects.toBe("string-error");
  });

  it("serves stale data on non-Error upstream failure", async () => {
    const normalized = makeNormalizedEvent();

    // source: simulated stale cache + non-Error rejection
    vi.mocked(cacheModule.cacheGet).mockReturnValue({
      data: { events: [normalized], maxUpdatedAt: "2026-01-15T10:00:00.000+01:00" },
      stale: true,
    });
    mockFetchFeed.mockRejectedValue("string-error");

    const events = await getEvents();
    expect(events).toEqual([normalized]);
  });
  });
});
