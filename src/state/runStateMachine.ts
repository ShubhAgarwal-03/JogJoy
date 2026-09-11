import { RunState, RunSnapshot, RunPoint } from "./types";

type Listener = (snapshot: RunSnapshot) => void;

/**
 * Owns the run lifecycle. Never touches the DOM or the GPS API directly —
 * other modules feed it data (accepted points, ticks) and it enforces
 * valid transitions + invariants (e.g. no distance/duration growth outside RUNNING).
 */
export class RunStateMachine {
  private snapshot: RunSnapshot = {
    state: "IDLE",
    routePoints: [],
    totalDistanceMeters: 0,
    activeDurationMs: 0,
    lastAcceptedPoint: null,
    gpsStatus: "LOST",
    startedAt: null,
  };

  private listeners: Listener[] = [];

  getSnapshot(): RunSnapshot {
    // shallow-cloned so external code can't mutate internal state directly
    return { ...this.snapshot, routePoints: [...this.snapshot.routePoints] };
  }

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }

  private canTransition(to: RunState): boolean {
    const from = this.snapshot.state;
    const allowed: Record<RunState, RunState[]> = {
      IDLE: ["CALIBRATING"],
      CALIBRATING: ["RUNNING", "IDLE"], // IDLE = user cancels / permission denied
      RUNNING: ["PAUSED", "FINISHED"],
      PAUSED: ["RUNNING", "FINISHED"],
      FINISHED: ["IDLE"], // starting a new run resets to IDLE first
    };
    return allowed[from].includes(to);
  }

  private setState(to: RunState) {
    if (!this.canTransition(to)) {
      throw new Error(`Invalid transition: ${this.snapshot.state} -> ${to}`);
    }
    this.snapshot.state = to;
  }

  // --- Public transitions ---

  startCalibrating() {
    this.setState("CALIBRATING");
    this.emit();
  }

  /** Called once calibration finds an acceptable first fix. */
  beginRunning(anchorPoint: RunPoint) {
    this.setState("RUNNING");
    this.snapshot.startedAt = anchorPoint.timestamp;
    this.snapshot.lastAcceptedPoint = anchorPoint;
    this.snapshot.routePoints = [anchorPoint];
    this.emit();
  }

  cancelCalibration() {
    this.setState("IDLE");
    this.emit();
  }

  pause() {
    this.setState("PAUSED");
    // Clear the anchor so resume doesn't connect a huge "phantom" segment
    // across the paused gap.
    this.snapshot.lastAcceptedPoint = null;
    this.emit();
  }

  resume() {
    this.setState("RUNNING");
    // lastAcceptedPoint stays null until the next accepted GPS point arrives;
    // that point becomes the new anchor with no distance added for the gap.
    this.emit();
  }

  finish() {
    this.setState("FINISHED");
    this.emit();
  }

  /** Reset to IDLE, e.g. after viewing summary and starting a new run. */
  reset() {
    this.snapshot = {
      state: "IDLE",
      routePoints: [],
      totalDistanceMeters: 0,
      activeDurationMs: 0,
      lastAcceptedPoint: null,
      gpsStatus: "LOST",
      startedAt: null,
    };
    this.emit();
  }

  // --- Data feeds (called by tracking/timer modules) ---

  /** Called with a newly accepted (already filtered) GPS point. */
  acceptPoint(point: RunPoint, distanceDeltaMeters: number) {
    if (this.snapshot.state !== "RUNNING") return; // never accrue while paused/idle
    this.snapshot.routePoints.push(point);
    this.snapshot.totalDistanceMeters += distanceDeltaMeters;
    this.snapshot.lastAcceptedPoint = point;
    this.snapshot.gpsStatus = "GOOD";
    this.emit();
  }

  setGpsStatus(status: RunSnapshot["gpsStatus"]) {
    if (this.snapshot.gpsStatus === status) return;
    this.snapshot.gpsStatus = status;
    this.emit();
  }

  /** Called every ~1s by durationTimer while RUNNING. */
  tickDuration(deltaMs: number) {
    if (this.snapshot.state !== "RUNNING") return;
    this.snapshot.activeDurationMs += deltaMs;
    this.emit();
  }

  /** Used by recovery to restore a saved in-progress run without re-validating transitions. */
  restoreSnapshot(snapshot: RunSnapshot) {
    this.snapshot = { ...snapshot };
    this.emit();
  }
}