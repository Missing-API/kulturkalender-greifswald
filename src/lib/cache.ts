import { logger } from "@/lib/logger";

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttlMs: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function isStale(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.createdAt > entry.ttlMs;
}

/**
 * Get a value from the cache. Returns stale data if within stale-while-revalidate window.
 */
export function cacheGet<T>(key: string): { data: T; stale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    logger.debug("Cache miss", { component: "cache", operation: "get", key });
    return null;
  }

  const stale = isStale(entry);
  logger.debug(stale ? "Cache stale hit" : "Cache hit", {
    component: "cache",
    operation: "get",
    key,
    ageMs: Date.now() - entry.createdAt,
  });

  return { data: entry.data, stale };
}

/**
 * Set a value in the cache with a TTL in milliseconds.
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, createdAt: Date.now(), ttlMs });
  logger.debug("Cache set", { component: "cache", operation: "set", key, ttlMs });
}
