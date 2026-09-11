import { RunSnapshot } from "../../state/types";

const labels: Record<RunSnapshot["gpsStatus"], string> = {
  GOOD: "GPS Good",
  WEAK: "GPS Weak",
  LOST: "GPS Lost",
};

export function renderGpsStatus(snapshot: RunSnapshot): void {
  const pill = document.getElementById("gps-status");
  const dot = pill?.querySelector(".gps-dot");
  const label = pill?.querySelector(".gps-label");
  if (!pill || !dot || !label) return;

  const show = snapshot.state === "RUNNING" || snapshot.state === "PAUSED";
  pill.hidden = !show;
  if (!show) return;

  dot.setAttribute("data-status", snapshot.gpsStatus);
  label.textContent = labels[snapshot.gpsStatus];
}