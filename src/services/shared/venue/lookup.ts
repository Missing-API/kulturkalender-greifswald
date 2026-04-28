/* eslint-disable @schafevormfenster/one-function-per-file -- Venue lookup: resolveVenueLocation + loadVenueMap + venueCache are a cohesive lookup unit */
import { config } from "@/config";

import { fetchVenueDetail } from "./fetch";
import { normalizeVenueName, parseVenueIndex } from "./parse-venue-index";
import type { GeneratedVenuesFile } from "./venue.types";

/**
 * Module-level runtime cache for lazily fetched venues.
 * Persists across requests within the same serverless invocation.
 */
const runtimeCache = new Map<string, VenueResolution>();

/**
 * Module-level cache for the venue index (fetched once per function lifetime).
 */
let venueIndexCache: Map<string, { id: string; url: string }> | null = null;

let staticVenues: GeneratedVenuesFile | null = null;

export interface VenueResolution {
  location: string;
  email: string | null;
}

/**
 * Load the static venue map generated at build time.
 * Returns empty venues if file doesn't exist.
 */
async function getStaticVenues(): Promise<GeneratedVenuesFile> {
  if (staticVenues) {
    return staticVenues;
  }

  try {
    // Dynamic import of generated file — may not exist before first build
    const data = await import("@/data/venues.generated.json");
    staticVenues = data.default as GeneratedVenuesFile;
  } catch {
    staticVenues = { generatedAt: "", venues: {} };
  }

  return staticVenues;
}

/**
 * Resolves venue location and email using two-layer lookup:
 * 1. Static map (venues.generated.json) — instant
 * 2. Runtime lazy fetch — single venue, 5s timeout
 * 3. Fallback to raw venue text from feed
 */
export async function resolveVenueLocation(
  venueName: string | null
): Promise<VenueResolution> {
  if (!venueName) {
    return { location: "", email: null };
  }

  const key = normalizeVenueName(venueName);

  // Layer 1: Static map
  const staticData = await getStaticVenues();
  const staticEntry = staticData.venues[key];
  if (staticEntry) {
    return { location: staticEntry.location, email: staticEntry.email ?? null };
  }

  // Layer 2a: Runtime cache
  const cached = runtimeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // Layer 2b: Runtime lazy fetch
  try {
    const index = await getVenueIndex();
    const indexEntry = index.get(key);

    if (indexEntry) {
      const detail = await fetchVenueDetail(indexEntry.url);
      if (detail) {
        const resolution: VenueResolution = { location: detail.location, email: detail.email };
        runtimeCache.set(key, resolution);
        return resolution;
      }
    }
  } catch {
    // Fail gracefully — use raw venue text
  }

  // Layer 3: Fallback to raw venue name
  const fallback: VenueResolution = { location: venueName, email: null };
  runtimeCache.set(key, fallback);
  return fallback;
}

async function getVenueIndex(): Promise<
  Map<string, { id: string; url: string }>
> {
  if (venueIndexCache) {
    return venueIndexCache;
  }

  const response = await fetch(config.venuesBaseUrl, {
    signal: AbortSignal.timeout(5000),
    headers: { "Accept-Language": "de" },
  });

  if (!response.ok) {
    venueIndexCache = new Map();
    return venueIndexCache;
  }

  const html = await response.text();
  const parsed = parseVenueIndex(html, config.venuesBaseUrl);

  venueIndexCache = new Map<string, { id: string; url: string }>();
  for (const [name, entry] of parsed) {
    venueIndexCache.set(name, { id: entry.id, url: entry.url });
  }

  return venueIndexCache;
}
