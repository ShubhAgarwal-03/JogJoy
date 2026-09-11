import { RunSnapshot } from "../state/types";

const RECOVERY_KEY = "plexqo_run_in_progress";

/** Persists the in-progress run so a reload/close mid-run can be restored. */
export function saveInProgressRun(snapshot: RunSnapshot): void {
  // Only ever persist while there's something meaningful to recover.
  if (snapshot.state !== "RUNNING" && snapshot.state !== "PAUSED") {
    clearInProgressRun();
    return;
  }
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(snapshot));
}

export function loadInProgressRun(): RunSnapshot | null {
  const raw = localStorage.getItem(RECOVERY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RunSnapshot;
  } catch {
    return null;
  }
}

export function clearInProgressRun(): void {
  localStorage.removeItem(RECOVERY_KEY);
}