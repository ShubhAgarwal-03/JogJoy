import { getRecentRuns } from "../../storage/runHistory";
import { loadInProgressRun } from "../../storage/runRecovery";
import { formatDistance, formatDuration, formatPace, formatRunDate } from "../formatters";
import { getUnitPreference } from "../../utils/unitPreference";
import { RunSummary } from "../../state/types";

export function renderHomeScreen(onOpenRun: (run: RunSummary) => void): void {
  const unit = getUnitPreference();
  const listEl = document.getElementById("recent-runs-list")!;
  const emptyEl = document.getElementById("recent-runs-empty")!;
  const runs = getRecentRuns(5);

  listEl.innerHTML = "";
  emptyEl.hidden = runs.length > 0;

  runs.forEach((run) => {
    const item = document.createElement("div");
    item.className = "run-list-item";
    item.innerHTML = `
      <div>
        <div class="run-list-date">${formatRunDate(run.finishedAt)}</div>
        <div class="run-list-distance">${formatDistance(run.distanceMeters, unit)}</div>
      </div>
      <div class="run-list-meta">
        ${formatDuration(run.activeDurationMs)}<br/>
        ${formatPace(run.avgPaceSecPerMeter, unit)}
      </div>
    `;
    item.addEventListener("click", () => onOpenRun(run));
    listEl.appendChild(item);
  });
}

export function renderRecoveryBanner(onResume: () => void, onDiscard: () => void): void {
  const banner = document.getElementById("recovery-banner")!;
  const saved = loadInProgressRun();
  banner.hidden = !saved;
  if (!saved) return;

  const resumeBtn = document.getElementById("btn-resume-recovered")!;
  const discardBtn = document.getElementById("btn-discard-recovered")!;

  resumeBtn.onclick = onResume;
  discardBtn.onclick = onDiscard;
}