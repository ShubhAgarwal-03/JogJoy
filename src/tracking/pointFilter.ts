import { RunPoint } from "../state/types";

const MAX_ACCEPTABLE_ACCURACY_METERS = 30;
const MAX_PLAUSIBLE_SPEED_MPS = 7; // ~25 km/h, generous ceiling for a runner
const GPS_WEAK_ACCURACY_METERS = 20; // between GOOD and outright rejection

export type FilterResult =
  | { accepted: true; distanceDeltaMeters: number; gpsStatus: "GOOD" | "WEAK" }
  | { accepted: false; reason: "poor_accuracy" | "implausible_jump" };

/**
 * Decides whether a raw GPS point should be accepted into the route,
 * and if so, how much distance it adds relative to the last accepted point.
 * Pure function — no side effects, easy to unit test.
 */
export function evaluatePoint(
  candidate: RunPoint,
  lastAccepted: RunPoint | null,
  haversineMeters: (a: RunPoint, b: RunPoint) => number
): FilterResult {
  if (candidate.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return { accepted: false, reason: "poor_accuracy" };
  }

  // No prior anchor (first point after start/resume) — accept unconditionally,
  // it becomes the new anchor with zero distance added.
  if (!lastAccepted) {
    return {
      accepted: true,
      distanceDeltaMeters: 0,
      gpsStatus: candidate.accuracy > GPS_WEAK_ACCURACY_METERS ? "WEAK" : "GOOD",
    };
  }

  const distance = haversineMeters(lastAccepted, candidate);
  const elapsedSec = Math.max(
    (candidate.timestamp - lastAccepted.timestamp) / 1000,
    0.001 // avoid div-by-zero on duplicate timestamps
  );
  const impliedSpeed = distance / elapsedSec;

  if (impliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
    return { accepted: false, reason: "implausible_jump" };
  }

  return {
    accepted: true,
    distanceDeltaMeters: distance,
    gpsStatus: candidate.accuracy > GPS_WEAK_ACCURACY_METERS ? "WEAK" : "GOOD",
  };
}