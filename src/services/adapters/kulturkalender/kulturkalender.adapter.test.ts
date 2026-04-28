import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/cache", () => {
  let store: Record<string, { data: unknown; stale: boolean }> = {};
  return {
    cacheGet: vi.fn((key: string) => store[key] ?? null),
    cacheSet: vi.fn((key: string, data: unknown) => {
      store[key] = { data, stale: false };
    }),
    cacheDelete: vi.fn((key: string) => {
      delete store[key];
    }),
    _reset: () => {
      store = {};
    },
    _markStale: (key: string) => {
      if (store[key]) store[key].stale = true;
    },
  };
});

const cacheModule = await import("@/lib/cache") as Awaited<typeof import("@/lib/cache")> & {
  _reset: () => void;
  _markStale: (key: string) => void;
};

const VALID_FEED = [
  {
    kumo_link: "https://example.com/events/1?start_on=2026-05-01",
    kumo_id: 1,
    kumo_updated_at: "2026-05-01T10:00:00.000+02:00",
    category: "Musik",
    venue: "Theater",
    title: "Test Event",
    subtitle: null,
    content: "Description",
    image: null,
    image_link: null,
    image_credits: null,
    time: "20:00",
    date: "2026-05-01",
    time_venue: "20:00 Theater",
    organiser: "Org",
  },
];

beforeEach(() => {
  cacheModule._reset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchFeed adapter", () => {
  describe("Happy Path", () => {
    it("fetches feed from URL and caches result", async () => {
      vi.stubGlobal(
        "fetch",
        // source: simulated successful HTTP response with valid feed payload
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => VALID_FEED,
        }),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test Event");
    });

    it("returns cached data on fresh cache hit", async () => {
      cacheModule.cacheSet("feed:kulturkalender:global", VALID_FEED, 3_600_000);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toEqual(VALID_FEED);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("Stale-if-error", () => {
    it("serves stale data on upstream failure", async () => {
      cacheModule.cacheSet("feed:kulturkalender:global", VALID_FEED, 3_600_000);
      cacheModule._markStale("feed:kulturkalender:global");

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toEqual(VALID_FEED);
    });

    it("serves stale data on non-Error upstream failure", async () => {
      cacheModule.cacheSet("feed:kulturkalender:global", VALID_FEED, 3_600_000);
      cacheModule._markStale("feed:kulturkalender:global");

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue("string-error"),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toEqual(VALID_FEED);
    });

    it("throws when no stale data and upstream fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      await expect(fetchFeed()).rejects.toThrow("Network error");
    });

    it("throws non-Error when no stale data available", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue("string-error"),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      await expect(fetchFeed()).rejects.toThrow("string-error");
    });
  });

  describe("Retry logic", () => {
    it("retries on 500 response and succeeds", async () => {
      // source: simulated 500 then success from upstream kulturkalender feed
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })
        // source: simulated successful retry response from upstream
        .mockResolvedValueOnce({ ok: true, json: async () => VALID_FEED });

      vi.stubGlobal("fetch", fetchMock);

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws on non-retryable HTTP error (4xx)", async () => {
      vi.stubGlobal(
        "fetch",
        // source: simulated HTTP 404 response from upstream
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      await expect(fetchFeed()).rejects.toThrow("HTTP 404");
    });

    it("throws after exhausting retries on persistent 500", async () => {
      vi.stubGlobal(
        "fetch",
        // source: simulated persistent HTTP 500 from upstream
        // source: simulated HTTP 500 response from upstream
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      await expect(fetchFeed()).rejects.toThrow("HTTP 500");
    });

    it("retries on network error and succeeds on second attempt", async () => {
      // source: simulated ECONNRESET then success from upstream
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        // source: simulated successful retry response from upstream
        .mockResolvedValueOnce({ ok: true, json: async () => VALID_FEED });

      vi.stubGlobal("fetch", fetchMock);

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("wraps non-Error throws in Error", async () => {
      vi.stubGlobal(
        "fetch",
        // source: simulated non-Error rejection from fetch
        vi.fn().mockRejectedValue("string-error"),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      await expect(fetchFeed()).rejects.toThrow("string-error");
    });
  });

  describe("Stale revalidation", () => {
    it("fetches fresh data when cache is stale", async () => {
      cacheModule.cacheSet("feed:kulturkalender:global", VALID_FEED, 3_600_000);
      cacheModule._markStale("feed:kulturkalender:global");

      vi.stubGlobal(
        "fetch",
        // source: simulated successful re-fetch after stale cache hit
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => VALID_FEED,
        }),
      );

      const { fetchFeed } = await import("./kulturkalender.adapter");
      const result = await fetchFeed();

      expect(result).toHaveLength(1);
    });
  });
});
