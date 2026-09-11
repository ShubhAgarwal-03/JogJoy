export type RunState =
  | "IDLE"
  | "CALIBRATING"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface RunPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number; // epoch ms
}

export interface RunSnapshot {
  state: RunState;
  routePoints: RunPoint[];       // all accepted points, in order
  totalDistanceMeters: number;
  activeDurationMs: number;
  lastAcceptedPoint: RunPoint | null;
  gpsStatus: "GOOD" | "WEAK" | "LOST";
  startedAt: number | null;      // epoch ms, set once on first RUNNING
}

export interface RunSummary {
  id: string;
  startedAt: number;
  finishedAt: number;
  distanceMeters: number;
  activeDurationMs: number;
  avgPaceSecPerMeter: number; // store raw, format at display time
  routePoints: RunPoint[];
}