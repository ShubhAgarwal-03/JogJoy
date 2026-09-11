import { RunSummary } from "../../state/types";
import { formatDistance, formatDuration, formatPace } from "../formatters";
import { getUnitPreference } from "../../utils/unitPreference";
import { RouteMap } from "../../map/routeMap";

export function renderSummaryScreen(run: RunSummary): void {
  const unit = getUnitPreference();

  document.getElementById("summary-distance")!.textContent =
    formatDistance(run.distanceMeters, unit).split(" ")[0];
  document.getElementById("summary-distance-unit")!.textContent = unit === "imperial" ? "mi" : "km";
  document.getElementById("summary-duration")!.textContent = formatDuration(run.activeDurationMs);
  document.getElementById("summary-pace")!.textContent = formatPace(run.avgPaceSecPerMeter, unit);

  // Fresh map instance each time — summary is entered once per finished run.
  const map = new RouteMap("summary-map");
  if (run.routePoints.length > 0) map.setRoute(run.routePoints);
  requestAnimationFrame(() => map.invalidateSize());
}