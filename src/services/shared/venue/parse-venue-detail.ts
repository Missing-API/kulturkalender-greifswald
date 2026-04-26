import * as cheerio from "cheerio";

export interface VenueDetail {
  name: string;
  street?: string;
  city?: string;
  location: string;
}

const PHONE_EMAIL_PATTERN = /^[\d\s+()/-]+$|@|^https?:\/\//;

/**
 * Parses a venue detail HTML page and extracts address information.
 * Filters out phone, email, and web link lines.
 */
export function parseVenueDetail(html: string): VenueDetail | null {
  const $ = cheerio.load(html);

  const nameEl = $("span.d-block.fw-500 a").first();
  const name = nameEl.text().trim();

  if (!name) {
    return null;
  }

  const addressLines: string[] = [];
  $("span.d-block")
    .not(".fw-500")
    .each((_, el) => {
      const text = $(el).text().trim();
      if (text && !PHONE_EMAIL_PATTERN.test(text)) {
        addressLines.push(text);
      }
    });

  const street = addressLines[0];
  const city = addressLines[1];

  const locationParts = [name, street, city].filter(Boolean);
  const location = locationParts.join(", ");

  return { name, street, city, location };
}
