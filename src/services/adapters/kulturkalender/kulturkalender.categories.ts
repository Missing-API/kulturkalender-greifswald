/* eslint-disable @schafevormfenster/one-function-per-file -- mapCategory and mapCategoryToTags are a cohesive pair: rural category + hashtag-safe tags */
const RURAL_CATEGORY_CULTURE = "Kultur & Tourismus";

const SOURCE_TO_RURAL: Record<string, string> = {
  Ausstellung: RURAL_CATEGORY_CULTURE,
  "Bühne": RURAL_CATEGORY_CULTURE,
  Fest: RURAL_CATEGORY_CULTURE,
  Film: RURAL_CATEGORY_CULTURE,
  "Kinder und Jugendliche": RURAL_CATEGORY_CULTURE,
  Kunst: RURAL_CATEGORY_CULTURE,
  Literatur: RURAL_CATEGORY_CULTURE,
  Musik: RURAL_CATEGORY_CULTURE,
  "Online/ on Air/ on TV": RURAL_CATEGORY_CULTURE,
  Party: RURAL_CATEGORY_CULTURE,
  Umland: RURAL_CATEGORY_CULTURE,
  Vortrag: RURAL_CATEGORY_CULTURE,
};

/**
 * Per-source-category hashtag tags, aligned with the classification-api taxonomy.
 * Tags must be hashtag-safe (no whitespace).
 */
const SOURCE_TO_TAGS: Record<string, string[]> = {
  Ausstellung: ["Kultur", "Ausstellung"],
  "Bühne": ["Kultur", "Bühne"],
  Fest: ["Kultur", "Gemeindeleben", "Fest"],
  Film: ["Kultur", "Film"],
  "Kinder und Jugendliche": ["Kultur", "Bildung", "Kinder", "Jugendliche"],
  Kunst: ["Kultur", "Kunst"],
  Literatur: ["Kultur", "Literatur"],
  Musik: ["Kultur", "Musik"],
  "Online/ on Air/ on TV": ["Kultur"],
  Party: ["Kultur", "Gemeindeleben", "Party"],
  Umland: ["Tourismus", "Umland"],
  Vortrag: ["Kultur", "Bildung", "Vortrag"],
};

export function mapCategory(source: string): string {
  return SOURCE_TO_RURAL[source] ?? "";
}

/**
 * Convert a source category to hashtag-safe display tags.
 * Returns empty array for unmapped categories like "Extra".
 */
export function mapCategoryToTags(sourceCategory: string): string[] {
  return SOURCE_TO_TAGS[sourceCategory] ?? [];
}
