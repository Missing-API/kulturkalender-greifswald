import { z } from "zod";

/**
 * Normalized event schema used for JSON and ICS output mapping.
 * All events pass through this schema before delivery.
 */
export const NormalizedEventSchema = z
  .object({
    id: z.string().min(1).describe("Stable event identity derived from source"),
    summary: z.string().min(1).describe("Normalized event title"),
    description: z.string().default("").describe("Full event description text"),
    start: z.string().describe("Event start as ISO 8601 datetime string"),
    end: z.string().nullable().default(null).describe("Event end as ISO 8601 datetime string"),
    timeZone: z
      .string()
      .default("Europe/Berlin")
      .describe("IANA timezone for event times"),
    location: z.string().default("").describe("Normalized location/venue text"),
    category: z.string().default("").describe("Event category"),
    organizer: z.string().default("").describe("Organizer name"),
    link: z.string().url().describe("Link to original event page"),
    image: z.string().nullable().default(null).describe("Event image URL"),
    status: z
      .enum(["confirmed", "tentative", "cancelled"])
      .default("confirmed")
      .describe("Normalized event lifecycle status"),
    source: z
      .string()
      .default("kulturkalender-greifswald")
      .describe("Source adapter identifier"),
    updated: z.string().describe("Last update timestamp from source"),
  })
  .strict()
  .transform((event) => ({
    ...event,
    summary: event.summary.trim(),
    description: event.description.trim(),
    location: event.location.trim(),
  }));

export type NormalizedEvent = z.output<typeof NormalizedEventSchema>;
export type NormalizedEventInput = z.input<typeof NormalizedEventSchema>;
