import * as cheerio from "cheerio";

export interface VenueDetail {
  name: string;
  street?: string;
  city?: string;
  location: string;
  email: string | null;
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

  /* Scope address extraction to the container that holds the venue name.
     The live pages include search-bar labels (e.g. "Date", "Venue") that
     also match span.d-block — looking only inside the name's parent div
     avoids picking those up. */
  const container = nameEl.closest("span.d-block.fw-500").parent();

  const addressLines: string[] = [];
  container
    .children("span.d-block")
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

  const emailEl = $("div.mt-1 a[href^='mailto:']").first();
  const emailHref = emailEl.attr("href") ?? "";
  const email = emailHref.startsWith("mailto:") ? emailHref.slice(7) : null;

  return { name, street, city, location, email };
}
