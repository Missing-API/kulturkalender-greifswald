/* eslint-disable @schafevormfenster/enforce-folder-structure -- API DTO schemas co-located with contracts by convention */
import { z } from "zod";

/**
 * API DTO schema for event list responses.
 */
export const EventDtoSchema = z
  .object({
    id: z.string().describe("Event identifier"),
    summary: z.string().describe("Event title"),
    description: z.string().describe("Event description"),
    start: z.string().describe("Start datetime ISO 8601"),
    end: z.string().nullable().describe("End datetime ISO 8601 or null"),
    timeZone: z.string().describe("IANA timezone"),
    location: z.string().describe("Venue/location name"),
    category: z.string().describe("Event category"),
    organizer: z.string().describe("Organizer name"),
    organizerEmail: z.string().nullable().describe("Organizer email from venue page or null"),
    link: z.string().describe("Link to original event"),
    image: z.string().nullable().describe("Image URL or null"),
    status: z
      .enum(["confirmed", "tentative", "cancelled"])
      .describe("Event status"),
    source: z.string().describe("Source adapter identifier"),
    tags: z.array(z.string()).describe("Metadata tags"),
    updated: z.string().describe("Last update timestamp"),
  })
  .strict();

export const EventListResponseSchema = z.object({
  events: z.array(EventDtoSchema).describe("List of events"),
  count: z.number().int().describe("Total number of events returned"),
}).strict();

export type EventDto = z.infer<typeof EventDtoSchema>;
export type EventListResponse = z.infer<typeof EventListResponseSchema>;
