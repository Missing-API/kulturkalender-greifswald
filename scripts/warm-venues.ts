/* eslint-disable @schafevormfenster/prefer-custom-logger -- Standalone build-time script, logger not available */
/**
 * Build-time venue warm-up script.
 * Fetches all venue detail pages and writes venues.generated.json.
 *
 * Usage: pnpm tsx scripts/warm-venues.ts
 */
import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";

import type { GeneratedVenueEntry, GeneratedVenuesFile } from "../src/services/shared/venue/venue.types";

const VENUES_BASE_URL =
  process.env.VENUES_BASE_URL ??
  "https://www.kulturkalender.greifswald.de/venues/";
const BATCH_SIZE = 10;
const DELAY_MS = 300;
const TIMEOUT_MS = 10_000;

const PHONE_EMAIL_PATTERN = /^[\d\s+()/-]+$|@|^https?:\/\//;

const log = {
  error: (...args: unknown[]) => console.error("[warm-venues]", ...args),
};

interface IndexEntry {
  id: string;
  name: string;
  normalizedName: string;
  url: string;
}

async function main(): Promise<void> {
  console.log("[warm-venues] Fetching venue index...");

  const response = await fetch(VENUES_BASE_URL, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "Accept-Language": "de" },
  });
  if (!response.ok) {
    log.error(`HTTP ${response.status} for ${VENUES_BASE_URL}`);
    throw new Error(`HTTP ${response.status} for ${VENUES_BASE_URL}`);
  }
  const indexHtml = await response.text();

  const $ = cheerio.load(indexHtml);
  const entries: IndexEntry[] = [];
  const origin = new URL(VENUES_BASE_URL).origin;

  $('a[href^="/venues/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const name = $(el).text().trim();
    const idMatch = /\/venues\/(\d+)/.exec(href);

    if (name && idMatch) {
      entries.push({
        id: idMatch[1],
        name,
        normalizedName: name.trim().toLowerCase().replaceAll(/\s+/g, " "),
        url: `${origin}${href}`,
      });
    }
  });

  console.log(`[warm-venues] Found ${entries.length} venues`);

  const venues: Record<string, GeneratedVenueEntry> = {};
  let failed = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const res = await fetch(entry.url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "Accept-Language": "de" },
        });
        if (!res.ok) {
          log.error(`HTTP ${res.status} for ${entry.url}`);
          throw new Error(`HTTP ${res.status} for ${entry.url}`);
        }
        const html = await res.text();
        return { entry, html };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { entry, html: detailHtml } = result.value;
        const $d = cheerio.load(detailHtml);
        const nameEl = $d("span.d-block.fw-500 a").first();
        const detailName = nameEl.text().trim() || entry.name;

        const addressLines: string[] = [];
        $d("span.d-block")
          .not(".fw-500")
          .each((_, el) => {
            const text = $d(el).text().trim();
            if (text && !PHONE_EMAIL_PATTERN.test(text)) {
              addressLines.push(text);
            }
          });

        const street = addressLines[0];
        const city = addressLines[1];
        const locationParts = [detailName, street, city].filter(Boolean);

        const emailEl = $d("div.mt-1 a[href^='mailto:']").first();
        const emailHref = emailEl.attr("href") ?? "";
        const email = emailHref.startsWith("mailto:") ? emailHref.slice(7) : null;

        venues[entry.normalizedName] = {
          id: entry.id,
          name: detailName,
          street,
          city,
          location: locationParts.join(", "),
          email,
          url: entry.url,
        };
      } else {
        failed++;
        console.warn(
          `[warm-venues] Failed to fetch venue: ${result.reason}`
        );
      }
    }

    if (i + BATCH_SIZE < entries.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  const output: GeneratedVenuesFile = {
    generatedAt: new Date().toISOString(),
    venues,
  };

  const outputPath = path.resolve("src/data/venues.generated.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(
    `[warm-venues] Wrote ${Object.keys(venues).length} venues to ${outputPath}`
  );
  if (failed > 0) {
    console.warn(`[warm-venues] ${failed} venue(s) failed to fetch`);
  }
}

await main();
