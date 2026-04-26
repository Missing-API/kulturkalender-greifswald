import { resolveVenueLocation } from "@/services/shared/venue/lookup";
import type { NormalizedEventInput } from "@/types/normalized-event.schema";

import type { KulturkalenderSourceEvent } from "./kulturkalender.source.schema";

const DEFAULT_ORGANIZER = "Kulturkalender Greifswald";
const VHS_PATTERN = /volkshochschule/i;

/**
 * Maps a source feed event to the normalized event input shape.
 */
export async function mapSourceToNormalized(
  source: KulturkalenderSourceEvent
): Promise<NormalizedEventInput> {
  const startDateTime = buildStartDateTime(source.date, source.time);
  const tags = detectTags(source);
  const location = await resolveVenueLocation(source.venue);

  return {
    id: `kulturkalender-${source.kumo_id}-${source.date}`,
    summary: source.title,
    description: buildDescription(source),
    start: startDateTime,
    end: null,
    timeZone: "Europe/Berlin",
    location,
    category: source.category,
    organizer: source.organiser ?? DEFAULT_ORGANIZER,
    link: source.kumo_link,
    image: source.image ?? null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
    tags,
    updated: source.kumo_updated_at,
  };
}

function buildStartDateTime(date: string, time: string): string {
  if (/^\d{2}:\d{2}$/.test(time)) {
    return `${date}T${time}:00`;
  }
  return `${date}T00:00:00`;
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

/**
 * Detect metadata tags for downstream processing.
 * VHS events are soft-tagged, not filtered.
 */
function detectTags(source: KulturkalenderSourceEvent): string[] {
  const tags: string[] = [];
  if (
    (source.organiser && VHS_PATTERN.test(source.organiser)) ||
    (source.venue && VHS_PATTERN.test(source.venue))
  ) {
    tags.push("vhs-overlap");
  }
  return tags;
}
