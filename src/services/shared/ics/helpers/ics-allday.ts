/* eslint-disable @schafevormfenster/one-function-per-file -- isAllDay and toIcsAllDayEnd are cohesive helpers */
import { parseLocalIsoToDate } from "./ics-date";

/**
 * Check whether a start string is date-only (all-day event) or includes a time.
 */
export function isAllDay(start: string): boolean {
  return !start.includes("T");
}

/**
 * Build an ICS DATE end object for the day after the given date-only string.
 * Used for all-day events where DTEND is the exclusive next day.
 */
export function toIcsAllDayEnd(dateOnly: string) {
  const date = parseLocalIsoToDate(dateOnly);
  date.setUTCDate(date.getUTCDate() + 1);
  return {
    date,
    type: "DATE" as const,
  };
}
