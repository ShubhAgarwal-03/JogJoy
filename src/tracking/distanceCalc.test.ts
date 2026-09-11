import { describe, it, expect } from "vitest";
import { haversineMeters } from "./distanceCalc";
import { RunPoint } from "../state/types";

const point = (lat: number, lng: number, t = 0): RunPoint => ({
  lat,
  lng,
  accuracy: 5,
  timestamp: t,
});

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    const p = point(12.9716, 77.5946);
    expect(haversineMeters(p, p)).toBeCloseTo(0, 5);
  });

  it("returns a known distance between two real-world coordinates", () => {
    // Bengaluru city center to Kempegowda Intl Airport, ~35km apart (approx)
    const bengaluru = point(12.9716, 77.5946);
    const airport = point(13.1986, 77.7066);
    const distance = haversineMeters(bengaluru, airport);
    expect(distance).toBeGreaterThan(30000);
    expect(distance).toBeLessThan(40000);
  });

  it("is symmetric (A->B equals B->A)", () => {
    const a = point(12.9716, 77.5946);
    const b = point(12.9720, 77.5950);
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 8);
  });

  it("scales roughly linearly for small consecutive steps", () => {
    // ~0.0001 deg lat ≈ 11m; two equal steps should ≈ double one step
    const a = point(12.9716, 77.5946);
    const b = point(12.9717, 77.5946);
    const c = point(12.9718, 77.5946);
    const oneStep = haversineMeters(a, b);
    const twoSteps = haversineMeters(a, c);
    expect(twoSteps).toBeCloseTo(oneStep * 2, 0);
  });
});