import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import after mock so logger is available
const { cacheGet, cacheSet, cacheDelete } = await import("@/lib/cache");

describe("cache", () => {
  beforeEach(() => {
    // Clear the internal cache by deleting known keys
    cacheDelete("test-key");
    cacheDelete("stale-key");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("cacheGet", () => {
    it("returns null for unknown key", () => {
      expect(cacheGet("nonexistent")).toBeNull();
    });

    it("returns data with stale=false for fresh entry", () => {
      cacheSet("test-key", { value: 42 }, 60_000);
      const result = cacheGet<{ value: number }>("test-key");

      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ value: 42 });
      expect(result!.stale).toBe(false);
    });

    it("returns data with stale=true for expired entry", () => {
      vi.useFakeTimers();
      cacheSet("stale-key", "old-data", 100);

      vi.advanceTimersByTime(200);
      const result = cacheGet<string>("stale-key");

      expect(result).not.toBeNull();
      expect(result!.data).toBe("old-data");
      expect(result!.stale).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("cacheSet", () => {
    it("stores and retrieves data", () => {
      cacheSet("test-key", [1, 2, 3], 5000);
      const result = cacheGet<number[]>("test-key");

      expect(result).not.toBeNull();
      expect(result!.data).toEqual([1, 2, 3]);
    });

    it("overwrites existing entry", () => {
      cacheSet("test-key", "first", 5000);
      cacheSet("test-key", "second", 5000);
      const result = cacheGet<string>("test-key");

      expect(result!.data).toBe("second");
    });
  });

  describe("cacheDelete", () => {
    it("removes an existing entry", () => {
      cacheSet("test-key", "data", 5000);
      const deleted = cacheDelete("test-key");

      expect(deleted).toBe(true);
      expect(cacheGet("test-key")).toBeNull();
    });

    it("returns false for non-existent key", () => {
      const deleted = cacheDelete("nonexistent");
      expect(deleted).toBe(false);
    });
  });
});
