/* eslint-disable @schafevormfenster/one-function-per-file -- ICS date helpers: parse/convert/status-map are a cohesive utility set */
/**
 * Parse local ISO datetime string to a Date object without timezone drift.
 * The returned Date represents the wall-clock components (year, month, day, hour, minute)
 * via its UTC accessors, preserving the local time values.
 */
export function parseLocalIsoToDate(localIso: string): Date {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = (timePart ?? "00:00:00").split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second ?? 0));
}

/**
 * Parse local ISO datetime string directly into ICS date array.
 * NEVER uses new Date() to avoid timezone drift.
 */
export function toIcsDateArray(
  localIso: string
): [number, number, number, number, number] {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00:00").split(":").map(Number);
  return [year, month, day, hour, minute];
}

export function toIcsDateObject(localIso: string) {
  const date = parseLocalIsoToDate(localIso);
  return {
    date,
    type: "DATE-TIME" as const,
    local: {
      date,
      timezone: "Europe/Berlin",
      tzoffset: "+0100",
    },
  };
}

export function mapStatus(
  status: "confirmed" | "tentative" | "cancelled"
): "CONFIRMED" | "TENTATIVE" | "CANCELLED" {
  const map = {
    confirmed: "CONFIRMED",
    tentative: "TENTATIVE",
    cancelled: "CANCELLED",
  } as const;
  return map[status];
}
