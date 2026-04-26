export const config = {
  feedUrl:
    process.env.KULTURKALENDER_FEED_URL ??
    "https://www.kulturkalender.greifswald.de/export/a869cfebea250bbfe04a1b623baaf338.json",
  venuesBaseUrl:
    process.env.VENUES_BASE_URL ??
    "https://www.kulturkalender.greifswald.de/venues/",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? "10000"),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? "3600"),
  cacheStaleWhileRevalidateSeconds: Number(
    process.env.CACHE_STALE_WHILE_REVALIDATE_SECONDS ?? "600"
  ),
  logLevel: process.env.LOG_LEVEL ?? "info",
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? "Europe/Berlin",
} as const;
