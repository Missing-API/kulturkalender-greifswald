import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getEvents } from "@/services/application/get-events.service";
import { eventsToIcs } from "@/services/shared/ics/ics-formatter";

export async function GET() {
  try {
    const start = Date.now();
    const events = await getEvents();
    const icsContent = eventsToIcs(events);

    logger.info("ICS served", {
      component: "api.events.ics",
      operation: "GET",
      durationMs: Date.now() - start,
      eventCount: events.length,
    });

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="events.ics"',
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    logger.error("Internal error in ICS endpoint", {
      component: "api.events.ics",
      operation: "GET",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
