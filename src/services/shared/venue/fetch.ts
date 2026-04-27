import { config } from "@/config";

import { parseVenueDetail, type VenueDetail } from "./helpers/parse-venue-detail";

/**
 * Fetches and parses a single venue detail page at runtime.
 * Used as fallback when venue is not in the static map.
 * Timeout: 5s, no retry (fail fast for API latency budget).
 */
export async function fetchVenueDetail(
  venueUrl: string
): Promise<VenueDetail | null> {
  try {
    const response = await fetch(venueUrl, {
      signal: AbortSignal.timeout(
        Math.min(config.requestTimeoutMs, 5000)
      ),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return parseVenueDetail(html);
  } catch {
    return null;
  }
}
