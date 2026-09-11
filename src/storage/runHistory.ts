import { RunSummary } from "../state/types";

const HISTORY_KEY = "plexqo_run_history";
const MAX_STORED_RUNS = 50; // simple cap so localStorage doesn't grow unbounded

export function saveRunToHistory(run: RunSummary): void {
  const existing = getAllRuns();
  const updated = [run, ...existing].slice(0, MAX_STORED_RUNS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function getAllRuns(): RunSummary[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RunSummary[];
  } catch {
    // Corrupt data shouldn't crash the app — treat as empty history.
    return [];
  }
}

export function getRunById(id: string): RunSummary | null {
  return getAllRuns().find((r) => r.id === id) ?? null;
}

export function getRecentRuns(limit = 5): RunSummary[] {
  return getAllRuns().slice(0, limit);
}