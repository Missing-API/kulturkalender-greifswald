/* eslint-disable @schafevormfenster/one-function-per-file -- Adapter module: fetchFeed + internal helpers are a single-source concern */
import { config } from "@/config";
import { cacheGet, cacheSet } from "@/lib/cache";
import { log, logger } from "@/lib/logger";

import {
  KulturkalenderSourceFeedSchema,
  type KulturkalenderSourceFeed,
} from "./kulturkalender.source.schema";

const FEED_CACHE_KEY = "feed:kulturkalender:global";
const FEED_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the Kulturkalender feed from the configured URL.
 * Uses in-memory cache with stale-while-revalidate and stale-if-error.
 */
export async function fetchFeed(): Promise<KulturkalenderSourceFeed> {
  const cached = cacheGet<KulturkalenderSourceFeed>(FEED_CACHE_KEY);

  if (cached && !cached.stale) {
    return cached.data;
  }

  try {
    const start = Date.now();
    const response = await fetchWithRetry(config.feedUrl, {
      timeoutMs: config.requestTimeoutMs,
      retries: 1,
      retryDelayMs: 500,
    });

    const data: unknown = await response.json();
    const feed = KulturkalenderSourceFeedSchema.parse(data);

    logger.info("Feed fetched", {
      component: "adapter.kulturkalender",
      operation: "fetchFeed",
      durationMs: Date.now() - start,
      sourceUrl: config.feedUrl,
      eventCount: feed.length,
    });

    cacheSet(FEED_CACHE_KEY, feed, FEED_TTL_MS);
    return feed;
  } catch (error) {
    // Stale-if-error: return stale data on upstream failure
    if (cached) {
      logger.warn("Feed fetch failed, serving stale", {
        component: "adapter.kulturkalender",
        operation: "fetchFeed",
        error: error instanceof Error ? error.message : String(error),
      });
      return cached.data;
    }

    log.error("Feed fetch failed, no stale data available", {
      component: "adapter.kulturkalender",
      operation: "fetchFeed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

interface FetchOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
}

async function fetchWithRetry(
  url: string,
  options: FetchOptions
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { Accept: "application/json", "Accept-Language": "de" },
      });

      if (response.ok) {
        return response;
      }

      if (response.status >= 500 && attempt < options.retries) {
        logger.warn("Feed fetch transient failure, retrying", {
          component: "adapter.kulturkalender",
          operation: "fetchWithRetry",
          sourceUrl: url,
          attempt,
          status: response.status,
        });
        await delay(options.retryDelayMs);
        continue;
      }

      const msg = `Feed fetch failed: HTTP ${response.status} ${response.statusText}`;
      log.error(msg, {
        component: "adapter.kulturkalender",
        operation: "fetchWithRetry",
        sourceUrl: url,
        status: response.status,
      });
      throw new Error(msg);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.retries) {
        await delay(options.retryDelayMs);
        continue;
      }
    }
  }

  log.error("Feed fetch failed after retries", {
    component: "adapter.kulturkalender",
    operation: "fetchWithRetry",
    sourceUrl: url,
    error: lastError?.message,
  });
  throw lastError ?? new Error("Feed fetch failed after retries");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
