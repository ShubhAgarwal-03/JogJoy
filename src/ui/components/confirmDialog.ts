import { formatDistance, formatDuration } from "../formatters";
import { UnitSystem } from "../../utils/unitPreference";

export function showFinishConfirm(
  distanceMeters: number,
  durationMs: number,
  unit: UnitSystem,
  onConfirm: () => void,
  onCancel: () => void
): void {
  const sheet = document.getElementById("finish-confirm") as HTMLElement;
  const distanceEl = document.getElementById("confirm-distance")!;
  const durationEl = document.getElementById("confirm-duration")!;
  const confirmBtn = document.getElementById("btn-confirm-finish")!;
  const cancelBtn = document.getElementById("btn-confirm-cancel")!;

  distanceEl.textContent = formatDistance(distanceMeters, unit);
  durationEl.textContent = formatDuration(durationMs);
  sheet.hidden = false;

  const cleanup = () => {
    sheet.hidden = true;
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };
  const handleConfirm = () => { cleanup(); onConfirm(); };
  const handleCancel = () => { cleanup(); onCancel(); };

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);
}