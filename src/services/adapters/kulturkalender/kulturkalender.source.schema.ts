import { z } from "zod";

/**
 * Source schema for Kulturkalender Greifswald JSON feed events.
 * Matches the structure from the upstream export endpoint.
 */
export const KulturkalenderSourceEventSchema = z
  .object({
    kumo_link: z.string().url().describe("Direct link to event on source site"),
    kumo_id: z.number().int().describe("Recurring series identifier from source"),
    kumo_updated_at: z.string().describe("Source update timestamp in ISO format"),
    category: z.string().describe("Event category label from source"),
    venue: z.string().nullable().describe("Venue name from source"),
    title: z.string().min(1).describe("Raw source event title"),
    subtitle: z.string().nullable().describe("Subtitle or short description"),
    content: z.string().nullable().describe("Full event description text"),
    image: z.string().nullable().describe("Event image URL"),
    image_link: z.string().nullable().describe("Event image link URL"),
    image_credits: z.string().nullable().describe("Image credit/attribution"),
    time: z.string().describe("Local event time string from source (HH:MM or empty)"),
    date: z.string().describe("Event date in YYYY-MM-DD format"),
    time_venue: z.string().nullable().describe("Combined time/venue display string"),
    organiser: z.string().nullable().describe("Organiser name if available"),
  })
  .strict();

export const KulturkalenderSourceFeedSchema = z.array(
  KulturkalenderSourceEventSchema
);

export type KulturkalenderSourceEvent = z.infer<
  typeof KulturkalenderSourceEventSchema
>;
export type KulturkalenderSourceFeed = z.infer<
  typeof KulturkalenderSourceFeedSchema
>;
