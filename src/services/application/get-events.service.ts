import { dummySourceEvents } from "@/data/dummy-events";
import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { KulturkalenderSourceEventSchema } from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { NormalizedEventSchema, type NormalizedEvent } from "@/types/normalized-event.schema";

/**
 * Returns normalized events from the dummy source data.
 * Validates source → maps → validates normalized output.
 */
export function getEvents(): NormalizedEvent[] {
  return dummySourceEvents.map((raw) => {
    const sourceEvent = KulturkalenderSourceEventSchema.parse(raw);
    const mapped = mapSourceToNormalized(sourceEvent);
    return NormalizedEventSchema.parse(mapped);
  });
}
