import type { NormalizedEventInput } from "@/types/normalized-event.schema";

import type { KulturkalenderSourceEvent } from "./kulturkalender.source.schema";

/**
 * Maps a source feed event to the normalized event input shape.
 */
export function mapSourceToNormalized(
  source: KulturkalenderSourceEvent
): NormalizedEventInput {
  const startDateTime = buildStartDateTime(source.date, source.time);

  return {
    id: `kulturkalender-${source.kumo_id}-${source.date}`,
    summary: source.title,
    description: buildDescription(source),
    start: startDateTime,
    end: null,
    timeZone: "Europe/Berlin",
    location: source.venue ?? "",
    category: source.category,
    organizer: source.organiser ?? "",
    link: source.kumo_link,
    image: source.image ?? null,
    status: "confirmed",
    source: "kulturkalender-greifswald",
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
