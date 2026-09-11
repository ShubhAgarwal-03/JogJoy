import { RunStateMachine } from "./state/runStateMachine";
import { GeolocationTracker } from "./tracking/geolocation";
import { evaluatePoint } from "./tracking/pointFilter";
import { haversineMeters } from "./tracking/distanceCalc";
import { DurationTimer } from "./tracking/durationTimer";
import {
  saveInProgressRun,
  loadInProgressRun,
  clearInProgressRun,
} from "./storage/runRecovery";
import { saveRunToHistory } from "./storage/runHistory";
import { RunPoint, RunSnapshot, RunSummary } from "./state/types";

const CALIBRATION_MAX_ACCURACY_METERS = 25;
const CALIBRATION_TIMEOUT_MS = 10000; // give up waiting and use best-so-far after this
const GPS_LOST_THRESHOLD_MS = 10000; // no accepted point for this long -> "LOST"

/**
 * The RunController is the single place that owns the lifecycle wiring:
 * state machine + GPS + timer + persistence. The UI layer only ever
 * talks to this class — it never touches GeolocationTracker, the state
 * machine, or storage directly.
 */
export class RunController {
  private stateMachine = new RunStateMachine();
  private geo = new GeolocationTracker();
  private timer = new DurationTimer();

  private calibrationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private bestCalibrationPoint: RunPoint | null = null;
  private lastAcceptedAt: number | null = null;
  private gpsWatchdogId: ReturnType<typeof setInterval> | null = null;

  private onPermissionDenied: (() => void) | null = null;

  constructor() {
    // Persist in-progress state on every change so a reload can recover it.
    this.stateMachine.onChange((snapshot) => {
      saveInProgressRun(snapshot);
    });
  }

  getSnapshot(): RunSnapshot {
    return this.stateMachine.getSnapshot();
  }

  onChange(listener: (snapshot: RunSnapshot) => void): () => void {
    return this.stateMachine.onChange(listener);
  }

  // --- App boot ---

  /** Call once on app load. Returns true if an in-progress run was restored. */
  tryRecoverInProgressRun(): boolean {
    const saved = loadInProgressRun();
    if (!saved) return false;

    this.stateMachine.restoreSnapshot(saved);

    // Resume GPS watching and the duration timer under the recovered state.
    this.startGeolocationWatch();
    if (saved.state === "RUNNING") {
      this.timer.start((deltaMs) => this.stateMachine.tickDuration(deltaMs));
    }
    this.startGpsWatchdog();
    return true;
  }

  // --- Start flow ---

  /**
   * Kicks off permission request + calibration. `onDenied` lets the UI
   * show the permission-denied state without this class knowing about the DOM.
   */
  startRun(onDenied: () => void): void {
    this.onPermissionDenied = onDenied;
    this.bestCalibrationPoint = null;
    this.stateMachine.startCalibrating();

    this.geo.requestPermissionAndStart(
      (point) => this.handleCalibrationPoint(point),
      () => this.handlePermissionError()
    );

    this.calibrationTimeoutId = setTimeout(() => {
      this.finishCalibration();
    }, CALIBRATION_TIMEOUT_MS);
  }

  private handlePermissionError(): void {
    this.geo.stop();
    if (this.calibrationTimeoutId) clearTimeout(this.calibrationTimeoutId);
    this.stateMachine.cancelCalibration();
    this.onPermissionDenied?.();
  }

  private handleCalibrationPoint(point: RunPoint): void {
    if (this.stateMachine.getSnapshot().state !== "CALIBRATING") {
      // Calibration already finished (or user cancelled); ignore late callbacks.
      return;
    }

    // Track best-accuracy point seen so far in case we hit the timeout
    // without ever reaching the "acceptable" threshold.
    if (
      !this.bestCalibrationPoint ||
      point.accuracy < this.bestCalibrationPoint.accuracy
    ) {
      this.bestCalibrationPoint = point;
    }

    if (point.accuracy <= CALIBRATION_MAX_ACCURACY_METERS) {
      this.finishCalibration(point);
    }
  }

