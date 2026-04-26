import * as cheerio from "cheerio";

export interface VenueIndexEntry {
  id: string;
  name: string;
  url: string;
}

/**
 * Parses the venue index HTML page and extracts venue links.
 * Returns a Map keyed by normalized venue name.
 */
export function parseVenueIndex(
  html: string,
  baseUrl: string
): Map<string, VenueIndexEntry> {
  const $ = cheerio.load(html);
  const venues = new Map<string, VenueIndexEntry>();

  $('a[href^="/venues/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const name = $(el).text().trim();
    const idMatch = /\/venues\/(\d+)/.exec(href);

    if (name && idMatch) {
      const key = normalizeVenueName(name);
      const origin = new URL(baseUrl).origin;
      venues.set(key, {
        id: idMatch[1],
        name,
        url: `${origin}${href}`,
      });
    }
  });

  return venues;
}

/**
 * Normalize venue name for lookup: trim, lower-case, collapse spaces.
 */
export function normalizeVenueName(name: string): string {
  return name.trim().toLowerCase().replaceAll(/\s+/g, " ");
}
