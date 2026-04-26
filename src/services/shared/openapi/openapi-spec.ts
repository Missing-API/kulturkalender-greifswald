import { generateOpenApi } from "@ts-rest/open-api";

import { eventsContract } from "@/contracts/events.contract";

export function generateOpenApiSpec() {
  return generateOpenApi(
    eventsContract,
    {
      info: {
        title: "Kulturkalender Greifswald API",
        version: "1.0.0",
        description:
          "Event data from Kulturkalender Greifswald delivered as JSON and ICS.",
      },
      servers: [{ url: "/" }],
    },
    { setOperationId: true }
  );
}
