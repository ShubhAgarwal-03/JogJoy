import { UnitSystem } from "../utils/unitPreference";

const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;

/** Distance for display, e.g. "5.24 km" or "3.26 mi". */
export function formatDistance(meters: number, unit: UnitSystem): string {
  if (unit === "imperial") {
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(2)} mi`;
  }
  const km = meters / METERS_PER_KM;
  return `${km.toFixed(2)} km`;
}

/** Duration for display, e.g. "31:48" or "1:05:12" for runs over an hour. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Pace for display, e.g. "6:04 /km" or "9:47 /mi".
 * Input is seconds-per-meter (as stored in RunSummary) to avoid unit
 * confusion elsewhere — conversion to km/mi happens only here, at display time.
 */
export function formatPace(secPerMeter: number, unit: UnitSystem): string {
  if (!isFinite(secPerMeter) || secPerMeter <= 0) {
    return unit === "imperial" ? "--:-- /mi" : "--:-- /km";
  }

  const secPerUnit =
    unit === "imperial"
      ? secPerMeter * METERS_PER_MILE
      : secPerMeter * METERS_PER_KM;

  const minutes = Math.floor(secPerUnit / 60);
  const seconds = Math.round(secPerUnit % 60);

  // Handle rounding pushing seconds to 60
  const adjMinutes = seconds === 60 ? minutes + 1 : minutes;
  const adjSeconds = seconds === 60 ? 0 : seconds;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${adjMinutes}:${pad(adjSeconds)} ${unit === "imperial" ? "/mi" : "/km"}`;
}

/** Convenience: derive live avg pace (sec/meter) from running totals. */
export function calcAvgPaceSecPerMeter(
  activeDurationMs: number,
  distanceMeters: number
): number {
  if (distanceMeters <= 0) return 0;
  return activeDurationMs / 1000 / distanceMeters;
}

/** Human-readable date for history list, e.g. "Today", "Yesterday", "Sep 8". */
export function formatRunDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  const now = new Date();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}