import { describe, it, expect } from "vitest";
import {
  formatDistance,
  formatDuration,
  formatPace,
  calcAvgPaceSecPerMeter,
  formatRunDate,
} from "./formatters";

describe("formatDistance", () => {
  it("formats metric correctly", () => {
    expect(formatDistance(5240, "metric")).toBe("5.24 km");
  });
  it("formats imperial correctly", () => {
    expect(formatDistance(5000, "imperial")).toBe("3.11 mi");
  });
});

describe("formatDuration", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatDuration(31 * 60 * 1000 + 48 * 1000)).toBe("31:48");
  });
  it("formats over an hour as h:mm:ss", () => {
    expect(formatDuration(65 * 60 * 1000 + 12 * 1000)).toBe("1:05:12");
  });
  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("formatPace", () => {
  it("formats a realistic running pace in metric", () => {
    // 6:04/km => 364 sec/km => 0.364 sec/m
    const secPerMeter = 364 / 1000;
    expect(formatPace(secPerMeter, "metric")).toBe("6:04 /km");
  });

  it("returns placeholder for zero distance", () => {
    expect(formatPace(0, "metric")).toBe("--:-- /km");
  });

  it("handles rounding up to the next minute correctly", () => {
    // Construct a value that rounds seconds to exactly 60
    const secPerMeter = 359.6 / 1000; // 5:59.6/km -> rounds to 6:00
    expect(formatPace(secPerMeter, "metric")).toBe("6:00 /km");
  });
});

describe("calcAvgPaceSecPerMeter", () => {
  it("returns 0 when distance is 0 to avoid divide-by-zero", () => {
    expect(calcAvgPaceSecPerMeter(60000, 0)).toBe(0);
  });
  it("computes correctly for normal values", () => {
    // 10 min for 1000m => 0.6 sec/m
    expect(calcAvgPaceSecPerMeter(600000, 1000)).toBeCloseTo(0.6, 5);
  });
});

describe("formatRunDate", () => {
  it("labels today's date as 'Today'", () => {
    expect(formatRunDate(Date.now())).toBe("Today");
  });
  it("labels yesterday's date as 'Yesterday'", () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    expect(formatRunDate(yesterday)).toBe("Yesterday");
  });
});