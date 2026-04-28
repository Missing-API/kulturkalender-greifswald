/* eslint-disable @schafevormfenster/one-function-per-file -- Mapper module: mapping helpers are tightly coupled to mapSourceToNormalized */
import { resolveVenueLocation } from "@/services/shared/venue/lookup";
import type { NormalizedEventInput } from "@/types/normalized-event.schema";

import { mapCategory, mapCategoryToTags } from "./kulturkalender.categories";
import type { KulturkalenderSourceEvent } from "./kulturkalender.source.schema";

const SOURCE_NAME = "Kulturkalender Greifswald";
const VHS_PATTERN = /volkshochschule/i;

/**
 * VHS courses are already imported directly from VHS and must not be
 * duplicated through the Kulturkalender feed. Use this guard before
 * mapping to filter them out.
 */
export function isVhsEvent(source: KulturkalenderSourceEvent): boolean {
  return (
    (!!source.organiser && VHS_PATTERN.test(source.organiser)) ||
    (!!source.venue && VHS_PATTERN.test(source.venue))
  );
}

/**
 * Maps a source feed event to the normalized event input shape.
 */
export async function mapSourceToNormalized(
  source: KulturkalenderSourceEvent
): Promise<NormalizedEventInput> {
  const startDateTime = buildStartDateTime(source.date, source.time);
  const tags = mapCategoryToTags(source.category);
  const venue = await resolveVenueLocation(source.venue);

  return {
    id: `kulturkalender-${source.kumo_id}-${source.date}`,
    seriesId: `kulturkalender-${source.kumo_id}`,
    summary: source.title,
    description: buildDescription(source),
    start: startDateTime,
    end: null,
    timeZone: "Europe/Berlin",
    location: venue.location,
    category: mapCategory(source.category),
    organizer: source.organiser ?? source.venue ?? "",
    organizerEmail: venue.email,
    link: source.kumo_link,
    image: source.image ?? null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
    sourceName: SOURCE_NAME,
    tags,
    updated: source.kumo_updated_at,
  };
}

function buildStartDateTime(date: string, time: string): string {
  if (/^\d{2}:\d{2}$/.test(time)) {
    return `${date}T${time}:00`;
  }
  return date;
}

function buildDescription(source: KulturkalenderSourceEvent): string {
  const parts: string[] = [];
  if (source.subtitle) {
    parts.push(source.subtitle);
  }
  if (source.content) {
    parts.push(source.content);
  }
  return parts.join("\n\n");
}
