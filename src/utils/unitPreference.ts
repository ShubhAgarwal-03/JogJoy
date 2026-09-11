export type UnitSystem = "metric" | "imperial";

const UNIT_KEY = "plexqo_unit_preference";

export function getUnitPreference(): UnitSystem {
  const stored = localStorage.getItem(UNIT_KEY);
  return stored === "imperial" ? "imperial" : "metric"; // default metric
}

export function setUnitPreference(unit: UnitSystem): void {
  localStorage.setItem(UNIT_KEY, unit);
}