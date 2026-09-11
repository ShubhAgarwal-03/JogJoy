import { RunSnapshot } from "../../state/types";
import { formatDistance, formatDuration, formatPace, calcAvgPaceSecPerMeter } from "../formatters";
import { getUnitPreference } from "../../utils/unitPreference";
import { RouteMap } from "../../map/routeMap";

let mapInstance: RouteMap | null = null;

export function initRunMap(): RouteMap {
  if (!mapInstance) mapInstance = new RouteMap("run-map");
  return mapInstance;
}

export function destroyRunMap(): void {
  mapInstance?.destroy();
  mapInstance = null;
}

export function renderRunScreen(snapshot: RunSnapshot): void {
  const unit = getUnitPreference();

  document.getElementById("run-distance")!.textContent =
    formatDistance(snapshot.totalDistanceMeters, unit).split(" ")[0];
  document.getElementById("run-distance-unit")!.textContent = unit === "imperial" ? "mi" : "km";

  document.getElementById("run-duration")!.textContent = formatDuration(snapshot.activeDurationMs);

  const pace = calcAvgPaceSecPerMeter(snapshot.activeDurationMs, snapshot.totalDistanceMeters);
  document.getElementById("run-pace")!.textContent = formatPace(pace, unit);

  const badge = document.getElementById("run-status-badge")!;
  badge.setAttribute("data-state", snapshot.state);
  badge.textContent = snapshot.state === "PAUSED" ? "Paused" : "Active";

  const pauseBtn = document.getElementById("btn-pause-resume")!;
  pauseBtn.textContent = snapshot.state === "PAUSED" ? "Resume" : "Pause";

  if (mapInstance && snapshot.routePoints.length > 0) {
    mapInstance.setRoute(snapshot.routePoints);
  }
}