  private finishCalibration(forcedPoint?: RunPoint): void {
    if (this.stateMachine.getSnapshot().state !== "CALIBRATING") return;
    if (this.calibrationTimeoutId) clearTimeout(this.calibrationTimeoutId);

    const anchor = forcedPoint ?? this.bestCalibrationPoint;
    if (!anchor) {
      // No fix at all within the timeout — treat like a denied/failed start.
      this.geo.stop();
      this.stateMachine.cancelCalibration();
      this.onPermissionDenied?.();
      return;
    }

    this.lastAcceptedAt = Date.now();
    this.stateMachine.beginRunning(anchor);
    this.timer.start((deltaMs) => this.stateMachine.tickDuration(deltaMs));
    this.startGpsWatchdog();
  }

  /** Called by the geolocation watch for every raw point once RUNNING/PAUSED. */
  private handleGpsPoint(point: RunPoint): void {
    const snapshot = this.stateMachine.getSnapshot();
    if (snapshot.state !== "RUNNING") return; // ignore points while paused/idle

    const result = evaluatePoint(point, snapshot.lastAcceptedPoint, haversineMeters);

    if (!result.accepted) {
      // Poor accuracy or implausible jump — don't accrue distance, but
      // still let the watchdog know we're alive if accuracy was just weak.
      return;
    }

    this.lastAcceptedAt = Date.now();
    this.stateMachine.setGpsStatus(result.gpsStatus);
    this.stateMachine.acceptPoint(point, result.distanceDeltaMeters);
  }

  private startGeolocationWatch(): void {
    if (this.geo.isActive()) return;
    this.geo.requestPermissionAndStart(
      (point) => this.handleGpsPoint(point),
      () => {
        /* mid-run errors are treated as GPS loss, not a hard failure */
      }
    );
  }

  private startGpsWatchdog(): void {
    if (this.gpsWatchdogId) return;
    this.gpsWatchdogId = setInterval(() => {
      const snapshot = this.stateMachine.getSnapshot();
      if (snapshot.state !== "RUNNING") return;
      const elapsedSinceLastAccepted =
        Date.now() - (this.lastAcceptedAt ?? Date.now());
      if (elapsedSinceLastAccepted > GPS_LOST_THRESHOLD_MS) {
        this.stateMachine.setGpsStatus("LOST");
      }
    }, 2000);
  }

  private stopGpsWatchdog(): void {
    if (this.gpsWatchdogId) {
      clearInterval(this.gpsWatchdogId);
      this.gpsWatchdogId = null;
    }
  }

  // --- Pause / Resume ---

  pause(): void {
    this.stateMachine.pause();
    this.timer.stop();
    // Keep the GPS watch alive (for a faster resume) but points are
    // ignored by handleGpsPoint's state check above.
  }

  resume(): void {
    this.stateMachine.resume();
    this.lastAcceptedAt = Date.now(); // avoid an immediate false "GPS lost"
    this.timer.start((deltaMs) => this.stateMachine.tickDuration(deltaMs));
  }

  // --- Finish ---

  finish(): RunSummary {
    const snapshot = this.stateMachine.getSnapshot();

    this.timer.stop();
    this.stopGpsWatchdog();
    this.geo.stop();

    this.stateMachine.finish();
    clearInProgressRun();

    const summary: RunSummary = {
      id: `run_${Date.now()}`,
      startedAt: snapshot.startedAt ?? Date.now(),
      finishedAt: Date.now(),
      distanceMeters: snapshot.totalDistanceMeters,
      activeDurationMs: snapshot.activeDurationMs,
      avgPaceSecPerMeter:
        snapshot.totalDistanceMeters > 0
          ? snapshot.activeDurationMs / 1000 / snapshot.totalDistanceMeters
          : 0,
      routePoints: snapshot.routePoints,
    };

    saveRunToHistory(summary);
    return summary;
  }

  /** Called after viewing the summary, to go back to a fresh IDLE state. */
  startNewRun(): void {
    this.stateMachine.reset();
  }
}

// =========================================================================
// DOM bootstrap: connects RunController to the screens in index.html.
// Nothing above this line knows the DOM exists; nothing below computes
// distance/duration/pace itself — it only renders what the controller gives it.
// =========================================================================

