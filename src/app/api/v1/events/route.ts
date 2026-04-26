import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { EventListResponse } from "@/contracts/events.schemas";
import { logger } from "@/lib/logger";
import { getEvents } from "@/services/application/get-events.service";

export async function GET() {
  try {
    const start = Date.now();
    const events = await getEvents();
    const response: EventListResponse = {
      events,
      count: events.length,
    };

    logger.info("Events served", {
      component: "api.events",
      operation: "GET",
      durationMs: Date.now() - start,
      eventCount: events.length,
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error("Validation error in events endpoint", {
        component: "api.events",
        operation: "GET",
        issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 422 }
      );
    }

    logger.error("Internal error in events endpoint", {
      component: "api.events",
      operation: "GET",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
