import { NextResponse } from "next/server";

import { getEvents } from "@/services/application/get-events.service";
import { eventsToIcs } from "@/services/shared/ics/ics-formatter";

export async function GET() {
  try {
    const events = getEvents();
    const icsContent = eventsToIcs(events);
    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="events.ics"',
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
