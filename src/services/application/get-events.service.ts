import { fetchFeed } from "@/services/adapters/kulturkalender/kulturkalender.adapter";
import { mapSourceToNormalized } from "@/services/adapters/kulturkalender/kulturkalender.mapper";
import { KulturkalenderSourceEventSchema } from "@/services/adapters/kulturkalender/kulturkalender.source.schema";
import { NormalizedEventSchema, type NormalizedEvent } from "@/types/normalized-event.schema";

/**
 * Returns normalized events from the live Kulturkalender feed.
 * Validates source → maps → validates normalized output.
 */
export async function getEvents(): Promise<NormalizedEvent[]> {
  const feed = await fetchFeed();

  const results = await Promise.all(
    feed.map(async (raw) => {
      const sourceEvent = KulturkalenderSourceEventSchema.parse(raw);
      const mapped = await mapSourceToNormalized(sourceEvent);
      return NormalizedEventSchema.parse(mapped);
    })
  );

  return results;
}
