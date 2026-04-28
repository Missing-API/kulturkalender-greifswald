/* eslint-disable @schafevormfenster/one-function-per-file -- Service: getEvents + computeMaxUpdatedAt are a single orchestration concern */
import { cacheGet, cacheSet, cacheDelete } from "@/lib/cache";
import { log, logger } from "@/lib/logger";
import { fetchFeed } from "@/services/adapters/kulturkalender/kulturkalender.adapter";
import { isVhsEvent, mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { NormalizedEventSchema, type NormalizedEvent } from "@/types/normalized-event.schema";

const EVENTS_CACHE_KEY = "events:normalized:global";
const EVENTS_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface NormalizedCacheData {
  events: NormalizedEvent[];
  maxUpdatedAt: string;
}

/**
 * Compute the latest kumo_updated_at from the feed to detect new data.
 */
function getMaxUpdatedAt(feed: { kumo_updated_at: string }[]): string {
  let max = "";
  for (const item of feed) {
    if (item.kumo_updated_at > max) {
      max = item.kumo_updated_at;
    }
  }
  return max;
}

/**
 * Returns normalized events from the live Kulturkalender feed.
 * Uses in-memory cache with 15m TTL. Invalidates when source kumo_updated_at changes.
 * Serves stale data during revalidation and on transient upstream failure.
 */
export async function getEvents(): Promise<NormalizedEvent[]> {
  const cached = cacheGet<NormalizedCacheData>(EVENTS_CACHE_KEY);

  if (cached && !cached.stale) {
    logger.info("Normalized events cache hit", {
      component: "service.getEvents",
      operation: "cache",
      eventCount: cached.data.events.length,
      cacheStatus: "hit",
    });
    return cached.data.events;
  }

  try {
    const feed = await fetchFeed();
    const feedMaxUpdatedAt = getMaxUpdatedAt(feed);

    // Invalidate if source data has changed
    if (cached?.data.maxUpdatedAt === feedMaxUpdatedAt) {
      // Feed unchanged — refresh TTL with existing data
      cacheSet(EVENTS_CACHE_KEY, cached.data, EVENTS_TTL_MS);
      logger.info("Normalized events cache revalidated (unchanged)", {
        component: "service.getEvents",
        operation: "cache",
        eventCount: cached.data.events.length,
        cacheStatus: "revalidated",
      });
      return cached.data.events;
    }

    // Feed changed or no cache — transform events
    if (cached) {
      cacheDelete(EVENTS_CACHE_KEY);
    }

    // VHS courses are imported directly from VHS — filter them out to avoid duplicates.
    const nonVhsFeed = feed.filter((sourceEvent) => !isVhsEvent(sourceEvent));

    const results = await Promise.all(
      nonVhsFeed.map(async (sourceEvent) => {
        const mapped = await mapSourceToNormalized(sourceEvent);
        return NormalizedEventSchema.parse(mapped);
      }),
    );

    const cacheData: NormalizedCacheData = {
      events: results,
      maxUpdatedAt: feedMaxUpdatedAt,
    };
    cacheSet(EVENTS_CACHE_KEY, cacheData, EVENTS_TTL_MS);

    logger.info("Normalized events cache miss", {
      component: "service.getEvents",
      operation: "cache",
      eventCount: results.length,
      cacheStatus: cached ? "invalidated" : "miss",
    });

    return results;
  } catch (error) {
    // Stale-if-error: serve stale normalized data on transient failure
    if (cached) {
      logger.warn("Normalized events fetch failed, serving stale", {
        component: "service.getEvents",
        operation: "cache",
        eventCount: cached.data.events.length,
        cacheStatus: "stale-error",
        error: error instanceof Error ? error.message : String(error),
      });
      return cached.data.events;
    }

    log.error("Normalized events fetch failed, no stale data available", {
      component: "service.getEvents",
      operation: "getEvents",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
