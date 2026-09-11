import { describe, it, expect } from "vitest";
import { evaluatePoint } from "./pointFilter";
import { haversineMeters } from "./distanceCalc";
import { RunPoint } from "../state/types";

const point = (lat: number, lng: number, accuracy: number, timestamp: number): RunPoint => ({
  lat,
  lng,
  accuracy,
  timestamp,
});

describe("evaluatePoint", () => {
  it("accepts the first point unconditionally when there is no prior anchor", () => {
    const first = point(12.9716, 77.5946, 10, 1000);
    const result = evaluatePoint(first, null, haversineMeters);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.distanceDeltaMeters).toBe(0);
    }
  });

  it("rejects a point with poor accuracy", () => {
    const last = point(12.9716, 77.5946, 10, 1000);
    const bad = point(12.9717, 77.5946, 50, 2000); // accuracy 50m > 30m threshold
    const result = evaluatePoint(bad, last, haversineMeters);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason).toBe("poor_accuracy");
    }
  });

  it("accepts a plausible next point and reports correct distance", () => {
    const last = point(12.9716, 77.5946, 10, 1000);
    // ~11m north, 5 seconds later => ~2.2 m/s, well within running speed
    const next = point(12.97169, 77.5946, 10, 6000);
    const result = evaluatePoint(next, last, haversineMeters);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.distanceDeltaMeters).toBeGreaterThan(0);
      expect(result.distanceDeltaMeters).toBeLessThan(20);
    }
  });

  it("rejects a point implying an impossible speed (GPS jump)", () => {
    const last = point(12.9716, 77.5946, 10, 1000);
    // ~1km away but only 2 seconds later => impossible for a runner
    const jump = point(12.9806, 77.5946, 10, 3000);
    const result = evaluatePoint(jump, last, haversineMeters);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason).toBe("implausible_jump");
    }
  });

  it("marks a point as WEAK when accuracy is mediocre but still acceptable", () => {
    const last = point(12.9716, 77.5946, 10, 1000);
    const mediocre = point(12.97169, 77.5946, 25, 6000); // between WEAK and reject thresholds
    const result = evaluatePoint(mediocre, last, haversineMeters);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.gpsStatus).toBe("WEAK");
    }
  });

  it("handles duplicate timestamps without dividing by zero", () => {
    const last = point(12.9716, 77.5946, 10, 1000);
    const sameTime = point(12.9716, 77.5946, 10, 1000);
    expect(() => evaluatePoint(sameTime, last, haversineMeters)).not.toThrow();
  });
});