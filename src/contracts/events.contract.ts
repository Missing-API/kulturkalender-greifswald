import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { EventListResponseSchema } from "./events.schemas";

const c = initContract();

export const eventsContract = c.router({
  getEvents: {
    method: "GET",
    path: "/api/v1/events",
    responses: {
      200: EventListResponseSchema,
      422: z.object({
        error: z.string(),
        details: z.array(z.object({
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string(),
        })),
      }).strict(),
      500: z.object({
        error: z.string(),
      }).strict(),
    },
    summary: "Get all events",
    description: "Returns a list of all events from Kulturkalender Greifswald. Events are enriched with venue details and cached for 15 minutes.",
  },
});
