/* eslint-disable @schafevormfenster/one-function-per-file -- Description builders: plain-text + HTML are a cohesive pair */
import { dataToHtml, dataToText, type TextWithData } from "@/lib/data-text-mapper";
import type { NormalizedEvent } from "@/types/normalized-event.schema";

/**
 * Derive scopes from source category per ICS spec.
 * "Umland" → ["Region"], anything else → undefined.
 */
function deriveScopes(event: NormalizedEvent): string[] | undefined {
  if (event.category === "Umland") {
    return ["Region"];
  }
  return undefined;
}

/**
 * Build the TextWithData shape for @schafevormfenster/data-text-mapper.
 */
function buildTextWithData(event: NormalizedEvent): TextWithData {
  return {
    description: event.description,
    url: event.link,
    tags: event.category ? [event.category] : undefined,
    scopes: deriveScopes(event),
    image: event.image ?? undefined,
  };
}

/**
 * Generate plain text description for ICS DESCRIPTION field.
 */
export function buildIcsDescription(event: NormalizedEvent): string {
  return dataToText(buildTextWithData(event));
}

/**
 * Generate HTML description for ICS X-ALT-DESC field.
 */
export function buildIcsHtmlDescription(event: NormalizedEvent): string {
  return dataToHtml(buildTextWithData(event));
}
