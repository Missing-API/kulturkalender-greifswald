import { NextResponse } from "next/server";

import type { EventListResponse } from "@/contracts/events.schemas";
import { getEvents } from "@/services/application/get-events.service";

export async function GET() {
  try {
    const events = getEvents();
    const response: EventListResponse = {
      events,
      count: events.length,
    };
    return NextResponse.json(response, {
      headers: {
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
