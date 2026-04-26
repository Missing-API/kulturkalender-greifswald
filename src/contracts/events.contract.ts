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
      500: z.object({
        error: z.string(),
      }).strict(),
    },
    summary: "Get all events",
    description: "Returns a list of all events from Kulturkalender Greifswald",
  },
});