import { renderHomeScreen, renderRecoveryBanner } from "./ui/screens/homeScreen";
import { renderRunScreen, initRunMap, destroyRunMap } from "./ui/screens/runScreen";
import { renderSummaryScreen } from "./ui/screens/summaryScreen";
import { renderRunDetailScreen } from "./ui/screens/runDetailScreen";
import { renderGpsStatus } from "./ui/components/gpsStatusBadge";
import { showFinishConfirm } from "./ui/components/confirmDialog";
import { hidePermissionError } from "./ui/components/permissionPrompt";
import { getUnitPreference } from "./utils/unitPreference";
import { applyThemePreference, getThemePreference, setThemePreference } from "./utils/themePreference";

const controller = new RunController();
applyThemePreference();

const screens = [
  "screen-home", "screen-calibrating", "screen-permission-error",
  "screen-run", "screen-summary", "screen-run-detail",
] as const;
type ScreenId = typeof screens[number];

function showScreen(id: ScreenId) {
  screens.forEach((s) => {
    document.getElementById(s)!.hidden = s !== id;
  });
}

function isScreenVisible(id: ScreenId): boolean {
  return document.getElementById(id)!.hidden === false;
}

// --- Single source of truth for reacting to state changes ---
// Runs on every RunStateMachine change: updates the GPS pill, re-renders
// the run screen while live, and catches the CALIBRATING -> RUNNING
// transition to swap screens and mount the map exactly once.
controller.onChange((snapshot) => {
  renderGpsStatus(snapshot);

  if (snapshot.state === "RUNNING" || snapshot.state === "PAUSED") {
    if (!isScreenVisible("screen-run")) {
      showScreen("screen-run");
      initRunMap();
    }
    renderRunScreen(snapshot);
  }
});

// --- Home screen ---
function goHome() {
  showScreen("screen-home");
  renderHomeScreen((run) => openRunDetail(run));
  renderRecoveryBanner(
    () => resumeRecoveredRun(),
    () => {
      clearInProgressRun();
      renderRecoveryBanner(() => {}, () => {});
    }
  );
}

function resumeRecoveredRun() {
  const restored = controller.tryRecoverInProgressRun();
  if (!restored) return;
  showScreen("screen-run");
  initRunMap();
  renderRunScreen(controller.getSnapshot());
}

function openRunDetail(run: RunSummary) {
  showScreen("screen-run-detail");
  renderRunDetailScreen(run);
}

document.getElementById("btn-back-to-home")!.addEventListener("click", goHome);

// --- Start flow ---
document.getElementById("btn-start-run")!.addEventListener("click", () => {
  showScreen("screen-calibrating");
  controller.startRun(() => showScreen("screen-permission-error"));
});

document.getElementById("btn-cancel-calibration")!.addEventListener("click", () => {
  goHome();
});

document.getElementById("btn-retry-permission")!.addEventListener("click", () => {
  hidePermissionError();
  showScreen("screen-calibrating");
  controller.startRun(() => showScreen("screen-permission-error"));
});

// --- Pause / Resume ---
document.getElementById("btn-pause-resume")!.addEventListener("click", () => {
  const state = controller.getSnapshot().state;
  if (state === "RUNNING") controller.pause();
  else if (state === "PAUSED") controller.resume();
});

// --- Finish ---
document.getElementById("btn-finish-run")!.addEventListener("click", () => {
  const snapshot = controller.getSnapshot();
  showFinishConfirm(
    snapshot.totalDistanceMeters,
    snapshot.activeDurationMs,
    getUnitPreference(),
    () => {
      const summary = controller.finish();
      destroyRunMap();
      showScreen("screen-summary");
      renderSummaryScreen(summary);
    },
    () => { /* cancelled, stay on run screen */ }
  );
});

// --- New run from summary ---
document.getElementById("btn-new-run")!.addEventListener("click", () => {
  controller.startNewRun();
  goHome();
});

// --- Theme toggle ---
document.getElementById("btn-theme-toggle")!.addEventListener("click", () => {
  const next = getThemePreference() === "dark" ? "auto" : "dark";
  setThemePreference(next);
});

// --- Boot ---
const wasRecovered = controller.tryRecoverInProgressRun();
if (wasRecovered) {
  showScreen("screen-run");
  initRunMap();
  renderRunScreen(controller.getSnapshot());
} else {
  goHome();
}