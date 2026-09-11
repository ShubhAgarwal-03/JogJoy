import { RunSummary } from "../../state/types";
import { formatDistance, formatDuration, formatPace, formatRunDate } from "../formatters";
import { getUnitPreference } from "../../utils/unitPreference";
import { RouteMap } from "../../map/routeMap";

export function renderRunDetailScreen(run: RunSummary): void {
  const unit = getUnitPreference();

  document.getElementById("detail-date")!.textContent = formatRunDate(run.finishedAt);
  document.getElementById("detail-distance")!.textContent =
    formatDistance(run.distanceMeters, unit).split(" ")[0];
  document.getElementById("detail-distance-unit")!.textContent = unit === "imperial" ? "mi" : "km";
  document.getElementById("detail-duration")!.textContent = formatDuration(run.activeDurationMs);
  document.getElementById("detail-pace")!.textContent = formatPace(run.avgPaceSecPerMeter, unit);

  const map = new RouteMap("detail-map");
  if (run.routePoints.length > 0) map.setRoute(run.routePoints);
  requestAnimationFrame(() => map.invalidateSize());
}